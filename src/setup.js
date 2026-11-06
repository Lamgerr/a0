// Setup mode logic, kept pure so it can be tested without a TTY.
//
// Two modes:
//   keyless — no keys were added: keep the anonymous lanes on
//   keyed   — at least one key was added: turn the anonymous lanes off and
//             route to the user's legit free-tier accounts instead
//
// The second mode is the point: pooled anonymous quota is a fallback, not the
// product. Keys get better models, higher limits, and real failover.

import { resolveProviders, RECOMMENDED_IDS, OPTIONAL_IDS } from "./registry.js";

export const KEYLESS_IDS = ["llm7", "pollinations", "kilo"];

export function anyKey(providers) {
  return providers.some((p) => p.hasKey);
}

/**
 * Rebalance lanes for the chosen mode. Mutates cfg.providers[id].enabled and
 * cfg.routing.preferKeyless. Returns {mode, disabled, enabled}.
 */
export function applySetupMode(cfg, providers = resolveProviders(cfg)) {
  const keyed = anyKey(providers);
  const disabled = [];
  const enabled = [];

  for (const p of providers) {
    if (!p.keyless || p.hasKey) continue;
    cfg.providers[p.id] = cfg.providers[p.id] || {};
    cfg.providers[p.id].enabled = !keyed;
    if (keyed) disabled.push(p.id);
    else enabled.push(p.id);
  }

  cfg.routing = cfg.routing || {};
  cfg.routing.preferKeyless = !keyed;

  return {
    mode: keyed ? "keyed" : "keyless",
    disabled,
    enabled,
    keyed: providers.filter((p) => p.enabled && p.hasKey).map((p) => p.id),
  };
}

export function inOrder(providers, ids) {
  return ids.map((id) => providers.find((p) => p.id === id)).filter(Boolean);
}

export function recommended(providers) {
  return inOrder(providers, RECOMMENDED_IDS);
}

export function optional(providers) {
  return inOrder(providers, OPTIONAL_IDS);
}

/** Human-readable instructions for one lane, rendered by the TUI. */
export function guideLines(p) {
  const lines = [];
  const free = p.freeTier ? "free tier" : "paid only";
  lines.push(`${p.note} (${free})`);
  if (p.setup?.url) lines.push(`Get a key: ${p.setup.url}`);
  for (const step of p.setup?.steps || []) lines.push(`• ${step}`);
  return lines;
}

export function modeSummary(result) {
  if (result.mode === "keyed") {
    const parts = [`${result.keyed.length} keyed lane${result.keyed.length === 1 ? "" : "s"} active`];
    if (result.disabled.length) parts.push(`anonymous lanes off: ${result.disabled.join(", ")}`);
    return parts.join(" · ");
  }
  return `no keys added — using the anonymous pool: ${result.enabled.join(", ")}`;
}

export { RECOMMENDED_IDS, OPTIONAL_IDS };
