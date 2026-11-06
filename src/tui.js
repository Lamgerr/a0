// The TUI. Zero dependencies, ANSI only, designed to be readable over SSH
// and on a phone. Everything configurable is reachable from here.
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { modelCounts, resolveProviders, setModelEnabled } from "./registry.js";
import { mask, saveConfig as persist, redact, VERSION } from "./config.js";
import { checkLatest } from "./update.js";
import {
  applySetupMode,
  guideLines,
  modeSummary,
  optional,
  recommended,
} from "./setup.js";

const tty = Boolean(stdout.isTTY);
const color = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = color("1");
const dim = color("2");
const cyan = color("36");
const green = color("32");
const yellow = color("33");
const red = color("31");

export function clear() {
  if (tty) stdout.write("\x1b[2J\x1b[H");
}

export function banner() {
  clear();
  stdout.write(`
${bold(cyan("  a0"))} ${dim(`v${VERSION}`)}  ${dim("free-first inference gateway")}
${dim("  one endpoint, pooled free lanes, a routing brain")}
`);
}

// A single readline interface feeding a line queue. This works for both
// interactive typing and piped multi-line input: every line is queued and
// consumed one at a time, so pasted scripts are not dropped.
let rl = null;
const lineQueue = [];
let lineWaiter = null;

function ensureReader() {
  if (rl) return;
  rl = readline.createInterface({
    input: stdin,
    output: stdout,
    terminal: Boolean(stdout.isTTY),
  });
  rl.on("line", (line) => {
    if (lineWaiter) {
      const w = lineWaiter;
      lineWaiter = null;
      w(line);
    } else {
      lineQueue.push(line);
    }
  });
  rl.on("close", () => {
    if (lineWaiter) {
      const w = lineWaiter;
      lineWaiter = null;
      w("");
    }
  });
}

function readLine() {
  ensureReader();
  if (lineQueue.length > 0) return Promise.resolve(lineQueue.shift());
  return new Promise((resolve) => {
    lineWaiter = resolve;
  });
}

/** Release stdin so the process can exit. Safe to call more than once. */
export function closeInput() {
  if (rl) {
    rl.close();
    rl = null;
    lineQueue.length = 0;
    lineWaiter = null;
  }
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

/** Read a secret without echoing it. */
export function promptSecret(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      readLine().then((answer) => resolve(answer.trim()));
      return;
    }
    // Raw mode owns the keyboard; pause the line reader first.
    closeInput();
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onData = (buf) => {
      const text = buf.toString("utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
      for (const ch of text) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        if (ch >= " " && ch !== "\u001b") {
          value += ch;
          stdout.write("•");
        }
      }
    };
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      ensureReader();
    };
    stdin.on("data", onData);
  });
}

function tierLabel(p) {
  if (p.tier === "recommended") return green("recommended");
  if (p.tier === "keyless") return dim("keyless");
  return yellow("optional");
}

function capLine(p) {
  const caps = [tierLabel(p)];
  if (p.hasKey) caps.push(dim(`key ${mask(p.key)}`));
  else if (p.keyless) caps.push(dim("anonymous"));
  if (!p.freeTier) caps.push(red("paid"));
  const { enabled, total } = modelCounts(p);
  if (p.keyless && !p.hasKey) caps.push(dim(`${total} curated`));
  else caps.push(dim(enabled === total ? `${total} models` : `${enabled}/${total} models`));
  return caps.join(" · ");
}

function providerList(providers) {
  return providers
    .map((p, i) => {
      const n = bold(String(i + 1).padStart(2));
      return `  ${n}. ${p.enabled ? green("●") : dim("○")} ${p.label.padEnd(18)} ${capLine(p)}`;
    })
    .join("\n");
}

function saveKey(cfg, id, key) {
  cfg.providers[id] = { ...(cfg.providers[id] || {}), key, enabled: true };
}

