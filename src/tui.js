// TUI — full-screen, OpenCode-inspired. Zero dependencies, ANSI only.
// Uses alternate screen buffer. Mouse + keyboard navigation.
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { resolveProviders, modelCounts, setModelEnabled, activeProviders } from "./registry.js";
import { mask, saveConfig as persist, redact, VERSION } from "./config.js";
import { applySetupMode, guideLines, modeSummary, optional, recommended } from "./setup.js";
import { checkLatest, installLatest } from "./update.js";

// ── terminal helpers ──────────────────────────────────────────────────────
const tty = Boolean(stdout.isTTY);
const ESC = "\x1b";
const ALT_ON = `${ESC}[?1049h${ESC}[?25l`;
const ALT_OFF = `${ESC}[?25h${ESC}[?1049l`;
const CLEAR = `${ESC}[2J${ESC}[H`;
const RESET = `${ESC}[0m`;
const MOUSE_ON = `${ESC}[?1000h${ESC}[?1002h${ESC}[?1015h${ESC}[?1006h`;
const MOUSE_OFF = `${ESC}[?1006l${ESC}[?1015l${ESC}[?1002l${ESC}[?1000l`;

const c = (code) => (s) => tty ? `${ESC}[${code}m${s}${RESET}` : String(s);
const bold = c("1"); const dim = c("2");
const fg = {
  cyan: c("36"), green: c("32"), yellow: c("33"), red: c("31"),
  blue: c("34"), magenta: c("35"), white: c("37"), gray: c("90"),
  orange: c("38;5;208"),
};
const bg = { blue: c("44"), dark: c("48;5;236"), highlight: c("48;5;24") };

const BOX = { tl:"┌", tr:"┐", bl:"└", br:"┘", h:"─", v:"│" };

function termSize() { return { w: stdout.columns || 80, h: stdout.rows || 24 }; }
function move(r, col) { stdout.write(`${ESC}[${r};${col}H`); }
function writeAt(r, col, text) { move(r, col); stdout.write(text); }
function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ""); }

// ── input handling ────────────────────────────────────────────────────────
let keyHandler = null;
let inputBuffer = "";

function setupRawInput() {
  if (!stdin.isTTY) return;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  stdin.on("data", (chunk) => { inputBuffer += chunk; processInput(); });
  stdout.write(MOUSE_ON);
}

function processInput() {
  while (inputBuffer.length > 0) {
    let consumed = false;
    if (inputBuffer.startsWith("\x1b[<")) {
      const match = inputBuffer.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
      if (match) {
        const btn = parseInt(match[1], 10);
        const col = parseInt(match[2], 10);
        const row = parseInt(match[3], 10);
        const type = match[4] === "M" ? "press" : "release";
        inputBuffer = inputBuffer.slice(match[0].length);
        if (keyHandler) keyHandler({ type: "mouse", btn, col, row, action: type });
        consumed = true;
      } else break;
    } else if (inputBuffer.startsWith("\x1b[")) {
      const match = inputBuffer.match(/^\x1b\[[0-9;]*[A-Za-z]/);
      if (match) {
        const seq = match[0];
        inputBuffer = inputBuffer.slice(seq.length);
        if (keyHandler) keyHandler({ type: "key", key: seq });
        consumed = true;
      } else break;
    } else if (inputBuffer.startsWith("\x1b")) {
      inputBuffer = inputBuffer.slice(1);
      if (keyHandler) keyHandler({ type: "key", key: "escape" });
      consumed = true;
    } else {
      const ch = inputBuffer[0];
      inputBuffer = inputBuffer.slice(1);
      if (ch === "\r" || ch === "\n") { if (keyHandler) keyHandler({ type: "key", key: "enter" }); }
      else if (ch === "\t") { if (keyHandler) keyHandler({ type: "key", key: "tab" }); }
      else if (ch === "\x7f" || ch === "\b") { if (keyHandler) keyHandler({ type: "key", key: "backspace" }); }
      else if (ch === "\x03") { cleanup(); process.exit(0); }
      else if (ch >= " ") { if (keyHandler) keyHandler({ type: "char", char: ch }); }
      consumed = true;
    }
    if (!consumed) break;
  }
}

function setKeyHandler(handler) { keyHandler = handler; }
function cleanup() {
  stdout.write(MOUSE_OFF);
  if (stdin.isTTY) { stdin.setRawMode(false); stdin.pause(); }
  stdout.write(ALT_OFF);
}

// ── shared readline for forms ─────────────────────────────────────────────
let rl = null, lineQueue = [], lineWaiter = null;
function ensureReader() {
  if (rl) return;
  rl = readline.createInterface({ input: stdin, output: stdout, terminal: Boolean(stdout.isTTY) });
  rl.on("line", (line) => { if (lineWaiter) { const w = lineWaiter; lineWaiter = null; w(line); } else lineQueue.push(line); });
  rl.on("close", () => { if (lineWaiter) { const w = lineWaiter; lineWaiter = null; w(""); } });
}
function readLine() {
  ensureReader();
  if (lineQueue.length > 0) return Promise.resolve(lineQueue.shift());
  return new Promise((resolve) => { lineWaiter = resolve; });
}
export function closeInput() {
  if (rl) { rl.close(); rl = null; lineQueue.length = 0; lineWaiter = null; }
}
async function ask(question, def = "") {
  const suffix = def !== "" ? dim(` [${def}]`) : "";
  stdout.write(`${question}${suffix}: `);
  const answer = (await readLine()).trim();
  return answer === "" ? String(def) : answer;
}
async function confirm(question, def = true) {
  const answer = (await ask(`${question} ${dim("(y/n)")}`, def ? "y" : "n")).toLowerCase();
  return answer === "y" || answer === "yes";
}
export function promptSecret(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") { readLine().then((a) => resolve(a.trim())); return; }
    closeInput();
    stdin.setRawMode(true); stdin.resume();
    let value = "";
    const onData = (buf) => {
      const text = buf.toString("utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
      for (const ch of text) {
        if (ch === "\r" || ch === "\n") { cleanup2(); stdout.write("\n"); resolve(value); return; }
        if (ch === "\u0003") { cleanup2(); stdout.write("\n"); process.exit(130); }
        if (ch === "\u007f" || ch === "\b") { if (value) { value = value.slice(0, -1); stdout.write("\b \b"); } continue; }
        if (ch >= " " && ch !== "\u001b") { value += ch; stdout.write("•"); }
      }
    };
    const cleanup2 = () => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", onData); ensureReader(); };
    stdin.on("data", onData);
  });
}

