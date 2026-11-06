import test from "node:test";
import assert from "node:assert/strict";

import { analyze } from "../src/classify.js";

test("plain short text is a fast request", () => {
  const a = analyze({ model: "a0/auto", messages: [{ role: "user", content: "say hi" }] });
  assert.equal(a.vision, false);
  assert.equal(a.tools, false);
  assert.equal(a.difficulty, 1);
  assert.equal(a.category, "a0/fast");
});

test("image content marks the request as vision", () => {
  const a = analyze({
    model: "a0/auto",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "what is this?" },
          { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
        ],
      },
    ],
  });
  assert.equal(a.vision, true);
});

test("tools force the code path and a higher difficulty", () => {
  const a = analyze({
    model: "a0/auto",
    tools: [{ type: "function", function: { name: "read_file", parameters: {} } }],
    messages: [{ role: "user", content: "fix the bug" }],
  });
  assert.equal(a.tools, true);
  assert.equal(a.code, true);
  assert.equal(a.category, "a0/code");
  assert.ok(a.difficulty >= 2);
});

test("large prompts are classified as long context", () => {
  const big = "x".repeat(160_000); // ~40k tokens
  const a = analyze({ model: "a0/auto", messages: [{ role: "user", content: big }] });
  assert.equal(a.longContext, true);
  assert.equal(a.difficulty, 3);
});

test("an explicit raw model is preserved", () => {
  const a = analyze({ model: "gpt-oss-120b", messages: [{ role: "user", content: "hi" }] });
  assert.equal(a.explicitModel, "gpt-oss-120b");
});
