#!/usr/bin/env node
// Report only: no solver process, WASM instance, large-table read or page write.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readWca100 } from './wasm-benchmark.mjs';
import { verify } from './benchmark.mjs';
import { parseCompleteJsonl, readSuccessfulTiming } from './report-opt10-wca100.mjs';
import { getVariant } from './variants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const BASE = resolve(ROOT, '.tmp/cubeopt-reverse');
const GiB = 2 ** 30;
const SHA = /^[a-f0-9]{64}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const timestamp = value => { assert(Number.isFinite(Date.parse(value)), 'Invalid evidence timestamp'); return Date.parse(value); };
const STATS = ['nodes', 'probes', 'inverse_probes', 'cache_reuses', 'splits', 'face_prunes', 'face_siblings_removed'];
const REQUIRED_SOURCES = ['Cargo.toml', 'Cargo.lock', 'src/main.rs', 'src/native_parallel.rs', 'src/search.rs', 'src/cube.rs'];

function smallFile(path, limit = 4 * 1024 ** 2) {
  assert(isAbsolute(path) && resolve(path) === path, 'Evidence path must be absolute and canonical');
  const stat = lstatSync(path);
  assert(stat.isFile() && stat.size > 0 && stat.size <= limit, `Expected a bounded regular evidence file: ${path}`);
  return readFileSync(path);
}

export function nativeReportIdentity(review) {
  if (review.backend === 'opt') {
    assert(Number.isInteger(review.variant) && review.variant >= 1 && review.variant <= 9);
    assert.equal(review.h, null);
    return { id: `rust-opt-${review.variant}`, mode: 'solve', tableBytes: getVariant(review.variant).tableBytes };
  }
  if (review.backend === 'opt10') {
    assert.equal(review.variant, null); assert.equal(review.h, null);
    return { id: 'rust-opt-10', mode: 'solve-opt10', tableBytes: 31_130_911_744 };
  }
  assert.equal(review.backend, 'h48', 'Only the reviewed Rust native backends are reportable');
  assert.equal(review.variant, null);
  const h = review.h;
  assert([7, 10].includes(h), 'Only retained H7/H10 tables are in this protocol');
  return { id: `rust-h${h}`, mode: 'solve-h48',
    tableBytes: h === 7 ? 3_793_842_344 : 30_336_314_216 };
}

export function validateNativeReview(review, corpus, expectedInput) {
  assert.equal(review.schema, 'cuberoot.multithread-wca100-review.v1');
  assert.equal(review.scope, 'mac18-wca100-single');
  assert(/^wca100-mt18-[a-z0-9-]+$/.test(review.label));
  for (const [key, value] of Object.entries({ threads: 18, batchThreads: 1, cases: 100, measuredPasses: 1, warmupCases: 0 }))
    assert.equal(review[key], value, `Incorrect ${key}`);
  const identity = nativeReportIdentity(review);
  assert.equal(review.table.bytes, identity.tableBytes);
  assert(isAbsolute(review.table.path) && resolve(review.table.path) === review.table.path);
  assert(isAbsolute(review.executable) && resolve(review.executable) === review.executable);
  assert(SHA.test(review.executableSha256)); assert(SHA.test(review.baselineSha256)); assert(SHA.test(review.stoppedResourcesSha256));
  assert.equal(review.input.path, resolve(BASE, 'wca100-single.tsv'));
  assert.equal(review.input.sha256, hash(expectedInput)); assert.equal(review.input.corpusSha256, corpus.corpusSha256);
  if (review.input.bytes !== undefined) assert.equal(review.input.bytes, Buffer.byteLength(expectedInput));
  const expectedArgs = identity.mode === 'solve-h48' ? [identity.mode, String(review.h), review.table.path]
    : [identity.mode, review.snapshot?.path ?? review.args?.[1], review.table.path];
  assert.deepEqual(review.args, [...expectedArgs, '8', '20', '0'], 'Native CLI must use contexts=8, maxDepth=20 and no node cutoff');
  assert.equal(review.machine.platform, 'darwin'); assert.equal(review.machine.arch, 'arm64');
  assert.equal(review.machine.logicalCpus, 18);
  for (const field of ['hostname', 'cpuModel', 'osRelease']) assert(typeof review.machine[field] === 'string' && review.machine[field].length > 0);
  assert(typeof review.boot === 'string' && review.boot.length > 0);
  assert(Number.isSafeInteger(review.swapouts) && review.swapouts >= 0);
  assert(review.sourceSha256 && typeof review.sourceSha256 === 'object' && !Array.isArray(review.sourceSha256));
  for (const name of REQUIRED_SOURCES) assert(SHA.test(review.sourceSha256[name] ?? ''), `Missing source hash: ${name}`);
  for (const [name, digest] of Object.entries(review.sourceSha256)) {
    assert(!isAbsolute(name) && !name.split('/').some(p => p === '..' || p === '.' || p === ''));
    assert(/(?:\.(?:rs|mjs|mts)|Cargo\.(?:toml|lock))$/.test(name) && SHA.test(digest));
  }
  for (const field of ['resourcesPath', 'exitPath', 'reportPath']) assert(isAbsolute(review.predecessor[field]));
  for (const field of ['resourcesSha256', 'exitSha256', 'reportSha256']) assert(SHA.test(review.predecessor[field]));
  return identity;
}

