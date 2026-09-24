import { availableParallelism } from 'node:os';
import { wcaDir } from './data_paths.mjs';
if (process.env.CUBEROOT_ALLOW_LEGACY_OPT9 !== '1') {
  throw new Error('旧 opt9 整解循环已停用；请在 core/ 运行 pnpm exec tsx ../solver/333opt/solve_h10.mts');
}
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
// TOTAL = 活的语料行数(与 solve.mjs 的 CORPUS 同源, 计含逗号的 "id,scramble" 行)。
// 别再硬编码: master 池随新比赛增长(曾固定 1297444, 池涨到 1304126 后会提前 break 漏掉尾部)。
const CORPUS = process.env.CORPUS ? resolve(process.env.CORPUS) : resolve(wcaDir, 'wca_scrambles_no_wide_move.txt');
if (!existsSync(CORPUS)) throw new Error(`WCA 语料不存在: ${CORPUS}`);
const TOTAL = readFileSync(CORPUS, 'utf8').split('\n').filter((l) => l.indexOf(',') > 0).length;
// 线程数: env THREADS 覆盖，默认使用可用 CPU 线程。
const THREADS = String(process.env.THREADS || availableParallelism());
const lines = () => (existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).length : 0);

let stuck = 0, run = 0;
for (;;) {
  const before = lines();
  if (before >= TOTAL) { console.log(`[loop] corpus complete: ${before}/${TOTAL}`); break; }
  run++;
  console.log(`[loop] run #${run} start · ${before}/${TOTAL} done · launching solve.mjs ${THREADS}`);
  const r = spawnSync('node', ['solve.mjs', THREADS], { cwd: __dirname, stdio: 'inherit' });
  const after = lines();
  console.log(`[loop] run #${run} exit code=${r.status ?? 'null'} · ${after}/${TOTAL} (+${after - before})`);
  if (after >= TOTAL) { console.log('[loop] corpus complete'); break; }
  if (r.status === 0) { console.log('[loop] solve.mjs exited 0 below TOTAL — treating as done'); break; }
  if (after > before) { stuck = 0; continue; } // normal resource crash → restart, resumes
  stuck++;
  if (stuck >= 3) { console.log(`[loop] STUCK: 3 consecutive runs, 0 progress at ${after}/${TOTAL} — halting for investigation`); process.exit(2); }
  console.log(`[loop] no progress (${stuck}/3) — retrying`);
}
