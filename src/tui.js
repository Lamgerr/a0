// TUI — full-screen, OpenCode-inspired. Zero dependencies, ANSI only.
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
const fg = { cyan: c("36"), green: c("32"), yellow: c("33"), red: c("31"), blue: c("34"), magenta: c("35"), white: c("37"), gray: c("90") };

const BOX = { tl:"┌", tr:"┐", bl:"└", br:"┘", h:"─", v:"│", dTl:"╔", dTr:"╗", dBl:"╚", dBr:"╝" };

function termSize() { return { w: stdout.columns || 80, h: stdout.rows || 24 }; }
function move(r, col) { stdout.write(`${ESC}[${r};${col}H`); }
function writeAt(r, col, text) { move(r, col); stdout.write(text); }
function truncate(s, w) { return s.length > w ? s.slice(0, w - 1) + "…" : s; }

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
      const m = inputBuffer.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
      if (m) { inputBuffer = inputBuffer.slice(m[0].length); if (keyHandler) keyHandler({ type: "mouse", btn: +m[1], col: +m[2], row: +m[3], action: m[4] === "M" ? "press" : "release" }); consumed = true; } else break;
    } else if (inputBuffer.startsWith("\x1b[")) {
      const m = inputBuffer.match(/^\x1b\[[0-9;]*[A-Za-z]/);
      if (m) { inputBuffer = inputBuffer.slice(m[0].length); if (keyHandler) keyHandler({ type: "key", key: m[0] }); consumed = true; } else break;
    } else if (inputBuffer.startsWith("\x1b")) {
      inputBuffer = inputBuffer.slice(1);
      if (keyHandler) keyHandler({ type: "key", key: "escape" });
      consumed = true;
    } else {
      const ch = inputBuffer[0]; inputBuffer = inputBuffer.slice(1);
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
function cleanup() { stdout.write(MOUSE_OFF); if (stdin.isTTY) { stdin.setRawMode(false); stdin.pause(); } stdout.write(ALT_OFF); }

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
export function closeInput() { if (rl) { rl.removeAllListeners(); rl.close(); rl = null; lineQueue.length = 0; lineWaiter = null; stdout.write("DEBUG: closeInput done\n"); } }
async function ask(question, def = "") {
  const suffix = def !== "" ? dim(` [${def}]`) : "";
  stdout.write(`${question}${suffix}: `);
  const answer = (await readLine()).trim();
  return answer === "" ? String(def) : answer;
}
async function confirm(question, def = true) {
  const answer = (await ask(`${question} (y/n)`, def ? "y" : "n")).toLowerCase();
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
export function banner() { clear(); stdout.write(`\n  a0  v${VERSION}\n  OpenAI-compatible inference gateway\n`); }
function drawBox(r, col, w, h, title = "") {
  let top = BOX.tl;
  if (title) { const ts = ` ${title} `; const pad = w - 2 - ts.length; const lp = Math.floor(pad / 2), rp = pad - lp; top += "─".repeat(Math.max(0, lp)) + ts + "─".repeat(Math.max(0, rp)) + BOX.tr; }
  else top += "─".repeat(w - 2) + BOX.tr;
  writeAt(r, col, top);
  for (let i = 1; i < h - 1; i++) { writeAt(r + i, col, BOX.v); writeAt(r + i, col + w - 1, BOX.v); }
  writeAt(r + h - 1, col, BOX.bl + "─".repeat(w - 2) + BOX.br);
}
function drawDoubleBox(r, col, w, h, title = "") {
  let top = BOX.dTl;
  if (title) { const ts = ` ${title} `; const pad = w - 2 - ts.length; const lp = Math.floor(pad / 2), rp = pad - lp; top += "═".repeat(Math.max(0, lp)) + ts + "═".repeat(Math.max(0, rp)) + BOX.dTr; }
  else top += "═".repeat(w - 2) + BOX.dTr;
  writeAt(r, col, top);
  for (let i = 1; i < h - 1; i++) { writeAt(r + i, col, BOX.v); writeAt(r + i, col + w - 1, BOX.v); }
  writeAt(r + h - 1, col, BOX.dBl + "═".repeat(w - 2) + BOX.dBr);
}
function drawStatusBar(items) {
  const { w, h } = termSize();
  const bar = items.join("  │  ");
  writeAt(h, 1, `${ESC}[7m${bar.padEnd(w).slice(0, w)}${RESET}`);
}

// ── dialog/popup system ───────────────────────────────────────────────────
let dialogActive = false;
let dialogContent = null;
let dialogCallback = null;

function showDialog(title, lines, buttons = ["OK"]) {
  dialogActive = true;
  dialogContent = { title, lines, buttons, selectedButton: 0 };
  renderDialog();
}

function renderDialog() {
  if (!dialogActive || !dialogContent) return;
  const { w, h } = termSize();
  const { title, lines, buttons, selectedButton } = dialogContent;
  const dialogW = Math.min(w - 4, 70);
  const dialogH = lines.length + 6;
  const r = Math.floor((h - dialogH) / 2);
  const col = Math.floor((w - dialogW) / 2);
  drawDoubleBox(r, col, dialogW, dialogH, title);
  for (let i = 0; i < lines.length; i++) {
    writeAt(r + 2 + i, col + 2, truncate(lines[i], dialogW - 4));
  }
  // Buttons
  const btnRow = r + dialogH - 2;
  let btnX = col + 2;
  for (let i = 0; i < buttons.length; i++) {
    const prefix = i === selectedButton ? "▸ " : "  ";
    const style = i === selectedButton ? "\x1b[1;32m" : "";
    writeAt(btnRow, btnX, `${style}${prefix}${buttons[i]}${RESET}`);
    btnX += buttons[i].length + 4;
  }
  writeAt(h, 1, `${ESC}[7m  Tab/←→ navigate buttons · Enter confirm · Esc cancel${" ".repeat(Math.max(0, w - 50))}${RESET}`);
}

function closeDialog() {
  dialogActive = false;
  dialogContent = null;
  dialogCallback = null;
}

function handleDialogKey(ev) {
  if (!dialogActive) return false;
  const { buttons, selectedButton } = dialogContent;
  if (ev.type === "key") {
    if (ev.key === "escape") { closeDialog(); render(); return true; }
    if (ev.key === "\x1b[C" || ev.key === "tab") {
      dialogContent.selectedButton = (selectedButton + 1) % buttons.length;
      renderDialog();
      return true;
    }
    if (ev.key === "\x1b[D") {
      dialogContent.selectedButton = (selectedButton - 1 + buttons.length) % buttons.length;
      renderDialog();
      return true;
    }
    if (ev.key === "enter") {
      const btn = buttons[selectedButton];
      closeDialog();
      if (dialogCallback) dialogCallback(btn);
      render();
      return true;
    }
  } else if (ev.type === "char") {
    if (ev.char === " ") {
      const btn = buttons[selectedButton];
      closeDialog();
      if (dialogCallback) dialogCallback(btn);
      render();
      return true;
    }
  }
  return true; // consume all input when dialog is active
}

// ── helpers ───────────────────────────────────────────────────────────────
function tierLabel(p) {
  if (p.tier === "recommended") return "recommended";
  if (p.tier === "keyless") return "keyless";
  if (p.tier === "local") return "local";
  return "optional";
}
function capLine(p) {
  const caps = [tierLabel(p)];
  if (p.hasKey) caps.push(`key ${mask(p.key)}`);
  else if (p.keyless) caps.push("anonymous");
  if (!p.freeTier) caps.push("paid");
  const { enabled, total } = modelCounts(p);
  if (p.keyless && !p.hasKey) caps.push(`${total} curated`);
  else caps.push(enabled === total ? `${total} models` : `${enabled}/${total} models`);
  return caps.join(" · ");
}
function providerList(providers) {
  return providers.map((p, i) => `  ${String(i + 1).padStart(2)}. ${p.enabled ? "●" : "○"} ${p.label.padEnd(18)} ${capLine(p)}`).join("\n");
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
  stdout.write(`\nSetup\n\na0 operates in two modes:\n  keyed      provider API keys — better models, higher limits, failover\n  keyless    anonymous free lanes, no signup required\n\nAdd at least two keys for racing and failover. Press enter to skip any key.\n`);
  const providers = resolveProviders(cfg);
  stdout.write(`\nRecommended providers\n`);
  for (const p of recommended(providers)) {
    stdout.write(`\n  ${p.label}  · recommended\n`);
    for (const line of guideLines(p)) stdout.write(`    ${line}\n`);
    const key = (await promptSecret(`    Paste key (enter to skip): `)).trim();
    if (key) { saveKey(cfg, p.id, key); stdout.write(`    ✓ ${p.label} enabled\n`); }
  }
  const wantsOptional = await confirm("\nConfigure optional providers too?", false);
  if (wantsOptional) {
    for (const p of optional(providers)) {
      stdout.write(`\n  ${p.label}  · optional\n`);
      for (const line of guideLines(p)) stdout.write(`    ${line}\n`);
      const key = (await promptSecret(`    Paste key (enter to skip): `)).trim();
      if (key) { saveKey(cfg, p.id, key); stdout.write(`    ✓ ${p.label} enabled\n`); }
    }
  }
  const mode = applySetupMode(cfg);
  stdout.write(`\nMode  ${modeSummary(mode)}\n`);
  if (mode.mode === "keyed") {
    const keep = await confirm("Keep anonymous lanes on as a fallback?", false);
    if (keep) { for (const id of mode.disabled) cfg.providers[id] = { ...(cfg.providers[id] || {}), enabled: true }; cfg.routing.preferKeyless = true; }
  }
  stdout.write(`\nServer\n`);
  cfg.port = Number.parseInt(await ask("Port", String(cfg.port)), 10) || cfg.port;
  cfg.host = await ask("Bind host", cfg.host);
  stdout.write(`\nBehaviour\n`);
  cfg.enhance = await confirm("Enhance every prompt", cfg.enhance);
  cfg.race = Math.min(4, Math.max(1, Number.parseInt(await ask("Lanes raced in parallel", String(cfg.race)), 10) || cfg.race));
  stdout.write(`\nUpdates\n`);
  cfg.updates = cfg.updates || {};
  cfg.updates.autoCheck = await confirm("Check for updates on startup", cfg.updates.autoCheck !== false);
  cfg.updates.autoInstall = await confirm("Install updates automatically", Boolean(cfg.updates.autoInstall));
  const file = persist(cfg);
  stdout.write(`\n✓ saved ${file}\n`);
  await ask("Press enter to start a0", "");
  return cfg;
}

// ── model menu ────────────────────────────────────────────────────────────
export async function modelMenu(cfg, p) {
  banner();
  if (p.keyless && !p.hasKey) {
    stdout.write(`\n  ${p.label} is part of the anonymous pool.\n  Models are curated and cannot be selected individually.\n  Add a key to unlock per-model selection.\n${p.setup?.url ? `\n  Get a key: ${p.setup.url}\n` : ""}\n`);
    await ask("Press enter", "");
    return;
  }
  if (!p.hasKey) {
    stdout.write(`\n  ${p.label} has no key.\n  Add a key first: ${p.setup?.url || "see guide"}\n`);
    await ask("Press enter", "");
    return;
  }
  for (;;) {
    banner();
    const fresh = resolveProviders(cfg).find((x) => x.id === p.id) || p;
    const { enabled, total } = modelCounts(fresh);
    stdout.write(`\n${fresh.label} models\n\n`);
    for (const [i, m] of fresh.models.entries()) {
      const on = m.enabled !== false;
      const caps = [m.tools ? "tools" : "", m.vision ? "vision" : "", m.fast ? "fast" : ""].filter(Boolean).join(",");
      const meta = `${Math.round((m.context || 0) / 1000)}k${caps ? ` · ${caps}` : ""}`;
      stdout.write(`  ${on ? "●" : "○"} ${String(i + 1).padStart(2)}. ${m.id.padEnd(34)} ${meta}\n`);
    }
    stdout.write(`\n  ${enabled}/${total} enabled · toggle <n> · all · none · add · back\n`);
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
      stdout.write(`    ✓ ${modelId} added\n`);
      await ask("Press enter", "");
      continue;
    }
    const idx = Number.parseInt(arg, 10) - 1;
    const model = fresh.models[idx];
    if (!model) continue;
    if (cmd === "toggle" || cmd === "t") {
      const next = model.enabled === false;
      if (!next && enabled === 1) { stdout.write(`\n  At least one model must stay enabled.\n`); await ask("Press enter", ""); continue; }
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
    // Only show active (enabled) providers
    const active = providers.filter((p) => p.enabled);
    stdout.write(`\nLanes (active only)\n`);
    for (const [i, p] of active.entries()) {
      const keyInfo = p.hasKey ? `key ${mask(p.key)}` : p.keyless ? "anonymous" : "no key";
      const mc = modelCounts(p);
      const modelInfo = (p.keyless && !p.hasKey) ? `${mc.total} curated` : `${mc.enabled}/${mc.total} models`;
      stdout.write(`  ${String(i + 1).padStart(2)}. ${p.enabled ? "●" : "○"} ${p.label.padEnd(18)} ${keyInfo.padEnd(20)} ${modelInfo}\n`);
    }
    stdout.write(`\n  ${dim("Press Ctrl+P to add a new provider")}\n`);
    stdout.write(`  ${dim("toggle <n> · key <n> · models <n> · guide <n> · test <n> · testall · back")}\n`);
    const input = (await ask("Command", "back")).trim().toLowerCase();
    const [cmd, arg] = input.split(/\s+/);
    if (cmd === "back" || cmd === "b") return;
    if (cmd === "\x10" || cmd === "ctrl+p" || cmd === "add") {
      // Ctrl+P or "add" opens provider search dialog
      const result = await selectProviderUI(cfg, "Add provider");
      if (!result) continue;
      if (result.type === "add_custom") {
        await addProviderWizard(cfg);
      } else {
        const p = result.provider;
        banner();
        stdout.write(`\n${p.label}\n\n`);
        stdout.write(`  Base URL: ${p.baseUrl}\n`);
        stdout.write(`  Status:   ${p.enabled ? "enabled" : "disabled"}\n`);
        stdout.write(`  Key:      ${p.hasKey ? mask(p.key) : "none"}\n`);
        stdout.write(`  Models:   ${modelCounts(p).enabled}/${modelCounts(p).total}\n\n`);
        for (const line of guideLines(p)) stdout.write(`  ${line}\n`);
        stdout.write("\n");
        const action = await ask("Action (key/toggle/models/test/back)", "back");
        cfg.providers[p.id] = cfg.providers[p.id] || {};
        if (action === "key" || action === "k") {
          const key = (await promptSecret(`  ${p.label} API key ${p.hasKey ? `(current ${mask(p.key)})` : ""}: `)).trim();
          if (key) { saveKey(cfg, p.id, key); persist(cfg); stdout.write(`  ✓ key saved\n`); }
        } else if (action === "toggle" || action === "t") {
          cfg.providers[p.id].enabled = !p.enabled;
          persist(cfg);
          stdout.write(`  ✓ ${cfg.providers[p.id].enabled ? "enabled" : "disabled"}\n`);
        } else if (action === "models" || action === "m") {
          await modelMenu(cfg, p);
        } else if (action === "test") {
          const r = await testProvider(p);
          stdout.write(`  ${r.ok ? "✓ reachable" : `✗ ${r.status}`} ${r.ms}ms\n`);
        }
        await ask("Press enter", "");
      }
      continue;
    }
    if (cmd === "testall") {
      stdout.write("\n");
      for (const p of providers.filter((x) => x.enabled)) {
        const r = await testProvider(p);
        stdout.write(`  ${r.ok ? "✓" : "✗"} ${p.label.padEnd(18)} ${r.status} ${r.ms}ms\n`);
      }
      await ask("\nPress enter", "");
      continue;
    }
    const idx = Number.parseInt(arg, 10) - 1;
    const p = active[idx];
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
      stdout.write(`\n  ${p.label}  ${tierLabel(p)}\n`);
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
      stdout.write(`  ${r.ok ? "✓ reachable" : `✗ ${r.status}`} ${r.ms}ms\n`);
      await ask("Press enter", "");
    }
  }
}

// ── searchable provider selector ──────────────────────────────────────────
export async function selectProviderUI(cfg, title = "Select provider") {
  const providers = resolveProviders(cfg);
  let searchQuery = "";
  let selectedIndex = 0;
  let scrollOffset = 0;
  const wasRaw = stdin.isTTY && stdin.isRaw;
  let dataListener = null;
  if (stdin.isTTY) {
    // Close readline if active
    if (rl) {
      rl.removeAllListeners();
      rl.close();
      rl = null;
      lineQueue.length = 0;
      lineWaiter = null;
    }
    // Remove ALL listeners
    stdin.removeAllListeners();
    // Wait for cleanup
    await new Promise(r => setTimeout(r, 300));
    // Enable raw mode
    if (!stdin.isRaw) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    inputBuffer = "";
    dataListener = (chunk) => {
      inputBuffer += chunk;
      processInput();
    };
    stdin.on("data", dataListener);
    await new Promise(r => setTimeout(r, 100));
  }

  function getFiltered() {
    if (!searchQuery) return providers;
    const q = searchQuery.toLowerCase();
    return providers.filter((p) =>
      p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) ||
      (p.tier || "").toLowerCase().includes(q) || (p.note || "").toLowerCase().includes(q)
    );
  }
  return new Promise((resolve) => {
    const render = () => {
      const { w, h } = termSize();
      stdout.write(CLEAR);
      writeAt(1, 1, `  ${title}`.padEnd(w));
      writeAt(2, 2, `Type to search · ↑↓ navigate · Enter select · a add custom · Esc cancel`);
      const filtered = getFiltered();
      if (selectedIndex >= filtered.length) selectedIndex = Math.max(0, filtered.length - 1);
      writeAt(4, 2, `  Search: ${searchQuery}█`.padEnd(w - 2));
      const listStart = 6;
      const visibleCount = Math.max(1, h - listStart - 3);
      if (selectedIndex < scrollOffset) scrollOffset = selectedIndex;
      if (selectedIndex >= scrollOffset + visibleCount) scrollOffset = selectedIndex - visibleCount + 1;
      for (let i = 0; i < visibleCount; i++) {
        const idx = i + scrollOffset;
        if (idx >= filtered.length) { writeAt(listStart + i, 2, " ".repeat(w - 2)); continue; }
        const p = filtered[idx];
        const isSelected = idx === selectedIndex;
        const prefix = isSelected ? "▸ " : "  ";
        const state = p.enabled ? "●" : "○";
        const tier = p.tier === "recommended" ? "rec" : p.tier === "keyless" ? "key" : p.tier === "local" ? "loc" : "opt";
        const line = `${prefix}${state} ${p.label.padEnd(20)} ${tier.padEnd(10)} ${p.baseUrl.replace(/^https?:\/\//, "").slice(0, 35)}`;
        writeAt(listStart + i, 2, truncate(line, w - 4));
      }
      writeAt(h - 2, 2, `${filtered.length} of ${providers.length} providers`.padEnd(w - 2));
      drawStatusBar(["↑↓ navigate", "Enter select", "a add custom", "Esc cancel", "Type search"]);
    };
    setKeyHandler((ev) => {
      const filtered = getFiltered();
      if (ev.type === "char") {
        if (ev.char === "a" && !searchQuery) {
          if (stdin.isTTY) { stdin.setRawMode(false); stdin.pause(); if (dataListener) stdin.removeListener("data", dataListener); ensureReader(); }
          resolve({ type: "add_custom" });
          return;
        }
        searchQuery += ev.char;
        selectedIndex = 0;
        scrollOffset = 0;
        render();
      } else if (ev.type === "key") {
        if (ev.key === "escape") {
          if (stdin.isTTY) { stdin.setRawMode(false); stdin.pause(); if (dataListener) stdin.removeListener("data", dataListener); ensureReader(); }
          resolve(null);
        } else if (ev.key === "\x1b[A") { selectedIndex = Math.max(0, selectedIndex - 1); render(); }
        else if (ev.key === "\x1b[B") { selectedIndex = Math.min(Math.max(0, filtered.length - 1), selectedIndex + 1); render(); }
        else if (ev.key === "enter") {
          if (filtered.length > 0) {
            if (stdin.isTTY) { stdin.setRawMode(false); stdin.pause(); if (dataListener) stdin.removeListener("data", dataListener); ensureReader(); }
            resolve({ type: "select", provider: filtered[selectedIndex] });
          }
        } else if (ev.key === "backspace") { searchQuery = searchQuery.slice(0, -1); selectedIndex = 0; scrollOffset = 0; render(); }
        else if (ev.key === " ") { searchQuery += " "; render(); }
      }
    });
    render();
  });
}

// ── add provider wizard ────────────────────────────────────────────────────
export async function addProviderWizard(cfg) {
  const result = await selectProviderUI(cfg, "Add provider");
  if (!result) return;
  if (result.type === "add_custom") {
    banner();
    stdout.write(`\nAdd custom provider\n\n`);
    const id = (await ask("Provider id (slug, lowercase)")).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!id) return;
    if (cfg.providers[id]) { stdout.write(`  Provider ${id} already exists.\n`); await ask("Press enter", ""); return; }
    const label = (await ask("Display name", id)) || id;
    const baseUrl = (await ask("Base URL (OpenAI-compatible)")).trim().replace(/\/+$/, "");
    if (!baseUrl) { stdout.write(`  Base URL is required.\n`); await ask("Press enter", ""); return; }
    const keyless = await confirm("Is this provider keyless (no API key)?", false);
    let key = "", keyEnv = "";
    if (!keyless) {
      key = (await promptSecret(`  API key (enter to skip): `)).trim();
      keyEnv = (await ask("Env var name for the key (optional)")).trim();
    }
    const tier = (await ask("Tier (local/optional/recommended)", keyless ? "local" : "optional")).trim().toLowerCase();
    const validTier = ["local", "optional", "recommended", "keyless"].includes(tier) ? tier : "optional";
    const models = [];
    stdout.write(`\nModels (add at least one; empty id to finish)\n`);
    for (;;) {
      const modelId = (await ask("  Model id")).trim();
      if (!modelId) break;
      const context = Number.parseInt(await ask("    Context tokens", "32000"), 10) || 32000;
      const tools = await confirm("    Supports tool calls?", true);
      const vision = await confirm("    Supports vision?", false);
      const quality = Math.min(5, Math.max(1, Number.parseInt(await ask("    Quality 1-5", "3"), 10) || 3));
      const fast = await confirm("    Fast lane?", false);
      models.push({ id: modelId, label: modelId, context, tools, vision, quality, fast });
      stdout.write(`    ✓ ${modelId} added\n`);
    }
    if (models.length === 0) { stdout.write(`  No models added; provider not saved.\n`); await ask("Press enter", ""); return; }
    cfg.providers[id] = { baseUrl, ...(key ? { key } : {}), ...(keyEnv ? { keyEnv } : {}), models, enabled: true, tier: validTier, keyless, label, freeTier: true, rpm: 30, note: "custom lane", setup: { url: baseUrl, note: "custom lane" } };
    persist(cfg);
    stdout.write(`\n✓ provider ${id} saved with ${models.length} model(s)\n`);
    await ask("Press enter", "");
    return;
  }
  const p = result.provider;
  banner();
  stdout.write(`\n${p.label}\n\n`);
  stdout.write(`  Base URL: ${p.baseUrl}\n`);
  stdout.write(`  Status:   ${p.enabled ? "enabled" : "disabled"}\n`);
  stdout.write(`  Key:      ${p.hasKey ? mask(p.key) : "none"}\n`);
  stdout.write(`  Models:   ${modelCounts(p).enabled}/${modelCounts(p).total}\n\n`);
  for (const line of guideLines(p)) stdout.write(`  ${line}\n`);
  stdout.write("\n");
  const action = await ask("Action (key/toggle/models/test/back)", "back");
  cfg.providers[p.id] = cfg.providers[p.id] || {};
  if (action === "key" || action === "k") {
    const key = (await promptSecret(`  ${p.label} API key ${p.hasKey ? `(current ${mask(p.key)})` : ""}: `)).trim();
    if (key) { saveKey(cfg, p.id, key); persist(cfg); stdout.write(`  ✓ key saved\n`); }
  } else if (action === "toggle" || action === "t") {
    cfg.providers[p.id].enabled = !p.enabled;
    persist(cfg);
    stdout.write(`  ✓ ${cfg.providers[p.id].enabled ? "enabled" : "disabled"}\n`);
  } else if (action === "models" || action === "m") {
    await modelMenu(cfg, p);
  } else if (action === "test") {
    const r = await testProvider(p);
    stdout.write(`  ${r.ok ? "✓ reachable" : `✗ ${r.status}`} ${r.ms}ms\n`);
  }
  await ask("Press enter", "");
}

