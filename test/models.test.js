import test from "node:test";
import assert from "node:assert/strict";

import {
  activeProviders,
  catalog,
  findModel,
  modelCounts,
  resolveProviders,
  setModelEnabled,
} from "../src/registry.js";
import { route, RouteError } from "../src/router.js";
import { DEFAULTS } from "../src/config.js";

function cfgWith(providers = {}) {
  return { ...structuredClone(DEFAULTS), providers };
}

function providers(providersCfg = {}) {
  return resolveProviders(cfgWith(providersCfg));
}

const analysis = (over = {}) => ({
  explicitModel: "",
  category: "a0/auto",
  vision: false,
  tools: false,
  estTokens: 10,
  difficulty: 1,
  ...over,
});

test("a model starts enabled and disabling it is recorded as a disabled list", () => {
  const cfg = cfgWith();
  const before = providers().find((p) => p.id === "groq");
  assert.equal(before.models.every((m) => m.enabled !== false), true);
  assert.deepEqual(modelCounts(before), { enabled: before.models.length, total: before.models.length });

  const models = before.models.map((m) => m.id);
  setModelEnabled(cfg, "groq", models[0], false, models);
  assert.deepEqual(cfg.providers.groq.disabled, [models[0]]);

  const after = resolveProviders(cfg).find((p) => p.id === "groq");
  assert.equal(after.models[0].enabled, false);
  assert.equal(after.models[1].enabled, true);
  assert.deepEqual(modelCounts(after), { enabled: models.length - 1, total: models.length });
});

test("re-enabling the last disabled model drops the empty disabled array", () => {
  const cfg = cfgWith({ groq: { key: "gsk_test", disabled: ["gpt-oss-120b"] } });
  const before = resolveProviders(cfg).find((p) => p.id === "groq");
  const models = before.models.map((m) => m.id);
  setModelEnabled(cfg, "groq", "gpt-oss-120b", true, models);
  assert.equal("disabled" in cfg.providers.groq, false);
});

test("disabled ids that are not on the lane are not persisted", () => {
  const cfg = cfgWith({ groq: { key: "gsk_test" } });
  const before = resolveProviders(cfg).find((p) => p.id === "groq");
  const models = before.models.map((m) => m.id);
  setModelEnabled(cfg, "groq", "not-a-real-model", false, models);
  assert.equal("disabled" in cfg.providers.groq, false);
});

test("a lane with every model disabled is inactive and leaves the catalog", () => {
  const cfg = cfgWith({ groq: { key: "gsk_test" } });
  const groq = providers({ groq: { key: "gsk_test" } }).find((p) => p.id === "groq");
  const models = groq.models.map((m) => m.id);
  for (const id of models) setModelEnabled(cfg, "groq", id, false, models);

  const after = resolveProviders(cfg);
  assert.equal(after.find((p) => p.id === "groq").enabled, true);
  assert.equal(activeProviders(after).some((p) => p.id === "groq"), false);

  const ids = catalog(after).data.map((m) => m.id);
  for (const id of models) assert.equal(ids.includes(id), false, `${id} should be hidden`);
  assert.ok(ids.includes("a0/auto"), "categories stay listed");
});

test("the catalog exposes only enabled models, with the rest of the lane intact", () => {
  const cfg = cfgWith({ groq: { key: "gsk_test", disabled: ["gpt-oss-120b"] } });
  const list = catalog(resolveProviders(cfg)).data;
  assert.equal(list.some((m) => m.id === "gpt-oss-120b"), false);
  assert.ok(list.some((m) => m.id === "qwen/qwen3.8-27b"));
});

test("findModel skips disabled models, including the provider::model form", () => {
  const cfg = cfgWith({ groq: { key: "gsk_test", disabled: ["gpt-oss-120b"] } });
  const list = resolveProviders(cfg);
  assert.equal(findModel(list, "gpt-oss-120b"), null);
  assert.equal(findModel(list, "groq::gpt-oss-120b"), null);
  assert.equal(findModel(list, "qwen/qwen3.8-27b").provider.id, "groq");
});

test("the router will not route to a disabled model, even when named explicitly", () => {
  const cfg = cfgWith({ groq: { key: "gsk_test", disabled: ["gpt-oss-120b"] } });
  const list = resolveProviders(cfg);

  assert.throws(
    () => route({}, analysis({ explicitModel: "gpt-oss-120b" }), list, cfg),
    (err) => err instanceof RouteError && err.code === "model_not_found",
  );
  const hit = route({}, analysis({ explicitModel: "qwen/qwen3.8-27b" }), list, cfg);
  assert.equal(hit.candidates[0].model.id, "qwen/qwen3.8-27b");
});

test("a disabled model never appears in an ordinary routed candidate list", () => {
  const cfg = cfgWith({ groq: { key: "gsk_test", disabled: ["gpt-oss-120b"] } });
  const list = resolveProviders(cfg);
  const result = route({}, analysis({ category: "a0/reasoning" }), list, cfg);
  assert.equal(
    result.candidates.some((c) => c.model.id === "gpt-oss-120b"),
    false,
  );
});
