// The TUI. Zero dependencies, ANSI only, designed to be readable over SSH
// and on a phone. Everything configurable is reachable from here.
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { DEFAULT_PROVIDERS, resolveProviders } from "./registry.js";
import { mask, saveConfig as persist, VERSION } from "./config.js";

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

async function ask(question, def = "") {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const suffix = def !== "" ? dim(` [${def}]`) : "";
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer === "" ? String(def) : answer;
  } finally {
    rl.close();
  }
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
      // Piped input: read one line normally.
      const rl = readline.createInterface({ input: stdin, output: stdout });
      rl.question("", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }
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
    };
    stdin.on("data", onData);
  });
}

function stateOf(provider) {
  if (provider.enabled) return green("on");
  return dim("off");
}

function capLine(p) {
  const caps = [];
  if (p.keyless) caps.push("keyless");
  if (p.models.some((m) => m.tools)) caps.push("tools");
  if (p.models.some((m) => m.vision)) caps.push("vision");
  if (p.hasKey) caps.push(`key ${mask(p.key)}`);
  return caps.join(" · ");
}

function providerList(providers) {
  return providers
    .map((p, i) => {
      const n = bold(String(i + 1).padStart(2));
      return `  ${n}. ${p.enabled ? green("●") : dim("○")} ${p.label.padEnd(16)} ${dim(capLine(p))}`;
    })
    .join("\n");
}

