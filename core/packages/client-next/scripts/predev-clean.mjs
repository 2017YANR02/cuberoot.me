#!/usr/bin/env node
// predev-clean — free port 3000 before `next dev` starts.
//
// Why: on Windows, closing the terminal or Ctrl+C can leave an orphaned
// next-server (+ turbopack worker forks) still bound to 3000. The next
// `pnpm dev` then either fails to bind or, worse, you end up talking to a
// stale 10h-old server that has crashed its render workers ("jest worker
// exceeding retry limit"). This kills whatever is LISTENING on the port,
// process tree and all, so dev always starts clean.
//
// Runs as the first half of the `dev` script (pnpm doesn't auto-run `pre*`
// hooks, so it's chained inline rather than named `predev`).
//
// Port is overridable via argv[2] (used by tests so they don't touch 3000).

import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// First numeric arg = port (tests pass their own so they don't touch 3000).
// `--wipe-next` = also delete the .next build cache after freeing the port,
// to recover from a corrupt/stale .next (e.g. "Unexpected non-whitespace
// character after JSON" from a half-written manifest). Used by `dev:clean`.
const args = process.argv.slice(2);
const PORT = Number(args.find((a) => /^\d+$/.test(a))) || 3000;
const WIPE = args.includes('--wipe-next');
const isWin = process.platform === 'win32';

function pidsOnPort(port) {
  try {
    if (isWin) {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        const c = line.trim().split(/\s+/); // [Proto, Local, Foreign, State, PID]
        if (c.length >= 5 && c[0] === 'TCP' && c[3] === 'LISTENING' && c[1].endsWith(`:${port}`)) {
          pids.add(c[4]);
        }
      }
      return [...pids].filter((p) => p && p !== '0');
    }
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return []; // nothing listening → both tools exit non-zero
  }
}

// Best-effort kill. A non-zero exit usually just means the process already
// exited between our netstat snapshot and now (benign race) — the port
// re-check below is the real success signal, so we swallow errors here.
function kill(pid) {
  try {
    if (isWin) execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGKILL');
  } catch {
    /* fall through to port re-check */
  }
}

const before = pidsOnPort(PORT);
if (!before.length) {
  console.log(`[predev-clean] port ${PORT} already free`);
} else {
  before.forEach(kill);
  const after = pidsOnPort(PORT);
  if (!after.length) {
    console.log(`[predev-clean] freed port ${PORT} (was PID ${before.join(', ')})`);
  } else {
    console.warn(`[predev-clean] port ${PORT} still held by PID ${after.join(', ')} after kill — next dev may fail to bind`);
  }
}

// Done AFTER killing the port holder, so nothing is writing .next while we
// delete it. Full wipe = cold rebuild on the next start; only via dev:clean.
if (WIPE) {
  try {
    rmSync('.next', { recursive: true, force: true });
    console.log('[predev-clean] wiped .next build cache (cold rebuild ahead)');
  } catch (e) {
    console.warn(`[predev-clean] could not wipe .next: ${e.message}`);
  }
}
