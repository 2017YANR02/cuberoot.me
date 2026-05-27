#!/usr/bin/env node
// dev-safe — spawn `next dev` with OOM guards (Windows-focused).
//
// Death modes this protects against:
// 1. Turbopack runaway compile pegging CPU + RAM, system swaps to death.
// 2. node V8 heap blows past addressable limit.
//
// Defenses (in order of importance):
// (a) PriorityClass = BelowNormal — Windows scheduler always favors desktop
//     processes over the dev server. Even if RAM blows up, the user can
//     still move the mouse and kill it.
// (b) NODE_OPTIONS=--max-old-space-size=3072 — V8 heap hard cap. Catches
//     pure JS leaks. Turbopack native memory is OUTSIDE this (in-process
//     N-API module), so we also need (c).
// (c) Watchdog samples RSS every 2 s. RSS > 2.5 GB → SIGKILL + log reason
//     to .tmp/dev-safe-killed.txt. Caller (test scripts / human) reads
//     that file to learn what happened.
//
// Usage: `pnpm dev:safe` (from packages/client-next/) or invoke directly.

import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TMP = path.join(ROOT, '.tmp');
mkdirSync(TMP, { recursive: true });
const KILL_LOG = path.join(TMP, 'dev-safe-killed.txt');
const STATUS_LOG = path.join(TMP, 'dev-safe-status.log');

const RAM_CAP_MB = 2500;
const SAMPLE_MS = 2000;

const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextBin, 'dev', '-H', '127.0.0.1', '-p', '3000'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=3072' },
});

const PID = child.pid;
console.log(`[dev-safe] spawned next dev PID=${PID} cap=${RAM_CAP_MB}MB`);

// Windows: BelowNormal priority — the single most important protection.
// Children spawned by next dev (incl. turbopack worker forks) inherit this.
if (process.platform === 'win32') {
  try {
    execSync(
      `pwsh -NoProfile -Command "(Get-Process -Id ${PID}).PriorityClass = 'BelowNormal'"`,
      { stdio: 'ignore' },
    );
    console.log(`[dev-safe] PID=${PID} PriorityClass → BelowNormal`);
  } catch (e) {
    console.warn(`[dev-safe] could not set priority: ${e.message}`);
  }
}

function killTree(pid) {
  if (process.platform === 'win32') {
    try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' }); } catch {}
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch {}
  }
}

let watchdogActive = true;
const watchdog = setInterval(() => {
  if (!watchdogActive) return;
  let rssMB;
  try {
    const out = execSync(
      `pwsh -NoProfile -Command "(Get-Process -Id ${PID} -ErrorAction SilentlyContinue).WS"`,
      { encoding: 'utf8', timeout: 4000 },
    ).trim();
    if (!out) {
      console.log('[dev-safe] dev process gone, watchdog exits');
      clearInterval(watchdog);
      watchdogActive = false;
      return;
    }
    rssMB = Math.round(Number(out) / 1048576);
  } catch {
    return;
  }

  appendFileSync(STATUS_LOG, `${new Date().toISOString()} PID=${PID} RAM=${rssMB}MB\n`);

  if (rssMB > RAM_CAP_MB) {
    const msg = `${new Date().toISOString()} KILL PID=${PID} RSS=${rssMB}MB > cap=${RAM_CAP_MB}MB`;
    console.error(`[dev-safe] ${msg}`);
    writeFileSync(KILL_LOG, msg + '\n');
    killTree(PID);
    clearInterval(watchdog);
    watchdogActive = false;
    process.exit(1);
  }
}, SAMPLE_MS);

child.on('exit', (code, signal) => {
  clearInterval(watchdog);
  watchdogActive = false;
  console.log(`[dev-safe] next dev exited code=${code} signal=${signal}`);
  process.exit(code ?? 0);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    killTree(PID);
    process.exit(0);
  });
}
