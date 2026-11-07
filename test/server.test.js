import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../src/server.js";
import { MARK } from "../src/enhance.js";
import { fakeUpstream, provider, testCfg } from "./helpers.js";

const M = { id: "tiny", tools: true, vision: false, context: 32_000, quality: 3, fast: true };

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(resolve);
  });
}

function chat(base, body, extraHeaders = {}) {
  return fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

test("/v1/models lists categories and lanes", async () => {
  const up = await fakeUpstream((req, res) => res.end("{}"));
  const a0 = createServer({ cfg: testCfg(), providers: [provider("fake", up.url, [M])] });
  const base = await listen(a0);
  try {
    const res = await fetch(`${base}/v1/models`);
    const json = await res.json();
    const ids = json.data.map((m) => m.id);
    assert.ok(ids.includes("a0"));
    assert.ok(ids.includes("a0/auto"));
    assert.ok(ids.includes("fake-tiny-free"));
  } finally {
    await close(a0);
    await up.close();
  }
});

test("non-stream: enhances the prompt, routes, and cleans filler", async () => {
  let seen;
  const up = await fakeUpstream((req, res, raw) => {
    seen = JSON.parse(raw);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: "Sure!\n\nhello" }, finish_reason: "stop" }],
      }),
    );
  });
  const a0 = createServer({ cfg: testCfg(), providers: [provider("fake", up.url, [M])] });
  const base = await listen(a0);
  try {
    const res = await chat(base, { model: "a0/fast", messages: [{ role: "user", content: "hi" }] });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.choices[0].message.content, "hello");
    assert.equal(seen.model, "tiny");
    assert.equal(seen.messages[0].role, "system");
    assert.ok(seen.messages[0].content.includes(MARK));
    assert.equal(seen.messages[1].content, "hi");
  } finally {
    await close(a0);
    await up.close();
  }
});

test("stream: passes SSE through untouched", async () => {
  const up = await fakeUpstream((req, res, raw) => {
    const body = JSON.parse(raw);
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: body.stream ? "hi" : "?" } }] })}\n\n`);
    res.end("data: [DONE]\n\n");
  });
  const a0 = createServer({ cfg: testCfg(), providers: [provider("fake", up.url, [M])] });
  const base = await listen(a0);
  try {
    const res = await chat(base, {
      model: "a0/fast",
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /text\/event-stream/);
    const text = await res.text();
    assert.match(text, /hi/);
    assert.match(text, /\[DONE\]/);
  } finally {
    await close(a0);
    await up.close();
  }
});

test("a configured token is required", async () => {
  const up = await fakeUpstream((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }] }));
  });
  const a0 = createServer({
    cfg: testCfg({ token: "sekret" }),
    providers: [provider("fake", up.url, [M])],
  });
  const base = await listen(a0);
  try {
    const no = await chat(base, { model: "a0/fast", messages: [{ role: "user", content: "hi" }] });
    assert.equal(no.status, 401);
    const yes = await chat(
      base,
      { model: "a0/fast", messages: [{ role: "user", content: "hi" }] },
      { authorization: "Bearer sekret" },
    );
    assert.equal(yes.status, 200);
  } finally {
    await close(a0);
    await up.close();
  }
});