/** First-run setup. Keeps the default keyless pool, offers the upgrades. */
export async function setupWizard(cfg) {
  banner();
  stdout.write(`
${bold("Setup")}
a0 works with no keys. The keyless pool is already enabled.
Extra lanes are optional — they make sessions faster and unlock vision.
`);

  const providers = resolveProviders(cfg);
  stdout.write(`\n${providerList(providers)}\n`);

  const picked = await ask(`Enable extra lanes by number ${dim("(comma separated, or enter to keep defaults)")}`, "");
  if (picked) {
    for (const part of picked.split(",")) {
      const idx = Number.parseInt(part.trim(), 10) - 1;
      const p = providers[idx];
      if (!p) continue;
      cfg.providers[p.id] = cfg.providers[p.id] || {};
      cfg.providers[p.id].enabled = true;
      if (!p.keyless && !p.hasKey) {
        const key = await promptSecret(`  ${p.label} API key: `);
        if (key) cfg.providers[p.id].key = key;
      }
    }
  }

  stdout.write(`\n${bold("Server")}\n`);
  cfg.port = Number.parseInt(await ask("Port", String(cfg.port)), 10) || cfg.port;
  const host = await ask("Bind host", cfg.host);
  cfg.host = host;

  stdout.write(`\n${bold("Behaviour")}\n`);
  cfg.enhance = await confirm("Enhance every prompt with a0's operating contract", cfg.enhance);
  cfg.race = Math.min(4, Math.max(1, Number.parseInt(await ask("Lanes raced in parallel", String(cfg.race)), 10) || cfg.race));

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

export async function providerMenu(cfg) {
  for (;;) {
    banner();
    const providers = resolveProviders(cfg);
    stdout.write(`
${bold("Lanes")}
${providerList(providers)}

  ${dim("toggle <n> · key <n> · test <n> · testall · back")}
`);
    const input = (await ask("Command", "back")).trim().toLowerCase();
    const [cmd, arg] = input.split(/\s+/);
    if (cmd === "back" || cmd === "b") return;
    if (cmd === "testall") {
      stdout.write("\n");
      for (const p of providers.filter((x) => x.enabled)) {
        const r = await testProvider(p);
        stdout.write(`  ${r.ok ? green("✓") : red("✗")} ${p.label.padEnd(16)} ${r.status} ${dim(`${r.ms}ms`)}\n`);
      }
      await ask("\nPress enter", "");
      continue;
    }
    const idx = Number.parseInt(arg, 10) - 1;
    const p = providers[idx];
    if (!p) continue;
    cfg.providers[p.id] = cfg.providers[p.id] || {};
    if (cmd === "toggle" || cmd === "t") {
      cfg.providers[p.id].enabled = !p.enabled;
      persist(cfg);
    } else if (cmd === "key" || cmd === "k") {
      const key = await promptSecret(`  ${p.label} API key ${p.hasKey ? `(current ${mask(p.key)})` : ""}: `);
      if (key) {
        cfg.providers[p.id].key = key;
        cfg.providers[p.id].enabled = true;
        persist(cfg);
      }
    } else if (cmd === "test") {
      const r = await testProvider(p);
      stdout.write(`  ${r.ok ? green("✓ reachable") : red(`✗ ${r.status}`)} ${dim(`${r.ms}ms`)}\n`);
      await ask("Press enter", "");
    }
  }
}

export async function settingsMenu(cfg) {
  for (;;) {
    banner();
    stdout.write(`
${bold("Settings")}

  1. Lanes and keys
  2. Behaviour      ${dim(`enhance=${cfg.enhance} clean=${cfg.cleanOutput}`)}
  3. Performance    ${dim(`race=${cfg.race} best-of=${cfg.bestOf} attempts=${cfg.maxAttempts}`)}
  4. Server         ${dim(`${cfg.host}:${cfg.port}${cfg.token ? " token=on" : ""}`)}
  5. Routing        ${dim(`keyless-first=${cfg.routing.preferKeyless} sticky=${cfg.routing.sticky}`)}
  6. Show config    ${dim("secrets masked")}
  7. Save and exit
  8. Exit without saving
`);
    const choice = await ask("Choice", "7");

    if (choice === "1") {
      await providerMenu(cfg);
    } else if (choice === "2") {
      cfg.enhance = await confirm("Enhance every prompt", cfg.enhance);
      cfg.cleanOutput = await confirm("Strip filler from non-stream answers", cfg.cleanOutput);
    } else if (choice === "3") {
      cfg.race = Math.min(4, Math.max(1, Number.parseInt(await ask("Lanes raced in parallel", String(cfg.race)), 10) || cfg.race));
      cfg.bestOf = Math.min(4, Math.max(1, Number.parseInt(await ask("Best-of answers for non-stream", String(cfg.bestOf)), 10) || cfg.bestOf));
      cfg.maxAttempts = Math.min(8, Math.max(1, Number.parseInt(await ask("Max lane attempts", String(cfg.maxAttempts)), 10) || cfg.maxAttempts));
      cfg.requestTimeoutMs = (Number.parseInt(await ask("Request timeout ms", String(cfg.requestTimeoutMs)), 10) || cfg.requestTimeoutMs);
      cfg.firstByteTimeoutMs = (Number.parseInt(await ask("First-byte timeout ms", String(cfg.firstByteTimeoutMs)), 10) || cfg.firstByteTimeoutMs);
    } else if (choice === "4") {
      cfg.host = await ask("Bind host", cfg.host);
      cfg.port = Number.parseInt(await ask("Port", String(cfg.port)), 10) || cfg.port;
      const token = await ask("Local token (empty = no auth)", cfg.token ? "(keep current)" : "");
      if (token && token !== "(keep current)") cfg.token = token;
    } else if (choice === "5") {
      cfg.routing.preferKeyless = await confirm("Prefer keyless lanes", cfg.routing.preferKeyless);
      cfg.routing.sticky = await confirm("Keep one model per session", cfg.routing.sticky);
    } else if (choice === "6") {
      const { redact } = await import("./config.js");
      stdout.write(`\n${JSON.stringify(redact(cfg), null, 2)}\n`);
      await ask("\nPress enter", "");
    } else if (choice === "7") {
      const file = persist(cfg);
      stdout.write(`\n${green("✓")} saved ${dim(file)}\n`);
      return cfg;
    } else if (choice === "8") {
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
    stdout.write(`  ${bold(p.label.padEnd(16))} ${enabled} ${verdict}\n`);
  }
  const enabled = providers.filter((p) => p.enabled);
  const keyless = enabled.filter((p) => p.keyless).length;
  stdout.write(`
${bold("Summary")}
  lanes enabled   ${enabled.length} (${keyless} keyless)
  enhancement     ${cfg.enhance ? green("on") : yellow("off")}
  race            ${cfg.race}
  best-of         ${cfg.bestOf}
  endpoint        ${cyan(`http://${cfg.host}:${cfg.port}/v1`)}
`);
  await ask("\nPress enter", "");
}

export async function statusLine(cfg, providers) {
  const active = providers.filter((p) => p.enabled);
  banner();
  stdout.write(`
${bold("Running")}
  endpoint   ${cyan(`http://${cfg.host}:${cfg.port}/v1`)}
  api key    ${cfg.token ? mask(cfg.token) : dim("any value (no auth)")}
  lanes      ${active.length} (${active.filter((p) => p.keyless).length} keyless)
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
  a0 setup           first-run wizard
  a0 config          interactive settings
  a0 serve           start the gateway
  a0 doctor          check every lane
  a0 models          list categories and lanes
  a0 version         print version

${bold("Flags")}
  --port <n>         port (default 8082)
  --host <addr>      bind address (default 127.0.0.1)
  --race <n>         lanes raced in parallel (1–4)
  --no-enhance       disable prompt enhancement
  --token <secret>   require this bearer token
`);
}

export { DEFAULT_PROVIDERS };
