// Request analysis. Cheap, deterministic, no model call: a0 decides what the
// request needs before it decides which lane serves it.

const CODE_WORDS =
  /\b(refactor|debug|stack trace|compile|typecheck|unit test|migration|api|endpoint|function|class|component|regex|sql|docker|kubernetes|git|merge conflict|exception|segfault|memory leak|race condition|optimi[sz]e|architecture|schema)\b/i;
const HARD_WORDS =
  /\b(design|architect|prove|formal|security|concurrency|distributed|from scratch|whole app|full[ -]?stack|end[ -]?to[ -]?end|benchmark|trade[ -]?off|why does|root cause)\b/i;

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

function withoutBinary(s) {
  return String(s).replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, "data:<image>");
}

/** Analyze an OpenAI chat request body. Pure; safe to unit test. */
export function analyze(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  let vision = false;
  let text = "";

  for (const msg of messages) {
    if (msg?.role === "assistant" && Array.isArray(msg.tool_calls)) {
      text += `\n${msg.tool_calls.map((t) => t?.function?.name || "").join(" ")}`;
    }
    if (hasImage(msg?.content)) vision = true;
    text += `\n${contentText(msg?.content)}`;
  }

  const tools =
    (Array.isArray(body?.tools) && body.tools.length > 0) ||
    (Array.isArray(body?.functions) && body.functions.length > 0) ||
    body?.tool_choice !== undefined;

  const raw = JSON.stringify(body?.messages || []);
  const estTokens = Math.ceil(withoutBinary(raw).length / 4);
  const haystack = `${text}\n${JSON.stringify((body?.tools || []).map((t) => t?.function?.name || ""))}`;

  const fenced = /```[\s\S]*?```/.test(text);
  const code = fenced || tools || CODE_WORDS.test(haystack);
  const longContext =
    estTokens > 24_000 || (Array.isArray(body?.messages) && body.messages.length > 40);
  const wantsJson =
    body?.response_format?.type === "json_object" ||
    body?.response_format?.type === "json_schema" ||
    /\bjson\b/i.test(text);

  let difficulty = 1;
  if (estTokens > 6_000) difficulty = 2;
  if (estTokens > 30_000) difficulty = 3;
  if (tools) difficulty = Math.max(difficulty, 2);
  if (code) difficulty = Math.max(difficulty, 2);
  if (HARD_WORDS.test(haystack)) difficulty = Math.max(difficulty, 2);
  if (longContext || HARD_WORDS.test(haystack) || estTokens > 30_000) difficulty = 3;

  const requested = typeof body?.model === "string" ? body.model : "";
  const inferred = vision
    ? "a0/vision"
    : longContext
      ? "a0/long"
      : code || tools
        ? "a0/code"
        : difficulty === 1
          ? "a0/fast"
          : "a0/auto";
  // a0/auto means "decide for me"; any other a0/* category is honored.
  const category = requested.startsWith("a0/") && requested !== "a0/auto" ? requested : inferred;

  return {
    category,
    explicitModel: requested && !requested.startsWith("a0/") ? requested : "",
    vision,
    tools: Boolean(tools),
    longContext,
    wantsJson,
    code,
    difficulty,
    estTokens,
    stream: Boolean(body?.stream),
    preview: text.replace(/\s+/g, " ").trim().slice(0, 160),
  };
}