// ── drawing primitives ────────────────────────────────────────────────────
export function clear() { if (tty) stdout.write("\x1b[2J\x1b[H"); }
export function banner() {
  clear();
  stdout.write(`\n${bold(fg.cyan("  a0"))} ${dim(`v${VERSION}`)}\n${dim("  OpenAI-compatible inference gateway")}\n`);
}

function drawBox(r, col, w, h, title = "", colorFn = (s) => s) {
  let top = BOX.tl;
  if (title) {
    const ts = ` ${title} `;
    const pad = w - 2 - ts.length;
    const lp = Math.floor(pad / 2), rp = pad - lp;
    top += "─".repeat(Math.max(0, lp)) + ts + "─".repeat(Math.max(0, rp)) + BOX.tr;
  } else top += "─".repeat(w - 2) + BOX.tr;
  writeAt(r, col, colorFn(top));
  for (let i = 1; i < h - 1; i++) { writeAt(r + i, col, colorFn(BOX.v)); writeAt(r + i, col + w - 1, colorFn(BOX.v)); }
  writeAt(r + h - 1, col, colorFn(BOX.bl + "─".repeat(w - 2) + BOX.br));
}

function drawStatusBar(items) {
  const { w, h } = termSize();
  const bar = items.join("  │  ");
  writeAt(h, 1, `${ESC}[7m${bar.padEnd(w).slice(0, w)}${RESET}`);
}

function drawHLine(r, col, w, ch = "─") { writeAt(r, col, ch.repeat(w)); }

// ── tier helpers ──────────────────────────────────────────────────────────
function tierLabel(p) {
  if (p.tier === "recommended") return fg.green("recommended");
  if (p.tier === "keyless") return dim("keyless");
  if (p.tier === "local") return fg.cyan("local");
  return fg.yellow("optional");
}
function capLine(p) {
  const caps = [tierLabel(p)];
  if (p.hasKey) caps.push(dim(`key ${mask(p.key)}`));
  else if (p.keyless) caps.push(dim("anonymous"));
  if (!p.freeTier) caps.push(fg.red("paid"));
  const { enabled, total } = modelCounts(p);
  if (p.keyless && !p.hasKey) caps.push(dim(`${total} curated`));
  else caps.push(dim(enabled === total ? `${total} models` : `${enabled}/${total} models`));
  return caps.join(" · ");
}
function providerList(providers) {
  return providers.map((p, i) => {
    const n = bold(String(i + 1).padStart(2));
    return `  ${n}. ${p.enabled ? fg.green("●") : dim("○")} ${p.label.padEnd(18)} ${capLine(p)}`;
  }).join("\n");
}
function saveKey(cfg, id, key) { cfg.providers[id] = { ...(cfg.providers[id] || {}), key, enabled: true }; }
function testProvider(p) {
  const url = `${p.baseUrl.replace(/\/+$/, "")}/models`;
  const started = Date.now();
  return fetch(url, { signal: AbortSignal.timeout(8000), headers: p.key ? { authorization: `Bearer ${p.key}` } : {} })
    .then((res) => ({ ok: res.ok, status: res.status, ms: Date.now() - started }))
    .catch((err) => ({ ok: false, status: err.name === "TimeoutError" ? "timeout" : err.message, ms: Date.now() - started }));
}

