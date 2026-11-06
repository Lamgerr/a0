import test from "node:test";
import assert from "node:assert/strict";

import { analyze } from "../src/classify.js";
import { enhanceBody, cleanOutputText, MARK } from "../src/enhance.js";

test("a prompt without a system message gets one", () => {
  const body = { model: "a0/auto", messages: [{ role: "user", content: "hi" }] };
  const out = enhanceBody(body, analyze(body), { enhance: true });
  assert.equal(out.messages[0].role, "system");
  assert.ok(out.messages[0].content.includes(MARK));
  assert.equal(out.messages.length, 2);
});

test("an existing system message is preserved and prefixed", () => {
  const body = {
    model: "a0/auto",
    messages: [
      { role: "system", content: "You are Cline." },
      { role: "user", content: "hi" },
    ],
  };
  const out = enhanceBody(body, analyze(body), { enhance: true });
  assert.equal(out.messages.length, 2);
  assert.ok(out.messages[0].content.includes(MARK));
  assert.ok(out.messages[0].content.includes("You are Cline."));
});

test("enhancement is idempotent", () => {
  const body = { model: "a0/auto", messages: [{ role: "user", content: "hi" }] };
  const once = enhanceBody(body, analyze(body), { enhance: true });
  const twice = enhanceBody(once, analyze(once), { enhance: true });
  const count = twice.messages[0].content.split(MARK).length - 1;
  assert.equal(count, 1);
});

test("enhancement can be disabled", () => {
  const body = { model: "a0/auto", messages: [{ role: "user", content: "hi" }] };
  const out = enhanceBody(body, analyze(body), { enhance: false });
  assert.equal(out.messages.length, 1);
});

test("clean output removes filler but keeps content", () => {
  assert.equal(cleanOutputText("Sure!\n\nhello", { cleanOutput: true }), "hello");
  assert.equal(
    cleanOutputText("done\n\nLet me know if you need anything else.", { cleanOutput: true }),
    "done",
  );
  assert.equal(cleanOutputText("```js\nx\n```", { cleanOutput: true }), "```js\nx\n```");
});