export function validateNativeProtection(review, receipt, resources, completion, reviewPath, reviewSha256) {
  assert(receipt && typeof receipt === 'object', 'Missing consumed multithread review');
  assert.equal(receipt.schema, 'cuberoot.multithread-wca100-consumption.v1');
  assert.equal(receipt.reviewPath, reviewPath); assert.equal(receipt.reviewSha256, reviewSha256);
  for (const field of ['scope', 'label', 'executable', 'args', 'backend', 'variant', 'h', 'threads', 'batchThreads',
    'cases', 'measuredPasses', 'warmupCases', 'input', 'table', 'executableSha256', 'sourceSha256',
    'baselineSha256', 'stoppedResourcesSha256', 'predecessor', 'boot', 'swapouts', 'snapshot', 'machine']) {
    assert.deepEqual(receipt[field], review[field], `Consumed review differs: ${field}`);
  }
  assert(Number.isSafeInteger(receipt.pid) && receipt.pid > 0);
  assert.equal(receipt.commandSha256, hash(JSON.stringify([review.executable, ...review.args])));
  assert.equal(receipt.before.boot, review.boot); assert.equal(receipt.before.swapouts, review.swapouts);
  assert.equal(receipt.before.pressure, 1);
  assert.equal(resources.backend, review.backend); assert.equal(resources.variant, review.variant); assert.equal(resources.h, review.h);
  assert.equal(resources.entry, 'native'); assert.equal(resources.mode, review.args[0]);
  assert.equal(resources.tableBytes, review.table.bytes); assert.equal(resources.measureNativeRss, true);
  assert.equal(resources.stopped, ''); assert.equal(resources.trigger, null); assert.equal(resources.pressure, 1);
  assert.equal(resources.boot, review.boot); assert.equal(resources.swapouts, review.swapouts);
  assert.equal(resources.rssLimit, review.table.bytes + GiB + 18 * 16 * 1024 ** 2);
  assert.equal(resources.deadlineMs, 6 * 60 * 60_000);
  assert(receipt.before.available >= resources.rssLimit + 3 * GiB);
  assert(Number.isSafeInteger(resources.peakRss) && resources.peakRss > 0 && resources.peakRss <= resources.rssLimit);
  assert(Number.isFinite(resources.minimumHeadroom) && resources.minimumHeadroom >= 2 * GiB);
  if (resources.searchThreads !== undefined) assert.equal(resources.searchThreads, 18);
  if (resources.batchThreads !== undefined) assert.equal(resources.batchThreads, 1);
  assert.equal(completion.exitCode, 0); assert.equal(completion.signal, null);
  assert(timestamp(resources.sampledAt) >= timestamp(receipt.consumedAt));
  assert(timestamp(completion.finishedAt) >= timestamp(resources.sampledAt));
}

export function validateNativeRows(rows, reference, corpus) {
  assert.equal(rows.length, 100); assert.equal(reference.length, 100); assert.equal(corpus.cases.length, 100);
  let totalSeconds = 0;
  for (const [i, item] of corpus.cases.entries()) {
    const row = rows[i], prior = reference[i];
    assert.equal(row.id, item.id, 'Result order differs from fixed input'); assert.equal(prior.id, `r0_${item.id}`);
    assert.equal(row.threads, 18); assert.equal(row.batch_threads, 1); assert.equal(row.contexts, 8);
    assert.equal(row.cancelled, false); assert.equal(prior.cancelled, false);
    assert(Number.isInteger(row.length) && row.length >= 0 && row.length <= 20);
    assert.equal(row.length, prior.length); assert.equal(row.completed_depth, row.length === 0 ? null : row.length - 1);
    assert.equal(prior.contexts, 8);
    assert(Number.isFinite(row.seconds) && row.seconds >= 0);
    for (const stat of STATS) assert(Number.isSafeInteger(row[stat]) && row[stat] >= 0, `Invalid ${stat}`);
    totalSeconds += row.seconds;
  }
  return totalSeconds;
}

