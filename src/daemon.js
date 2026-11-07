// Daemon management. Runs a0 as a background process with a PID file.
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { configDir, saveConfig } from "./config.js";

export function pidFile() {
  return path.join(configDir(), "a0.pid");
}

export function logFile() {
  return path.join(configDir(), "a0.log");
}

export function isRunning() {
  const pf = pidFile();
  try {
    const pid = Number.parseInt(fs.readFileSync(pf, "utf8").trim(), 10);
    if (!pid || !Number.isFinite(pid)) return { running: false, pid: null };
    // Check if process exists
    try {
      process.kill(pid, 0);
      return { running: true, pid };
    } catch {
      // Process doesn't exist, clean up stale pid file
      try { fs.unlinkSync(pf); } catch {}
      return { running: false, pid: null };
    }
  } catch {
    return { running: false, pid: null };
  }
}

export function startDaemon(cfg, flags = {}) {
  const { running, pid } = isRunning();
  if (running) {
    return { ok: false, message: `a0 is already running (pid ${pid}). Use 'a0 restart' to restart.` };
  }

  // Ensure config dir exists
  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 });

  // Auto-generate token if binding beyond loopback and no token set
  const host = flags.host || cfg.host || "127.0.0.1";
  const isLocal = host === "127.0.0.1" || host === "localhost" || host === "::1";
  if (!isLocal && !cfg.token && !flags.token) {
    cfg.token = crypto.randomBytes(24).toString("base64url");
    saveConfig(cfg);
  }

  const port = flags.port || cfg.port || 8082;
  const token = flags.token || cfg.token || "";

  const args = ["serve"];
  if (flags.port) args.push("--port", String(flags.port));
  if (flags.host) args.push("--host", flags.host);
  if (flags.race) args.push("--race", String(flags.race));
  if (flags.token) args.push("--token", flags.token);
  if (flags["no-enhance"]) args.push("--no-enhance");

  const out = fs.openSync(logFile(), "a");
  const err = fs.openSync(logFile(), "a");

  const child = spawn(process.execPath, [process.argv[1], ...args], {
    detached: true,
    stdio: ["ignore", out, err],
    cwd: process.cwd(),
  });

  child.unref();

  // Write PID file
  fs.writeFileSync(pidFile(), String(child.pid), { mode: 0o600 });

  // Build connection details
  const lines = [];
  lines.push(`a0 started (pid ${child.pid})`);
  lines.push(``);
  lines.push(`  IP:        ${host}`);
  lines.push(`  Port:      ${port}`);
  lines.push(`  Local:     ${isLocal ? "yes (loopback only)" : "no (network accessible)"}`);
  lines.push(`  Endpoint:  http://${host}:${port}/v1`);
  if (token) {
    const masked = token.length <= 8 ? "••••" : `${token.slice(0, 4)}…${token.slice(-4)}`;
    lines.push(`  Auth:      yes (API key: ${masked})`);
  } else {
    lines.push(`  Auth:      no (any value accepted)`);
  }
  lines.push(``);
  lines.push(`  Logs: ${logFile()}`);
  if (!token && !isLocal) {
    lines.push(``);
    lines.push(`  ⚠ Binding to a non-loopback address without auth.`);
    lines.push(`  Run 'a0 passwd' to set a local API key.`);
  }
  if (!token && isLocal) {
    lines.push(``);
    lines.push(`  Tip: Run 'a0 passwd' to set a local API key for extra security.`);
  }

  return { ok: true, pid: child.pid, message: lines.join("\n") };
}

export function stopDaemon() {
  const { running, pid } = isRunning();
  if (!running) {
    return { ok: false, message: "a0 is not running." };
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (err) {
    try { fs.unlinkSync(pidFile()); } catch {}
    return { ok: false, message: `Failed to stop: ${err.message}` };
  }

  // Wait for process to exit (up to 5 seconds)
  const start = Date.now();
  while (Date.now() - start < 5000) {
    try {
      process.kill(pid, 0);
    } catch {
      // Process exited
      try { fs.unlinkSync(pidFile()); } catch {}
      return { ok: true, message: `a0 stopped (pid ${pid}).` };
    }
    // Busy wait (small sleep)
    const end = Date.now() + 100;
    while (Date.now() < end) {}
  }

  // Force kill if still running
  try { process.kill(pid, "SIGKILL"); } catch {}
  try { fs.unlinkSync(pidFile()); } catch {}
  return { ok: true, message: `a0 stopped (pid ${pid}, forced).` };
}

export function restartDaemon(cfg, flags = {}) {
  const stopResult = stopDaemon();
  // Brief pause to let port release
  const start = Date.now();
  while (Date.now() - start < 500) {}
  const startResult = startDaemon(cfg, flags);
  return { stop: stopResult, start: startResult };
}

export function setPassword(cfg, newPassword, authFile) {
  if (authFile) {
    // Save token to file
    const dir = path.dirname(authFile);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const token = newPassword || crypto.randomBytes(24).toString("base64url");
    fs.writeFileSync(authFile, token + "\n", { mode: 0o600 });
    try { fs.chmodSync(authFile, 0o600); } catch {}
    cfg.authFile = authFile;
    cfg.token = token;
    saveConfig(cfg);
    const masked = token.length <= 8 ? "••••" : `${token.slice(0, 4)}…${token.slice(-4)}`;
    return { ok: true, token, masked, message: `Auth key saved to ${authFile} (API key: ${masked})` };
  }
  if (!newPassword) {
    newPassword = crypto.randomBytes(24).toString("base64url");
  }
  cfg.token = newPassword;
  cfg.authFile = "";
  saveConfig(cfg);
  const masked = newPassword.length <= 8 ? "••••" : `${newPassword.slice(0, 4)}…${newPassword.slice(-4)}`;
  return { ok: true, token: newPassword, masked, message: `Auth API key set: ${masked}` };
}
export function daemonStatus() {
  const { running, pid } = isRunning();
  if (!running) return { running: false, pid: null, message: "a0 is not running." };
  return { running: true, pid, message: `a0 is running (pid ${pid}).` };
}