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
  // ── major cloud providers (key required) ────────────────────────────────
  {
    id: "anthropic",
    label: "Anthropic",
    tier: "optional",
    baseUrl: "https://api.anthropic.com/v1",
    keyEnv: "A0_ANTHROPIC_KEY",
    keyless: false,
    rpm: 50,
    freeTier: false,
    note: "Claude models. No free tier; needs credit. Excellent for code and reasoning.",
    setup: { url: "https://console.anthropic.com/settings/keys", steps: ["Sign in at console.anthropic.com", "Open API Keys and create one", "Add billing credit"] },
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", context: 200_000, tools: true, vision: true, quality: 5 },
      { id: "claude-haiku-3-5-20241022", label: "Claude Haiku 3.5", context: 200_000, tools: true, vision: true, quality: 4, fast: true },
    ],
  },
  {
    id: "mistral",
    label: "Mistral AI",
    tier: "optional",
    baseUrl: "https://api.mistral.ai/v1",
    keyEnv: "A0_MISTRAL_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Free tier available. Strong coding models (Codestral).",
    setup: { url: "https://console.mistral.ai/api-keys/", steps: ["Create an account at console.mistral.ai", "Open API Keys and create one", "Free tier has rate limits"] },
    models: [
      { id: "codestral-latest", label: "Codestral", context: 256_000, tools: true, vision: false, quality: 4, fast: true },
      { id: "mistral-large-latest", label: "Mistral Large", context: 128_000, tools: true, vision: false, quality: 5 },
    ],
  },
  {
    id: "cohere",
    label: "Cohere",
    tier: "optional",
    baseUrl: "https://api.cohere.com/v2",
    keyEnv: "A0_COHERE_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "Free trial key. Command R+ for RAG and tools.",
    setup: { url: "https://dashboard.cohere.com/api-keys", steps: ["Sign in at dashboard.cohere.com", "Create a trial API key", "Free tier is rate-limited"] },
    models: [
      { id: "command-r-plus", label: "Command R+", context: 128_000, tools: true, vision: false, quality: 4 },
      { id: "command-r", label: "Command R", context: 128_000, tools: true, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    tier: "optional",
    baseUrl: "https://api.deepseek.com/v1",
    keyEnv: "A0_DEEPSEEK_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Very cheap. DeepSeek-V3 and R1 are strong for code and reasoning.",
    setup: { url: "https://platform.deepseek.com/api_keys", steps: ["Register at platform.deepseek.com", "Create an API key", "Top up for higher limits; small free quota exists"] },
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3", context: 64_000, tools: true, vision: false, quality: 5 },
      { id: "deepseek-reasoner", label: "DeepSeek R1", context: 64_000, tools: false, vision: false, quality: 5 },
    ],
  },
  {
    id: "together",
    label: "Together AI",
    tier: "optional",
    baseUrl: "https://api.together.xyz/v1",
    keyEnv: "A0_TOGETHER_KEY",
    keyless: false,
    rpm: 60,
    freeTier: true,
    note: "Many open models. Free trial credits on signup.",
    setup: { url: "https://api.together.xyz/settings/api-keys", steps: ["Sign up at together.ai", "Open API Keys and create one", "Free trial credits included"] },
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
      { id: "Qwen/Qwen2.5-Coder-32B-Instruct", label: "Qwen 2.5 Coder 32B", context: 32_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    tier: "optional",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    keyEnv: "A0_FIREWORKS_KEY",
    keyless: false,
    rpm: 60,
    freeTier: true,
    note: "Fast inference for open models. Free trial credits.",
    setup: { url: "https://fireworks.ai/account/api-keys", steps: ["Sign up at fireworks.ai", "Create an API key", "Free trial credits included"] },
    models: [
      { id: "accounts/fireworks/models/llama-v3p3-70b-instruct", label: "Llama 3.3 70B", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    tier: "optional",
    baseUrl: "https://api.perplexity.ai",
    keyEnv: "A0_PERPLEXITY_KEY",
    keyless: false,
    rpm: 20,
    freeTier: false,
    note: "Sonar models with web search built in. No free tier.",
    setup: { url: "https://www.perplexity.ai/settings/api", steps: ["Sign in at perplexity.ai", "Open API settings", "Create an API key"] },
    models: [
      { id: "sonar-pro", label: "Sonar Pro", context: 200_000, tools: false, vision: false, quality: 4 },
      { id: "sonar", label: "Sonar", context: 128_000, tools: false, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "cerebras",
    label: "Cerebras",
    tier: "optional",
    baseUrl: "https://api.cerebras.ai/v1",
    keyEnv: "A0_CEREBRAS_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Extremely fast inference. Free tier available.",
    setup: { url: "https://cloud.cerebras.ai/platform", steps: ["Sign up at cloud.cerebras.ai", "Create an API key", "Free tier available"] },
    models: [
      { id: "llama-3.3-70b", label: "Llama 3.3 70B", context: 8_192, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "sambanova",
    label: "SambaNova",
    tier: "optional",
    baseUrl: "https://api.sambanova.ai/v1",
    keyEnv: "A0_SAMBANOVA_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Fast inference. Free tier credits on signup.",
    setup: { url: "https://cloud.sambanova.ai/apis", steps: ["Sign up at cloud.sambanova.ai", "Create an API key", "Free credits included"] },
    models: [
      { id: "Meta-Llama-3.3-70B-Instruct", label: "Llama 3.3 70B", context: 8_192, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "novita",
    label: "Novita AI",
    tier: "optional",
    baseUrl: "https://api.novita.ai/v3/openai",
    keyEnv: "A0_NOVITA_KEY",
    keyless: false,
    rpm: 60,
    freeTier: true,
    note: "Open model hosting. Pay-as-you-go with free credits.",
    setup: { url: "https://novita.ai/settings/key-management", steps: ["Sign up at novita.ai", "Create an API key", "Free credits on signup"] },
    models: [
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "siliconflow",
    label: "SiliconFlow",
    tier: "optional",
    baseUrl: "https://api.siliconflow.cn/v1",
    keyEnv: "A0_SILICONFLOW_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Chinese provider with many open models. Free tier available.",
    setup: { url: "https://cloud.siliconflow.cn/account/ak", steps: ["Sign up at siliconflow.cn", "Create an API key", "Free tier available"] },
    models: [
      { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek V3", context: 64_000, tools: true, vision: false, quality: 5 },
      { id: "Qwen/Qwen2.5-Coder-32B-Instruct", label: "Qwen 2.5 Coder 32B", context: 32_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "moonshot",
    label: "Moonshot (Kimi)",
    tier: "optional",
    baseUrl: "https://api.moonshot.cn/v1",
    keyEnv: "A0_MOONSHOT_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "Kimi models with long context. Free tier available.",
    setup: { url: "https://platform.moonshot.cn/console/api-keys", steps: ["Sign up at platform.moonshot.cn", "Create an API key", "Free credits on signup"] },
    models: [
      { id: "moonshot-v1-128k", label: "Moonshot V1 128K", context: 128_000, tools: true, vision: false, quality: 4 },
    ],
  },
  {
    id: "minimax",
    label: "MiniMax",
    tier: "optional",
    baseUrl: "https://api.minimax.chat/v1",
    keyEnv: "A0_MINIMAX_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "Chinese provider. MiniMax-Text-01 with 1M context.",
    setup: { url: "https://www.minimaxi.com/user-center/basic-information/interface-key", steps: ["Sign up at minimaxi.com", "Create an API key", "Free credits available"] },
    models: [
      { id: "MiniMax-Text-01", label: "MiniMax Text 01", context: 1_000_000, tools: true, vision: false, quality: 4 },
    ],
  },
  {
    id: "stepfun",
    label: "StepFun",
    tier: "optional",
    baseUrl: "https://api.stepfun.com/v1",
    keyEnv: "A0_STEPFUN_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "Step models. Free tier available.",
    setup: { url: "https://platform.stepfun.com/interface-key", steps: ["Sign up at platform.stepfun.com", "Create an API key", "Free credits available"] },
    models: [
      { id: "step-2-16k", label: "Step 2 16K", context: 16_000, tools: true, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    tier: "optional",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyEnv: "A0_NVIDIA_KEY",
    keyless: false,
    rpm: 40,
    freeTier: true,
    note: "NVIDIA-hosted models. Free credits on signup.",
    setup: { url: "https://build.nvidia.com/", steps: ["Sign up at build.nvidia.com", "Generate an API key", "Free credits included"] },
    models: [
      { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B (NIM)", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "hyperbolic",
    label: "Hyperbolic",
    tier: "optional",
    baseUrl: "https://api.hyperbolic.xyz/v1",
    keyEnv: "A0_HYPERBOLIC_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Open model inference. Free credits on signup.",
    setup: { url: "https://app.hyperbolic.xyz/settings", steps: ["Sign up at hyperbolic.xyz", "Create an API key", "Free credits included"] },
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    tier: "optional",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    keyEnv: "A0_DEEPINFRA_KEY",
    keyless: false,
    rpm: 60,
    freeTier: true,
    note: "Open model hosting. Free credits on signup.",
    setup: { url: "https://deepinfra.com/dash/api_keys", steps: ["Sign up at deepinfra.com", "Create an API key", "Free credits included"] },
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "nebius",
    label: "Nebius AI",
    tier: "optional",
    baseUrl: "https://api.studio.nebius.ai/v1",
    keyEnv: "A0_NEBIUS_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Open model inference. Free credits on signup.",
    setup: { url: "https://studio.nebius.ai/settings/api-keys", steps: ["Sign up at studio.nebius.ai", "Create an API key", "Free credits included"] },
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "ai21",
    label: "AI21 Labs",
    tier: "optional",
    baseUrl: "https://api.ai21.com/studio/v1",
    keyEnv: "A0_AI21_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "Jamba models. Free tier available.",
    setup: { url: "https://studio.ai21.com/account/api-key", steps: ["Sign up at studio.ai21.com", "Create an API key", "Free tier available"] },
    models: [
      { id: "jamba-1.5-large", label: "Jamba 1.5 Large", context: 256_000, tools: true, vision: false, quality: 4 },
    ],
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    tier: "optional",
    baseUrl: "https://api-inference.huggingface.co/v1",
    keyEnv: "A0_HUGGINGFACE_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Inference API for open models. Free tier with rate limits.",
    setup: { url: "https://huggingface.co/settings/tokens", steps: ["Sign up at huggingface.co", "Create an access token (read)", "Free tier has rate limits"] },
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B", context: 128_000, tools: false, vision: false, quality: 3 },
    ],
  },
  {
    id: "replicate",
    label: "Replicate",
    tier: "optional",
    baseUrl: "https://api.replicate.com/v1",
    keyEnv: "A0_REPLICATE_KEY",
    keyless: false,
    rpm: 20,
    freeTier: false,
    note: "Run open models. Pay per second of compute.",
    setup: { url: "https://replicate.com/account/api-tokens", steps: ["Sign up at replicate.com", "Create an API token", "Pay per use"] },
    models: [
      { id: "meta/meta-llama-3.3-70b-instruct", label: "Llama 3.3 70B", context: 128_000, tools: false, vision: false, quality: 3 },
    ],
  },
  {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    tier: "optional",
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
    keyEnv: "A0_CLOUDFLARE_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Run models on Cloudflare's edge. Free tier (10K neurons/day).",
    setup: { url: "https://dash.cloudflare.com/profile/api-tokens", steps: ["Sign up at cloudflare.com", "Create an API token with Workers AI permission", "Set account ID in base URL"] },
    models: [
      { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B", context: 24_000, tools: false, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "lepton",
    label: "Lepton AI",
    tier: "optional",
    baseUrl: "https://api.lepton.ai/api/v1",
    keyEnv: "A0_LEPTON_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Open model hosting. Free credits on signup.",
    setup: { url: "https://dashboard.lepton.ai/settings/api", steps: ["Sign up at lepton.ai", "Create an API key", "Free credits included"] },
    models: [
      { id: "llama-3.1-8b", label: "Llama 3.1 8B", context: 128_000, tools: false, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "anyscale",
    label: "Anyscale",
    tier: "optional",
    baseUrl: "https://api.endpoints.anyscale.com/v1",
    keyEnv: "A0_ANYSCALE_KEY",
    keyless: false,
    rpm: 30,
    freeTier: true,
    note: "Open model serving. Free credits on signup.",
    setup: { url: "https://console.anyscale.com/credentials", steps: ["Sign up at anyscale.com", "Create an API key", "Free credits included"] },
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", context: 128_000, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    tier: "optional",
    baseUrl: "https://api.x.ai/v1",
    keyEnv: "A0_XAI_KEY",
    keyless: false,
    rpm: 30,
    freeTier: false,
    note: "Grok models. No free tier; needs credit.",
    setup: { url: "https://console.x.ai/", steps: ["Sign up at console.x.ai", "Create an API key", "Add billing credit"] },
    models: [
      { id: "grok-3", label: "Grok 3", context: 131_072, tools: true, vision: true, quality: 5 },
      { id: "grok-3-mini", label: "Grok 3 Mini", context: 131_072, tools: true, vision: false, quality: 4, fast: true },
    ],
  },
  {
    id: "yi",
    label: "01.AI (Yi)",
    tier: "optional",
    baseUrl: "https://api.lingyiwanwu.com/v1",
    keyEnv: "A0_YI_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "Yi models. Free tier available.",
    setup: { url: "https://platform.lingyiwanwu.com/apikeys", steps: ["Sign up at platform.lingyiwanwu.com", "Create an API key", "Free credits available"] },
    models: [
      { id: "yi-large", label: "Yi Large", context: 32_000, tools: true, vision: false, quality: 4 },
    ],
  },
  {
    id: "baichuan",
    label: "Baichuan",
    tier: "optional",
    baseUrl: "https://api.baichuan-ai.com/v1",
    keyEnv: "A0_BAICHUAN_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "Chinese provider. Free tier available.",
    setup: { url: "https://platform.baichuan-ai.com/console/apikey", steps: ["Sign up at platform.baichuan-ai.com", "Create an API key", "Free credits available"] },
    models: [
      { id: "Baichuan4", label: "Baichuan 4", context: 32_000, tools: true, vision: false, quality: 4 },
    ],
  },
  {
    id: "internlm",
    label: "InternLM",
    tier: "optional",
    baseUrl: "https://internlm-chat.intern-ai.org.cn/puyu/api/v1",
    keyEnv: "A0_INTERNLM_KEY",
    keyless: false,
    rpm: 20,
    freeTier: true,
    note: "InternLM models. Free tier available.",
    setup: { url: "https://internlm-chat.intern-ai.org.cn/", steps: ["Sign up at intern-ai.org.cn", "Create an API key", "Free credits available"] },
    models: [
      { id: "internlm2.5-latest", label: "InternLM 2.5", context: 32_000, tools: true, vision: false, quality: 3 },
    ],
  },
  // ── local providers (keyless, run on your machine) ──────────────────────
  {
    id: "ollama",
    label: "Ollama",
    tier: "local",
    baseUrl: "http://127.0.0.1:11434/v1",
    keyEnv: "A0_OLLAMA_KEY",
    keyless: true,
    rpm: 1000,
    freeTier: true,
    note: "Local models via Ollama. No key needed. Auto-discovers models.",
    setup: { url: "https://ollama.com", steps: ["Install Ollama: https://ollama.com/download", "Run: ollama serve", "Pull a model: ollama pull qwen2.5-coder:7b", "a0 auto-discovers models from /api/tags"] },
    models: [
      { id: "llama3.2", label: "Llama 3.2 (Ollama)", context: 128_000, tools: true, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    tier: "local",
    baseUrl: "http://127.0.0.1:1234/v1",
    keyEnv: "A0_LMSTUDIO_KEY",
    keyless: true,
    rpm: 1000,
    freeTier: true,
    note: "Local models via LM Studio. No key needed.",
    setup: { url: "https://lmstudio.ai", steps: ["Download LM Studio: https://lmstudio.ai", "Load a model and start the server", "Default endpoint: http://127.0.0.1:1234/v1"] },
    models: [
      { id: "local-model", label: "LM Studio Local", context: 32_000, tools: true, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "vllm",
    label: "vLLM",
    tier: "local",
    baseUrl: "http://127.0.0.1:8000/v1",
    keyEnv: "A0_VLLM_KEY",
    keyless: true,
    rpm: 1000,
    freeTier: true,
    note: "Local models via vLLM. No key needed.",
    setup: { url: "https://docs.vllm.ai", steps: ["Install vLLM: pip install vllm", "Run: vllm serve <model>", "Default endpoint: http://127.0.0.1:8000/v1"] },
    models: [
      { id: "default", label: "vLLM Default", context: 32_000, tools: false, vision: false, quality: 3, fast: true },
    ],
  },
  {
    id: "llamacpp",
    label: "llama.cpp server",
    tier: "local",
    baseUrl: "http://127.0.0.1:8080/v1",
    keyEnv: "A0_LLAMACPP_KEY",
    keyless: true,
    rpm: 1000,
    freeTier: true,
    note: "Local models via llama.cpp server. No key needed.",
    setup: { url: "https://github.com/ggml-org/llama.cpp", steps: ["Build llama.cpp with server support", "Run: llama-server -m model.gguf", "Default endpoint: http://127.0.0.1:8080/v1"] },
    models: [
      { id: "default", label: "llama.cpp Default", context: 32_000, tools: false, vision: false, quality: 3, fast: true },
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
