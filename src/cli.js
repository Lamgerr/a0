// CLI entry: thin, explicit, no magic.
import crypto from "node:crypto";
import { stdin, stdout } from "node:process";

import { configExists, configPath, loadConfig, saveConfig, VERSION } from "./config.js";
import { CATEGORIES, activeProviders, resolveProviders } from "./registry.js";
import { createServer } from "./server.js";
import { help, setupWizard, settingsMenu, doctor, statusLine, banner, runTUI } from "./tui.js";
import { startDaemon, stopDaemon, restartDaemon, daemonStatus, isRunning, logFile } from "./daemon.js";
import { checkLatest, installLatest, maybeCheck } from "./update.js";
import { startHarness } from "./harness.js";

const VALUE_FLAGS = new Set(["--port", "--host", "--race", "--token", "--best-of"]);

function parseArgv(argv) {
  const out = { command: "", flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const [name, inline] = arg.split("=");
      if (VALUE_FLAGS.has(name)) {
        out.flags[name.slice(2)] = inline !== undefined ? inline : argv[++i];
      } else {
        out.flags[name.slice(2)] = true;
      }
    } else if (!out.command) {
      out.command = arg;
    }
  }
  return out;
}

function applyFlags(cfg, flags) {
  if (flags.port) cfg.port = Number.parseInt(flags.port, 10) || cfg.port;
  if (flags.host) cfg.host = flags.host;
  if (flags.token) cfg.token = flags.token;
  if (flags.race) cfg.race = Math.min(4, Math.max(1, Number.parseInt(flags.race, 10) || cfg.race));
  if (flags["best-of"]) cfg.bestOf = Math.min(4, Math.max(1, Number.parseInt(flags["best-of"], 10) || cfg.bestOf));
  if (flags["no-enhance"]) cfg.enhance = false;
  return cfg;
}

