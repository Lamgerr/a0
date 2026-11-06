// a0 config: one JSON file, 0600, everything overridable by env.
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";

export const VERSION = "0.2.9";

// Shared keep-alive agents for upstream connections. Reusing TCP connections
// across requests avoids the ~50-100ms connection setup overhead per lane.
export const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 32 });
export const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 32 });

/** Pick the right agent for a URL. */
export function agentFor(url) {
  return String(url).startsWith("https:") ? httpsAgent : httpAgent;
}

export const DEFAULTS = {
  port: 8082,
  host: "127.0.0.1",
  token: "",
  enhance: true,
  cleanOutput: true,
  race: 2, // lanes dispatched in parallel per request (1 = plain failover)
  bestOf: 1, // non-stream only: collect N answers, pick the best
  maxAttempts: 3,
  requestTimeoutMs: 90_000,
  firstByteTimeoutMs: 25_000,
  maxBodyBytes: 16 * 1024 * 1024,
  routing: {
    preferKeyless: false,
    sticky: true,
    longContextTokens: 24_000,
    costOptimize: true,
  },
  updates: {
    autoCheck: true,
    autoInstall: false,
    lastCheck: 0,
  },
  providers: {},
};

export function configDir() {
  if (process.env.A0_HOME) return path.resolve(process.env.A0_HOME);
  return path.join(os.homedir(), ".a0");
}

export function configPath() {
  return path.join(configDir(), "config.json");
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function merge(base, override) {
  if (!isObject(override)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

export function loadConfig(file = configPath()) {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw new Error(`cannot read ${file}: ${err.message}`);
    }
  }
  const cfg = merge(DEFAULTS, raw);

  // Environment wins over the file, file wins over defaults.
  const env = process.env;
  if (env.A0_PORT) cfg.port = Number(env.A0_PORT);
  if (env.A0_HOST) cfg.host = env.A0_HOST;
  if (env.A0_TOKEN) cfg.token = env.A0_TOKEN;
  if (env.A0_ENHANCE) cfg.enhance = truthy(env.A0_ENHANCE);
  if (env.A0_RACE) cfg.race = clampInt(env.A0_RACE, 1, 4, cfg.race);
  if (env.A0_BEST_OF) cfg.bestOf = clampInt(env.A0_BEST_OF, 1, 4, cfg.bestOf);
  if (env.A0_MAX_ATTEMPTS) cfg.maxAttempts = clampInt(env.A0_MAX_ATTEMPTS, 1, 8, cfg.maxAttempts);
  if (env.A0_PROVIDERS) {
    try {
      cfg.providers = merge(cfg.providers, JSON.parse(env.A0_PROVIDERS));
    } catch {
      /* ignore malformed provider override */
    }
  }
  return cfg;
}

export function saveConfig(cfg, file = configPath()) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    /* best effort on filesystems without chmod */
  }
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(cfg, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
  return file;
}

export function configExists(file = configPath()) {
  return fs.existsSync(file);
}

// Secrets never leave the process in logs or status output.
export function redact(cfg) {
  const copy = structuredClone(cfg);
  for (const [id, p] of Object.entries(copy.providers || {})) {
    if (p && typeof p.key === "string" && p.key) {
      copy.providers[id].key = mask(p.key);
    }
  }
  if (copy.token) copy.token = mask(copy.token);
  return copy;
}

export function mask(secret) {
  if (!secret) return "";
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

function truthy(v) {
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

function clampInt(v, min, max, def) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
