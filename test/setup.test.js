import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PROVIDERS, resolveProviders } from "../src/registry.js";
import { DEFAULTS } from "../src/config.js";
import {
  applySetupMode,
  guideLines,
  modeSummary,
  optional,
  recommended,
  RECOMMENDED_IDS,
  OPTIONAL_IDS,
} from "../src/setup.js";

function cfgWith(providers = {}) {
  return { ...structuredClone(DEFAULTS), providers };
}

const ids = (providers) => providers.map((p) => p.id);

test("no keys means keyless mode and the anonymous pool is on", () => {
  const cfg = cfgWith();
  const result = applySetupMode(cfg);
  assert.equal(result.mode, "keyless");
  const providers = resolveProviders(cfg);
  for (const id of ["llm7", "pollinations", "kilo"]) {
    assert.equal(providers.find((p) => p.id === id).enabled, true, `${id} should be on`);
  }
  assert.equal(cfg.routing.preferKeyless, true);
  assert.match(modeSummary(result), /anonymous pool/);
});

test("one key switches to keyed mode and disables anonymous lanes", () => {
  const cfg = cfgWith({ groq: { key: "gsk_test", enabled: true } });
  const result = applySetupMode(cfg);
  assert.equal(result.mode, "keyed");
  const providers = resolveProviders(cfg);
  assert.equal(providers.find((p) => p.id === "groq").enabled, true);
  for (const id of ["llm7", "pollinations", "kilo"]) {
    assert.equal(providers.find((p) => p.id === id).enabled, false, `${id} should be off`);
  }
  assert.deepEqual(result.disabled.sort(), ["kilo", "llamacpp", "llm7", "lmstudio", "ollama", "pollinations", "vllm"]);
  assert.equal(cfg.routing.preferKeyless, false);
});

test("a key on a keyless-capable lane keeps that lane enabled", () => {
  const cfg = cfgWith({ kilo: { key: "kilocode_test", enabled: true } });
  const result = applySetupMode(cfg);
  assert.equal(result.mode, "keyed");
  const providers = resolveProviders(cfg);
  assert.equal(providers.find((p) => p.id === "kilo").enabled, true);
  assert.equal(providers.find((p) => p.id === "llm7").enabled, false);
  assert.equal(providers.find((p) => p.id === "pollinations").enabled, false);
  assert.ok(result.keyed.includes("kilo"));
});

test("the recommended set is ordered and the optional set is separate", () => {
  const providers = resolveProviders(cfgWith());
  assert.deepEqual(ids(recommended(providers)), RECOMMENDED_IDS);
  assert.deepEqual(RECOMMENDED_IDS, ["kilo", "xkiro", "groq", "zai"]);
  assert.deepEqual(ids(optional(providers)), OPTIONAL_IDS);
  assert.deepEqual(OPTIONAL_IDS, ["openrouter", "mimo", "alibaba", "openai", "gemini"]);
  // many providers now (46 total)
  assert.ok(resolveProviders(cfgWith()).length >= 40, "should have 40+ providers");
});

test("every provider carries setup guidance", () => {
  for (const p of resolveProviders(cfgWith())) {
    assert.ok(p.setup?.url, `${p.id} needs a key URL`);
    assert.ok(guideLines(p).length >= 2, `${p.id} needs guidance`);
  }
  const groq = resolveProviders(cfgWith()).find((p) => p.id === "groq");
  assert.match(guideLines(groq).join("\n"), /console\.groq\.com\/keys/);
});