export async function addModelWizard(cfg) {
  const result = await selectProviderUI(cfg, "Add model to provider");
  if (!result || result.type !== "select") return;
  const p = result.provider;
  cfg.providers[p.id] = cfg.providers[p.id] || {};
  banner();
  stdout.write(`\nAdd model to ${p.label}\n\n`);
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
  stdout.write(`\n✓ model ${modelId} added to ${p.label}\n`);
  await ask("Press enter", "");
}

// ── settings menu ─────────────────────────────────────────────────────────
export async function settingsMenu(cfg) {
  for (;;) {
    banner();
    stdout.write(`\nSettings\n\n  1. Lanes, keys, and models\n  2. Behaviour      enhance=${cfg.enhance} clean=${cfg.cleanOutput}\n  3. Performance    race=${cfg.race} best-of=${cfg.bestOf} attempts=${cfg.maxAttempts}\n  4. Server         ${cfg.host}:${cfg.port}${cfg.token ? " token=on" : ""}\n  5. Routing        keyless-first=${cfg.routing.preferKeyless} sticky=${cfg.routing.sticky}\n  6. Updates        auto-check=${cfg.updates?.autoCheck !== false} auto-install=${Boolean(cfg.updates?.autoInstall)}\n  7. Providers      search & select from 46+ providers  (Ctrl+P in TUI)\n  8. Add model      add a model to a provider\n  9. Show config    secrets masked\n  10. Save and exit\n  11. Exit without saving\n`);
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
    else if (choice === "10") { const file = persist(cfg); stdout.write(`\n✓ saved ${file}\n`); return cfg; }
    else if (choice === "11") return cfg;
  }
}

