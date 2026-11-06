// The enhancement layer. a0 never forwards a raw client prompt: every request
// gets a short, fixed operating contract merged into its system message, plus
// task-specific guidance derived from the analysis. Idempotent by design.

export const MARK = "[[a0:core:v1]]";

const CORE = `${MARK}
You are the model behind a0's gateway. Follow this contract exactly:
- Answer with the result. No preamble, no restating the request, no "Sure", no code echo.
- Prefer a minimal diff or the exact files/code needed. End with one short verification step at most.
- Ground every claim in the provided context. Never invent APIs, files, flags, or facts. If something is unknown, say so in one line.
- If a tool call is needed, emit it directly. Do not narrate what you are about to do.
- Ask at most one clarifying question, and only when the task is genuinely ambiguous.
- Optimize for the user's next action, not for the completeness of the explanation.`;

function taskLines(a) {
  const lines = [];
  if (a.vision) lines.push("- Inspect the image before concluding; describe only what is visible.");
  if (a.tools) lines.push("- Keep tool payloads minimal and valid JSON. One tool call per step unless parallel calls are safe.");
  if (a.difficulty >= 3) lines.push("- Decide on one plan, then execute it. Do not explore alternatives in the output.");
  if (a.longContext) lines.push("- Use the supplied context. Do not ask for files that are already present.");
  if (a.wantsJson) lines.push("- Return exactly one valid JSON value, no markdown fence, no commentary.");
  return lines.join("\n");
}

export function directive(analysis) {
  const extra = taskLines(analysis);
  return extra ? `${CORE}\n${extra}` : CORE;
}

/** Return a copy of the request with a0's contract applied. */
export function enhanceBody(body, analysis, cfg) {
  if (!cfg?.enhance) return body;
  const out = structuredClone(body);
  if (!Array.isArray(out.messages)) out.messages = [];

  const text = directive(analysis);
  const first = out.messages[0];

  if (first && first.role === "system") {
    if (typeof first.content === "string") {
      if (!first.content.includes(MARK)) first.content = `${text}\n\n${first.content}`;
    } else if (Array.isArray(first.content)) {
      if (!JSON.stringify(first.content).includes(MARK)) {
        first.content.unshift({ type: "text", text });
      }
    } else {
      first.content = text;
    }
  } else {
    out.messages.unshift({ role: "system", content: text });
  }
  return out;
}

const LEADING_FILLER =
  /^(sure|certainly|of course|absolutely|great|okay|ok)[!.,:]?\s*$/i;
const TRAILING_FILLER =
  /^(let me know if (you need|there'?s) (anything|more).*|hope (this|that) helps.*|feel free to ask.*)$/i;

/** Conservative cleanup for non-stream answers. Never touches code blocks. */
export function cleanOutputText(text, cfg) {
  if (!cfg?.cleanOutput || typeof text !== "string") return text;
  const lines = text.split("\n");
  while (lines.length && LEADING_FILLER.test(lines[0].trim())) lines.shift();
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && TRAILING_FILLER.test(lines[lines.length - 1].trim())) lines.pop();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  const cleaned = lines.join("\n");
  return cleaned.trim() ? cleaned : text;
}
