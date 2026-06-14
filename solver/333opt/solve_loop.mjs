// Auto-restart wrapper for solve.mjs.
//
// The opt9 in-proc solver occasionally dies with an emscripten "unwind" after a few thousand solves
// (pthread / main-thread-proxying resource churn accumulating in a long-lived process). solve.mjs is
// resumable — a fresh process skips ids already in out.0.csv — so we just relaunch until the corpus is
// done. Each restart reloads the 15G table (~56s); at ~5k solves/crash that's ~4% overhead.
//
// Safety: if 3 consecutive runs make ZERO progress (a deterministic crash on the next scramble, or a
// load failure), HALT with exit 2 instead of silently skipping data or looping forever — that needs a
// human/agent to look. Normal resource crashes always make progress, so they just trigger a restart.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'out.0.csv');
const TOTAL = 1297444;
const lines = () => (existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).length : 0);

let stuck = 0, run = 0;
for (;;) {
  const before = lines();
  if (before >= TOTAL) { console.log(`[loop] corpus complete: ${before}/${TOTAL}`); break; }
  run++;
  console.log(`[loop] run #${run} start · ${before}/${TOTAL} done · launching solve.mjs 12`);
  const r = spawnSync('node', ['solve.mjs', '12'], { cwd: __dirname, stdio: 'inherit' });
  const after = lines();
  console.log(`[loop] run #${run} exit code=${r.status ?? 'null'} · ${after}/${TOTAL} (+${after - before})`);
  if (after >= TOTAL) { console.log('[loop] corpus complete'); break; }
  if (r.status === 0) { console.log('[loop] solve.mjs exited 0 below TOTAL — treating as done'); break; }
  if (after > before) { stuck = 0; continue; } // normal resource crash → restart, resumes
  stuck++;
  if (stuck >= 3) { console.log(`[loop] STUCK: 3 consecutive runs, 0 progress at ${after}/${TOTAL} — halting for investigation`); process.exit(2); }
  console.log(`[loop] no progress (${stuck}/3) — retrying`);
}
