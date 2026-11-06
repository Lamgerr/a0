import test from "node:test";
import assert from "node:assert/strict";

import { analyze } from "../src/classify.js";
import { route, diverse, RouteError } from "../src/router.js";
import { provider, testCfg } from "./helpers.js";

const textOnly = provider("text", "http://text.local", [
  { id: "t", tools: false, vision: false, context: 32_000, quality: 5 },
]);
const toolLane = provider("tool", "http://tool.local", [
  { id: "x", tools: true, vision: false, context: 32_000, quality: 3 },
]);
const visionLane = provider("eye", "http://eye.local", [
  { id: "v", tools: true, vision: true, context: 128_000, quality: 4 },
]);

test("a tool request never reaches a chat-only lane", () => {
  const body = {
    model: "a0/code",
    tools: [{ type: "function", function: { name: "read_file", parameters: {} } }],
    messages: [{ role: "user", content: "fix it" }],
  };
  const plan = route(body, analyze(body), [textOnly, toolLane], testCfg());
  assert.equal(plan.candidates[0].provider.id, "tool");
});

test("vision without a vision lane is an explicit error", () => {
  const body = {
    model: "a0/auto",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "look" },
          { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
        ],
      },
    ],
  };
  assert.throws(
    () => route(body, analyze(body), [textOnly, toolLane], testCfg()),
    (err) => err instanceof RouteError && err.code === "no_vision_lane",
  );
});

test("vision routes to the vision lane", () => {
  const body = {
    model: "a0/auto",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "look" },
          { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
        ],
      },
    ],
  };
  const plan = route(body, analyze(body), [textOnly, visionLane], testCfg());
  assert.equal(plan.candidates[0].provider.id, "eye");
});

test("an unknown explicit model is rejected", () => {
  const body = { model: "nope/model", messages: [{ role: "user", content: "hi" }] };
  assert.throws(
    () => route(body, analyze(body), [textOnly], testCfg()),
    (err) => err instanceof RouteError && err.code === "model_not_found",
  );
});

test("a0/cheap keeps only keyless lanes", () => {
  const paid = provider(
    "paid",
    "http://paid.local",
    [{ id: "p", tools: true, vision: false, context: 32_000, quality: 5 }],
    { keyless: false },
  );
  paid.models[0].keyless = false;
  const body = { model: "a0/cheap", messages: [{ role: "user", content: "hi" }] };
  const plan = route(body, analyze(body), [paid, textOnly], testCfg());
  assert.equal(plan.candidates[0].provider.id, "text");
});

test("diverse picks distinct providers before repeating one", () => {
  const a = provider("a", "http://a", [{ id: "a1", tools: true, vision: false, context: 32_000, quality: 5 }]);
  const b = provider("b", "http://b", [{ id: "b1", tools: true, vision: false, context: 32_000, quality: 4 }]);
  const cands = [
    { provider: a, model: a.models[0] },
    { provider: a, model: { ...a.models[0], id: "a2" } },
    { provider: b, model: b.models[0] },
  ];
  const picked = diverse(cands, 2);
  assert.equal(picked.length, 2);
  assert.notEqual(picked[0].provider.id, picked[1].provider.id);
});
