// Daemon management. Runs a0 as a background process with a PID file.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { configDir } from "./config.js";

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

  return { ok: true, pid: child.pid, message: `a0 started (pid ${child.pid}). Logs: ${logFile()}` };
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

export function daemonStatus() {
  const { running, pid } = isRunning();
  if (!running) return { running: false, pid: null, message: "a0 is not running." };
  return { running: true, pid, message: `a0 is running (pid ${pid}).` };
}