/** First-run setup. Guides keys first; keyless is the fallback. */
export async function setupWizard(cfg) {
  banner();
  stdout.write(`
${bold("Setup")}

a0 works two ways:
  ${green("recommended")}  add free keys from legit providers — better models, higher limits, real failover
  ${dim("keyless")}      skip everything — a0 uses anonymous free lanes

Add at least two keys for racing and failover. Press enter to skip any key.
`);

  const providers = resolveProviders(cfg);

  stdout.write(`\n${bold("Recommended free providers")}\n`);
  for (const p of recommended(providers)) {
    stdout.write(`\n  ${bold(p.label)}  ${dim("· recommended")}\n`);
    for (const line of guideLines(p)) stdout.write(`    ${dim(line)}\n`);
    const key = (await promptSecret(`    Paste key ${dim("(enter to skip)")}: `)).trim();
    if (key) {
      saveKey(cfg, p.id, key);
      stdout.write(`    ${green("✓")} ${p.label} enabled\n`);
    }
  }

  const wantsOptional = await confirm("\nConfigure optional providers too? (tighter free limits)", false);
  if (wantsOptional) {
    for (const p of optional(providers)) {
      stdout.write(`\n  ${bold(p.label)}  ${dim("· optional")}\n`);
      for (const line of guideLines(p)) stdout.write(`    ${dim(line)}\n`);
      const key = (await promptSecret(`    Paste key ${dim("(enter to skip)")}: `)).trim();
      if (key) {
        saveKey(cfg, p.id, key);
        stdout.write(`    ${green("✓")} ${p.label} enabled\n`);
      }
    }
  }

  const mode = applySetupMode(cfg);
  stdout.write(`\n${bold("Mode")}  ${mode.mode === "keyed" ? green(modeSummary(mode)) : dim(modeSummary(mode))}\n`);
  if (mode.mode === "keyed") {
    stdout.write(
      dim("  Anonymous lanes are off so your keyed lanes are used first. You can change this any time.\n"),
    );
    const keep = await confirm("Keep anonymous lanes on as a fallback?", false);
    if (keep) {
      for (const id of mode.disabled) {
        cfg.providers[id] = { ...(cfg.providers[id] || {}), enabled: true };
      }
      cfg.routing.preferKeyless = true;
    }
  }

  stdout.write(`\n${bold("Server")}\n`);
  cfg.port = Number.parseInt(await ask("Port", String(cfg.port)), 10) || cfg.port;
  cfg.host = await ask("Bind host", cfg.host);

  stdout.write(`\n${bold("Behaviour")}\n`);
  cfg.enhance = await confirm("Enhance every prompt with a0's operating contract", cfg.enhance);
  cfg.race = Math.min(4, Math.max(1, Number.parseInt(await ask("Lanes raced in parallel", String(cfg.race)), 10) || cfg.race));

  stdout.write(`\n${bold("Updates")}\n`);
  cfg.updates = cfg.updates || {};
  cfg.updates.autoCheck = await confirm("Check for a0 updates on startup", cfg.updates.autoCheck !== false);
  cfg.updates.autoInstall = await confirm("Install updates automatically (restart to apply)", Boolean(cfg.updates.autoInstall));

  const file = persist(cfg);
  stdout.write(`\n${green("✓")} saved ${dim(file)}\n`);
  await ask("Press enter to start a0", "");
  return cfg;
}

async function testProvider(p) {
  const url = `${p.baseUrl.replace(/\/+$/, "")}/models`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: p.key ? { authorization: `Bearer ${p.key}` } : {},
    });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, status: err.name === "TimeoutError" ? "timeout" : err.message, ms: Date.now() - started };
  }
}

/** Per-model selection for one keyed lane. Anonymous lanes stay curated. */
export async function modelMenu(cfg, p) {
  banner();
  if (p.keyless && !p.hasKey) {
    stdout.write(`
  ${bold(p.label)} is part of a0's ${green("anonymous pool")}.

  ${dim("Its models are curated by a0 and cannot be selected individually.")}
  ${dim("Add a key for this provider to unlock per-model selection.")}
${p.setup?.url ? `\n  ${dim("Get a key:")} ${p.setup.url}\n` : ""}
`);
    await ask("Press enter", "");
    return;
  }
  if (!p.hasKey) {
    stdout.write(`
  ${bold(p.label)} has no key yet.

  ${dim("Add a key first:")} ${p.setup?.url || dim("see `guide` for this lane")}
`);
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
      const caps = [m.tools ? "tools" : "", m.vision ? "vision" : "", m.fast ? "fast" : ""]
        .filter(Boolean)
        .join(",");
      const meta = `${Math.round((m.context || 0) / 1000)}k${caps ? ` · ${caps}` : ""}`;
      stdout.write(
        `  ${on ? green("●") : dim("○")} ${bold(String(i + 1).padStart(2))}. ${m.id.padEnd(34)} ${dim(meta)}\n`,
      );
    }
    stdout.write(`\n  ${dim(`${enabled}/${total} enabled · toggle <n> · all · none · back`)}\n`);
    const input = (await ask("Command", "back")).trim().toLowerCase();
    const [cmd, arg] = input.split(/\s+/);
    if (cmd === "back" || cmd === "b") return;

    const ids = fresh.models.map((m) => m.id);

    if (cmd === "all") {
      for (const id of ids) setModelEnabled(cfg, fresh.id, id, true, ids);
      persist(cfg);
      continue;
    }
    if (cmd === "none") {
      if (!(await confirm(`Disable all ${total} models on ${fresh.label}?`, false))) continue;
      for (const id of ids) setModelEnabled(cfg, fresh.id, id, false, ids);
      persist(cfg);
      continue;
    }

    const idx = Number.parseInt(arg, 10) - 1;
    const model = fresh.models[idx];
    if (!model) continue;
    if (cmd === "toggle" || cmd === "t") {
      const next = model.enabled === false;
      if (!next && enabled === 1) {
        stdout.write(`\n  ${yellow("At least one model must stay enabled on a keyed lane.")}\n`);
        await ask("Press enter", "");
        continue;
      }
      setModelEnabled(cfg, fresh.id, model.id, next, ids);
      persist(cfg);
    }
  }
}

