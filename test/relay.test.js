import test from "node:test";
import assert from "node:assert/strict";

import { relayOnce, relayStream } from "../src/relay.js";
import { fakeUpstream, provider, testCfg, MockRes } from "./helpers.js";

const M = { id: "tiny", tools: true, vision: false, context: 32_000, quality: 3 };

test("non-stream fails over to the next lane", async () => {
  const bad = await fakeUpstream((req, res) => {
    res.writeHead(500);
    res.end("boom");
  });
  const good = await fakeUpstream((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }] }));
  });
  try {
    const p1 = provider("bad", bad.url, [M]);
    const p2 = provider("good", good.url, [M]);
    const result = await relayOnce({
      cfg: testCfg(),
      body: { model: "x", messages: [{ role: "user", content: "hi" }] },
      candidates: [
        { provider: p1, model: p1.models[0] },
        { provider: p2, model: p2.models[0] },
      ],
    });
    assert.equal(result.provider, "good");
    assert.equal(result.json.choices[0].message.content, "ok");
  } finally {
    await bad.close();
    await good.close();
  }
});

test("stream race commits to the first usable lane", async () => {
  const slow = await fakeUpstream((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write('data: {"choices":[{"delta":{"content":"slow"}}]}\n\n');
      res.end("data: [DONE]\n\n");
    }, 300);
  });
  const fast = await fakeUpstream((req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"choices":[{"delta":{"content":"fast"}}]}\n\n');
    res.end("data: [DONE]\n\n");
  });
  try {
    const p1 = provider("slow", slow.url, [M]);
    const p2 = provider("fast", fast.url, [M]);
    const out = new MockRes();
    const meta = await relayStream({
      cfg: testCfg({ race: 2 }),
      body: { model: "x", stream: true, messages: [{ role: "user", content: "hi" }] },
      candidates: [
        { provider: p1, model: p1.models[0] },
        { provider: p2, model: p2.models[0] },
      ],
      res: out,
    });
    assert.equal(meta.provider, "fast");
    assert.match(out.body(), /fast/);
    assert.ok(out.ended);
  } finally {
    await slow.close();
    await fast.close();
  }
});

test("non-stream best-of keeps the better answer", async () => {
  const weak = await fakeUpstream((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "I can't help" }, finish_reason: "stop" }] }));
  });
  const strong = await fakeUpstream((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: "```js\nconst x = 1;\n```" }, finish_reason: "stop" }],
      }),
    );
  });
  try {
    const p1 = provider("weak", weak.url, [M]);
    const p2 = provider("strong", strong.url, [M]);
    const result = await relayOnce({
      cfg: testCfg({ bestOf: 2 }),
      body: { model: "x", messages: [{ role: "user", content: "hi" }] },
      candidates: [
        { provider: p1, model: p1.models[0] },
        { provider: p2, model: p2.models[0] },
      ],
    });
    assert.equal(result.provider, "strong");
  } finally {
    await weak.close();
    await strong.close();
  }
});
