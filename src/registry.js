// The lane registry: data, not code. Users and the community extend this;
// nothing here is a secret. Capability flags are conservative on purpose —
// a lane that cannot do tools must never be handed a tool call.

export const CATEGORIES = [
  { id: "a0/auto", label: "a0 auto", note: "best available lane for the request" },
  { id: "a0/code", label: "a0 code", note: "agentic coding, tools required" },
  { id: "a0/reasoning", label: "a0 reasoning", note: "hard problems, higher quality lanes" },
  { id: "a0/vision", label: "a0 vision", note: "image input" },
  { id: "a0/fast", label: "a0 fast", note: "short tasks, lowest latency" },
  { id: "a0/long", label: "a0 long", note: "large contexts" },
  { id: "a0/cheap", label: "a0 cheap", note: "keyless lanes only" },
];

// quality: 1–5, relative within the free pool. fast: prefers a low-latency lane.
// context: conservative token ceiling, not the provider's marketing number.
export const DEFAULT_PROVIDERS = [
  {
    id: "llm7",
    label: "LLM7",
    baseUrl: "https://api.llm7.io/v1",
    keyEnv: "A0_LLM7_KEY",
    keyless: true,
    rpm: 60,
    note: "Anonymous tier. 500K tokens/day; a free token lifts it to 1M.",
    models: [
      { id: "fast", label: "LLM7 Fast", context: 32_000, tools: true, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "pollinations",
    label: "Pollinations",
    baseUrl: "https://text.pollinations.ai/openai",
    keyEnv: "",
    keyless: true,
    rpm: 30,
    note: "Fully keyless. Text-only, tool calls supported.",
    models: [
      { id: "openai-fast", label: "Pollinations Fast", context: 32_000, tools: true, vision: false, quality: 2, fast: true },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "A0_OPENROUTER_KEY",
    keyless: false,
    rpm: 20,
    note: "Free models with a free account key. 50 requests/day without credit.",
    models: [
      { id: "openrouter/free", label: "OpenRouter Free", context: 128_000, tools: true, vision: true, quality: 5 },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "A0_GROQ_KEY",
    keyless: false,
    rpm: 30,
    note: "Free tier, very fast. The recommended upgrade for agentic sessions.",
    models: [
      { id: "gpt-oss-120b", label: "Groq GPT-OSS 120B", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "A0_GEMINI_KEY",
    keyless: false,
    rpm: 15,
    note: "Free project quota. Best vision lane when a key is present.",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", context: 1_000_000, tools: true, vision: true, quality: 5, fast: true },
    ],
  },
  {
    id: "xkiro",
    label: "xKiro",
    baseUrl: "https://api.xkiro.com/v1",
    keyEnv: "A0_XKIRO_KEY",
    keyless: false,
    rpm: 30,
    note: "Agent gateway free tier, 500K tokens/day. Flagship free models.",
    models: [
      { id: "qwen/qwen3.8-max:free", label: "xKiro Qwen3.8 Max", context: 1_000_000, tools: true, vision: true, quality: 5 },
      { id: "qwen/qwen3-coder-plus:free", label: "xKiro Qwen3 Coder", context: 1_000_000, tools: true, vision: false, quality: 5 },
    ],
  },
];

function keyFor(def, cfg) {
  const override = cfg.providers?.[def.id] || {};
  if (override.key) return override.key;
  if (def.keyEnv && process.env[def.keyEnv]) return process.env[def.keyEnv];
  return "";
}

function enabledFor(def, cfg, key) {
  const override = cfg.providers?.[def.id] || {};
  if (typeof override.enabled === "boolean") return override.enabled;
  return def.keyless || Boolean(key);
}

function shape(def, cfg) {
  const override = cfg.providers?.[def.id] || {};
  const key = keyFor(def, cfg);
  const baseUrl = (override.baseUrl || def.baseUrl || "").replace(/\/+$/, "");
  const models = (override.models || def.models || []).map((m) => ({
    ...m,
    providerId: def.id,
    providerLabel: def.label,
    keyless: Boolean(def.keyless),
  }));
  return {
    ...def,
    baseUrl,
    key,
    enabled: enabledFor(def, cfg, key),
    models,
    hasKey: Boolean(key),
  };
}

/** Merge built-in lanes with the user's overrides and custom lanes. */
export function resolveProviders(cfg) {
  const out = [];
  const seen = new Set();
  for (const def of DEFAULT_PROVIDERS) {
    seen.add(def.id);
    out.push(shape(def, cfg));
  }
  for (const [id, override] of Object.entries(cfg.providers || {})) {
    if (seen.has(id)) continue;
    if (!override || typeof override !== "object") continue;
    if (!override.baseUrl || !Array.isArray(override.models)) continue;
    out.push(
      shape(
        {
          id,
          label: override.label || id,
          baseUrl: override.baseUrl,
          keyEnv: override.keyEnv || "",
          keyless: Boolean(override.keyless),
          rpm: override.rpm || 0,
          note: override.note || "custom lane",
          models: override.models,
        },
        cfg,
      ),
    );
  }
  return out;
}

export function activeProviders(providers) {
  return providers.filter((p) => p.enabled && p.models.length > 0);
}

export function findModel(providers, requested) {
  if (!requested) return null;
  const [maybeProvider, ...rest] = requested.split("::");
  const wanted = rest.length ? rest.join("::") : requested;
  for (const p of providers) {
    if (rest.length && p.id !== maybeProvider) continue;
    for (const m of p.models) {
      if (m.id === wanted) return { provider: p, model: m };
    }
  }
  return null;
}

/** OpenAI /v1/models payload: categories first, then every enabled raw model. */
export function catalog(providers) {
  const created = Math.floor(Date.now() / 1000);
  const data = CATEGORIES.map((c) => ({
    id: c.id,
    object: "model",
    created,
    owned_by: "a0",
    a0: { category: true, note: c.note },
  }));
  for (const p of activeProviders(providers)) {
    for (const m of p.models) {
      data.push({
        id: m.id,
        object: "model",
        created,
        owned_by: p.id,
        a0: {
          provider: p.id,
          label: m.label,
          context: m.context,
          tools: Boolean(m.tools),
          vision: Boolean(m.vision),
          quality: m.quality,
          keyless: m.keyless,
        },
      });
    }
  }
  return { object: "list", data };
}
