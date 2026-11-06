// Self-update. Free lanes rot fast; a0 should be easy to keep current.
// Default is check-only. Installing is explicit (`a0 update`) or opt-in
// (`updates.autoInstall`), because replacing a running npm global can fail
// or surprise the user.
import { spawn } from "node:child_process";

import { VERSION } from "./config.js";

export const PACKAGE = process.env.A0_PACKAGE || "a0-gateway";
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function parseVersion(v) {
  return String(v)
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
}

/** 1 if a > b, -1 if a < b, 0 if equal. Prerelease tags are ignored. */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

export async function checkLatest({
  fetchImpl = fetch,
  packageName = PACKAGE,
  timeoutMs = 4000,
  current = VERSION,
} = {}) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, current, packageName, url };
    }
    const json = await res.json();
    const latest = json.version;
    return {
      ok: true,
      current,
      latest,
      update: compareVersions(latest, current) > 0,
      packageName,
      url,
    };
  } catch (err) {
    return { ok: false, error: err.name === "TimeoutError" ? "timeout" : err.message, current, packageName, url };
  }
}

export function installLatest({ spawnImpl = spawn, packageName = PACKAGE } = {}) {
  return new Promise((resolve) => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawnImpl(npm, ["install", "-g", `${packageName}@latest`], { stdio: "inherit" });
    child.on("error", (err) => resolve({ ok: false, error: err.message }));
    child.on("exit", (code) => resolve({ ok: code === 0, code }));
  });
}

/**
 * Check at most once per day. Returns null when disabled or recently checked.
 * The caller owns persistence of cfg.updates.lastCheck.
 */
export async function maybeCheck(cfg, { fetchImpl, now = Date.now() } = {}) {
  const updates = cfg.updates || {};
  if (updates.autoCheck === false) return null;
  if (updates.lastCheck && now - updates.lastCheck < CHECK_INTERVAL_MS) return null;

  const result = await checkLatest({ fetchImpl });
  cfg.updates = { ...updates, lastCheck: now };
  return { ...result, checked: true };
}
