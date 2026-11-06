import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadConfig, saveConfig, configPath, redact, DEFAULTS } from "../src/config.js";
import { resolveProviders, activeProviders } from "../src/registry.js";

test("config saves with owner-only permissions and round-trips", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "a0-config-"));
  const previous = process.env.A0_HOME;
  process.env.A0_HOME = dir;
  try {
    const cfg = loadConfig();
    assert.equal(cfg.port, DEFAULTS.port);
    cfg.port = 9999;
    cfg.providers.llm7 = { key: "sk-test-123456789" };
    saveConfig(cfg);
    assert.equal(statSync(configPath()).mode & 0o777, 0o600);
    const loaded = loadConfig();
    assert.equal(loaded.port, 9999);
    assert.equal(loaded.providers.llm7.key, "sk-test-123456789");
  } finally {
    if (previous === undefined) delete process.env.A0_HOME;
    else process.env.A0_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("redaction never exposes a full key", () => {
  const out = redact({ token: "abcdefghijkl", providers: { x: { key: "sk-1234567890" } } });
  assert.ok(!out.token.includes("abcdefghijkl"));
  assert.ok(!out.providers.x.key.includes("1234567890"));
});

test("keyless lanes are on, keyed lanes wait for a key", () => {
  const cfg = loadConfig();
  const providers = resolveProviders(cfg);
  const llm7 = providers.find((p) => p.id === "llm7");
  const groq = providers.find((p) => p.id === "groq");
  assert.equal(llm7.keyless, true);
  assert.equal(llm7.enabled, true);
  assert.equal(groq.enabled, false);
  assert.ok(activeProviders(providers).length >= 1);
});

test("a user key enables a keyed lane", () => {
  const cfg = loadConfig();
  cfg.providers.groq = { key: "gsk_test" };
  const groq = resolveProviders(cfg).find((p) => p.id === "groq");
  assert.equal(groq.enabled, true);
  assert.equal(groq.hasKey, true);
});