// ── setup wizard ──────────────────────────────────────────────────────────
export async function setupWizard(cfg) {
  banner();
  stdout.write(`\n${bold("Setup")}\n\na0 operates in two modes:\n  ${fg.green("keyed")}      provider API keys — better models, higher limits, failover\n  ${dim("keyless")}    anonymous free lanes, no signup required\n\nAdd at least two keys for racing and failover. Press enter to skip any key.\n`);
  const providers = resolveProviders(cfg);
  stdout.write(`\n${bold("Recommended providers")}\n`);
  for (const p of recommended(providers)) {
    stdout.write(`\n  ${bold(p.label)}  ${dim("· recommended")}\n`);
    for (const line of guideLines(p)) stdout.write(`    ${dim(line)}\n`);
    const key = (await promptSecret(`    Paste key ${dim("(enter to skip)")} `)).trim();
    if (key) { saveKey(cfg, p.id, key); stdout.write(`    ${fg.green("✓")} ${p.label} enabled\n`); }
  }
  const wantsOptional = await confirm("\nConfigure optional providers too?", false);
  if (wantsOptional) {
    for (const p of optional(providers)) {
      stdout.write(`\n  ${bold(p.label)}  ${dim("· optional")}\n`);
      for (const line of guideLines(p)) stdout.write(`    ${dim(line)}\n`);
      const key = (await promptSecret(`    Paste key ${dim("(enter to skip)")} `)).trim();
      if (key) { saveKey(cfg, p.id, key); stdout.write(`    ${fg.green("✓")} ${p.label} enabled\n`); }
    }
  }
  const mode = applySetupMode(cfg);
  stdout.write(`\n${bold("Mode")}  ${mode.mode === "keyed" ? fg.green(modeSummary(mode)) : dim(modeSummary(mode))}\n`);
  if (mode.mode === "keyed") {
    const keep = await confirm("Keep anonymous lanes on as a fallback?", false);
    if (keep) { for (const id of mode.disabled) cfg.providers[id] = { ...(cfg.providers[id] || {}), enabled: true }; cfg.routing.preferKeyless = true; }
  }
  stdout.write(`\n${bold("Server")}\n`);
  cfg.port = Number.parseInt(await ask("Port", String(cfg.port)), 10) || cfg.port;
  cfg.host = await ask("Bind host", cfg.host);
  stdout.write(`\n${bold("Behaviour")}\n`);
  cfg.enhance = await confirm("Enhance every prompt", cfg.enhance);
  cfg.race = Math.min(4, Math.max(1, Number.parseInt(await ask("Lanes raced in parallel", String(cfg.race)), 10) || cfg.race));
  stdout.write(`\n${bold("Updates")}\n`);
  cfg.updates = cfg.updates || {};
  cfg.updates.autoCheck = await confirm("Check for updates on startup", cfg.updates.autoCheck !== false);
  cfg.updates.autoInstall = await confirm("Install updates automatically", Boolean(cfg.updates.autoInstall));
  const file = persist(cfg);
  stdout.write(`\n${fg.green("✓")} saved ${dim(file)}\n`);
  await ask("Press enter to start a0", "");
  return cfg;
}