export function verifyNativeSolutions(puzzle, rows, reference, corpus) {
  const totalSeconds = validateNativeRows(rows, reference, corpus);
  for (const [i, item] of corpus.cases.entries()) {
    verify(puzzle, item, reference[i]);
    verify(puzzle, { ...item, htm: reference[i].length }, rows[i]);
  }
  return totalSeconds;
}

export async function reportNativeMultithread({ reviewPath, prefix, output }) {
  assert(!existsSync(output), `Refusing to overwrite a report: ${output}`);
  const evidence = {};
  function read(path, max) {
    const bytes = smallFile(path, max); evidence[path] = { bytes: bytes.length, sha256: hash(bytes) }; return bytes;
  }
  const reviewBytes = read(reviewPath), review = JSON.parse(reviewBytes);
  const corpusPath = resolve(ROOT, 'solver/testdata/benchmarks/wca-first100.json');
  read(corpusPath); const corpus = readWca100(corpusPath);
  const expectedInput = corpus.cases.map(row => `${row.id}\t${row.scramble}\n`).join('');
  const identity = validateNativeReview(review, corpus, expectedInput);
  assert.equal(prefix, resolve(BASE, review.label), 'Prefix must be the guard run identity');
  assert.equal(read(review.input.path).toString('utf8'), expectedInput);
  assert.equal(hash(read(resolve(BASE, 'resource-baseline.json'))), review.baselineSha256, 'Original resource baseline changed');
  assert.equal(hash(read(resolve(BASE, 'opt10-generate-v1-resources.json'))), review.stoppedResourcesSha256, 'Original stopped run changed');
  const predecessorResources = JSON.parse(read(review.predecessor.resourcesPath));
  const predecessorExit = JSON.parse(read(review.predecessor.exitPath));
  const predecessorReport = JSON.parse(read(review.predecessor.reportPath));
  assert.equal(evidence[review.predecessor.resourcesPath].sha256, review.predecessor.resourcesSha256);
  assert.equal(evidence[review.predecessor.exitPath].sha256, review.predecessor.exitSha256);
  assert.equal(evidence[review.predecessor.reportPath].sha256, review.predecessor.reportSha256);
  assert.equal(predecessorResources.stopped, ''); assert.equal(predecessorResources.trigger, null);
  assert.equal(predecessorExit.exitCode, 0); assert.equal(predecessorExit.signal, null);
  assert.equal(predecessorReport.schema, 'cuberoot.rust-opt10.wca100-report.v1');
  assert.equal(predecessorReport.cases, 100); assert.equal(predecessorReport.independentlyVerifiedSolutions, 100);
  assert.equal(predecessorReport.optimalLengthsMatched, 100); assert.equal(predecessorReport.protection.triggered, false);
  assert.equal(predecessorResources.boot, review.boot); assert.equal(predecessorResources.swapouts, review.swapouts);
  const resourcePath = `${prefix}-resources.json`, exitPath = `${prefix}-exit.json`;
  const resources = JSON.parse(read(resourcePath)), completion = JSON.parse(read(exitPath));
  validateNativeProtection(review, resources.multithreadReviewReceipt, resources, completion, reviewPath, hash(reviewBytes));
  assert(timestamp(resources.multithreadReviewReceipt.consumedAt) >= timestamp(predecessorExit.finishedAt));
  const timing = readSuccessfulTiming(read(`${prefix}.stderr.log`).toString('utf8'), completion);
  assert(timing.peakRssBytes <= resources.rssLimit, 'Native RSS exceeds this run budget');
  assert.equal(hash(read(review.executable, 64 * 1024 ** 2)), review.executableSha256, 'Executable changed since review');
  for (const [name, digest] of Object.entries(review.sourceSha256))
    assert.equal(hash(read(resolve(HERE, name))), digest, `Source changed since review: ${name}`);
  // Stat only: never read or hash the multi-gigabyte table in this report process.
  const tableStat = lstatSync(review.table.path); assert(tableStat.isFile()); assert.equal(tableStat.size, review.table.bytes);
  if (['opt', 'opt10'].includes(review.backend)) {
    assert(review.snapshot, 'Opt runs require a frozen coordinate snapshot');
    assert.equal(review.snapshot.path, review.args[1]); assert(SHA.test(review.snapshot.sha256));
    const snapshot = read(review.snapshot.path);
    assert.equal(snapshot.length, review.snapshot.bytes); assert.equal(hash(snapshot), review.snapshot.sha256);
  }
  const rows = parseCompleteJsonl(read(`${prefix}.jsonl`).toString('utf8'), 100);
  const referencePath = resolve(BASE, 'wca100-rust-h10-v2.jsonl');
  const reference = parseCompleteJsonl(read(referencePath).toString('utf8'), 400).slice(0, 100);
  const referenceReport = JSON.parse(read(resolve(BASE, 'wca100-rust-h10-v2-report.json')));
  assert.equal(referenceReport.corpusSha256, corpus.corpusSha256); assert.equal(referenceReport.verified, 400);
  assert.equal(referenceReport.threads, 1); assert.equal(referenceReport.resource.stopped, '');
  const { cube3x3x3 } = await import(pathToFileURL(resolve(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')));
  const puzzle = await cube3x3x3.kpuzzle();
  const totalSeconds = verifyNativeSolutions(puzzle, rows, reference, corpus);
  assert(totalSeconds <= timing.processWallSeconds + 0.05, 'Sum of sequential solve times exceeds process wall time');
  const report = { schema: 'cuberoot.native-multithread.wca100-report.v1', createdAt: new Date().toISOString(),
    complete: true, performanceEligible: true, id: identity.id, runtime: 'native', backend: review.backend,
    variant: review.variant, h: review.h, corpusSha256: corpus.corpusSha256,
    machine: review.machine, threads: 18, batchThreads: 1, contexts: 8, cases: 100, measuredPasses: 1, warmupCases: 0,
    totalSeconds, peakRssBytes: timing.peakRssBytes, sampledPeakProcessTreeRssBytes: resources.peakRss,
    processTiming: timing, independentlyVerifiedSolutions: 100, independentlyReplayedReferenceSolutions: 100,
    optimalLengthsMatched: 100,
    protocol: { inputOrder: 'wca-first100-source-order', processes: 1, threadsPerScramble: 18,
      concurrentScrambles: 1, measuredPasses: 1, warmupCases: 0,
      timing: 'Sum of native solve elapsed seconds, including per-scramble worker lifecycle and depth barriers; loading and verification excluded',
      rss: 'macOS time -l process peak RSS in bytes, including table loading and validation' },
    artifacts: { executable: { path: review.executable, sha256: review.executableSha256 },
      table: { ...review.table, payloadRehashedByReporter: false }, ...(review.snapshot ? { snapshot: review.snapshot } : {}) },
    sourceSha256: review.sourceSha256,
    protection: { triggered: false, baselineSha256: review.baselineSha256, boot: review.boot, swapouts: review.swapouts,
      resources, completion },
    optimalLengthReference: { id: 'rust-h10', pass: 'r0', purpose: 'Independent replay and known optimal lengths only; no historical timing comparison' },
    perCase: rows.map((row, index) => ({ ...row, index, sourceLine: corpus.cases[index].sourceLine,
      independentlyReplayed: true, referenceLength: reference[index].length })), evidence,
    limits: ['One pass does not estimate timing variability.', 'Compare timing only within the same recorded machine and protocol.'] };
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}

export function parseNativeReportArgs(args) {
  const values = {};
  while (args.length) {
    const key = args.shift(); assert(['--review', '--prefix', '--out'].includes(key) && values[key] === undefined && args.length);
    values[key] = resolve(args.shift());
  }
  assert(values['--review'] && values['--prefix'] && values['--out'], 'Usage: native-multithread-report.mjs --review LAUNCH.json --prefix RUN_PREFIX --out NEW_REPORT.json');
  assert.notEqual(values['--out'], values['--review']);
  return { reviewPath: values['--review'], prefix: values['--prefix'], output: values['--out'] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reportNativeMultithread(parseNativeReportArgs(process.argv.slice(2)))
    .then(r => console.log(JSON.stringify({ id: r.id, cases: r.cases, totalSeconds: r.totalSeconds, peakRssBytes: r.peakRssBytes })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
