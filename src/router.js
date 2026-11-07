// The router: eligibility first, score second, diversity third. A lane is
// never asked to do something it cannot do — no tool call to a chat-only
// model, no image to a text-only one, no 200K prompt to a 32K window.

const CATEGORY_IDS = new Set([
  "a0",
  "a0/auto",
  "a0/code",
  "a0/reasoning",
  "a0/vision",
  "a0/fast",
  "a0/long",
  "a0/cheap",
]);

export class RouteError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function pool(providers) {
  const out = [];
  for (const p of providers) {
    if (!p.enabled) continue;
    for (const m of p.models) {
      if (m.enabled === false) continue;
      out.push({ provider: p, model: m });
    }
  }
  return out;
}

function score(m, analysis, cfg) {
  let s = (m.quality || 1) * 20;
  const cheap = analysis.category === "a0/cheap";
  const preferQuality = analysis.difficulty >= 3 || analysis.category === "a0/reasoning" || analysis.category === "a0/code";
  
  if (m.fast && (analysis.category === "a0/fast" || analysis.difficulty === 1)) s += 8;
  if (analysis.category === "a0/code") s += (m.quality || 1) * 2;
  if (analysis.category === "a0/reasoning" || analysis.difficulty >= 3) s += (m.quality || 1) * 4;
  if (analysis.category === "a0/long") s += Math.min(Math.floor((m.context || 0) / 8_000), 40);
  if (m.keyless && cfg?.routing?.preferKeyless) s += 4;
  if (cheap && m.keyless) s += 200;
  if (cheap && !m.keyless) s -= 200;
  
  // Cost awareness: prefer cheaper lanes when quality is sufficient
  // For simple tasks (difficulty 1), prefer fast/cheap lanes
  if (analysis.difficulty === 1 && !preferQuality) {
    if (m.fast) s += 15;
    if (m.keyless) s += 10;
  }
  
  // Cost optimization: prefer cheaper lanes when quality is sufficient
  if (cfg?.routing?.costOptimize !== false && analysis.difficulty <= 2) {
    if (m.keyless) s += 5;
    if (m.fast) s += 5;
  }
  
  // Penalize very low quality models for complex tasks
  if (preferQuality && (m.quality || 1) < 3) s -= 20;
  
  return s;
}

function eligible(c, analysis) {
  const { model: m } = c;
  if (analysis.vision && !m.vision) return "vision";
  if ((analysis.tools || analysis.category === "a0/code") && !m.tools) return "tools";
  if (analysis.category === "a0/cheap" && !m.keyless) return "cost";
  if (analysis.estTokens > (m.context || 0)) return "context";
  return "";
}

/** Pick the ordered candidate list for one request. */
export function route(body, analysis, providers, cfg) {
  const active = providers.filter((p) => p.enabled);
  const all = pool(active);

  if (analysis.explicitModel) {
    const hit = all.find(
      (c) => c.model.id === analysis.explicitModel || `${c.provider.id}::${c.model.id}` === analysis.explicitModel,
    );
    if (!hit) {
      throw new RouteError(
        "model_not_found",
        `unknown model "${analysis.explicitModel}" — use an a0/* category or a model from GET /v1/models`,
      );
    }
    return { candidates: [hit], category: hit.provider.id, degraded: false, reason: "explicit model" };
  }

  if (!CATEGORY_IDS.has(analysis.category)) {
    throw new RouteError("model_not_found", `unknown category "${analysis.category}"`);
  }

  // a0 and a0/auto are already resolved to the inferred category by analyze()
  const rejected = new Map();
  let eligibleList = all.filter((c) => {
    const why = eligible(c, analysis);
    if (why) rejected.set(why, (rejected.get(why) || 0) + 1);
    return !why;
  });

  let degraded = false;
  let reason = "";

  if (eligibleList.length === 0 && analysis.vision) {
    throw new RouteError(
      "no_vision_lane",
      "no vision-capable lane is enabled — add a key for OpenRouter, Gemini, or xKiro in `a0 config`",
      503,
    );
  }
  if (eligibleList.length === 0 && (analysis.tools || analysis.category === "a0/code")) {
    throw new RouteError(
      "no_tool_lane",
      "no tool-capable lane is enabled — agentic clients need one; add a key for Groq, OpenRouter, Gemini, or xKiro in `a0 config`",
      503,
    );
  }

  if (eligibleList.length === 0 && analysis.longContext) {
    // Nothing has the full window. Take the largest and say so.
    eligibleList = [...all]
      .filter((c) => (!analysis.vision || c.model.vision) && (!analysis.tools || c.model.tools))
      .sort((a, b) => (b.model.context || 0) - (a.model.context || 0))
      .slice(0, 1);
    degraded = true;
    reason = "no lane fits the full context window; using the largest";
  }

  if (eligibleList.length === 0) {
    throw new RouteError("no_lane", "no enabled lane can serve this request", 503);
  }

  const ordered = eligibleList
    .map((c) => ({ ...c, _score: score(c.model, analysis, cfg) }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...c }) => c);

  return { candidates: ordered, category: analysis.category, degraded, reason };
}

/** Take the top n candidates, preferring distinct providers so a race is real. */
export function diverse(candidates, n) {
  const picked = [];
  const used = new Set();
  const pickedSet = new Set();
  for (const c of candidates) {
    if (picked.length >= n) break;
    if (used.has(c.provider.id)) continue;
    used.add(c.provider.id);
    picked.push(c);
    pickedSet.add(c);
  }
  for (const c of candidates) {
    if (picked.length >= n) break;
    if (pickedSet.has(c)) continue;
    picked.push(c);
    pickedSet.add(c);
  }
  return picked;
}

export function routeErrorBody(err) {
  return {
    error: {
      message: err.message,
      type: "a0_route_error",
      code: err.code || "no_lane",
    },
  };
}