// ── model menu ────────────────────────────────────────────────────────────
export async function modelMenu(cfg, p) {
  banner();
  if (p.keyless && !p.hasKey) {
    stdout.write(`\n  ${bold(p.label)} is part of the anonymous pool.\n  ${dim("Models are curated and cannot be selected individually.")}\n  ${dim("Add a key to unlock per-model selection.")}\n${p.setup?.url ? `\n  ${dim("Get a key:")} ${p.setup.url}\n` : ""}\n`);
    await ask("Press enter", "");
    return;
  }
  if (!p.hasKey) {
    stdout.write(`\n  ${bold(p.label)} has no key.\n  ${dim("Add a key first:")} ${p.setup?.url || dim("see guide")}\n`);
    await ask("Press enter", "");
    return;
  }
  for (;;) {
    banner();
    const fresh = resolveProviders(cfg).find((x) => x.id === p.id) || p;
    const { enabled, total } = modelCounts(fresh);
    stdout.write(`\n${bold(`${fresh.label} models`)}\n\n`);
    for (const [i, m] of fresh.models.entries()) {
      const on = m.enabled !== false;
      const caps = [m.tools ? "tools" : "", m.vision ? "vision" : "", m.fast ? "fast" : ""].filter(Boolean).join(",");
      const meta = `${Math.round((m.context || 0) / 1000)}k${caps ? ` · ${caps}` : ""}`;
      stdout.write(`  ${on ? fg.green("●") : dim("○")} ${bold(String(i + 1).padStart(2))}. ${m.id.padEnd(34)} ${dim(meta)}\n`);
    }
    stdout.write(`\n  ${dim(`${enabled}/${total} enabled · toggle <n> · all · none · add · back`)}\n`);
    const input = (await ask("Command", "back")).trim().toLowerCase();
    const [cmd, arg] = input.split(/\s+/);
    if (cmd === "back" || cmd === "b") return;
    const ids = fresh.models.map((m) => m.id);
    if (cmd === "all") { for (const id of ids) setModelEnabled(cfg, fresh.id, id, true, ids); persist(cfg); continue; }
    if (cmd === "none") {
      if (!(await confirm(`Disable all ${total} models on ${fresh.label}?`, false))) continue;
      for (const id of ids) setModelEnabled(cfg, fresh.id, id, false, ids);
      persist(cfg); continue;
    }
    if (cmd === "add" || cmd === "a") {
      const modelId = (await ask("  Model id")).trim();
      if (!modelId) continue;
      const context = Number.parseInt(await ask("    Context tokens", "32000"), 10) || 32000;
      const tools = await confirm("    Supports tool calls?", true);
      const vision = await confirm("    Supports vision?", false);
      const quality = Math.min(5, Math.max(1, Number.parseInt(await ask("    Quality 1-5", "3"), 10) || 3));
      const fast = await confirm("    Fast lane?", false);
      const override = cfg.providers[fresh.id] || {};
      if (!Array.isArray(override.models)) override.models = fresh.models.map((m) => { const { providerId, providerLabel, keyless, enabled, ...rest } = m; return rest; });
      override.models.push({ id: modelId, label: modelId, context, tools, vision, quality, fast });
      cfg.providers[fresh.id] = override;
      persist(cfg);
      stdout.write(`    ${fg.green("✓")} ${modelId} added\n`);
      await ask("Press enter", "");
      continue;
    }
    const idx = Number.parseInt(arg, 10) - 1;
    const model = fresh.models[idx];
    if (!model) continue;
    if (cmd === "toggle" || cmd === "t") {
      const next = model.enabled === false;
      if (!next && enabled === 1) { stdout.write(`\n  ${fg.yellow("At least one model must stay enabled.")}\n`); await ask("Press enter", ""); continue; }
      setModelEnabled(cfg, fresh.id, model.id, next, ids);
      persist(cfg);
    }
  }
}

// ── provider menu ─────────────────────────────────────────────────────────
export async function providerMenu(cfg) {
  for (;;) {
    banner();
    const providers = resolveProviders(cfg);
    stdout.write(`\n${bold("Lanes")}\n${providerList(providers)}\n\n  ${dim("toggle <n> · key <n> · models <n> · guide <n> · test <n> · testall · back")}\n`);
    const input = (await ask("Command", "back")).trim().toLowerCase();
    const [cmd, arg] = input.split(/\s+/);
    if (cmd === "back" || cmd === "b") return;
    if (cmd === "testall") {
      stdout.write("\n");
      for (const p of providers.filter((x) => x.enabled)) {
        const r = await testProvider(p);
        stdout.write(`  ${r.ok ? fg.green("✓") : fg.red("✗")} ${p.label.padEnd(18)} ${r.status} ${dim(`${r.ms}ms`)}\n`);
      }
      await ask("\nPress enter", "");
      continue;
    }
    const idx = Number.parseInt(arg, 10) - 1;
    const p = providers[idx];
    if (!p) continue;
    cfg.providers[p.id] = cfg.providers[p.id] || {};
    if (cmd === "toggle" || cmd === "t") {
      if (!p.enabled && !p.keyless && !p.hasKey) {
        const key = (await promptSecret(`  ${p.label} API key: `)).trim();
        if (!key) continue;
        saveKey(cfg, p.id, key);
        persist(cfg); continue;
      }
      cfg.providers[p.id].enabled = !p.enabled;
      persist(cfg);
    } else if (cmd === "key" || cmd === "k") {
      const key = (await promptSecret(`  ${p.label} API key ${p.hasKey ? `(current ${mask(p.key)})` : ""}: `)).trim();
      if (key) { saveKey(cfg, p.id, key); persist(cfg); }
    } else if (cmd === "guide" || cmd === "g") {
      stdout.write(`\n  ${bold(p.label)}  ${tierLabel(p)}\n`);
      for (const line of guideLines(p)) stdout.write(`    ${line}\n`);
      await ask("\nPress enter", "");
    } else if (cmd === "models" || cmd === "m") {
      if (p.keyless && !p.hasKey) await modelMenu(cfg, p);
      else if (!p.hasKey) {
        const key = (await promptSecret(`  ${p.label} API key: `)).trim();
        if (!key) continue;
        saveKey(cfg, p.id, key);
        persist(cfg);
        await modelMenu(cfg, resolveProviders(cfg).find((x) => x.id === p.id) || p);
      } else await modelMenu(cfg, p);
    } else if (cmd === "test") {
      const r = await testProvider(p);
      stdout.write(`  ${r.ok ? fg.green("✓ reachable") : fg.red(`✗ ${r.status}`)} ${dim(`${r.ms}ms`)}\n`);
      await ask("Press enter", "");
    }
  }
}

