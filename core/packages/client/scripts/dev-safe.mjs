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
// Usage: `pnpm dev:safe` (from packages/client/) or invoke directly.

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
  env: {
    ...process.env,
    // V8 heap cap (catches pure JS leaks; turbopack Rust mem is outside this).
    // dns-result-order=ipv4first avoids intermittent getaddrinfo ENOTFOUND on
    // upstream rewrites when AAAA lookup stalls.
    NODE_OPTIONS: '--max-old-space-size=3072 --dns-result-order=ipv4first',
  },
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
    try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' }); } catch { /* already dead */ }
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch { /* already dead */ }
  }
}

// Total cap covers ALL node procs (turbopack forks workers that don't
// inherit our PriorityClass via Node's spawn — we re-apply each tick).
// 8 GB: heavy pages cold-compile + accumulated chunks naturally drift to
// 5.5-6.5 GB after browsing many routes. Below 8 leaves no headroom and
// triggers spurious kills during normal browsing. 8 GB on a 32 GB system
// is still ~25 % — BelowNormal keeps desktop responsive even at this size.
const TOTAL_RAM_CAP_MB = 8000;

let watchdogActive = true;
const watchdog = setInterval(() => {
  if (!watchdogActive) return;
  let parentMB, totalMB, count;
  try {
    const out = execSync(
      `pwsh -NoProfile -Command "$ps = Get-Process node -EA SilentlyContinue; $ps | ForEach-Object { if ($_.PriorityClass -ne 'BelowNormal') { try { $_.PriorityClass = 'BelowNormal' } catch {} } }; $p = $ps | Where-Object Id -eq ${PID}; $sum = ($ps | Measure-Object WS -Sum).Sum; '{0} {1} {2}' -f ($p.WS), $sum, $ps.Count"`,
      { encoding: 'utf8', timeout: 4000 },
    ).trim();
    if (!out || out.startsWith(' ')) {
      console.log('[dev-safe] parent process gone, watchdog exits');
      clearInterval(watchdog);
      watchdogActive = false;
      return;
    }
    const [pWS, sumWS, n] = out.split(' ');
    parentMB = Math.round(Number(pWS || 0) / 1048576);
    totalMB = Math.round(Number(sumWS || 0) / 1048576);
    count = Number(n || 0);
  } catch {
    return;
  }

  appendFileSync(STATUS_LOG, `${new Date().toISOString()} parent=${parentMB}MB total_node=${totalMB}MB (${count} procs)\n`);

  if (totalMB > TOTAL_RAM_CAP_MB) {
    const msg = `${new Date().toISOString()} KILL total node RSS=${totalMB}MB > cap=${TOTAL_RAM_CAP_MB}MB (${count} procs)`;
    console.error(`[dev-safe] ${msg}`);
    writeFileSync(KILL_LOG, msg + '\n');
    killTree(PID);
    clearInterval(watchdog);
    watchdogActive = false;
    process.exit(1);
  }
  if (parentMB > RAM_CAP_MB) {
    const msg = `${new Date().toISOString()} KILL parent PID=${PID} RSS=${parentMB}MB > cap=${RAM_CAP_MB}MB`;
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
