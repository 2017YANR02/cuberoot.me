import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readWca100 } from './wasm-benchmark.mjs';
import { nativeReportIdentity, validateNativeReview, validateNativeProtection,
  validateNativeRows, verifyNativeSolutions, parseNativeReportArgs } from './native-multithread-report.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = 'a'.repeat(64);
const corpus = readWca100();
const input = corpus.cases.map(c => `${c.id}\t${c.scramble}\n`).join('');
function fixture() {
  const reviewPath = resolve(ROOT, '.tmp/native-report-fixture-review.json');
  const table = { path: resolve(ROOT, '.tmp/native-report-fixture-table.dat'), bytes: 30_401_280 };
  const snapshot = { path: resolve(ROOT, '.tmp/native-report-fixture-small.bin'), bytes: 818008, sha256: sha };
  const review = { schema: 'cuberoot.multithread-wca100-review.v1', scope: 'mac18-wca100-single',
    label: 'wca100-mt18-native-report-fixture', executable: resolve(ROOT, '.tmp/native-report-fixture-binary'), executableSha256: sha,
    backend: 'opt', variant: 1, h: null, args: ['solve', snapshot.path, table.path, '8', '20', '0'],
    table, snapshot, threads: 18, batchThreads: 1, cases: 100, measuredPasses: 1, warmupCases: 0,
    input: { path: resolve(ROOT, '.tmp/cubeopt-reverse/wca100-single.tsv'), sha256: hash(input), corpusSha256: corpus.corpusSha256 },
    machine: { platform: 'darwin', arch: 'arm64', logicalCpus: 18, hostname: 'fixture', cpuModel: 'fixture', osRelease: 'fixture' },
    boot: 'fixture-boot', swapouts: 0, baselineSha256: sha, stoppedResourcesSha256: sha,
    sourceSha256: Object.fromEntries(['Cargo.toml', 'Cargo.lock', 'src/main.rs', 'src/native_parallel.rs', 'src/search.rs', 'src/cube.rs'].map(k => [k, sha])),
    predecessor: { resourcesPath: '/fixture/resources.json', resourcesSha256: sha, exitPath: '/fixture/exit.json', exitSha256: sha,
      reportPath: '/fixture/report.json', reportSha256: sha } };
  const receipt = { ...structuredClone(review), schema: 'cuberoot.multithread-wca100-consumption.v1', reviewPath, reviewSha256: sha, pid: 123,
    commandSha256: hash(JSON.stringify([review.executable, ...review.args])),
    before: { boot: review.boot, swapouts: 0, pressure: 1, available: 64 * 1024 ** 3 },
    consumedAt: '2026-10-14T01:00:00.000Z' };
  const resources = { backend: 'opt', variant: 1, h: null, entry: 'native', mode: 'solve', tableBytes: table.bytes,
    measureNativeRss: true, stopped: '', trigger: null, pressure: 1, boot: review.boot, swapouts: 0,
    rssLimit: table.bytes + 1024 ** 3 + 18 * 16 * 1024 ** 2, deadlineMs: 6 * 60 * 60_000,
    peakRss: 100 * 1024 ** 2, minimumHeadroom: 3 * 1024 ** 3,
    sampledAt: '2026-10-14T01:01:00.000Z', multithreadReviewReceipt: receipt };
  const completion = { exitCode: 0, signal: null, finishedAt: '2026-10-14T01:01:01.000Z' };
  const rows = corpus.cases.map(c => ({ id: c.id, solution: 'R', length: 1, seconds: 1, completed_depth: 0,
    threads: 18, batch_threads: 1, contexts: 8, cancelled: false,
    nodes: 1, probes: 1, inverse_probes: 1, cache_reuses: 0, splits: 0, face_prunes: 0, face_siblings_removed: 0 }));
  const reference = rows.map(r => ({ ...r, id: `r0_${r.id}`, threads: 1 }));
  return { review, receipt, reviewPath, resources, completion, rows, reference };
}

test('accepts the fixed native18 single-pass protocol and all allowed identities', () => {
  const f = fixture();
  assert.equal(validateNativeReview(f.review, corpus, input).id, 'rust-opt-1');
  validateNativeProtection(f.review, f.receipt, f.resources, f.completion, f.reviewPath, sha);
  assert.equal(validateNativeRows(f.rows, f.reference, corpus), 100);
  for (let variant = 1; variant <= 9; variant++) assert.equal(nativeReportIdentity({ backend: 'opt', variant, h: null }).id, `rust-opt-${variant}`);
  assert.equal(nativeReportIdentity({ backend: 'opt10', variant: null, h: null }).id, 'rust-opt-10');
  for (const h of [7, 10]) assert.equal(nativeReportIdentity({ backend: 'h48', variant: null, h }).id, `rust-h${h}`);
});

