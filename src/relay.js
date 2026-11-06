// The relay. Two things make it different from a plain proxy:
//   1. race — dispatch to several lanes at once and commit to the first
//      usable first byte, so a slow or dead free lane never stalls a session;
//   2. best-of — for non-stream calls, collect several answers and keep the
//      best one by a small deterministic rubric.
// Everything is bounded: attempts, time, and bytes.

export const DEFAULT_SSE = "text/event-stream; charset=utf-8";

import { agentFor } from "./config.js";

export class RelayError extends Error {
  constructor(code, message, attempts = [], status = 502) {
    super(message);
    this.code = code;
    this.attempts = attempts;
    this.status = status;
  }
}

function headersFor(c, cfg) {
  const h = { "content-type": "application/json" };
  if (c.provider.key) h.authorization = `Bearer ${c.provider.key}`;
  if (c.provider.headers && typeof c.provider.headers === "object") Object.assign(h, c.provider.headers);
  if (c.provider.id === "openrouter") {
    h["http-referer"] = "https://github.com/NaveenSingh9999/a0";
    h["x-title"] = "a0";
  }
  return h;
}

function payloadFor(c, body) {
  const out = { ...body, model: c.model.id };
  delete out.a0;
  return out;
}

function endpoint(p) {
  return `${p.baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function timed(ms, fn, onTimeout) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        /* ignore */
      }
      reject(new Error(`timeout after ${ms}ms`));
    }, ms);
    fn().then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function readFirst(reader, ms) {
  return timed(ms, () => reader.read(), () => reader.cancel().catch(() => {}));
}

/** One streaming attempt. Resolves only after a valid first byte. */
async function openStream(c, body, cfg, signal) {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  if (signal) signal.addEventListener("abort", onAbort, { once: true });

  const timer = setTimeout(() => ac.abort(), cfg.requestTimeoutMs);
  let reader;
  try {
    const r = await fetch(endpoint(c.provider), {
      method: "POST",
      headers: headersFor(c, cfg),
      body: JSON.stringify(payloadFor(c, body)),
      signal: ac.signal,
      agent: agentFor(endpoint(c.provider)),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} ${detail.slice(0, 240)}`);
    }
    if (!r.body) throw new Error("upstream returned no body");
    reader = r.body.getReader();
    const first = await readFirst(reader, cfg.firstByteTimeoutMs);
    if (first.done || !first.value || first.value.length === 0) throw new Error("empty first byte");
    clearTimeout(timer);
    return {
      c,
      ac,
      reader,
      first: first.value,
      contentType: r.headers.get("content-type") || DEFAULT_SSE,
      cleanup() {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
      },
    };
  } catch (err) {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
    ac.abort();
    throw err;
  }
}

/** One non-stream attempt. */
async function callOnce(c, body, cfg, signal) {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
  try {
    const r = await timed(
      cfg.requestTimeoutMs,
      () =>
        fetch(endpoint(c.provider), {
          method: "POST",
          headers: headersFor(c, cfg),
          body: JSON.stringify(payloadFor(c, body)),
          signal: ac.signal,
          agent: agentFor(endpoint(c.provider)),
        }),
      () => ac.abort(),
    );
    const raw = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${raw.slice(0, 240)}`);
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error("upstream returned invalid JSON");
    }
    if (!Array.isArray(json.choices) || json.choices.length === 0) throw new Error("upstream returned no choices");
    return { c, json };
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

function rubric(json) {
  const choice = json.choices?.[0] || {};
  const msg = choice.message || {};
  const text = typeof msg.content === "string" ? msg.content : "";
  let s = 0;
  if (text) s += 10;
  if (/```/.test(text)) s += 5;
  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) s += 8;
  if (choice.finish_reason === "length") s -= 5;
  if (/^(I can't|I cannot|As an AI|I'm sorry, but)/i.test(text.trim())) s -= 12;
  s += Math.min(text.length / 500, 5);
  return s;
}

function attemptName(c) {
  return `${c.provider.id}:${c.model.id}`;
}

async function raceOpen(list, body, cfg, signal) {
  const handles = list.map((c) => ({ c, ac: new AbortController() }));
  const failures = [];
  const attempts = handles.map((h) =>
    openStream(h.c, body, cfg, signal).then(
      (win) => {
        for (const other of handles) if (other !== h) other.ac.abort();
        win.ac = h.ac;
        return win;
      },
      (err) => {
        failures.push(`${attemptName(h.c)} (${err.message})`);
        throw err;
      },
    ),
  );
  try {
    return await Promise.any(attempts);
  } catch {
    throw new RelayError("all_lanes_failed", "every lane in the race failed", failures);
  }
}