// ── showUpdateCheck ───────────────────────────────────────────────────────
export async function showUpdateCheck(cfg) {
  const result = await checkLatest();
  cfg.updates = { ...(cfg.updates || {}), lastCheck: Date.now() };
  if (!result.ok) { stdout.write(`\n  ✗ update check failed: ${result.error || result.status}\n`); return result; }
  if (result.update) {
    stdout.write(`\n  ↑ a0 v${result.latest} is available (you have v${result.current})\n`);
    stdout.write(`  Install: npm install -g ${result.packageName}@latest  (or run \`a0 update\`)\n`);
  } else stdout.write(`\n  ✓ up to date v${result.current}\n`);
  return result;
}

// ── doctor ────────────────────────────────────────────────────────────────
export async function doctor(cfg) {
  banner();
  const providers = resolveProviders(cfg);
  stdout.write(`\nLanes\n`);
  for (const p of providers) {
    const enabled = p.enabled ? "enabled " : "disabled";
    let verdict = "—";
    if (p.enabled) { const r = await testProvider(p); verdict = r.ok ? `ok ${r.ms}ms` : String(r.status); }
    stdout.write(`  ${p.label.padEnd(18)} ${tierLabel(p).padEnd(22)} ${enabled} ${verdict}\n`);
    if (!p.enabled && p.setup?.url) stdout.write(`      key: ${p.setup.url}\n`);
  }
  const enabled = providers.filter((p) => p.enabled);
  const keyed = enabled.filter((p) => p.hasKey).length;
  const keyless = enabled.filter((p) => p.keyless && !p.hasKey).length;
  stdout.write(`\nSummary\n  lanes enabled   ${enabled.length} (${keyed} keyed, ${keyless} anonymous)\n  enhancement     ${cfg.enhance ? "on" : "off"}\n  race            ${cfg.race}\n  best-of         ${cfg.bestOf}\n  endpoint        http://${cfg.host}:${cfg.port}/v1\n`);
  await ask("\nPress enter", "");
}

