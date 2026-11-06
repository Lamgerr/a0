import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  CHECK_INTERVAL_MS,
  PACKAGE,
  checkLatest,
  compareVersions,
  installLatest,
  maybeCheck,
} from "../src/update.js";

function fakeResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  impl.calls = calls;
  return impl;
}

function fakeSpawn(result) {
  const calls = [];
  const impl = (cmd, args, options) => {
    calls.push({ cmd, args, options });
    const child = new EventEmitter();
    process.nextTick(() => {
      if (result.error) child.emit("error", new Error(result.error));
      else child.emit("exit", result.code ?? 0);
    });
    return child;
  };
  impl.calls = calls;
  return impl;
}

test("the default npm package is a0-gateway, not the unrelated a0 package", () => {
  assert.equal(PACKAGE, "a0-gateway");
});

test("versions compare numerically, not lexically", () => {
  assert.equal(compareVersions("0.10.0", "0.9.9"), 1);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
  assert.equal(compareVersions("v2.0.0", "10.0.0"), -1);
  assert.equal(compareVersions("1.2", "1.2.0"), 0);
  assert.equal(compareVersions("1.2.1", "1.2"), 1);
});

test("checkLatest reports an available update", async () => {
  const fetchImpl = fakeFetch(async () => fakeResponse({ version: "9.9.9" }));
  const result = await checkLatest({ fetchImpl, current: "0.1.0", packageName: "a0" });
  assert.equal(result.ok, true);
  assert.equal(result.latest, "9.9.9");
  assert.equal(result.current, "0.1.0");
  assert.equal(result.update, true);
  assert.match(fetchImpl.calls[0].url, /registry\.npmjs\.org\/a0\/latest$/);
});

test("checkLatest reports no update when the running version is current or newer", async () => {
  const same = await checkLatest({
    fetchImpl: fakeFetch(async () => fakeResponse({ version: "0.1.0" })),
    current: "0.1.0",
  });
  assert.equal(same.ok, true);
  assert.equal(same.update, false);

  const ahead = await checkLatest({
    fetchImpl: fakeFetch(async () => fakeResponse({ version: "0.1.0" })),
    current: "0.2.0",
  });
  assert.equal(ahead.update, false);
});

test("checkLatest degrades gracefully on HTTP errors and network failures", async () => {
  const missing = await checkLatest({
    fetchImpl: fakeFetch(async () => fakeResponse({}, { ok: false, status: 404 })),
    current: "0.1.0",
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);

  const timeout = await checkLatest({
    fetchImpl: fakeFetch(async () => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    }),
    current: "0.1.0",
  });
  assert.equal(timeout.ok, false);
  assert.equal(timeout.error, "timeout");
});

test("maybeCheck is a no-op when auto-check is off", async () => {
  const fetchImpl = fakeFetch(async () => fakeResponse({ version: "9.9.9" }));
  const result = await maybeCheck({ updates: { autoCheck: false, lastCheck: 0 } }, { fetchImpl });
  assert.equal(result, null);
  assert.equal(fetchImpl.calls.length, 0);
});

test("maybeCheck respects the daily interval", async () => {
  const now = 1_700_000_000_000;
  const fetchImpl = fakeFetch(async () => fakeResponse({ version: "9.9.9" }));
  const cfg = { updates: { autoCheck: true, lastCheck: now - 1000 } };
  const result = await maybeCheck(cfg, { fetchImpl, now });
  assert.equal(result, null);
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(cfg.updates.lastCheck, now - 1000, "a skipped check does not touch lastCheck");
});

test("a stale check hits npm once and records the time", async () => {
  const now = 1_700_000_000_000;
  const fetchImpl = fakeFetch(async () => fakeResponse({ version: "9.9.9" }));
  const cfg = { updates: { autoCheck: true, lastCheck: now - CHECK_INTERVAL_MS - 1 } };
  const result = await maybeCheck(cfg, { fetchImpl, now });
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(result.checked, true);
  assert.equal(result.update, true);
  assert.equal(cfg.updates.lastCheck, now);
});

test("installLatest runs the global npm install and reports success", async () => {
  const spawnImpl = fakeSpawn({ code: 0 });
  const result = await installLatest({ spawnImpl, packageName: "a0" });
  assert.deepEqual(result, { ok: true, code: 0 });
  assert.equal(spawnImpl.calls[0].args.at(-1), "a0@latest");
  assert.deepEqual(spawnImpl.calls[0].args.slice(0, 2), ["install", "-g"]);
});

test("installLatest reports a non-zero exit and a spawn error", async () => {
  const failed = await installLatest({ spawnImpl: fakeSpawn({ code: 1 }), packageName: "a0" });
  assert.deepEqual(failed, { ok: false, code: 1 });

  const errored = await installLatest({
    spawnImpl: fakeSpawn({ error: "npm not found" }),
    packageName: "a0",
  });
  assert.equal(errored.ok, false);
  assert.match(errored.error, /npm not found/);
});
