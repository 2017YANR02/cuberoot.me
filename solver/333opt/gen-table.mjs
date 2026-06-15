// Generate a cubeopt h48 pruning table headlessly in Node and stream it to disk.
// The browser /scramble/solver builds these via init(hwConcurrency,..) then a
// File-System-Access download; this is the same thing without a browser, so the
// multi-GB tables (opt7/8/9) can be produced unattended and land straight on a
// chosen drive (NOT the default Downloads / C:).
//
// Node DOES spawn emscripten pthreads (worker_threads) for this build, so
// generation is multi-threaded. The whole table lives in the wasm heap (this is
// a wasm MEMORY64 build, so >4GB is fine) — peak RAM ≈ table size, so opt9
// (15565M) needs ~16GB free.
//
// Usage:  THREADS=12 MODULE=<cube48optN.mjs> OUT=<dir> node gen-table.mjs
//   MODULE  default cube48opt9.mjs (the 15G table)
//   OUT     default solver/tables/h48
//   THREADS default 12
import { openSync, writeSync, closeSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const MJS = process.env.MODULE
  ? resolve(process.env.MODULE)
  : resolve(repoRoot, 'core/packages/client/public/cubeopt/cube48opt9.mjs');
const OUTDIR = process.env.OUT ? resolve(process.env.OUT) : resolve(repoRoot, 'solver/tables/h48');
const THREADS = Number(process.env.THREADS || 12);

const createModule = (await import(pathToFileURL(MJS).href)).default;
const m = await createModule({ print: (t) => process.stdout.write(t + '\n'), printErr: (t) => process.stderr.write(t + '\n') });

const name = m.get_table_name();
const expected = Number(m.get_table_size());
mkdirSync(OUTDIR, { recursive: true });
const out = resolve(OUTDIR, name);
console.log(`module ${MJS}`);
console.log(`table  ${name}  ${(expected / 1024 / 1024).toFixed(0)}M (${expected} bytes)`);
console.log(`out    ${out}`);

if (existsSync(out) && statSync(out).size === expected) {
  console.log('already present with correct size — nothing to do');
  process.exit(0);
}

console.log(`generating with ${THREADS} threads (this is the slow part)…`);
const t0 = Date.now();
const rc = m.init(THREADS, 1); // 1st arg = #threads to BUILD the prune table
const genMin = ((Date.now() - t0) / 1000 / 60).toFixed(1);
console.log(`init rc=${rc}, generated in ${genMin} min`);
if (rc !== 0) { console.error('generation failed (init returned nonzero)'); process.exit(1); }

// stream the table out of the wasm heap in 64M chunks — never copy the whole
// 15G into a second Node buffer (would double peak RAM).
const base = Number(m._get_mem_ptr());
const size = Number(m.get_table_size());
const fd = openSync(out, 'w');
const CH = 64 * 1024 * 1024;
let written = 0;
for (let off = 0; off < size; off += CH) {
  const len = Math.min(CH, size - off);
  writeSync(fd, Buffer.from(m.HEAPU8.buffer, base + off, len));
  written += len;
  if ((off / CH) % 16 === 0 || written === size) process.stdout.write(`\rwriting ${((written / size) * 100).toFixed(1)}%   `);
}
closeSync(fd);
const finalSize = statSync(out).size;
console.log(`\nwrote ${out}  ${finalSize} bytes  (${finalSize === expected ? 'OK' : 'SIZE MISMATCH!'})`);
process.exit(finalSize === expected ? 0 : 1);
