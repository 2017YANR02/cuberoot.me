// Step 2 — optimal-HTM solver over the canonical merged 3x3 pool → out.*.csv (id,htm), resumable.
//
// Corpus = wca_scrambles_no_wide_move.txt (id,scramble per line; wide moves already stripped, mbf
// split into individual cubes, real WCA scramble ids) — the SAME master std_analyzer (cross stats)
// consumes, so 333opt covers the identical merged 3x3 pool (333 / OH / BLD / MBLD / FM / feet).
// Wide-move orientation suffixes on blind scrambles are gone in this file, so the optimal solver
// only ever sees plain face-turn (HTM) scrambles. Override the corpus with CORPUS=<file>.
//
// Two modes, auto-selected by table size (override with INPROC=0|1):
//   • fork mode   (table ≤4GB, e.g. the 972M opt5): fork K workers, each loads its OWN copy of the
//     table and solves its 1/K id-slice single-threaded. K solves run in parallel.
//   • in-proc mode (table >4GB, the 15G opt9): ONE process loads the table ONCE and solves each
//     scramble with the wasm's internal K-thread parallelism (init(0,K) + solve_scramble(...,K,...)).
//     Forking K copies of a 15G table would need 15G×K RAM — impossible — so the single table is shared.
//
// Node DOES spawn emscripten pthreads (worker_threads) for this build — verified ~4 solves/s with the
// 15G opt9 + K=12. Either way ≤K cores are pinned. Resumable: a restart skips ids already present in
// out.<c>.csv. Output rows are `id,htm,solution` — solution = the OPTIMAL solve sequence (the optimal
// *scramble* reaching the same state is its inverse). Parent aggregates the htm column → counts.json.
//
// Usage: node solve.mjs [K=12]
//   env MODULE  default cube48opt9.mjs   (15G opt9 — production; set opt5 + 972M table for sampling)
//   env TABLE   default solver/tables/h48/h48prun31h9.dat
//   env CORPUS  default D:/cube/scramble/wca_scramble/wca_scrambles_no_wide_move.txt (cross-stats master)
//   env INPROC  0|1     force mode (default: auto by table size)
import { readFileSync, writeFileSync, existsSync, appendFileSync, openSync, readSync, closeSync, fstatSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fork } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const MJS = process.env.MODULE
  ? resolve(process.env.MODULE)
  : resolve(repoRoot, 'core/packages/client-next/public/cubeopt/cube48opt9.mjs');
const DAT = process.env.TABLE
  ? resolve(process.env.TABLE)
  : resolve(repoRoot, 'solver/tables/h48/h48prun31h9.dat');
const CORPUS = process.env.CORPUS
  ? resolve(process.env.CORPUS)
  : 'D:/cube/scramble/wca_scramble/wca_scrambles_no_wide_move.txt';
const partFile = (c) => resolve(__dirname, `out.${c}.csv`);

// corpus line = "id,scramble" (id before the first comma) → [[id, scramble], ...].
const readCorpus = () => readFileSync(CORPUS, 'utf8').split('\n').map((l) => {
  const s = l.trim();
  const k = s.indexOf(',');
  return k > 0 ? [s.slice(0, k), s.slice(k + 1)] : null;
}).filter(Boolean);
// out line = "id,htm,solution" → Set of solved ids (id = first field).
const doneSet = (out) => existsSync(out)
  ? new Set(readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => l.slice(0, l.indexOf(','))))
  : new Set();

// Load module, stream the table into the wasm heap (64M chunks — never hold the whole file as a Node
// buffer alongside the heap), init the solve thread pool.
async function makeSolver(threads) {
  // debug=true makes the wasm print "Solution found!: <moves>" (the optimal solution sequence)
  // before "Cube1 finished in N" — we capture BOTH: htm = N, sol = the move sequence.
  const state = { last: '', sol: '' };
  const createModule = (await import(pathToFileURL(MJS).href)).default;
  const m = await createModule({ print: (t) => {
    const s = t.match(/Solution found!:\s*(.*)/);
    if (s) state.sol = s[1].trim().replace(/\s+/g, ' '); // wasm pads with double spaces — normalize
    if (/finished in/.test(t)) state.last = t;
  }, printErr: () => {} });
  const base = Number(m._get_mem_ptr());
  const fd = openSync(DAT, 'r');
  const sz = fstatSync(fd).size;
  const CH = 64 * 1024 * 1024;
  const tmp = Buffer.allocUnsafe(CH);
  for (let off = 0; off < sz;) { const g = readSync(fd, tmp, 0, Math.min(CH, sz - off), off); m.HEAPU8.set(tmp.subarray(0, g), base + off); off += g; }
  closeSync(fd);
  m.init(0, threads); // 0 = table already in heap; threads = solve pool size
  return (scr, nt) => {
    state.last = ''; state.sol = '';
    m.solve_scramble(scr, nt, 1, true); // debug=true → also prints the optimal solution
    const htm = (state.last.match(/finished in (\d+)/) || [])[1] ?? '';
    return { htm, sol: state.sol };
  };
}