async function firstOpen(list, body, cfg, signal) {
  const failures = [];
  for (const c of list) {
    try {
      return await openStream(c, body, cfg, signal);
    } catch (err) {
      failures.push(`${attemptName(c)} (${err.message})`);
    }
  }
  throw new RelayError("all_lanes_failed", "every lane failed", failures);
}

/** Stream a chat completion to the client. Returns {provider, model, attempts}. */
export async function relayStream({ cfg, body, candidates, res, signal, onEvent }) {
  const list = candidates.slice(0, Math.max(1, cfg.maxAttempts));
  const n = Math.max(1, Math.min(cfg.race, list.length));
  const started = Date.now();
  const opened = n > 1 ? await raceOpen(list.slice(0, n), body, cfg, signal) : await firstOpen(list, body, cfg, signal);

  const meta = {
    provider: opened.c.provider.id,
    model: opened.c.model.id,
    attempts: n,
    ms: Date.now() - started,
  };

  const onClose = () => {
    try {
      opened.ac.abort();
    } catch {
      /* ignore */
    }
  };
  res.on("close", onClose);

  res.writeHead(200, {
    "content-type": opened.contentType,
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-a0-provider": meta.provider,
    "x-a0-model": encodeURIComponent(meta.model),
    "x-a0-attempts": String(n),
  });

  let out = 0;
  try {
    out += opened.first.length;
    res.write(opened.first);
    for (;;) {
      const { value, done } = await readFirst(opened.reader, cfg.requestTimeoutMs);
      if (done) break;
      if (value?.length) {
        out += value.length;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    // Headers are already out; the only honest move is an in-band error.
    const payload = JSON.stringify({ error: { message: err.message, type: "a0_stream_error", code: "stream_interrupted" } });
    try {
      res.write(`\n\ndata: ${payload}\n\n`);
      res.end();
    } catch {
      /* client already gone */
    }
    meta.error = err.message;
  } finally {
    res.removeListener("close", onClose);
    opened.cleanup?.();
  }

  onEvent?.({
    provider: meta.provider,
    model: meta.model,
    status: meta.error ? 502 : 200,
    latencyMs: Date.now() - started,
    inTok: Math.ceil(JSON.stringify(body).length / 4),
    outTok: Math.ceil(out / 4),
    error: meta.error,
  });
  return meta;
}

/** Non-stream completion with best-of or racing semantics. */
export async function relayOnce({ cfg, body, candidates, signal, onEvent }) {
  const list = candidates.slice(0, Math.max(1, cfg.maxAttempts));
  const started = Date.now();
  const failures = [];
  let result;

  const bestOf = Math.max(1, Math.min(cfg.bestOf || 1, list.length));
  if (bestOf > 1) {
    const settled = await Promise.allSettled(list.slice(0, bestOf).map((c) => callOnce(c, body, cfg, signal)));
    const ok = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
    if (!ok.length) {
      for (const s of settled) if (s.status === "rejected") failures.push(s.reason?.message || "failed");
      throw new RelayError("all_lanes_failed", "every lane in the best-of set failed", failures);
    }
    result = ok.sort((a, b) => rubric(b.json) - rubric(a.json))[0];
  } else {
    for (const c of list) {
      try {
        result = await callOnce(c, body, cfg, signal);
        break;
      } catch (err) {
        failures.push(`${attemptName(c)} (${err.message})`);
      }
    }
    if (!result) throw new RelayError("all_lanes_failed", "every lane failed", failures);
  }

  const latencyMs = Date.now() - started;
  onEvent?.({
    provider: result.c.provider.id,
    model: result.c.model.id,
    status: 200,
    latencyMs,
    inTok: Math.ceil(JSON.stringify(body).length / 4),
    outTok: Math.ceil(JSON.stringify(result.json).length / 4),
  });
  return {
    json: result.json,
    provider: result.c.provider.id,
    model: result.c.model.id,
    latencyMs,
  };
}

export function relayErrorPayload(err) {
  return {
    error: {
      message: err.message,
      type: "a0_upstream_error",
      code: err.code || "upstream_error",
      a0: { attempts: err.attempts || [] },
    },
  };
}
