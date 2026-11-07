// Request analysis. Cheap, deterministic, no model call: a0 decides what the
// request needs before it decides which lane serves it.
//
// Use cases detected:
//   chat     — conversational, short, no tools
//   code     — coding task, tools likely needed
//   research — information gathering, long-form
//   creative — writing, brainstorming
//   analysis — data analysis, reasoning
//   agent    — agentic loop with tool calls

const CODE_WORDS =
  /\b(refactor|debug|stack trace|compile|typecheck|unit test|migration|api|endpoint|function|class|component|regex|sql|docker|kubernetes|git|merge conflict|exception|segfault|memory leak|race condition|optimi[sz]e|architecture|schema|implement|build|create|fix|write code|code review|pull request|commit)\b/i;
const HARD_WORDS =
  /\b(design|architect|prove|formal|security|concurrency|distributed|from scratch|whole app|full[ -]?stack|end[ -]?to[ -]?end|benchmark|trade[ -]?off|why does|root cause|deep dive|comprehensive|thorough)\b/i;
const RESEARCH_WORDS =
  /\b(research|explain|describe|summarize|compare|analyze|investigate|explore|what is|how does|tell me about|overview|survey)\b/i;
const CREATIVE_WORDS =
  /\b(write|story|poem|essay|creative|brainstorm|idea|suggest|recommend|imagine)\b/i;
const AGENT_WORDS =
  /\b(step by step|plan|execute|run|automate|workflow|pipeline|orchestrat)\b/i;

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((p) => p && (p.type === "text" || p.type === "input_text") && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n");
}

function hasImage(content) {
  if (!Array.isArray(content)) return false;
  return content.some(
    (p) =>
      p &&
      (p.type === "image_url" ||
        p.type === "input_image" ||
        p.type === "image" ||
        (p.image_url && typeof p.image_url === "object")),
  );
}

/** Detect the primary use case from the request. */
function detectUseCase(text, tools, hasTools) {
  const lower = text.toLowerCase();
  if (hasImage(null) || /image|photo|screenshot|picture|diagram/i.test(lower)) return "vision";
  if (tools || hasTools) return "agent";
  if (CODE_WORDS.test(lower)) return "code";
  if (RESEARCH_WORDS.test(lower)) return "research";
  if (CREATIVE_WORDS.test(lower)) return "creative";
  if (HARD_WORDS.test(lower)) return "analysis";
  if (AGENT_WORDS.test(lower)) return "agent";
  return "chat";
}

/** Analyze an OpenAI chat request body. Pure; safe to unit test. */
export function analyze(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  let vision = false;
  let text = "";
  let textLen = 0;

  for (const msg of messages) {
    if (msg?.role === "assistant" && Array.isArray(msg.tool_calls)) {
      const names = msg.tool_calls.map((t) => t?.function?.name || "").join(" ");
      text += `\n${names}`;
      textLen += names.length;
    }
    if (hasImage(msg?.content)) vision = true;
    const ct = contentText(msg?.content);
    text += `\n${ct}`;
    textLen += ct.length;
  }

  const tools =
    (Array.isArray(body?.tools) && body.tools.length > 0) ||
    (Array.isArray(body?.functions) && body.functions.length > 0) ||
    body?.tool_choice !== undefined;

  const toolNames = tools ? (body?.tools || []).map((t) => t?.function?.name || "").join(" ") : "";
  const haystack = `${text}\n${toolNames}`;

  // Estimate tokens from accumulated text length
  const estTokens = Math.ceil((textLen + toolNames.length + messages.length * 20) / 4);

  const fenced = /```[\s\S]*?```/.test(text);
  const code = fenced || tools || CODE_WORDS.test(haystack);
  const longContext = estTokens > 24_000 || messages.length > 40;
  const wantsJson =
    body?.response_format?.type === "json_object" ||
    body?.response_format?.type === "json_schema" ||
    /\bjson\b/i.test(text);

  const useCase = detectUseCase(text, tools, Array.isArray(body?.tools) && body.tools.length > 0);

  let difficulty = 1;
  if (estTokens > 6_000) difficulty = 2;
  if (estTokens > 30_000) difficulty = 3;
  if (tools) difficulty = Math.max(difficulty, 2);
  if (code) difficulty = Math.max(difficulty, 2);
  if (HARD_WORDS.test(haystack)) difficulty = Math.max(difficulty, 2);
  if (longContext || HARD_WORDS.test(haystack) || estTokens > 30_000) difficulty = 3;
  if (useCase === "research" || useCase === "analysis") difficulty = Math.max(difficulty, 2);

  const requested = typeof body?.model === "string" ? body.model : "";
  const isCategory = requested === "a0" || requested.startsWith("a0/");
  let inferred;
  if (vision) inferred = "a0/vision";
  else if (longContext) inferred = "a0/long";
  else if (useCase === "code" || tools) inferred = "a0/code";
  else if (useCase === "research" || useCase === "analysis") inferred = "a0/reasoning";
  else if (difficulty === 1) inferred = "a0/fast";
  else inferred = "a0/auto";

  const category = isCategory && requested !== "a0" && requested !== "a0/auto" ? requested : inferred;

  return {
    category,
    explicitModel: requested && !isCategory ? requested : "",
    vision,
    tools: Boolean(tools),
    longContext,
    wantsJson,
    code,
    difficulty,
    estTokens,
    stream: Boolean(body?.stream),
    preview: text.replace(/\s+/g, " ").trim().slice(0, 160),
    useCase,
  };
}