// ── add provider/model wizards ────────────────────────────────────────────
export async function addProviderWizard(cfg) {
  banner();
  stdout.write(`\n${bold("Add provider")}\n\n`);
  const id = (await ask("Provider id (slug, lowercase)")).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!id) return;
  if (cfg.providers[id]) { stdout.write(`  ${fg.yellow("Provider")} ${bold(id)} ${fg.yellow("already exists.")}\n`); await ask("Press enter", ""); return; }
  const label = (await ask("Display name", id)) || id;
  const baseUrl = (await ask("Base URL (OpenAI-compatible)")).trim().replace(/\/+$/, "");
  if (!baseUrl) { stdout.write(`  ${fg.red("Base URL is required.")}\n`); await ask("Press enter", ""); return; }
  const keyless = await confirm("Is this provider keyless (no API key)?", false);
  let key = "", keyEnv = "";
  if (!keyless) {
    key = (await promptSecret(`  API key ${dim("(enter to skip)")} `)).trim();
    keyEnv = (await ask("Env var name for the key (optional)")).trim();
  }
  const tier = (await ask("Tier (local/optional/recommended)", keyless ? "local" : "optional")).trim().toLowerCase();
  const validTier = ["local", "optional", "recommended", "keyless"].includes(tier) ? tier : "optional";
  const models = [];
  stdout.write(`\n${bold("Models")} ${dim("(add at least one; empty id to finish)")}\n`);
  for (;;) {
    const modelId = (await ask("  Model id")).trim();
    if (!modelId) break;
    const context = Number.parseInt(await ask("    Context tokens", "32000"), 10) || 32000;
    const tools = await confirm("    Supports tool calls?", true);
    const vision = await confirm("    Supports vision?", false);
    const quality = Math.min(5, Math.max(1, Number.parseInt(await ask("    Quality 1-5", "3"), 10) || 3));
    const fast = await confirm("    Fast lane?", false);
    models.push({ id: modelId, label: modelId, context, tools, vision, quality, fast });
    stdout.write(`    ${fg.green("✓")} ${modelId} added\n`);
  }
  if (models.length === 0) { stdout.write(`  ${fg.yellow("No models added; provider not saved.")}\n`); await ask("Press enter", ""); return; }
  cfg.providers[id] = { baseUrl, ...(key ? { key } : {}), ...(keyEnv ? { keyEnv } : {}), models, enabled: true, tier: validTier, keyless, label, freeTier: true, rpm: 30, note: "custom lane", setup: { url: baseUrl, note: "custom lane" } };
  persist(cfg);
  stdout.write(`\n${fg.green("✓")} provider ${bold(id)} saved with ${models.length} model(s)\n`);
  await ask("Press enter", "");
}

export async function addModelWizard(cfg) {
  banner();
  const providers = resolveProviders(cfg);
  stdout.write(`\n${bold("Add model to provider")}\n\n`);
  for (const [i, p] of providers.entries()) stdout.write(`  ${bold(String(i + 1).padStart(2))}. ${p.label}\n`);
  const idx = Number.parseInt(await ask("\nProvider number"), 10) - 1;
  const p = providers[idx];
  if (!p) { stdout.write(`  ${fg.red("Invalid provider.")}\n`); await ask("Press enter", ""); return; }
  cfg.providers[p.id] = cfg.providers[p.id] || {};
  const modelId = (await ask("Model id")).trim();
  if (!modelId) return;
  const context = Number.parseInt(await ask("Context tokens", "32000"), 10) || 32000;
  const tools = await confirm("Supports tool calls?", true);
  const vision = await confirm("Supports vision?", false);
  const quality = Math.min(5, Math.max(1, Number.parseInt(await ask("Quality 1-5", "3"), 10) || 3));
  const fast = await confirm("Fast lane?", false);
  const override = cfg.providers[p.id];
  if (!Array.isArray(override.models)) override.models = p.models.map((m) => { const { providerId, providerLabel, keyless, enabled, ...rest } = m; return rest; });
  override.models.push({ id: modelId, label: modelId, context, tools, vision, quality, fast });
  persist(cfg);
  stdout.write(`\n${fg.green("✓")} model ${bold(modelId)} added to ${p.label}\n`);
  await ask("Press enter", "");
}

