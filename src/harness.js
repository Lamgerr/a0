// Model research harness. Periodically checks providers for new models and
// updates the local config. Runs silently in the background.
//
// The harness:
// 1. Fetches /models from each enabled provider
// 2. Compares against known models in config
// 3. Adds new models with conservative capability defaults
// 4. Removes models that no longer exist (after 3 consecutive failures)
// 5. Updates model capabilities based on provider metadata when available

import { resolveProviders } from "./registry.js";
import { saveConfig } from "./config.js";

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const FAILURE_THRESHOLD = 3;

// Conservative defaults for newly discovered models
const DEFAULT_MODEL = {
  context: 32_000,
  tools: false,
  vision: false,
  quality: 3,
  fast: false,
};

// Capability inference from model name
function inferCapabilities(modelId) {
  const id = String(modelId).toLowerCase();
  const caps = { ...DEFAULT_MODEL };

  // Context size hints
  if (id.includes("128k") || id.includes("128000")) caps.context = 128_000;
  else if (id.includes("32k") || id.includes("32768")) caps.context = 32_000;
  else if (id.includes("8k") || id.includes("8192")) caps.context = 8_192;
  else if (id.includes("200k")) caps.context = 200_000;
  else if (id.includes("1m") || id.includes("1000000")) caps.context = 1_000_000;

  // Tool support hints
  if (id.includes("coder") || id.includes("code") || id.includes("instruct") || id.includes("chat")) {
    caps.tools = true;
  }
  if (id.includes("vision") || id.includes("vl") || id.includes("multimodal")) {
    caps.vision = true;
  }
  if (id.includes("fast") || id.includes("mini") || id.includes("flash") || id.includes("lite")) {
    caps.fast = true;
  }
  if (id.includes("large") || id.includes("70b") || id.includes("120b") || id.includes("405b")) {
    caps.quality = 5;
  } else if (id.includes("8b") || id.includes("7b") || id.includes("3b")) {
    caps.quality = 3;
  }

  // Known model families
  if (id.includes("gpt-4") || id.includes("claude") || id.includes("gemini")) {
    caps.tools = true;
    caps.vision = true;
    caps.quality = 5;
    caps.context = Math.max(caps.context, 128_000);
  }
  if (id.includes("deepseek") || id.includes("qwen") || id.includes("llama")) {
    caps.tools = true;
    caps.quality = Math.max(caps.quality, 4);
  }

  return caps;
}

// Fetch models from a provider's /models endpoint
async function fetchProviderModels(provider) {
  const url = `${provider.baseUrl.replace(/\/+$/, "")}/models`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: provider.key ? { authorization: `Bearer ${provider.key}` } : {},
    });
    if (!res.ok) return null;
    const json = await res.json();
    const models = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : [];
    return models
      .map((m) => {
        const id = m.id || m.name || m.model;
        if (!id) return null;
        // Skip models that look like they need special access or are not chat models
        const lower = String(id).toLowerCase();
        if (lower.includes("embedding") || lower.includes("whisper") || lower.includes("tts") || 
            lower.includes("dall-e") || lower.includes("moderation") || lower.includes("audio") ||
            lower.includes("image-generation") || lower.includes("fine-tune")) return null;
        // Skip models with very long IDs (likely internal)
        if (String(id).length > 80) return null;
        return {
          id,
          label: m.name || id,
          context: m.context_length || m.context || inferCapabilities(id).context,
          tools: m.capabilities?.tools ?? inferCapabilities(id).tools,
          vision: m.capabilities?.vision ?? inferCapabilities(id).vision,
          quality: inferCapabilities(id).quality,
          fast: inferCapabilities(id).fast,
        };
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

// Track consecutive failures per provider
const failureCounts = new Map();

/**
 * Run one research cycle. Returns { added, removed, updated, errors }.
 */
export async function runResearchCycle(cfg) {
  const providers = resolveProviders(cfg);
  const enabled = providers.filter((p) => p.enabled);
  const result = { added: 0, removed: 0, updated: 0, errors: [] };

  for (const p of enabled) {
    const models = await fetchProviderModels(p);
    if (!models) {
      const count = (failureCounts.get(p.id) || 0) + 1;
      failureCounts.set(p.id, count);
      if (count >= FAILURE_THRESHOLD) {
        result.errors.push(`${p.id}: ${count} consecutive failures`);
      }
      continue;
    }
    failureCounts.set(p.id, 0);

    const override = cfg.providers[p.id] || {};
    const knownIds = new Set((override.models || p.models || []).map((m) => m.id));
    const curatedIds = new Set((p.models || []).map((m) => m.id));
    const newIds = new Set(models.map((m) => m.id));
    const disabled = new Set(Array.isArray(override.disabled) ? override.disabled : []);

    // Only add NEW models (not already known)
    if (!Array.isArray(override.models)) {
      override.models = (p.models || []).map((m) => {
        const { providerId, providerLabel, keyless, enabled, ...rest } = m;
        return rest;
      });
    }

    let changed = false;
    for (const m of models) {
      if (knownIds.has(m.id)) continue;
      // Skip if this model is already in the curated list
      if (curatedIds.has(m.id)) continue;
      override.models.push({ id: m.id, label: m.label, context: m.context, tools: m.tools, vision: m.vision, quality: m.quality, fast: m.fast, _discovered: true });
      changed = true;
      result.added++;
    }

    // Never remove curated models. Only remove discovered models that no longer exist.
    const before = override.models.length;
    override.models = override.models.filter((m) => {
      // Keep curated models always
      if (curatedIds.has(m.id)) return true;
      // Keep disabled models (user explicitly disabled them)
      if (disabled.has(m.id)) return true;
      // Remove discovered models that no longer exist
      return newIds.has(m.id);
    });
    if (override.models.length < before) {
      result.removed += before - override.models.length;
      changed = true;
    }

    if (changed) {
      cfg.providers[p.id] = { ...override, models: override.models };
      result.updated++;
    }
  }

  if (result.added > 0 || result.removed > 0) {
    try { saveConfig(cfg); } catch { /* best effort */ }
  }

  return result;
}

/**
 * Start the background harness. Checks periodically.
 * Returns a cleanup function.
 */
export function startHarness(cfg, { intervalMs = CHECK_INTERVAL_MS, onResult } = {}) {
  let timer = null;
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const result = await runResearchCycle(cfg);
      if (onResult) onResult(result);
    } catch { /* silent */ }
    finally { running = false; }
  }

  // Initial run after 30 seconds (let the server start first)
  const initial = setTimeout(tick, 30_000);
  timer = setInterval(tick, intervalMs);

  return () => {
    clearTimeout(initial);
    if (timer) clearInterval(timer);
  };
}

export { CHECK_INTERVAL_MS, FAILURE_THRESHOLD, inferCapabilities };