function isLoopback(host) {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

function logRequest(entry) {
  const when = new Date(entry.ts).toTimeString().slice(0, 8);
  const route = entry.provider ? `${entry.provider}:${entry.model}` : "-";
  const parts = [
    `\x1b[2m${when}\x1b[0m`,
    (entry.category || entry.path || "-").padEnd(11),
    route.padEnd(34),
    String(entry.status || "-").padEnd(4),
    entry.ms !== undefined ? `${entry.ms}ms` : "",
    entry.degraded ? "\x1b[33mdegraded\x1b[0m" : "",
    entry.error ? `\x1b[31m${entry.error}\x1b[0m` : "",
  ];
  process.stderr.write(`${parts.filter(Boolean).join(" ")}\n`);
}

function listModels(cfg) {
  const providers = resolveProviders(cfg);
  banner();
  stdout.write(`\n${"\x1b[1m"}Categories\x1b[0m\n`);
  for (const c of CATEGORIES) stdout.write(`  ${c.id.padEnd(14)} ${"\x1b[2m"}${c.note}\x1b[0m\n`);
  stdout.write(`\n${"\x1b[1m"}Lanes\x1b[0m\n`);
  for (const p of providers) {
    const state = p.enabled ? "\x1b[32m●\x1b[0m" : "\x1b[2m○\x1b[0m";
    const badges = [p.keyless ? "keyless" : "key", p.hasKey ? "ready" : ""].filter(Boolean).join(",");
    stdout.write(`  ${state} ${p.label.padEnd(16)} ${"\x1b[2m"}${badges.padEnd(16)}\x1b[0m\n`);
    for (const m of p.models) {
      const off = m.enabled === false;
      const caps = [m.tools ? "tools" : "", m.vision ? "vision" : "", m.fast ? "fast" : ""].filter(Boolean).join(",");
      const meta = `${String(Math.round((m.context || 0) / 1000))}k${caps ? ` · ${caps}` : ""}`;
      stdout.write(`      ${off ? "\x1b[2m○" : "●"} ${(off ? `(off) ${m.id}` : m.id).padEnd(32)} ${meta}\x1b[0m\n`);
    }
  }
  stdout.write(`\n${"\x1b[2m"}Config: ${configPath()}\x1b[0m\n`);
}

async function updateCommand(cfg, flags) {
  stdout.write(`a0 v${VERSION} — checking npm…\n`);
  const result = await checkLatest();
  if (!result.ok) {
    process.stderr.write(`a0: update check failed — ${result.error || result.status}\n`);
    process.exitCode = 1;
    return;
  }
  cfg.updates = { ...(cfg.updates || {}), lastCheck: Date.now() };
  saveConfig(cfg);
  if (!result.update) {
    stdout.write(`a0 is up to date (v${result.current}).\n`);
    return;
  }
  stdout.write(`a0 v${result.latest} is available (you have v${result.current}).\n`);
  if (flags.check) {
    stdout.write("Run `a0 update` to install.\n");
    return;
  }
  stdout.write(`Installing ${result.packageName}@latest…\n`);
  const installed = await installLatest({ packageName: result.packageName });
  if (!installed.ok) {
    process.stderr.write(`a0: npm install failed — ${installed.error || `exit ${installed.code}`}\n`);
    process.stderr.write(`Try: npm install -g ${result.packageName}@latest\n`);
    process.exitCode = 1;
    return;
  }
  stdout.write(`✓ updated. Restart a0 to use v${result.latest}.\n`);
}

/** Fire-and-forget version check. Never delays or breaks startup. */
async function backgroundUpdateCheck(cfg) {
  const result = await maybeCheck(cfg);
  if (!result?.checked) return;
  try {
    saveConfig(cfg);
  } catch {
    /* a read-only config dir must not break serving */
  }
  if (!result.ok || !result.update) return;
  if (cfg.updates?.autoInstall) {
    process.stderr.write(`\na0: v${result.latest} available — installing…\n`);
    const installed = await installLatest({ packageName: result.packageName });
    if (installed.ok) process.stderr.write(`a0: updated to v${result.latest}; restart to apply.\n`);
    else process.stderr.write(`a0: auto-update failed — run \`a0 update\`.\n`);
    return;
  }
  process.stderr.write(`\na0: v${result.latest} available (you have v${VERSION}). Run \`a0 update\`.\n`);
}

async function serve(cfg) {
  let providers = resolveProviders(cfg);
  let active = activeProviders(providers);

  if (active.length === 0) {
    process.stderr.write(
      "a0: no lanes enabled. Run `a0 setup` or add a key in `a0 config`.\n",
    );
    process.exitCode = 1;
    return;
  }

  if (!isLoopback(cfg.host) && !cfg.token) {
    cfg.token = crypto.randomBytes(24).toString("base64url");
    saveConfig(cfg);
    process.stderr.write(
      `\na0: binding ${cfg.host} without a token — generated one:\n  ${cfg.token}\n` +
        `Use it as the API key: Authorization: Bearer ${cfg.token}\n\n`,
    );
  }

  const server = createServer({ cfg, providers, log: logRequest });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(cfg.port, cfg.host, resolve);
    });
  } catch (err) {
    if (err.code === "EADDRINUSE") {
      process.stderr.write(`a0: port ${cfg.port} is already in use. Try --port ${cfg.port + 1}.\n`);
    } else {
      process.stderr.write(`a0: cannot listen on ${cfg.host}:${cfg.port} — ${err.message}\n`);
    }
    process.exitCode = 1;
    return;
  }

  if (stdout.isTTY) await statusLine(cfg, providers);
  backgroundUpdateCheck(cfg).catch(() => {});

  // Start background model research harness
  const stopHarness = startHarness(cfg, {
    onResult: (r) => {
      if (r.added > 0 || r.removed > 0) {
        process.stderr.write(`a0: model refresh — +${r.added} -${r.removed} models\n`);
      }
    },
  });
  process.on("exit", stopHarness);

  const shutdown = () => {
    stdout.write("\n");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main() {
  const { command, flags } = parseArgv(process.argv.slice(2));
  let cfg = loadConfig();

  if (flags.help) {
    help();
    return;
  }
  if (flags.version) {
    stdout.write(`${VERSION}\n`);
    return;
  }

  switch (command) {
    case "help":
    case "-h":
    case "--help":
      help();
      return;
    case "version":
    case "-v":
    case "--version":
      stdout.write(`${VERSION}\n`);
      return;
    case "tui":
      applyFlags(cfg, flags);
      await runTUI(cfg);
      return;
    case "doctor":
      applyFlags(cfg, flags);
      await doctor(cfg);
      return;
    case "update":
      await updateCommand(cfg, flags);
      return;
    case "config":
      applyFlags(cfg, flags);
      await settingsMenu(cfg);
      return;
    case "setup":
      cfg = applyFlags(cfg, flags);
      cfg = await setupWizard(cfg);
      await serve(cfg);
      return;
    case "serve":
      cfg = applyFlags(cfg, flags);
      await serve(cfg);
      return;
    case "start":
      cfg = applyFlags(cfg, flags);
      const startResult = startDaemon(cfg, flags);
      stdout.write(`${startResult.ok ? "✓" : "✗"} ${startResult.message}\n`);
      if (!startResult.ok) process.exitCode = 1;
      return;
    case "stop":
      const stopResult = stopDaemon();
      stdout.write(`${stopResult.ok ? "✓" : "✗"} ${stopResult.message}\n`);
      if (!stopResult.ok) process.exitCode = 1;
      return;
    case "restart":
      cfg = applyFlags(cfg, flags);
      const restartResult = restartDaemon(cfg, flags);
      stdout.write(`${restartResult.stop.ok ? "✓" : "✗"} ${restartResult.stop.message}\n`);
      stdout.write(`${restartResult.start.ok ? "✓" : "✗"} ${restartResult.start.message}\n`);
      if (!restartResult.start.ok) process.exitCode = 1;
      return;
    case "status":
      const st = daemonStatus();
      stdout.write(`${st.running ? "●" : "○"} ${st.message}\n`);
      if (st.running) {
        const { running, pid } = isRunning();
        stdout.write(`  pid: ${pid}\n  log: ${logFile()}\n`);
      }
      return;
    case "":
      if (!configExists()) {
        if (stdin.isTTY) {
          cfg = await setupWizard(cfg);
        } else {
          // Headless first run: defaults are usable, so do not block on a TTY.
          saveConfig(cfg);
        }
      } else {
        cfg = applyFlags(cfg, flags);
      }
      if (stdin.isTTY && !flags.serve) {
        await runTUI(cfg);
      } else {
        await serve(cfg);
      }
      return;
    default:
      process.stderr.write(`a0: unknown command "${command}"\n\n`);
      help();
      process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`a0: ${err.message}\n`);
  if (process.env.A0_DEBUG) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