// ── settings menu ─────────────────────────────────────────────────────────
export async function settingsMenu(cfg) {
  for (;;) {
    banner();
    stdout.write(`\n${bold("Settings")}\n\n  1. Lanes, keys, and models\n  2. Behaviour      ${dim(`enhance=${cfg.enhance} clean=${cfg.cleanOutput}`)}\n  3. Performance    ${dim(`race=${cfg.race} best-of=${cfg.bestOf} attempts=${cfg.maxAttempts}`)}\n  4. Server         ${dim(`${cfg.host}:${cfg.port}${cfg.token ? " token=on" : ""}`)}\n  5. Routing        ${dim(`keyless-first=${cfg.routing.preferKeyless} sticky=${cfg.routing.sticky}`)}\n  6. Updates        ${dim(`auto-check=${cfg.updates?.autoCheck !== false} auto-install=${Boolean(cfg.updates?.autoInstall)}`)}\n  7. Add provider   ${dim("create a new lane")}\n  8. Add model      ${dim("add a model to a lane")}\n  9. Show config    ${dim("secrets masked")}\n  10. Save and exit\n  11. Exit without saving\n`);
    const choice = await ask("Choice", "10");
    if (choice === "1") await providerMenu(cfg);
    else if (choice === "2") { cfg.enhance = await confirm("Enhance every prompt", cfg.enhance); cfg.cleanOutput = await confirm("Strip filler from non-stream answers", cfg.cleanOutput); }
    else if (choice === "3") {
      cfg.race = Math.min(4, Math.max(1, Number.parseInt(await ask("Lanes raced in parallel", String(cfg.race)), 10) || cfg.race));
      cfg.bestOf = Math.min(4, Math.max(1, Number.parseInt(await ask("Best-of answers for non-stream", String(cfg.bestOf)), 10) || cfg.bestOf));
      cfg.maxAttempts = Math.min(8, Math.max(1, Number.parseInt(await ask("Max lane attempts", String(cfg.maxAttempts)), 10) || cfg.maxAttempts));
      cfg.requestTimeoutMs = Number.parseInt(await ask("Request timeout ms", String(cfg.requestTimeoutMs)), 10) || cfg.requestTimeoutMs;
      cfg.firstByteTimeoutMs = Number.parseInt(await ask("First-byte timeout ms", String(cfg.firstByteTimeoutMs)), 10) || cfg.firstByteTimeoutMs;
    } else if (choice === "4") {
      cfg.host = await ask("Bind host", cfg.host);
      cfg.port = Number.parseInt(await ask("Port", String(cfg.port)), 10) || cfg.port;
      const token = await ask("Local token (empty = no auth)", cfg.token ? "(keep current)" : "");
      if (token && token !== "(keep current)") cfg.token = token;
    } else if (choice === "5") {
      cfg.routing.preferKeyless = await confirm("Prefer keyless lanes", cfg.routing.preferKeyless);
      cfg.routing.sticky = await confirm("Keep one model per session", cfg.routing.sticky);
    } else if (choice === "6") {
      cfg.updates = cfg.updates || {};
      cfg.updates.autoCheck = await confirm("Check for updates on startup", cfg.updates.autoCheck !== false);
      cfg.updates.autoInstall = await confirm("Install updates automatically (restart to apply)", Boolean(cfg.updates.autoInstall));
      if (await confirm("Check now?", false)) { await showUpdateCheck(cfg); await ask("Press enter", ""); }
    } else if (choice === "7") await addProviderWizard(cfg);
    else if (choice === "8") await addModelWizard(cfg);
    else if (choice === "9") { stdout.write(`\n${JSON.stringify(redact(cfg), null, 2)}\n`); await ask("\nPress enter", ""); }
    else if (choice === "10") { const file = persist(cfg); stdout.write(`\n${fg.green("✓")} saved ${dim(file)}\n`); return cfg; }
    else if (choice === "11") return cfg;
  }
}

