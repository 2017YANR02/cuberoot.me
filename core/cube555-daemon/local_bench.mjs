/**
 * Local solver bench — spawn daemon directly, count move tokens per scramble.
 * Optimization workflow uses this; bench.mjs is HTTP-side and stays as-is.
 *
 * Usage (from repo root or core/):
 *   node cube555-daemon/local_bench.mjs                  # n=30 sequential
 *   node cube555-daemon/local_bench.mjs --n 50 --par 1   # 50 sequential (default)
 *   node cube555-daemon/local_bench.mjs --par 3          # 30 with 3-way concurrency
 *   node cube555-daemon/local_bench.mjs --workers 4 --xmx 10g
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { performance } from 'node:perf_hooks';

const args = parseArgs(process.argv.slice(2));
const N = Number(args.n ?? 30);
const PAR = Number(args.par ?? 1);
const WORKERS = String(args.workers ?? 3);
const XMX = String(args.xmx ?? '4g');
const HOME = String(args.home ?? 'D:\\cube\\cube555');
const CP = `dist;lib/twophase.jar`;

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) o[a.slice(2)] = argv[++i] ?? true;
  }
  return o;
}

const proc = spawn('java', ['-Xmx' + XMX, '-cp', CP, 'cs.cube555.Daemon'], {
  cwd: HOME,
  env: { ...process.env, CUBE555_WORKERS: WORKERS },
  stdio: ['pipe', 'pipe', 'inherit'],
});

const rl = createInterface({ input: proc.stdout });
const pending = new Map();
const moves = [];
const lats = [];
let okCount = 0;
let failCount = 0;
let errCount = 0;
let sent = 0;
let received = 0;
let ready = false;
let readyAt = 0;
const t0 = performance.now();

function sendOne() {
  if (sent >= N) return;
  const id = `q${++sent}`;
  pending.set(id, performance.now());
  proc.stdin.write(id + '\n');
}

rl.on('line', (line) => {
  if (!ready) {
    if (line.startsWith('READY')) {
      ready = true;
      readyAt = performance.now();
      console.error(`[ready] ${(readyAt - t0).toFixed(0)}ms after spawn (${line.trim()})`);
      for (let i = 0; i < PAR; i++) sendOne();
    }
    return;
  }
  const parts = line.split('\t');
  const id = parts[0];
  if (id === 'ERROR' || !pending.has(id)) {
    if (parts[1] === 'ERROR' || parts[0] === 'ERROR') {
      errCount++;
      console.error('[ERR]', line);
    }
    return;
  }
  const start = pending.get(id);
  pending.delete(id);
  received++;
  const lat = performance.now() - start;
  const scramble = parts[1];
  const tag = parts[3];
  if (tag === 'OK') {
    okCount++;
    const m = scramble.trim().split(/\s+/).filter(Boolean).length;
    moves.push(m);
    lats.push(lat);
  } else if (tag === 'FAIL') {
    failCount++;
    console.error('[FAIL]', line);
  } else {
    errCount++;
    console.error('[unknown]', line);
  }
  if (received < N) sendOne();
  else proc.stdin.write('QUIT\n');
});

proc.on('exit', (code) => {
  const wall = performance.now() - t0;
  const sorted = [...moves].sort((a, b) => a - b);
  const lsorted = [...lats].sort((a, b) => a - b);
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mid = (a) => a[Math.floor(a.length / 2)] ?? NaN;
  const avg = (a) => (a.length ? sum(a) / a.length : NaN);
  const min = (a) => a[0] ?? NaN;
  const max = (a) => a[a.length - 1] ?? NaN;
  console.log('');
  console.log(`### n=${moves.length} (target=${N}, par=${PAR}, workers=${WORKERS}, xmx=${XMX})`);
  console.log(`moves:   avg=${avg(moves).toFixed(2)}  median=${mid(sorted)}  min=${min(sorted)}  max=${max(sorted)}`);
  console.log(`latency: avg=${avg(lats).toFixed(0)}ms  median=${mid(lsorted).toFixed(0)}ms  min=${min(lsorted).toFixed(0)}ms  max=${max(lsorted).toFixed(0)}ms`);
  console.log(`verify:  ${okCount} OK / ${failCount} FAIL / ${errCount} ERR`);
  console.log(`wall:    ${(wall / 1000).toFixed(1)}s (after ready: ${((performance.now() - readyAt) / 1000).toFixed(1)}s)`);
  console.log(`JSON:    ${JSON.stringify({
    n: moves.length, par: PAR, workers: Number(WORKERS),
    avgMoves: Number(avg(moves).toFixed(2)),
    medianMoves: mid(sorted),
    minMoves: min(sorted),
    maxMoves: max(sorted),
    avgLatencyMs: Number(avg(lats).toFixed(0)),
    medianLatencyMs: Number(mid(lsorted).toFixed(0)),
    ok: okCount, fail: failCount, err: errCount,
    wallSec: Number((wall / 1000).toFixed(1)),
  })}`);
  process.exit(code ?? 0);
});
