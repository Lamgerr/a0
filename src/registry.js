// The lane registry: data, not code. Users and the community extend this;
// nothing here is a secret. Capability flags are conservative on purpose —
// a lane that cannot do tools must never be handed a tool call.
//
// tier:
//   "keyless"     anonymous lanes, usable with no account
//   "recommended" legit free key providers, best models and limits
//   "optional"    free tiers exist but are tighter or less predictable
//
// `setup` is rendered by the TUI so a new user can create a key without
// leaving the terminal.

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
  // ── keyless: the zero-setup default ──────────────────────────────────────
  {
    id: "llm7",
    label: "LLM7",
    tier: "keyless",
    baseUrl: "https://api.llm7.io/v1",
    keyEnv: "A0_LLM7_KEY",
    keyless: true,
    rpm: 60,
    freeTier: true,
    note: "Anonymous tier. ~500K tokens/day; a free token lifts it to 1M.",
    setup: {
      url: "https://llm7.io",
      note: "No key required. A free email token raises the daily limit.",
    },
    models: [
      { id: "fast", label: "LLM7 Fast", context: 32_000, tools: true, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "pollinations",
    label: "Pollinations",
    tier: "keyless",
    baseUrl: "https://text.pollinations.ai/openai",
    keyEnv: "",
    keyless: true,
    rpm: 30,
    freeTier: true,
    note: "Fully keyless. Text-only, tool calls supported.",
    setup: {
      url: "https://pollinations.ai",
      note: "No account at all. Text-only; no vision.",
    },
    models: [
      { id: "openai-fast", label: "Pollinations Fast", context: 32_000, tools: true, vision: false, quality: 2, fast: true },
    ],
  },

  // ── recommended: best legit free keys ────────────────────────────────────
  {
    id: "kilo",
    label: "Kilo Gateway",
    tier: "recommended",
    baseUrl: "https://ai-gateway.kilo.ai/api/v1",
    keyEnv: "A0_KILO_KEY",
    keyless: true, // anonymous free models work without a key
    rpm: 200,
    freeTier: true,
    note: "Free :free models, 200 req/hr anonymous. A key raises limits and unlocks routing.",
    setup: {
      url: "https://app.kilo.ai",
      steps: [
        "Sign in at app.kilo.ai (GitHub is fine)",
        "Open API keys and create one",
        "Optional: anonymous :free models already work without a key",
      ],
    },
    models: [
      { id: "nvidia/nemotron-3.5-super-vl:free", label: "Nemotron 3.5 Super VL", context: 1_000_000, tools: true, vision: true, quality: 5 },
      { id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra", context: 1_000_000, tools: true, vision: false, quality: 5 },
      { id: "cohere/north-mini-code:free", label: "North Mini Code", context: 256_000, tools: true, vision: false, quality: 4, fast: true },
      { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning", context: 1_000_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "xkiro",
    label: "xKiro",
    tier: "recommended",
    baseUrl: "https://api.xkiro.com/v1",
    keyEnv: "A0_XKIRO_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "45 free models, 500K tokens/day (1M after Telegram verification).",
    setup: {
      url: "https://xkiro.com/register",
      steps: [
        "Create a free account at xkiro.com/register",
        "Open the dashboard and create an API key (starts with sk-xt-)",
        "No card required; free models work immediately",
      ],
    },
    models: [
      { id: "qwen/qwen3.8-max:free", label: "Qwen3.8 Max", context: 1_000_000, tools: true, vision: true, quality: 5 },
      { id: "qwen/qwen3-coder-plus:free", label: "Qwen3 Coder Plus", context: 1_048_576, tools: true, vision: true, quality: 5 },
      { id: "qwen/qwen3.7-flash:free", label: "Qwen3.7 Flash", context: 1_000_000, tools: true, vision: true, quality: 4, fast: true },
      { id: "mistralai/codestral-2508", label: "Codestral 2508", context: 256_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    tier: "recommended",
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "A0_GROQ_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Free tier, very fast. The recommended upgrade for agentic sessions.",
    setup: {
      url: "https://console.groq.com/keys",
      steps: [
        "Sign in at console.groq.com",
        "Open API Keys and create a key (starts with gsk_)",
        "Free tier is rate-limited but needs no card",
      ],
    },
    models: [
      { id: "gpt-oss-120b", label: "Groq GPT-OSS 120B", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
      { id: "qwen/qwen3.8-27b", label: "Groq Qwen3.8 27B", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "zai",
    label: "Z.ai",
    tier: "recommended",
    baseUrl: "https://api.z.ai/api/paas/v4",
    keyEnv: "A0_ZAI_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "GLM-5.3-Flash: 1M context, vision + tools, strong coding at low cost.",
    setup: {
      url: "https://z.ai/manage-apikey/apikey-list",
      steps: [
        "Register at z.ai/model-api",
        "Open API Keys and create a Standard key",
        "GLM-5.3-Flash is the free-tier-friendly pick; check your console for quota",
      ],
    },
    models: [
      { id: "glm-5.3-flash", label: "GLM-5.3 Flash", context: 1_000_000, tools: true, vision: true, quality: 5, fast: true },
    ],
  },

  // ── optional: free tiers exist, but tighter or less predictable ──────────
  {
    id: "openrouter",
    label: "OpenRouter",
    tier: "optional",
    baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "A0_OPENROUTER_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "Free models are capped at ~50 requests/day without credit.",
    setup: {
      url: "https://openrouter.ai/keys",
      steps: ["Create an account", "Open Keys and create one", "Free models are rate-limited without a credit top-up"],
    },
    models: [
      { id: "openrouter/free", label: "OpenRouter Free", context: 128_000, tools: true, vision: true, quality: 4 },
    ],
  },
  {
    id: "mimo",
    label: "MiMo",
    tier: "optional",
    baseUrl: "https://api.xiaomimimo.com/v1",
    keyEnv: "A0_MIMO_KEY",
    keyless: false,
    rpm: 10,
    freeTier: true,
    note: "Limited free quota. Verify the model id in the console before relying on it.",
    setup: {
      url: "https://platform.xiaomimimo.com",
      steps: ["Create an account on the MiMo platform", "Create an API key", "Copy the exact model id from the console"],
    },
    models: [
      { id: "mimo-v2.6-pro", label: "MiMo v2.6 Pro", context: 1_048_576, tools: true, vision: false, quality: 4 },
    ],
  },
  {
    id: "alibaba",
    label: "Alibaba DashScope",
    tier: "optional",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    keyEnv: "A0_ALIBABA_KEY",
    keyless: false,
    rpm: 10,
    freeTier: true,
    note: "Free quota is region-limited and expires. Use the international endpoint.",
    setup: {
      url: "https://bailian.console.alibabacloud.com/",
      steps: ["Create a Model Studio / Bailian account", "Create an API key", "Use the international compatible-mode endpoint"],
    },
    models: [
      { id: "qwen3-coder-plus", label: "Qwen3 Coder Plus", context: 1_000_000, tools: true, vision: false, quality: 4 },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    tier: "optional",
    baseUrl: "https://api.openai.com/v1",
    keyEnv: "A0_OPENAI_KEY",
    keyless: false,
    rpm: 10,
    freeTier: false,
    note: "No free tier. Listed only for people who already have credit.",
    setup: {
      url: "https://platform.openai.com/api-keys",
      steps: ["Sign in at platform.openai.com", "Add billing credit", "Create an API key"],
    },
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", context: 128_000, tools: true, vision: true, quality: 3, fast: true },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    tier: "optional",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "A0_GEMINI_KEY",
    keyless: false,
    rpm: 15,
    freeTier: true,
    note: "Free project quota is opaque and changes; good vision, unpredictable limits.",
    setup: {
      url: "https://aistudio.google.com/apikey",
      steps: ["Open Google AI Studio", "Create an API key", "Free quotas are per-project and can change"],
    },
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", context: 1_000_000, tools: true, vision: true, quality: 5, fast: true },
    ],
  },
];

export const RECOMMENDED_IDS = ["kilo", "xkiro", "groq", "zai"];
export const OPTIONAL_IDS = ["openrouter", "mimo", "alibaba", "openai", "gemini"];

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
  const disabled = new Set(Array.isArray(override.disabled) ? override.disabled : []);
  const models = (override.models || def.models || []).map((m) => ({
    ...m,
    providerId: def.id,
    providerLabel: def.label,
    keyless: Boolean(def.keyless),
    enabled: !disabled.has(m.id),
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
          tier: override.tier || "optional",
          baseUrl: override.baseUrl,
          keyEnv: override.keyEnv || "",
          keyless: Boolean(override.keyless),
          rpm: override.rpm || 0,
          freeTier: override.freeTier !== false,
          note: override.note || "custom lane",
          setup: override.setup || { url: override.baseUrl, note: "custom lane" },
          models: override.models,
        },
        cfg,
      ),
    );
  }
  return out;
}

export function activeProviders(providers) {
  return providers.filter((p) => p.enabled && p.models.some((m) => m.enabled !== false));
}

export function modelCounts(p) {
  const total = p.models.length;
  const enabled = p.models.filter((m) => m.enabled !== false).length;
  return { enabled, total };
}

/**
 * Turn one model on or off for a provider. The on-disk form is a `disabled`
 * array, so configs stay small and a new built-in model defaults to on.
 * Returns the resulting disabled list.
 */
export function setModelEnabled(cfg, providerId, modelId, enabled, modelIds) {
  cfg.providers[providerId] = { ...(cfg.providers[providerId] || {}) };
  const override = cfg.providers[providerId];
  const known =
    modelIds ||
    (Array.isArray(override.models) && override.models.length
      ? override.models.map((m) => m.id)
      : (DEFAULT_PROVIDERS.find((d) => d.id === providerId)?.models || []).map((m) => m.id));
  const disabled = new Set(Array.isArray(override.disabled) ? override.disabled : []);
  if (enabled) disabled.delete(modelId);
  else disabled.add(modelId);
  const list = known.filter((id) => disabled.has(id));
  if (list.length) override.disabled = list;
  else delete override.disabled;
  return list;
}

export function byTier(providers, tier) {
  return providers.filter((p) => p.tier === tier);
}

export function findModel(providers, requested) {
  if (!requested) return null;
  const [maybeProvider, ...rest] = requested.split("::");
  const wanted = rest.length ? rest.join("::") : requested;
  for (const p of providers) {
    if (rest.length && p.id !== maybeProvider) continue;
    for (const m of p.models) {
      if (m.enabled === false) continue;
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
      if (m.enabled === false) continue;
      data.push({
        id: m.id,
        object: "model",
        created,
        owned_by: p.id,
        a0: {
          provider: p.id,
          label: m.label,
          tier: p.tier,
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