// ── showUpdateCheck ───────────────────────────────────────────────────────
export async function showUpdateCheck(cfg) {
  const result = await checkLatest();
  cfg.updates = { ...(cfg.updates || {}), lastCheck: Date.now() };
  if (!result.ok) { stdout.write(`\n  ${fg.red("✗")} update check failed: ${result.error || result.status}\n`); return result; }
  if (result.update) {
    stdout.write(`\n  ${fg.yellow("↑")} a0 v${result.latest} is available ${dim(`(you have v${result.current})`)}\n`);
    stdout.write(`  ${dim(`Install: npm install -g ${result.packageName}@latest  (or run \`a0 update\`)`)}\n`);
  } else stdout.write(`\n  ${fg.green("✓")} up to date ${dim(`v${result.current}`)}\n`);
  return result;
}

// ── doctor ────────────────────────────────────────────────────────────────
export async function doctor(cfg) {
  banner();
  const providers = resolveProviders(cfg);
  stdout.write(`\n${bold("Lanes")}\n`);
  for (const p of providers) {
    const enabled = p.enabled ? fg.green("enabled ") : dim("disabled");
    let verdict = dim("—");
    if (p.enabled) { const r = await testProvider(p); verdict = r.ok ? fg.green(`ok ${r.ms}ms`) : fg.red(String(r.status)); }
    stdout.write(`  ${bold(p.label.padEnd(18))} ${tierLabel(p).padEnd(22)} ${enabled} ${verdict}\n`);
    if (!p.enabled && p.setup?.url) stdout.write(`      ${dim(`key: ${p.setup.url}`)}\n`);
  }
  const enabled = providers.filter((p) => p.enabled);
  const keyed = enabled.filter((p) => p.hasKey).length;
  const keyless = enabled.filter((p) => p.keyless && !p.hasKey).length;
  stdout.write(`\n${bold("Summary")}\n  lanes enabled   ${enabled.length} (${keyed} keyed, ${keyless} anonymous)\n  enhancement     ${cfg.enhance ? fg.green("on") : fg.yellow("off")}\n  race            ${cfg.race}\n  best-of         ${cfg.bestOf}\n  endpoint        ${fg.cyan(`http://${cfg.host}:${cfg.port}/v1`)}\n`);
  await ask("\nPress enter", "");
}

// ── statusLine ────────────────────────────────────────────────────────────
export async function statusLine(cfg, providers) {
  const active = providers.filter((p) => p.enabled);
  const keyed = active.filter((p) => p.hasKey).length;
  const anon = active.filter((p) => p.keyless && !p.hasKey).length;
  banner();
  stdout.write(`\n${bold("Running")}\n  endpoint   ${fg.cyan(`http://${cfg.host}:${cfg.port}/v1`)}\n  api key    ${cfg.token ? mask(cfg.token) : dim("any value (no auth)")}\n  lanes      ${active.length} (${keyed} keyed, ${anon} anonymous)\n  enhance    ${cfg.enhance ? fg.green("on") : fg.yellow("off")}\n  race       ${cfg.race}   best-of ${cfg.bestOf}\n\n${dim("Point any OpenAI-compatible client at the endpoint above.")}\n${dim("Press Ctrl-C to stop.")}\n`);
}

// ── full-screen TUI ───────────────────────────────────────────────────────
const MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "◉", desc: "Overview and status" },
  { id: "lanes", label: "Lanes", icon: "≡", desc: "Providers and keys" },
  { id: "models", label: "Models", icon: "◆", desc: "Per-model selection" },
  { id: "providers", label: "Add Provider", icon: "+", desc: "Add a new lane" },
  { id: "settings", label: "Settings", icon: "⚙", desc: "All configuration" },
  { id: "doctor", label: "Doctor", icon: "♥", desc: "Health check" },
  { id: "update", label: "Update", icon: "↑", desc: "Check for updates" },
  { id: "quit", label: "Quit", icon: "✕", desc: "Exit" },
];

let menuIndex = 0;
let currentView = "menu";

function renderMenu() {
  const { w, h } = termSize();
  stdout.write(CLEAR);
  const title = ` a0 v${VERSION} `;
  writeAt(1, 1, `${ESC}[1;36m${title.padEnd(w)}${RESET}`);
  const menuW = 30, menuH = MENU_ITEMS.length + 4, menuR = 3, menuC = 2;
  drawBox(menuR, menuC, menuW, menuH, "Menu");
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i];
    const prefix = i === menuIndex ? "▸ " : "  ";
    const style = i === menuIndex ? `${ESC}[1;32m` : "";
    writeAt(menuR + 2 + i, menuC + 1, `${style}${(prefix + item.icon + " " + item.label).padEnd(menuW - 2)}${RESET}`);
  }
  const descC = menuC + menuW + 2, descW = w - descC, descH = menuH;
  drawBox(menuR, descC, descW, descH, "Description");
  const sel = MENU_ITEMS[menuIndex];
  writeAt(menuR + 2, descC + 2, `${bold(sel.label)}`);
  writeAt(menuR + 3, descC + 2, `${dim(sel.desc)}`);
  const infoR = menuR + menuH + 1, infoH = h - infoR - 1;
  if (infoH > 4) {
    drawBox(infoR, 2, w - 2, infoH, "Status");
    const cfg = globalThis.__a0cfg || {};
    const providers = resolveProviders(cfg);
    const active = activeProviders(providers);
    const keyed = active.filter((p) => p.hasKey).length;
    const anon = active.filter((p) => p.keyless && !p.hasKey).length;
    const lines = [
      `  Endpoint:  ${fg.cyan(`http://${cfg.host || "127.0.0.1"}:${cfg.port || 8082}/v1`)}`,
      `  Lanes:     ${active.length} enabled (${keyed} keyed, ${anon} anonymous)`,
      `  Enhance:   ${cfg.enhance ? fg.green("on") : fg.yellow("off")}`,
      `  Race:      ${cfg.race || 2}   Best-of: ${cfg.bestOf || 1}`,
      `  Models:    ${providers.reduce((n, p) => n + p.models.length, 0)} total across ${providers.length} providers`,
    ];
    for (let i = 0; i < lines.length && i < infoH - 2; i++) writeAt(infoR + 2 + i, 3, lines[i]);
  }
  drawStatusBar([`${dim("↑↓")} navigate`, `${dim("Enter")} select`, `${dim("q")} quit`, `${dim("Ctrl+C")} exit`]);
}

function renderLanes() {
  const { w, h } = termSize();
  stdout.write(CLEAR);
  const cfg = globalThis.__a0cfg || {};
  const providers = resolveProviders(cfg);
  writeAt(1, 1, `${ESC}[1;36m  Lanes${" ".repeat(Math.max(0, w - 8))}${RESET}`);
  const boxH = h - 4;
  drawBox(3, 1, w, boxH, "Providers");
  let r = 5;
  for (const p of providers) {
    if (r >= 3 + boxH - 1) break;
    const state = p.enabled ? fg.green("●") : dim("○");
    const tier = p.tier === "recommended" ? fg.green("rec") : p.tier === "keyless" ? dim("keyless") : p.tier === "local" ? fg.cyan("local") : fg.yellow("opt");
    const keyInfo = p.hasKey ? dim(`key ${mask(p.key)}`) : p.keyless ? dim("anonymous") : dim("no key");
    const mc = modelCounts(p);
    const modelInfo = (p.keyless && !p.hasKey) ? dim(`${mc.total} curated`) : dim(`${mc.enabled}/${mc.total} models`);
    writeAt(r, 2, `  ${state} ${p.label.padEnd(18)} ${tier.padEnd(10)} ${keyInfo.padEnd(20)} ${modelInfo}`.slice(0, w - 2));
    r++;
  }
  drawStatusBar([`${dim("↑↓")} scroll`, `${dim("Esc")} back`, `${dim("q")} quit`]);
}

export async function runTUI(cfg) {
  globalThis.__a0cfg = cfg;
  if (!tty) { stdout.write(`a0 v${VERSION} — non-interactive. Use 'a0 config' for settings.\n`); return; }
  stdout.write(ALT_ON + CLEAR);
  setupRawInput();
  let needsRedraw = true;
  setKeyHandler((ev) => {
    if (ev.type === "key") {
      if (ev.key === "escape") { if (currentView !== "menu") { currentView = "menu"; needsRedraw = true; } else { cleanup(); process.exit(0); } }
      else if (ev.key === "\x1b[A") { if (currentView === "menu") { menuIndex = (menuIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length; needsRedraw = true; } }
      else if (ev.key === "\x1b[B") { if (currentView === "menu") { menuIndex = (menuIndex + 1) % MENU_ITEMS.length; needsRedraw = true; } }
      else if (ev.key === "enter") {
        if (currentView === "menu") {
          const item = MENU_ITEMS[menuIndex];
          if (item.id === "quit") { cleanup(); process.exit(0); }
          else { currentView = item.id; needsRedraw = true; }
        }
      } else if (ev.key === "q" && currentView === "menu") { cleanup(); process.exit(0); }
    } else if (ev.type === "mouse" && ev.action === "press" && ev.btn === 0) {
      const menuR = 3, menuC = 2, menuW = 30;
      if (ev.col >= menuC && ev.col < menuC + menuW && ev.row >= menuR + 2 && ev.row < menuR + 2 + MENU_ITEMS.length) {
        const idx = ev.row - (menuR + 2);
        if (idx >= 0 && idx < MENU_ITEMS.length) {
          menuIndex = idx;
          const item = MENU_ITEMS[idx];
          if (item.id === "quit") { cleanup(); process.exit(0); }
          else { currentView = item.id; needsRedraw = true; }
        }
      }
    }
  });
  const renderLoop = setInterval(() => {
    if (!needsRedraw) return;
    needsRedraw = false;
    if (currentView === "menu") renderMenu();
    else if (currentView === "lanes") renderLanes();
    else {
      stdout.write(CLEAR);
      writeAt(1, 1, `${ESC}[1;36m  ${currentView}${" ".repeat(40)}${RESET}`);
      writeAt(3, 2, `${dim("Press Esc to go back")}`);
      drawStatusBar([`${dim("Esc")} back`, `${dim("q")} quit`]);
    }
  }, 50);
  stdout.on("resize", () => { needsRedraw = true; });
  await new Promise(() => {});
}

// ── help ──────────────────────────────────────────────────────────────────
export function help() {
  stdout.write(`\n${bold("a0")} ${dim(`v${VERSION}`)} — OpenAI-compatible inference gateway\n\n${bold("Usage")}\n  a0                 start the gateway (runs setup on first launch)\n  a0 tui             full-screen management interface\n  a0 setup           guided provider setup\n  a0 config          interactive settings\n  a0 serve           start the gateway\n  a0 doctor          check provider health\n  a0 models          list categories and providers\n  a0 update          update to the latest release\n  a0 version         print version\n\n${bold("Flags")}\n  --port <n>         port (default 8082)\n  --host <addr>      bind address (default 127.0.0.1)\n  --race <n>         lanes raced in parallel (1–4)\n  --no-enhance       disable prompt enhancement\n  --token <secret>   require this bearer token\n  --check            with update: report only, do not install\n`);
}

export default { clear, banner, setupWizard, settingsMenu, doctor, statusLine, modelMenu, addProviderWizard, addModelWizard, promptSecret, help, runTUI, closeInput };