// ── statusLine ────────────────────────────────────────────────────────────
export async function statusLine(cfg, providers) {
  const active = providers.filter((p) => p.enabled);
  const keyed = active.filter((p) => p.hasKey).length;
  const anon = active.filter((p) => p.keyless && !p.hasKey).length;
  banner();
  stdout.write(`\nRunning\n  endpoint   http://${cfg.host}:${cfg.port}/v1\n  api key    ${cfg.token ? mask(cfg.token) : "any value (no auth)"}\n  lanes      ${active.length} (${keyed} keyed, ${anon} anonymous)\n  enhance    ${cfg.enhance ? "on" : "off"}\n  race       ${cfg.race}   best-of ${cfg.bestOf}\n\nPoint any OpenAI-compatible client at the endpoint above.\nPress Ctrl-C to stop.\n`);
}

// ── full-screen TUI ───────────────────────────────────────────────────────
export async function runTUI(cfg) {
  globalThis.__a0cfg = cfg;
  if (!tty) { stdout.write(`a0 v${VERSION} — non-interactive. Use 'a0 config' for settings.\n`); return; }
  stdout.write(ALT_ON + CLEAR);
  setupRawInput();
  let currentView = "dashboard";
  let menuIndex = 0;
  let needsRedraw = true;
  const navItems = ["Dashboard", "Lanes", "Models", "Providers", "Settings", "Doctor", "Update", "Quit"];
  function render() {
    const { w, h } = termSize();
    stdout.write(CLEAR);
    writeAt(1, 1, ` a0 v${VERSION} `.padEnd(w));
    const sidebarW = 24;
    drawBox(3, 1, sidebarW, h - 4, "Navigation");
    for (let i = 0; i < navItems.length; i++) {
      const prefix = menuIndex === i ? "▸ " : "  ";
      const style = menuIndex === i ? "\x1b[1;32m" : "";
      writeAt(4 + i, 2, `${style}${prefix}${navItems[i]}${RESET}`.padEnd(sidebarW - 1));
    }
    const contentX = sidebarW + 2;
    const contentW = w - contentX;
    drawBox(3, contentX, contentW, h - 4, currentView.charAt(0).toUpperCase() + currentView.slice(1));
    const providers = resolveProviders(cfg);
    const active = activeProviders(providers);
    if (currentView === "dashboard") {
      const lines = [
        `  Endpoint:  http://${cfg.host || "127.0.0.1"}:${cfg.port || 8082}/v1`,
        `  Lanes:     ${active.length} enabled`,
        `  Enhance:   ${cfg.enhance ? "on" : "off"}`,
        `  Race:      ${cfg.race || 2}   Best-of: ${cfg.bestOf || 1}`,
        `  Models:    ${providers.reduce((n, p) => n + p.models.length, 0)} total across ${providers.length} providers`,
        ``,
        `  j/k  navigate menu`,
        `  Enter/space  select`,
        `  q  quit (from dashboard)`,
        `  Esc  back to dashboard`,
      ];
      for (let i = 0; i < lines.length && i < h - 8; i++) writeAt(5 + i, contentX + 2, lines[i]);
    } else if (currentView === "lanes") {
      let r = 5;
      for (const p of providers) {
        if (r >= h - 5) break;
        const state = p.enabled ? "●" : "○";
        const tier = p.tier === "recommended" ? "rec" : p.tier === "keyless" ? "key" : p.tier === "local" ? "loc" : "opt";
        const keyInfo = p.hasKey ? `key ${mask(p.key)}` : p.keyless ? "anonymous" : "no key";
        const mc = modelCounts(p);
        const modelInfo = (p.keyless && !p.hasKey) ? `${mc.total} curated` : `${mc.enabled}/${mc.total} models`;
        writeAt(r, contentX + 2, `  ${state} ${p.label.padEnd(18)} ${tier.padEnd(10)} ${keyInfo.padEnd(20)} ${modelInfo}`.slice(0, contentW - 4));
        r++;
      }
      if (r < h - 4) writeAt(r + 1, contentX + 2, "Use 'a0 config' for interactive management");
    } else if (currentView === "models") {
      let r = 5;
      writeAt(r, contentX + 2, "  Provider              Models"); r++;
      writeAt(r, contentX + 2, "  " + "─".repeat(Math.min(contentW - 4, 50))); r++;
      for (const p of providers) {
        if (r >= h - 5) break;
        const mc = modelCounts(p);
        const state = p.enabled ? "●" : "○";
        writeAt(r, contentX + 2, `  ${state} ${p.label.padEnd(18)} ${String(mc.enabled).padStart(3)}/${String(mc.total).padEnd(3)}  ${p.keyless && !p.hasKey ? "curated" : "selectable"}`.slice(0, contentW - 4));
        r++;
      }
      if (r < h - 4) writeAt(r + 1, contentX + 2, "Use 'a0 config' → Lanes for model selection");
    } else if (currentView === "providers") {
      let r = 5;
      writeAt(r, contentX + 2, "  Provider Directory"); r++;
      writeAt(r, contentX + 2, "  " + "─".repeat(Math.min(contentW - 4, 40))); r++;
      writeAt(r, contentX + 2, `  ${providers.length} providers available`); r++;
      writeAt(r, contentX + 2, `  ${active.length} currently enabled`); r++;
      writeAt(r, contentX + 2, `  ${providers.filter(p => p.keyless && !p.hasKey).length} keyless (anonymous)`); r++;
      writeAt(r, contentX + 2, `  ${providers.filter(p => p.tier === "local").length} local providers`); r += 2;
      writeAt(r, contentX + 2, "  Press Ctrl+P in 'a0 config' → Providers to search & select"); r++;
      writeAt(r, contentX + 2, "  Use 'a0 config' → Add provider for custom lanes"); r++;
    } else if (currentView === "settings") {
      let r = 5;
      const lines = [
        "  General",
        `    Enhance: ${cfg.enhance ? "on" : "off"}  Clean: ${cfg.cleanOutput ? "on" : "off"}  Depth: ${cfg.enhanceDepth}`,
        "",
        "  Performance",
        `    Race: ${cfg.race}  Best-of: ${cfg.bestOf}  Attempts: ${cfg.maxAttempts}`,
        `    Req timeout: ${cfg.requestTimeoutMs}ms  First byte: ${cfg.firstByteTimeoutMs}ms`,
        "",
        "  Routing",
        `    Keyless first: ${cfg.routing.preferKeyless}  Sticky: ${cfg.routing.sticky}  Cost: ${cfg.routing.costOptimize}`,
        "",
        "  Server",
        `    ${cfg.host}:${cfg.port}  Token: ${cfg.token ? "set" : "none"}  CORS: ${cfg.server.cors}`,
        "",
        "  Cache",
        `    Enabled: ${cfg.cache.enabled}  TTL: ${Math.round(cfg.cache.ttlMs/1000)}s  Max: ${cfg.cache.maxSize}`,
        "",
        "  Use 'a0 config' for interactive editing",
      ];
      for (let i = 0; i < lines.length && r + i < h - 5; i++) writeAt(r + i, contentX + 2, lines[i].slice(0, contentW - 4));
    } else if (currentView === "doctor") {
      let r = 5;
      writeAt(r, contentX + 2, "  Health Check"); r++;
      writeAt(r, contentX + 2, "  " + "─".repeat(Math.min(contentW - 4, 30))); r++;
      for (const p of providers) {
        if (r >= h - 5) break;
        const state = p.enabled ? "●" : "○";
        writeAt(r, contentX + 2, `  ${state} ${p.label.padEnd(18)} ${p.enabled ? "ok" : "disabled"}`.slice(0, contentW - 4));
        r++;
      }
      if (r < h - 4) writeAt(r + 1, contentX + 2, "Use 'a0 doctor' for full interactive check");
    } else if (currentView === "update") {
      let r = 5;
      writeAt(r, contentX + 2, "  Update"); r++;
      writeAt(r, contentX + 2, "  " + "─".repeat(Math.min(contentW - 4, 20))); r++;
      writeAt(r, contentX + 2, `  Current: v${VERSION}`); r++;
      writeAt(r, contentX + 2, "  Use 'a0 update' or 'a0 update --check'"); r++;
      writeAt(r, contentX + 2, "  Settings → Updates for auto-check/install"); r++;
    } else {
      writeAt(5, contentX + 2, "Press Esc to go back");
    }
    drawStatusBar(["↑↓/jk navigate", "Enter/space select", "Esc back", "q quit", "Ctrl+C exit"]);
  }
  setKeyHandler((ev) => {
    if (ev.type === "char") {
      if (ev.char === "k") { menuIndex = Math.max(0, menuIndex - 1); render(); }
      else if (ev.char === "j") { menuIndex = Math.min(MENU_ITEMS.length - 1, menuIndex + 1); render(); }
      else if (ev.char === " ") {
        const item = MENU_ITEMS[menuIndex];
        if (item.id === "quit") { cleanup(); process.exit(0); }
        else { currentView = item.id; render(); }
      } else if (ev.char === "q" && currentView === "dashboard") { cleanup(); process.exit(0); }
    } else if (ev.type === "key") {
      if (ev.key === "escape") { currentView = "dashboard"; render(); }
      else if (ev.key === "\x1b[A") { menuIndex = Math.max(0, menuIndex - 1); render(); }
      else if (ev.key === "\x1b[B") { menuIndex = Math.min(MENU_ITEMS.length - 1, menuIndex + 1); render(); }
      else if (ev.key === "enter") {
        const item = MENU_ITEMS[menuIndex];
        if (item.id === "quit") { cleanup(); process.exit(0); }
        else { currentView = item.id; render(); }
      }
    } else if (ev.type === "mouse" && ev.action === "press" && ev.btn === 0) {
      if (ev.col >= 2 && ev.col <= 24 && ev.row >= 4 && ev.row < 4 + MENU_ITEMS.length) {
        const idx = ev.row - 4;
        if (idx >= 0 && idx < MENU_ITEMS.length) {
          menuIndex = idx;
          const item = MENU_ITEMS[idx];
          if (item.id === "quit") { cleanup(); process.exit(0); }
          else { currentView = item.id; render(); }
        }
      }
    }
  });
  stdout.on("resize", () => render());
  render();
  await new Promise(() => {});
}

const MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "◉", desc: "Overview and status" },
  { id: "lanes", label: "Lanes", icon: "≡", desc: "Providers and keys" },
  { id: "models", label: "Models", icon: "◆", desc: "Per-model selection" },
  { id: "providers", label: "Providers", icon: "+", desc: "Search and select providers" },
  { id: "settings", label: "Settings", icon: "⚙", desc: "All configuration" },
  { id: "doctor", label: "Doctor", icon: "♥", desc: "Health check" },
  { id: "update", label: "Update", icon: "↑", desc: "Check for updates" },
  { id: "quit", label: "Quit", icon: "✕", desc: "Exit" },
];

// ── help ──────────────────────────────────────────────────────────────────
export function help() {
  stdout.write(`\na0 v${VERSION} — OpenAI-compatible inference gateway\n\nUsage\n  a0                 launch management TUI (runs setup on first launch)\n  a0 tui             full-screen management interface\n  a0 setup           guided provider setup\n  a0 config          interactive settings\n  a0 serve           start the gateway (foreground)\n  a0 start           start the gateway as a background daemon\n  a0 stop            stop the background daemon\n  a0 restart         restart the background daemon\n  a0 status          show daemon status\n  a0 passwd          set or generate a local auth API key\n  a0 doctor          check provider health\n  a0 models          list categories and providers\n  a0 update          update to the latest release\n  a0 version         print version\n\nFlags\n  --port <n>         port (default 8082)\n  --host <addr>      bind address (default 127.0.0.1)\n  --race <n>         lanes raced in parallel (1–4)\n  --no-enhance       disable prompt enhancement\n  --token <secret>   require this bearer token\n  --check            with update: report only, do not install\n  --serve            start the gateway server instead of the TUI\n`);
}

export default { clear, banner, setupWizard, settingsMenu, doctor, statusLine, modelMenu, addProviderWizard, addModelWizard, promptSecret, help, runTUI, closeInput, selectProviderUI };