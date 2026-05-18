/**
 * cube555 random-state daemon benchmark.
 *
 * Usage:
 *   node bench.mjs                            # default: prod
 *   node bench.mjs --base https://api.cuberoot.me
 *   node bench.mjs --base http://127.0.0.1:3002
 *   node bench.mjs --skip single --skip batch # toggle suites
 *
 * Suites:
 *   single  — 20 sequential GETs to /v1/scramble/555-rs (p50/p90/p99/mean)
 *   par     — 12 parallel GETs, measure total wall time and per-request lat
 *   batch   — GETs /v1/scramble/555-rs/batch?count=12 (SSE). If 404, skips.
 *
 * Output: pretty stdout + a JSON line per suite tagged with timestamp.
 */
import { performance } from 'node:perf_hooks';

const args = parseArgs(process.argv.slice(2));
const BASE = args.base ?? 'https://api.cuberoot.me';
const SKIP = new Set(args.skip ?? []);
const SINGLE_N = Number(args.singleN ?? 20);
const BATCH_N = Number(args.batchN ?? 12);
const TIMEOUT_MS = Number(args.timeout ?? 60_000);

function parseArgs(argv) {
  const out = { skip: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') out.base = argv[++i];
    else if (a === '--skip') out.skip.push(argv[++i]);
    else if (a === '--single-n') out.singleN = argv[++i];
    else if (a === '--batch-n') out.batchN = argv[++i];
    else if (a === '--timeout') out.timeout = argv[++i];
  }
  return out;
}

function stats(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return { n: 0 };
  const pick = (p) => sorted[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    n,
    min: sorted[0],
    p50: pick(0.5),
    p90: pick(0.9),
    p99: pick(0.99),
    max: sorted[n - 1],
    mean: sum / n,
  };
}

function fmt(ms) {
  if (ms == null || Number.isNaN(ms)) return '   -  ';
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function timedFetch(url, signal) {
  const t0 = performance.now();
  const res = await fetch(url, { signal });
  const body = await res.text();
  const t1 = performance.now();
  return { ok: res.ok, status: res.status, body, ms: t1 - t0 };
}

async function suiteSingle() {
  console.log(`[single] ${SINGLE_N}× sequential GET ${BASE}/v1/scramble/555-rs`);
  const lat = [];
  for (let i = 0; i < SINGLE_N; i++) {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await timedFetch(`${BASE}/v1/scramble/555-rs`, ctrl.signal);
      clearTimeout(tm);
      if (!r.ok) {
        console.log(`  [${i + 1}/${SINGLE_N}] ✗ ${r.status} (${fmt(r.ms)}) ${r.body.slice(0, 200)}`);
        continue;
      }
      lat.push(r.ms);
      process.stdout.write(`  [${i + 1}/${SINGLE_N}] ${fmt(r.ms)}\r`);
    } catch (e) {
      clearTimeout(tm);
      console.log(`  [${i + 1}/${SINGLE_N}] ✗ ${e.message}`);
    }
  }
  console.log(' '.repeat(50));
  const s = stats(lat);
  console.log(`  n=${s.n}  min=${fmt(s.min)} p50=${fmt(s.p50)} p90=${fmt(s.p90)} p99=${fmt(s.p99)} max=${fmt(s.max)} mean=${fmt(s.mean)}`);
  return { suite: 'single', base: BASE, ...s };
}

async function suitePar() {
  console.log(`[par] ${BATCH_N}× concurrent GET ${BASE}/v1/scramble/555-rs`);
  const t0 = performance.now();
  const all = await Promise.allSettled(
    Array.from({ length: BATCH_N }, () => {
      const ctrl = new AbortController();
      const tm = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      return timedFetch(`${BASE}/v1/scramble/555-rs`, ctrl.signal).finally(() => clearTimeout(tm));
    }),
  );
  const total = performance.now() - t0;
  const lat = all
    .filter((r) => r.status === 'fulfilled' && r.value.ok)
    .map((r) => r.value.ms);
  const fails = all.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
  const s = stats(lat);
  console.log(`  total=${fmt(total)} ok=${lat.length} fail=${fails.length}`);
  console.log(`  per-req: min=${fmt(s.min)} p50=${fmt(s.p50)} p90=${fmt(s.p90)} max=${fmt(s.max)} mean=${fmt(s.mean)}`);
  return { suite: 'par', base: BASE, total, ...s, fails: fails.length };
}

async function suiteBatch() {
  const url = `${BASE}/v1/scramble/555-rs/batch?count=${BATCH_N}`;
  console.log(`[batch] SSE GET ${url}`);
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = performance.now();
  let ttfbHeaders = null;
  let ttfFirstChunk = null;
  let firstScrambleMs = null;
  const scrambleMs = [];
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    ttfbHeaders = performance.now() - t0;
    if (res.status === 404) {
      clearTimeout(tm);
      console.log('  endpoint not deployed (404) — skip');
      return null;
    }
    if (!res.ok) {
      clearTimeout(tm);
      const txt = await res.text();
      console.log(`  HTTP ${res.status}: ${txt.slice(0, 200)}`);
      return { suite: 'batch', base: BASE, error: `HTTP ${res.status}` };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (ttfFirstChunk == null) ttfFirstChunk = performance.now() - t0;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.startsWith('data:')) {
          const elapsed = performance.now() - t0;
          if (firstScrambleMs == null) firstScrambleMs = elapsed;
          scrambleMs.push(elapsed);
        }
      }
    }
    clearTimeout(tm);
  } catch (e) {
    clearTimeout(tm);
    console.log(`  ✗ ${e.message}`);
    return { suite: 'batch', base: BASE, error: e.message };
  }
  const total = performance.now() - t0;
  console.log(`  ttfb-headers=${fmt(ttfbHeaders)} ttf-firstChunk=${fmt(ttfFirstChunk)} firstScramble=${fmt(firstScrambleMs)}`);
  console.log(`  total=${fmt(total)}  scrambles=${scrambleMs.length}/${BATCH_N}  lastScramble=${fmt(scrambleMs[scrambleMs.length - 1])}`);
  return {
    suite: 'batch', base: BASE, total, count: scrambleMs.length, target: BATCH_N,
    ttfbHeaders, ttfFirstChunk, firstScrambleMs, lastScrambleMs: scrambleMs[scrambleMs.length - 1],
  };
}

async function suiteReady() {
  console.log(`[ready] GET ${BASE}/v1/scramble/555-rs/ready`);
  try {
    const r = await timedFetch(`${BASE}/v1/scramble/555-rs/ready`, undefined);
    console.log(`  ${fmt(r.ms)}  body=${r.body}`);
    return { suite: 'ready', base: BASE, ms: r.ms, body: r.body };
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
    return null;
  }
}

(async () => {
  console.log(`# cube555 bench  base=${BASE}  ${new Date().toISOString()}`);
  const out = { ts: new Date().toISOString(), base: BASE, results: {} };

  out.results.ready = await suiteReady();
  if (!SKIP.has('single')) out.results.single = await suiteSingle();
  if (!SKIP.has('par')) out.results.par = await suitePar();
  if (!SKIP.has('batch')) out.results.batch = await suiteBatch();

  console.log('\n# JSON');
  console.log(JSON.stringify(out));
})();