export async function providerMenu(cfg) {
  for (;;) {
    banner();
    const providers = resolveProviders(cfg);
    stdout.write(`
${bold("Lanes")}
${providerList(providers)}

  ${dim("toggle <n> · key <n> · models <n> · guide <n> · test <n> · testall · back")}
`);
    const input = (await ask("Command", "back")).trim().toLowerCase();
    const [cmd, arg] = input.split(/\s+/);
    if (cmd === "back" || cmd === "b") return;

    if (cmd === "testall") {
      stdout.write("\n");
      for (const p of providers.filter((x) => x.enabled)) {
        const r = await testProvider(p);
        stdout.write(`  ${r.ok ? green("✓") : red("✗")} ${p.label.padEnd(18)} ${r.status} ${dim(`${r.ms}ms`)}\n`);
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
        persist(cfg);
        continue;
      }
      cfg.providers[p.id].enabled = !p.enabled;
      persist(cfg);
    } else if (cmd === "key" || cmd === "k") {
      const key = (await promptSecret(`  ${p.label} API key ${p.hasKey ? `(current ${mask(p.key)})` : ""}: `)).trim();
      if (key) {
        saveKey(cfg, p.id, key);
        persist(cfg);
      }
    } else if (cmd === "guide" || cmd === "g") {
      stdout.write(`\n  ${bold(p.label)}  ${tierLabel(p)}\n`);
      for (const line of guideLines(p)) stdout.write(`    ${line}\n`);
      await ask("\nPress enter", "");
    } else if (cmd === "models" || cmd === "m") {
      if (p.keyless && !p.hasKey) {
        await modelMenu(cfg, p);
      } else if (!p.hasKey) {
        const key = (await promptSecret(`  ${p.label} API key: `)).trim();
        if (!key) continue;
        saveKey(cfg, p.id, key);
        persist(cfg);
        await modelMenu(cfg, resolveProviders(cfg).find((x) => x.id === p.id) || p);
      } else {
        await modelMenu(cfg, p);
      }
    } else if (cmd === "test") {
      const r = await testProvider(p);
      stdout.write(`  ${r.ok ? green("✓ reachable") : red(`✗ ${r.status}`)} ${dim(`${r.ms}ms`)}\n`);
      await ask("Press enter", "");
    }
  }
}