test('rejects protocol, machine, source, table and input substitutions', () => {
  for (const mutate of [r => { r.threads = 4; }, r => { r.batchThreads = 18; }, r => { r.measuredPasses = 3; },
    r => { r.warmupCases = 100; }, r => { r.machine.platform = 'linux'; }, r => { r.machine.logicalCpus = 4; },
    r => { r.sourceSha256['src/native_parallel.rs'] = undefined; }, r => { r.input.sha256 = sha; },
    r => { r.table.bytes += 1; }, r => { r.args[5] = '1000'; }]) {
    const f = fixture(); mutate(f.review); assert.throws(() => validateNativeReview(f.review, corpus, input));
  }
  assert.throws(() => nativeReportIdentity({ backend: 'h48', variant: null, h: 11 }));
  assert.throws(() => nativeReportIdentity({ backend: 'nissy', variant: null, h: 10 }));
});

test('rejects modified consumption, stopped runs, failed exit and changed swap baseline', () => {
  for (const mutate of [f => { f.receipt.executableSha256 = 'b'.repeat(64); }, f => { f.receipt.args[5] = '1'; },
    f => { f.receipt.sourceSha256['src/search.rs'] = 'b'.repeat(64); }, f => { f.receipt.input.sha256 = 'b'.repeat(64); },
    f => { f.resources.swapouts = 1; }, f => { f.resources.boot = 'other'; }, f => { f.resources.stopped = 'interrupted'; },
    f => { f.resources.trigger = { reason: 'memory' }; }, f => { f.resources.minimumHeadroom = 1024 ** 3; },
    f => { f.resources.peakRss = f.resources.rssLimit + 1; }, f => { f.completion.exitCode = 1; },
    f => { f.completion.signal = 'SIGTERM'; }, f => { f.completion.finishedAt = f.receipt.consumedAt; }]) {
    const f = fixture(); mutate(f);
    assert.throws(() => validateNativeProtection(f.review, f.receipt, f.resources, f.completion, f.reviewPath, sha));
  }
});

test('rejects contexts mistaken for threads, reordered/incomplete records and partial solutions', () => {
  for (const mutate of [f => { delete f.rows[0].threads; }, f => { f.rows[0].threads = 8; },
    f => { f.rows[0].batch_threads = 18; }, f => { f.rows[0].cancelled = true; },
    f => { f.rows[0].completed_depth = null; }, f => { f.rows[0].length = 2; },
    f => { f.rows[0].seconds = NaN; }, f => { f.rows[0].nodes = -1; },
    f => { f.rows.reverse(); }, f => { f.rows.pop(); }, f => { f.rows.push(f.rows[0]); }]) {
    const f = fixture(); mutate(f); assert.throws(() => validateNativeRows(f.rows, f.reference, corpus));
  }
});

test('requires explicit input and a new report destination without launching anything', () => {
  assert.deepEqual(parseNativeReportArgs(['--review', '/fixture/review.json', '--prefix', '/fixture/run', '--out', '/fixture/report.json']),
    { reviewPath: '/fixture/review.json', prefix: '/fixture/run', output: '/fixture/report.json' });
  assert.throws(() => parseNativeReportArgs(['--review', '/fixture/review.json']));
  assert.throws(() => parseNativeReportArgs(['--review', '/fixture/review.json', '--prefix', '/fixture/run', '--out', '/fixture/review.json']));
});

test('independently replays all 100 results and references, including the final case', async () => {
  const { cube3x3x3 } = await import(pathToFileURL(resolve(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')));
  const puzzle = await cube3x3x3.kpuzzle(), f = fixture();
  const simple = { cases: corpus.cases.map(c => ({ id: c.id, scramble: 'R' })) };
  for (const row of [...f.rows, ...f.reference]) row.solution = "R'";
  assert.equal(verifyNativeSolutions(puzzle, f.rows, f.reference, simple), 100);
  f.rows[99].solution = 'U';
  assert.throws(() => verifyNativeSolutions(puzzle, f.rows, f.reference, simple), /corners|edges/);
  f.rows[99].solution = "R'"; f.reference[99].solution = 'U';
  assert.throws(() => verifyNativeSolutions(puzzle, f.rows, f.reference, simple), /corners|edges/);
});
