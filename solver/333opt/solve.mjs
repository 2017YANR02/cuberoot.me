// Step 2 — optimal-HTM solver over scrambles.txt → out.*.csv (resumable).
// Two modes, auto-selected by table size (override with INPROC=0|1):
//   • fork mode   (table ≤4GB): fork K workers, each loads its OWN copy of the
//     table and solves its 1/K slice single-threaded. K solves run in parallel.
//   • in-proc mode (table >4GB, e.g. the 15G opt9): ONE process loads the table
//     ONCE and solves each scramble with the wasm's internal K-thread parallelism
//     (init(0,K) + solve_scramble(...,K,...)). Forking K copies of a 15G table
//     would need 15G×K RAM — impossible — so the single table is shared.
//
// Node DOES spawn emscripten pthreads (worker_threads) for this build — verified
// ~7× solve speedup with N=7 — so in-proc multi-threading is real parallelism.
// Either way ≤K cores are pinned. Resumable: a restart skips lines already in
// out.<c>.csv. Parent aggregates → counts.json.
//
// Usage: node solve.mjs [K=12]
//   env MODULE=<cube48optN.mjs>   default cube48opt5 (972M)
//   env TABLE=<.dat>              default solver/tables/h48/h48prun31h5.dat
//   env INPROC=0|1                force mode (default: auto by table size)
import { readFileSync, writeFileSync, existsSync, appendFileSync, openSync, readSync, closeSync, fstatSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fork } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const MJS = process.env.MODULE
  ? resolve(process.env.MODULE)
  : resolve(repoRoot, 'core/packages/client-next/public/cubeopt/cube48opt5.mjs');
const DAT = process.env.TABLE
  ? resolve(process.env.TABLE)
  : resolve(repoRoot, 'solver/tables/h48/h48prun31h5.dat');
const SCR = resolve(__dirname, 'scrambles.txt');
const partFile = (c) => resolve(__dirname, `out.${c}.csv`);

const readScrambles = () => readFileSync(SCR, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const doneSet = (out) => existsSync(out)
  ? new Set(readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => Number(l.split(',')[0])))
  : new Set();

// Load module, stream the table into the wasm heap (64M chunks — never hold the
// whole file as a Node buffer alongside the heap), init the solve thread pool.
async function makeSolver(threads) {
  const state = { last: '' };
  const createModule = (await import(pathToFileURL(MJS).href)).default;
  const m = await createModule({ print: (t) => { if (/finished in/.test(t)) state.last = t; }, printErr: () => {} });
  const base = Number(m._get_mem_ptr());
  const fd = openSync(DAT, 'r');
  const sz = fstatSync(fd).size;
  const CH = 64 * 1024 * 1024;
  const tmp = Buffer.allocUnsafe(CH);
  for (let off = 0; off < sz;) { const g = readSync(fd, tmp, 0, Math.min(CH, sz - off), off); m.HEAPU8.set(tmp.subarray(0, g), base + off); off += g; }
  closeSync(fd);
  m.init(0, threads); // 0 = table already in heap; threads = solve pool size
  return (scr, nt) => {
    state.last = '';
    m.solve_scramble(scr, nt, 1, false);
    return (state.last.match(/finished in (\d+)/) || [])[1] ?? '';
  };
}

const K = Number(process.argv[2] ?? process.env.THREADS ?? 12);
const datSize = statSync(DAT).size;
const HUGE = 4 * 1024 * 1024 * 1024;
const inproc = process.env.INPROC === '1' || (process.env.INPROC !== '0' && datSize > HUGE);

if (process.env.WORKER) {
  // ---- fork worker: solve this slice single-threaded ----
  const chunk = Number(process.env.CHUNK), of = Number(process.env.OF);
  const out = partFile(chunk);
  const mine = readScrambles().map((s, i) => [i, s]).filter(([i]) => i % of === chunk);
  const done = doneSet(out);
  const todo = mine.filter(([i]) => !done.has(i));
  if (!todo.length) { console.log(`[w${chunk}] done already`); process.exit(0); }
  const solve = await makeSolver(1);
  console.log(`[w${chunk}] table ready, ${todo.length} to solve`);
  for (const [i, s] of todo) {
    const t0 = Date.now();
    const len = solve(s, 1);
    appendFileSync(out, `${i},${len}\n`);
    console.log(`[w${chunk}] line ${i} -> ${len} (${Date.now() - t0}ms)`);
  }
  process.exit(0);
}

// ---- parent ----
const all = readScrambles();
console.log(`module ${MJS}`);
console.log(`table  ${DAT}  (${(datSize / 1024 / 1024).toFixed(0)}M)`);
console.log(`${all.length} scrambles · mode=${inproc ? `in-proc ${K} threads` : `fork ${K} procs`}`);

if (inproc) {
  // single process holds ONE table; solve each scramble with K threads.
  const out = partFile(0);
  const done = doneSet(out);
  const todo = all.map((s, i) => [i, s]).filter(([i]) => !done.has(i));
  console.log(`loading ${(datSize / 1024 / 1024 / 1024).toFixed(1)}G table…`);
  const t0 = Date.now();
  const solve = await makeSolver(K);
  console.log(`table ready in ${((Date.now() - t0) / 1000).toFixed(0)}s · ${todo.length}/${all.length} to solve (${done.size} done)`);
  let n = 0; const start = Date.now();
  for (const [i, s] of todo) {
    const ts = Date.now();
    const len = solve(s, K);
    appendFileSync(out, `${i},${len}\n`);
    n++;
    const rate = n / ((Date.now() - start) / 1000);
    const eta = ((todo.length - n) / rate / 3600).toFixed(1);
    console.log(`[${done.size + n}/${all.length}] line ${i} -> ${len} (${Date.now() - ts}ms) · ${rate.toFixed(2)}/s · ETA ${eta}h`);
  }
} else {
  // fork K workers, each loads its own table copy, each solves a 1/K slice.
  await Promise.all(Array.from({ length: K }, (_, c) => new Promise((res) => {
    const p = fork(fileURLToPath(import.meta.url), [], { env: { ...process.env, WORKER: '1', CHUNK: String(c), OF: String(K) }, stdio: 'inherit' });
    p.on('exit', res);
  })));
}

// aggregate out.*.csv → counts.json
const counts = {};
let n = 0;
for (let c = 0; c < (inproc ? 1 : K); c++) {
  if (!existsSync(partFile(c))) continue;
  for (const l of readFileSync(partFile(c), 'utf8').split('\n').filter(Boolean)) {
    const len = l.split(',')[1];
    if (len) { counts[len] = (counts[len] || 0) + 1; n++; }
  }
}
writeFileSync(resolve(__dirname, 'counts.json'), JSON.stringify({ samples: n, counts }, null, 2));
console.log('DONE', n, 'solves →', JSON.stringify(counts));
