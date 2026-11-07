// Resilience layer. Circuit breaker, rate limiting, retry, and health tracking.
// Keeps a0 running even when providers are flaky.

// ── Circuit breaker ───────────────────────────────────────────────────────
const circuitState = new Map(); // providerId -> { failures, lastFailure, state: 'closed'|'open'|'half-open' }
const CIRCUIT_THRESHOLD = 5; // failures before opening
const CIRCUIT_RESET_MS = 60_000; // time before half-open
const CIRCUIT_HALF_OPEN_MAX = 1; // max requests in half-open

export function circuitStatus(providerId) {
  const state = circuitState.get(providerId);
  if (!state) return "closed";
  if (state.state === "open") {
    if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
      state.state = "half-open";
      state.halfOpenCount = 0;
      return "half-open";
    }
    return "open";
  }
  return state.state;
}

export function recordSuccess(providerId) {
  const state = circuitState.get(providerId);
  if (state) {
    state.failures = 0;
    state.state = "closed";
  }
}

export function recordFailure(providerId) {
  let state = circuitState.get(providerId);
  if (!state) {
    state = { failures: 0, lastFailure: 0, state: "closed", halfOpenCount: 0 };
    circuitState.set(providerId, state);
  }
  state.failures++;
  state.lastFailure = Date.now();
  if (state.state === "half-open") {
    state.state = "open";
  } else if (state.failures >= CIRCUIT_THRESHOLD) {
    state.state = "open";
  }
}

export function isCircuitOpen(providerId) {
  return circuitStatus(providerId) === "open";
}

export function resetAllCircuits() {
  circuitState.clear();
  rateWindows.clear();
}
const rateWindows = new Map(); // providerId -> { count, windowStart }

export function checkRateLimit(providerId, rpm) {
  if (!rpm || rpm <= 0) return true;
  const now = Date.now();
  let window = rateWindows.get(providerId);
  if (!window || now - window.windowStart > 60_000) {
    window = { count: 0, windowStart: now };
    rateWindows.set(providerId, window);
  }
  if (window.count >= rpm) return false;
  window.count++;
  return true;
}

// ── Retry with exponential backoff ─────────────────────────────────────────
export function retryDelay(attempt, baseMs = 1000) {
  return Math.min(baseMs * Math.pow(2, attempt), 10_000);
}

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Health tracking ───────────────────────────────────────────────────────
const healthStats = new Map(); // providerId -> { successes, failures, totalLatency, lastCheck }

export function recordHealth(providerId, success, latencyMs) {
  let stats = healthStats.get(providerId);
  if (!stats) {
    stats = { successes: 0, failures: 0, totalLatency: 0, lastCheck: 0 };
    healthStats.set(providerId, stats);
  }
  if (success) stats.successes++;
  else stats.failures++;
  stats.totalLatency += latencyMs || 0;
  stats.lastCheck = Date.now();
}

export function getHealth(providerId) {
  const stats = healthStats.get(providerId);
  if (!stats) return { successRate: 1, avgLatency: 0, total: 0 };
  const total = stats.successes + stats.failures;
  return {
    successRate: total > 0 ? stats.successes / total : 1,
    avgLatency: total > 0 ? Math.round(stats.totalLatency / total) : 0,
    total,
    successes: stats.successes,
    failures: stats.failures,
  };
}

export function getAllHealth() {
  const result = {};
  for (const [id, stats] of healthStats) {
    result[id] = getHealth(id);
  }
  return result;
}

// ── Output verification ────────────────────────────────────────────────────
const BAD_OUTPUT_PATTERNS = [
  /^(I can't|I cannot|I'm unable|I don't have)/i,
  /^(As an AI|As a language model)/i,
  /^(I'm sorry, but I)/i,
  /^(Unfortunately, I)/i,
];

export function isBadOutput(text) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length < 10 && !/\b(ok|yes|no|true|false|null)\b/i.test(trimmed)) return true;
  for (const pattern of BAD_OUTPUT_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

// ── Session tracking ───────────────────────────────────────────────────────
const sessions = new Map(); // sessionId -> { model, provider, lastUsed, context }
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.lastUsed > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }
  session.lastUsed = Date.now();
  return session;
}

export function setSession(sessionId, data) {
  if (!sessionId) return;
  sessions.set(sessionId, { ...data, lastUsed: Date.now() });
}

export function clearExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastUsed > SESSION_TTL_MS) sessions.delete(id);
  }
}

// Periodic cleanup
setInterval(clearExpiredSessions, 5 * 60 * 1000).unref();

// ── Request deduplication ──────────────────────────────────────────────────
const pendingRequests = new Map(); // key -> Promise

export function deduplicate(key, fn) {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }
  const promise = fn().finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, promise);
  return promise;
}