const K = Number(process.argv[2] ?? process.env.THREADS ?? 12);
const datSize = statSync(DAT).size;
const HUGE = 4 * 1024 * 1024 * 1024;
const inproc = process.env.INPROC === '1' || (process.env.INPROC !== '0' && datSize > HUGE);

if (process.env.WORKER) {
  // ---- fork worker: solve this id-slice single-threaded ----
  const chunk = Number(process.env.CHUNK), of = Number(process.env.OF);
  const out = partFile(chunk);
  const mine = readCorpus().filter((_, i) => i % of === chunk);
  const done = doneSet(out);
  const todo = mine.filter(([id]) => !done.has(id));
  if (!todo.length) { console.log(`[w${chunk}] done already`); process.exit(0); }
  const solve = await makeSolver(1);
  console.log(`[w${chunk}] table ready, ${todo.length} to solve`);
  for (const [id, s] of todo) {
    const t0 = Date.now();
    const { htm, sol } = solve(s, 1);
    appendFileSync(out, `${id},${htm},${sol}\n`);
    console.log(`[w${chunk}] ${id} -> ${htm} (${Date.now() - t0}ms)`);
  }
  process.exit(0);
}

// ---- parent ----
const all = readCorpus();
console.log(`module ${MJS}`);
console.log(`corpus ${CORPUS}  (${all.length} ids)`);
console.log(`table  ${DAT}  (${(datSize / 1024 / 1024).toFixed(0)}M) · mode=${inproc ? `in-proc ${K} threads` : `fork ${K} procs`}`);

if (inproc) {
  // single process holds ONE table; solve each scramble with K threads.
  const out = partFile(0);
  const done = doneSet(out);
  const todo = all.filter(([id]) => !done.has(id));
  console.log(`loading ${(datSize / 1024 / 1024 / 1024).toFixed(1)}G table…`);
  const t0 = Date.now();
  const solve = await makeSolver(K);
  console.log(`table ready in ${((Date.now() - t0) / 1000).toFixed(0)}s · ${todo.length}/${all.length} to solve (${done.size} done)`);
  let n = 0; const start = Date.now();
  for (const [id, s] of todo) {
    const ts = Date.now();
    const { htm, sol } = solve(s, K);
    appendFileSync(out, `${id},${htm},${sol}\n`);
    n++;
    if (n % 100 === 0 || n === todo.length) {
      const rate = n / ((Date.now() - start) / 1000);
      const eta = ((todo.length - n) / rate / 3600).toFixed(1);
      console.log(`[${done.size + n}/${all.length}] ${id} -> ${htm} (${Date.now() - ts}ms) · ${rate.toFixed(2)}/s · ETA ${eta}h`);
    }
  }
} else {
  // fork K workers, each loads its own table copy, each solves a 1/K id-slice.
  await Promise.all(Array.from({ length: K }, (_, c) => new Promise((res) => {
    const p = fork(fileURLToPath(import.meta.url), [], { env: { ...process.env, WORKER: '1', CHUNK: String(c), OF: String(K) }, stdio: 'inherit' });
    p.on('exit', res);
  })));
}

// aggregate out.*.csv → counts.json (histogram of htm lengths)
const counts = {};
let n = 0;
for (let c = 0; c < (inproc ? 1 : K); c++) {
  if (!existsSync(partFile(c))) continue;
  for (const l of readFileSync(partFile(c), 'utf8').split('\n').filter(Boolean)) {
    const len = l.split(',')[1]; // id,htm,solution → htm
    if (len) { counts[len] = (counts[len] || 0) + 1; n++; }
  }
}
writeFileSync(resolve(__dirname, 'counts.json'), JSON.stringify({ samples: n, counts }, null, 2));
console.log('DONE', n, 'solves →', JSON.stringify(counts));