/** Print the result of an npm version check and remember when it ran. */
export async function showUpdateCheck(cfg) {
  const result = await checkLatest();
  cfg.updates = { ...(cfg.updates || {}), lastCheck: Date.now() };
  if (!result.ok) {
    stdout.write(`\n  ${red("✗")} update check failed: ${result.error || result.status}\n`);
    return result;
  }
  if (result.update) {
    stdout.write(`\n  ${yellow("↑")} a0 v${result.latest} is available ${dim(`(you have v${result.current})`)}\n`);
    stdout.write(`  ${dim(`Install: npm install -g ${result.packageName}@latest  (or run \`a0 update\`)`)}\n`);
  } else {
    stdout.write(`\n  ${green("✓")} up to date ${dim(`v${result.current}`)}\n`);
  }
  return result;
}

export async function settingsMenu(cfg) {
  for (;;) {
    banner();
    stdout.write(`
${bold("Settings")}

  1. Lanes, keys, and models
  2. Behaviour      ${dim(`enhance=${cfg.enhance} clean=${cfg.cleanOutput}`)}
  3. Performance    ${dim(`race=${cfg.race} best-of=${cfg.bestOf} attempts=${cfg.maxAttempts}`)}
  4. Server         ${dim(`${cfg.host}:${cfg.port}${cfg.token ? " token=on" : ""}`)}
  5. Routing        ${dim(`keyless-first=${cfg.routing.preferKeyless} sticky=${cfg.routing.sticky}`)}
  6. Updates        ${dim(`auto-check=${cfg.updates?.autoCheck !== false} auto-install=${Boolean(cfg.updates?.autoInstall)}`)}
  7. Show config    ${dim("secrets masked")}
  8. Save and exit
  9. Exit without saving
`);
    const choice = await ask("Choice", "8");

    if (choice === "1") {
      await providerMenu(cfg);
    } else if (choice === "2") {
      cfg.enhance = await confirm("Enhance every prompt", cfg.enhance);
      cfg.cleanOutput = await confirm("Strip filler from non-stream answers", cfg.cleanOutput);
    } else if (choice === "3") {
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
      if (await confirm("Check now?", false)) {
        await showUpdateCheck(cfg);
        await ask("Press enter", "");
      }
    } else if (choice === "7") {
      stdout.write(`\n${JSON.stringify(redact(cfg), null, 2)}\n`);
      await ask("\nPress enter", "");
    } else if (choice === "8") {
      const file = persist(cfg);
      stdout.write(`\n${green("✓")} saved ${dim(file)}\n`);
      return cfg;
    } else if (choice === "9") {
      return cfg;
    }
  }
}

export async function doctor(cfg) {
  banner();
  const providers = resolveProviders(cfg);
  stdout.write(`\n${bold("Lanes")}\n`);
  for (const p of providers) {
    const enabled = p.enabled ? green("enabled ") : dim("disabled");
    let verdict = dim("—");
    if (p.enabled) {
      const r = await testProvider(p);
      verdict = r.ok ? green(`ok ${r.ms}ms`) : red(String(r.status));
    }
    stdout.write(`  ${bold(p.label.padEnd(18))} ${tierLabel(p).padEnd(22)} ${enabled} ${verdict}\n`);
    if (!p.enabled && p.setup?.url) stdout.write(`      ${dim(`key: ${p.setup.url}`)}\n`);
  }
  const enabled = providers.filter((p) => p.enabled);
  const keyed = enabled.filter((p) => p.hasKey).length;
  const keyless = enabled.filter((p) => p.keyless && !p.hasKey).length;
  stdout.write(`
${bold("Summary")}
  lanes enabled   ${enabled.length} (${keyed} keyed, ${keyless} anonymous)
  enhancement     ${cfg.enhance ? green("on") : yellow("off")}
  race            ${cfg.race}
  best-of         ${cfg.bestOf}
  endpoint        ${cyan(`http://${cfg.host}:${cfg.port}/v1`)}
`);
  await ask("\nPress enter", "");
}

export async function statusLine(cfg, providers) {
  const active = providers.filter((p) => p.enabled);
  const keyed = active.filter((p) => p.hasKey).length;
  const anon = active.filter((p) => p.keyless && !p.hasKey).length;
  banner();
  stdout.write(`
${bold("Running")}
  endpoint   ${cyan(`http://${cfg.host}:${cfg.port}/v1`)}
  api key    ${cfg.token ? mask(cfg.token) : dim("any value (no auth)")}
  lanes      ${active.length} (${keyed} keyed, ${anon} anonymous)
  enhance    ${cfg.enhance ? green("on") : yellow("off")}
  race       ${cfg.race}   best-of ${cfg.bestOf}

${dim("Point Cline, Roo, Continue, Aider, or any OpenAI SDK at the endpoint.")}
${dim("Press Ctrl-C to stop.")}
`);
}

export function help() {
  stdout.write(`
${bold("a0")} ${dim(`v${VERSION}`)} — free-first inference gateway

${bold("Usage")}
  a0                 start the gateway (runs setup on first launch)
  a0 setup           guided key + lane setup
  a0 config          interactive settings
  a0 serve           start the gateway
  a0 doctor          check every lane
  a0 models          list categories and lanes
  a0 update          update a0 to the latest npm release
  a0 version         print version

${bold("Flags")}
  --port <n>         port (default 8082)
  --host <addr>      bind address (default 127.0.0.1)
  --race <n>         lanes raced in parallel (1–4)
  --no-enhance       disable prompt enhancement
  --token <secret>   require this bearer token
  --check            with update: report only, do not install
`);
}
