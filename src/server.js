// The HTTP surface. OpenAI wire in, OpenAI wire out. No dialect, no auth
// layer beyond an optional local token, no tenancy.
import http from "node:http";

import { analyze } from "./classify.js";
import { enhanceBody, cleanOutputText } from "./enhance.js";
import { route, RouteError, routeErrorBody } from "./router.js";
import { catalog, CATEGORIES, resolveProviders } from "./registry.js";
import { relayStream, relayOnce, RelayError, relayErrorPayload, getCachedResponse, setCachedResponse } from "./relay.js";
import { VERSION } from "./config.js";
import { resetAllCircuits } from "./resilience.js";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, x-api-key",
  "access-control-max-age": "86400",
};

function sendJson(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...CORS,
    ...extra,
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const err = new Error("request body too large");
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authorized(req, cfg) {
  if (!cfg.token) return true;
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  const key = bearer?.[1] || req.headers["x-api-key"];
  return key === cfg.token;
}

function isLoopback(host) {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

export function createServer({ cfg, providers, log = () => {} }) {
  resetAllCircuits();
  // Pre-compute catalog once (providers don't change during server lifetime).
  const cachedCatalog = catalog(providers);
  const cachedHealthz = {
    status: "ok",
    version: VERSION,
    enhance: cfg.enhance,
    race: cfg.race,
    best_of: cfg.bestOf,
    providers: providers.map((p) => ({
      id: p.id,
      enabled: p.enabled,
      keyless: p.keyless,
      has_key: p.hasKey,
      models: p.models.map((m) => ({
        id: m.id,
        enabled: m.enabled !== false,
        tools: !!m.tools,
        vision: !!m.vision,
        context: m.context,
      })),
    })),
  };

  return http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url || "/", "http://a0.local");

    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS);
        res.end();
        return;
      }

      if (url.pathname === "/healthz" || url.pathname === "/v1/health") {
        sendJson(res, 200, { ...cachedHealthz, uptime_s: Math.round(process.uptime()) });
        return;
      }

      if (url.pathname === "/" && req.method === "GET") {
        sendJson(res, 200, {
          name: "a0",
          version: VERSION,
          endpoint: "/v1",
          categories: CATEGORIES.map((c) => c.id),
          hint: "point any OpenAI client at this server's /v1",
        });
        return;
      }

      if (url.pathname === "/v1/models" && req.method === "GET") {
        sendJson(res, 200, cachedCatalog);
        return;
      }

      if (url.pathname !== "/v1/chat/completions" || req.method !== "POST") {
        sendJson(res, 404, { error: { message: "not found", type: "invalid_request_error", code: "not_found" } });
        return;
      }

      if (!authorized(req, cfg)) {
        sendJson(
          res,
          401,
          { error: { message: "invalid a0 token", type: "authentication_error", code: "invalid_token" } },
          { "www-authenticate": "Bearer" },
        );
        return;
      }

      const raw = await readBody(req, cfg.maxBodyBytes);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: { message: "invalid JSON body", type: "invalid_request_error", code: "invalid_json" } });
        return;
      }
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        sendJson(res, 400, {
          error: { message: "messages must be a non-empty array", type: "invalid_request_error", code: "invalid_messages" },
        });
        return;
      }

      const analysis = analyze(body);
      let plan;
      try {
        plan = route(body, analysis, providers, cfg);
      } catch (err) {
        if (err instanceof RouteError) {
          sendJson(res, err.status, routeErrorBody(err));
          return;
        }
        throw err;
      }

      // Check cache for non-stream identical requests
      if (!body.stream && body.messages) {
        const cached = getCachedResponse(body);
        if (cached) {
          sendJson(res, 200, cached, { "x-a0-cached": "true", "access-control-allow-origin": "*" });
          return;
        }
      }
      const enhanced = enhanceBody(body, analysis, cfg);
      const clientAbort = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) clientAbort.abort();
      });

      const onEvent = (event) => {
        log({
          ts: new Date().toISOString(),
          path: url.pathname,
          category: plan.category,
          provider: event.provider,
          model: event.model,
          status: event.status,
          ms: event.latencyMs,
          in_tok: event.inTok,
          out_tok: event.outTok,
          stream: Boolean(body.stream),
          degraded: plan.degraded,
          error: event.error,
        });
      };

      const extra = {
        "x-a0-category": plan.category,
        "x-a0-degraded": String(plan.degraded),
        "x-a0-enhanced": String(Boolean(cfg.enhance)),
      };

      if (body.stream) {
        // Headers set here survive relayStream's writeHead merge.
        for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
        res.setHeader("access-control-allow-origin", "*");
        try {
          await relayStream({
            cfg,
            body: enhanced,
            candidates: plan.candidates,
            res,
            signal: clientAbort.signal,
            onEvent,
          });
        } catch (err) {
          if (res.headersSent) return;
          const e = err instanceof RelayError ? err : new RelayError("stream_error", err.message);
          sendJson(res, e.status || 502, relayErrorPayload(e), extra);
        }
        return;
      }

      try {
        const result = await relayOnce({
          cfg,
          body: enhanced,
          candidates: plan.candidates,
          signal: clientAbort.signal,
          onEvent,
        });
        if (cfg.cleanOutput) {
          for (const choice of result.json.choices || []) {
            if (choice?.message && typeof choice.message.content === "string") {
              choice.message.content = cleanOutputText(choice.message.content, cfg);
            }
          }
        }
        sendJson(res, 200, result.json, {
          ...extra,
          "x-a0-provider": result.provider,
          "x-a0-model": encodeURIComponent(result.model),
          "x-a0-latency-ms": String(result.latencyMs),
        });
        // Cache the response
        setCachedResponse(body, result.json);
      } catch (err) {
        const e = err instanceof RelayError ? err : new RelayError("upstream_error", err.message);
        sendJson(res, e.status || 502, relayErrorPayload(e), extra);
      }
    } catch (err) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const status = err.status || 500;
      sendJson(res, status, {
        error: { message: err.message || "internal error", type: "a0_error", code: status === 413 ? "body_too_large" : "internal" },
      });
      log({ ts: new Date().toISOString(), path: url.pathname, status, ms: Date.now() - started, error: err.message });
    }
  });
}

export function resolveBind(cfg) {
  return { host: cfg.host || "127.0.0.1", port: cfg.port || 8082, loopback: isLoopback(cfg.host || "127.0.0.1") };
}
