/** Resume optimal 3x3 solves with official Opt10; explicit legacy H10 backends remain available. */
import { statsEngine, statsOpt10Configuration } from './stats-engine.mts';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, createReadStream, createWriteStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { rustConfiguration, rustCsv, rustScramble } from './rust-h10-adapter.mts';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { wcaDir } from './data_paths.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const solverDir = resolve(here, '..');
const { engine, threads, table, expectedBytes } = statsEngine(resolve(solverDir, '..'));
const corpus = resolve(process.env.CORPUS || resolve(wcaDir, 'wca_scrambles_no_wide_move.txt'));
const output = resolve(process.env.OUT || resolve(here, 'out.0.csv'));
const engineLabel = engine === 'opt10' ? 'Rust Opt10' : engine === 'rust' ? 'Rust H10' : 'H48 h10';
if (!['c', 'rust', 'opt10'].includes(engine)) throw Error('Invalid H10_ENGINE');
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
  console.log(`[${engineLabel}] compiling native solver with ${threads} threads`);
  const result = spawnSync(compiler, args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`Native H48 compile failed: ${String(result.error || result.status)}`);
}
if (process.argv.includes('--smoke')) {
  if (engine !== 'c') throw Error('--smoke is only supported for the original C backend');
  if (!existsSync(table) || statSync(table).size !== expectedBytes) throw new Error(`${engineLabel} table missing/incomplete: ${table}`);
  ensureWorker();
  const result = spawnSync(binary, [table, String(threads)], {
    cwd: solverDir, input: "smoke,R U R'\n", encoding: 'utf8', timeout: 120_000,
  });
  const row = result.stdout?.trim() || '';
  const match = /^smoke,(\d+),(.+)$/.exec(row);
  if (result.error || result.status !== 0 || !match || Number(match[1]) > 3) {
    throw new Error(`H48 h10 smoke solve failed: ${String(result.error || result.status)}; stdout=${row}; stderr=${result.stderr}`);
  }
  console.log(`[${engineLabel}] smoke solve OK: ${row}`);
  process.exit(0);
}
if (!existsSync(corpus)) throw new Error(`WCA corpus missing: ${corpus}`);
const done = new Set<string>();
const writeCounts = !process.argv.includes('--no-counts');
const counts: Record<string, number> = {};
if (existsSync(output)) {
  for await (const row of lines(output)) {
    if (!row) continue;
    const parts = row.split(',');
    if (parts.length < 3 || !/^\d+$/.test(parts[1]) || !parts[2].trim()) throw new Error(`Malformed existing output row: ${row.slice(0, 100)}`);
    done.add(parts[0]);
    if (writeCounts) counts[parts[1]] = (counts[parts[1]] || 0) + 1;
  }
}
let total = 0;
let solved = 0;
for await (const row of lines(corpus)) {
  const comma = row.indexOf(',');
  if (comma <= 0) continue;
  total++;
  if (done.has(row.slice(0, comma))) solved++;
}
if (total === 0) throw new Error(`WCA corpus is empty: ${corpus}`);
if (!existsSync(table) || statSync(table).size !== expectedBytes) throw new Error(`${engineLabel} table missing/incomplete: ${table}`);
if (solved === total) { console.log(`[${engineLabel}] corpus complete: ${solved}/${total}`); process.exit(0); }
const rust = engine === 'opt10' ? statsOpt10Configuration(resolve(solverDir, '..'),threads)
  : engine === 'rust' ? rustConfiguration(resolve(solverDir, '..'), table, threads) : null;
if (!rust) ensureWorker();
console.log(`[${engineLabel}] table=${table}, corpus=${corpus}, solved=${solved}/${total}, threads=${threads}`);
if (rust && 'release' in rust) console.log(`[${engineLabel}] release=${rust.release}, searchThreads=${threads}, batchWorkers=1`);
if (rust) writeFileSync(`${output}.rust-run-${Date.now()}.json`, JSON.stringify({ ...rust, engine, threads, table, corpus, startedAt: new Date().toISOString() }, null, 2));
const child = spawn(rust ? process.execPath : binary, rust ? rust.args : [table, String(threads)],
  { cwd: solverDir, env: { ...process.env, ...rust?.env }, stdio: ['pipe', 'pipe', 'inherit'] });
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGTERM'));
const append = createWriteStream(output, { flags: 'a', encoding: 'utf8' });
let produced = 0;
const started = performance.now();
const inputAbort = new AbortController();
const exited = new Promise<void>((resolve, reject) => {
  child.once('error', reject);
  child.once('close', (code, signal) => {
    if (code !== 0 || !child.stdin.writableEnded) {
      const error = new Error(`${engineLabel} worker exited ${code ?? signal} after ${produced} rows; saved results retained`);
      inputAbort.abort(error);
      reject(error);
    } else resolve();
  });
});
child.stdin.on('error', error => inputAbort.abort(error));
const feed = (async () => {
  for await (const row of lines(corpus)) {
    inputAbort.signal.throwIfAborted();
    const comma = row.indexOf(',');
    if (comma <= 0 || done.has(row.slice(0, comma))) continue;
    const input = rust ? `${row.slice(0, comma)}\t${rustScramble(row.slice(comma + 1))}` : row;
    if (!child.stdin.write(`${input}\n`)) await once(child.stdin, 'drain', {signal: inputAbort.signal});
  }
  child.stdin.end();
})();
const collect = (async () => {
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const raw of rl) {
    const row = rust ? rustCsv(raw) : raw;
    if (rust) appendFileSync(`${output}.rust.jsonl`, raw + '\n');
    const parts = row.split(',');
    if (parts.length < 3 || !/^\d+$/.test(parts[1]) || !parts[2].trim()) throw new Error(`Invalid native result: ${row.slice(0, 100)}`);
    if (!append.write(`${row}\n`)) await once(append, 'drain');
    if (writeCounts) counts[parts[1]] = (counts[parts[1]] || 0) + 1;
    produced++;
    if (produced % 100 === 0) {
      const rate = produced / ((performance.now() - started) / 1000);
      console.log(`[${solved + produced}/${total}] ${parts[0]} -> ${parts[1]} · ${rate.toFixed(2)}/s · ETA ${((total - solved - produced) / rate / 3600).toFixed(1)}h`);
    }
  }
})();
try {
  await Promise.all([feed, collect, exited]);
} catch (error) {
  inputAbort.abort(error);
  child.stdin.destroy();
  child.kill();
  await Promise.allSettled([feed, collect, exited]);
  throw error;
} finally {
  append.end();
  await once(append, 'finish');
}
if (solved + produced !== total) throw new Error(`H48 output incomplete: ${solved + produced}/${total}`);
if (writeCounts) {
  writeFileSync(resolve(here, 'counts.json'), `${JSON.stringify({ samples: done.size + produced, counts }, null, 2)}\n`);
}
console.log(`[${engineLabel}] complete: ${solved + produced}/${total} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
