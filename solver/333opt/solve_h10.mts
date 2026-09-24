/** Resume optimal 3x3 solves with the native nissy-core H48 h10 table. */
import { availableParallelism } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { wcaDir } from './data_paths.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const solverDir = resolve(here, '..');
const tableDir = resolve(process.env.CUBE_TABLE_DIR || resolve(solverDir, 'tables'));
const table = resolve(process.env.H48_H10_TABLE || resolve(tableDir, 'h48-nissy-core/h48h10.dat'));
const corpus = resolve(process.env.CORPUS || resolve(wcaDir, 'wca_scrambles_no_wide_move.txt'));
const output = resolve(process.env.OUT || resolve(here, 'out.0.csv'));
const expectedBytes = 30_336_314_216;
const threads = Number(process.env.THREADS || availableParallelism());
if (!Number.isSafeInteger(threads) || threads < 1) throw new Error(`Invalid THREADS: ${threads}`);
const binary = resolve(solverDir, 'target/release', `solve_h48_h10_${threads}${process.platform === 'win32' ? '.exe' : ''}`);
const source = resolve(solverDir, 'native/solve_h48_h10.c');
const nissy = resolve(solverDir, 'vendor/nissy-core/src/nissy.c');
const wrapthread = resolve(solverDir, 'vendor/nissy-core/src/utils/wrapthread.h');

async function* lines(file: string): AsyncGenerator<string> {
  const stream = createReadStream(file, 'utf8');
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try { for await (const line of rl) yield line; } finally { rl.close(); stream.destroy(); }
}
function ensureWorker(): void {
  const latest = Math.max(statSync(source).mtimeMs, statSync(nissy).mtimeMs, statSync(wrapthread).mtimeMs);
  if (existsSync(binary) && statSync(binary).mtimeMs >= latest) return;
  const compiler = process.env.CC || (process.platform === 'win32' ? 'clang' : 'cc');
  const arch = process.arch === 'arm64' ? 'NEON' : 'PORTABLE';
  const args = ['-std=c11', '-D_POSIX_C_SOURCE=200809L', `-DTHREADS=${threads}`, `-D${arch}`, '-O3', '-pthread',
    '-I', resolve(solverDir, 'vendor/nissy-core/src'), nissy, source, '-o', binary];
  console.log(`[H48 h10] compiling native solver with ${threads} threads`);
  const result = spawnSync(compiler, args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`Native H48 compile failed: ${String(result.error || result.status)}`);
}
if (process.argv.includes('--smoke')) {
  if (!existsSync(table) || statSync(table).size !== expectedBytes) throw new Error(`H48 h10 table missing/incomplete: ${table}`);
  ensureWorker();
  const result = spawnSync(binary, [table, String(threads)], {
    cwd: solverDir, input: "smoke,R U R'\n", encoding: 'utf8', timeout: 120_000,
  });
  const row = result.stdout?.trim() || '';
  const match = /^smoke,(\d+),(.+)$/.exec(row);
  if (result.error || result.status !== 0 || !match || Number(match[1]) > 3) {
    throw new Error(`H48 h10 smoke solve failed: ${String(result.error || result.status)}; stdout=${row}; stderr=${result.stderr}`);
  }
  console.log(`[H48 h10] smoke solve OK: ${row}`);
  process.exit(0);
}
if (!existsSync(corpus)) throw new Error(`WCA corpus missing: ${corpus}`);
const done = new Set<string>();
if (existsSync(output)) {
  for await (const row of lines(output)) {
    if (!row) continue;
    const parts = row.split(',');
    if (parts.length < 3 || !/^\d+$/.test(parts[1]) || !parts[2].trim()) throw new Error(`Malformed existing output row: ${row.slice(0, 100)}`);
    done.add(parts[0]);
  }
}
let total = 0;
for await (const row of lines(corpus)) if (row.indexOf(',') > 0) total++;
if (total === 0) throw new Error(`WCA corpus is empty: ${corpus}`);
if (!existsSync(table) || statSync(table).size !== expectedBytes) throw new Error(`H48 h10 table missing/incomplete: ${table}`);
if (done.size >= total) { console.log(`[H48 h10] corpus complete: ${done.size}/${total}`); process.exit(0); }
ensureWorker();
console.log(`[H48 h10] table=${table}, corpus=${corpus}, solved=${done.size}/${total}, threads=${threads}`);
const child = spawn(binary, [table, String(threads)], { cwd: solverDir, stdio: ['pipe', 'pipe', 'inherit'] });
const append = createWriteStream(output, { flags: 'a', encoding: 'utf8' });
let produced = 0;
const started = performance.now();
const feed = (async () => {
  for await (const row of lines(corpus)) {
    const comma = row.indexOf(',');
    if (comma <= 0 || done.has(row.slice(0, comma))) continue;
    if (!child.stdin.write(`${row}\n`)) await once(child.stdin, 'drain');
  }
  child.stdin.end();
})();
const collect = (async () => {
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const row of rl) {
    const parts = row.split(',');
    if (parts.length < 3 || !/^\d+$/.test(parts[1]) || !parts[2].trim()) throw new Error(`Invalid native result: ${row.slice(0, 100)}`);
    if (!append.write(`${row}\n`)) await once(append, 'drain');
    produced++;
    if (produced % 100 === 0) {
      const rate = produced / ((performance.now() - started) / 1000);
      console.log(`[${done.size + produced}/${total}] ${parts[0]} -> ${parts[1]} · ${rate.toFixed(2)}/s · ETA ${((total - done.size - produced) / rate / 3600).toFixed(1)}h`);
    }
  }
})();
const exited = new Promise<number>((resolve, reject) => { child.on('error', reject); child.on('close', code => resolve(code ?? 1)); });
try {
  await Promise.all([feed, collect]);
  const exitCode = await exited;
  if (exitCode !== 0) throw new Error(`Native H48 solver exited ${exitCode} after ${produced} rows`);
} catch (error) {
  child.kill();
  throw error;
} finally {
  append.end();
  await once(append, 'finish');
}
if (done.size + produced !== total) throw new Error(`H48 output incomplete: ${done.size + produced}/${total}`);
const counts: Record<string, number> = {};
for await (const row of lines(output)) {
  const htm = row.split(',')[1];
  if (htm) counts[htm] = (counts[htm] || 0) + 1;
}
if (!process.argv.includes('--no-counts')) {
  writeFileSync(resolve(here, 'counts.json'), `${JSON.stringify({ samples: done.size + produced, counts }, null, 2)}\n`);
}
console.log(`[H48 h10] complete: ${done.size + produced}/${total} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
