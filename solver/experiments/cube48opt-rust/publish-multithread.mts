#!/usr/bin/env node
/** Publish completed Mac18 reports only. No solver, WASM instance or PDB read. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, openSync, closeSync, fstatSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPARISON_ROWS } from '../../../core/packages/client/app/[lang]/dev/solvers/compare/comparison-data.ts';
import { readWca100, validateSharedDepthResults } from './wasm-benchmark.mjs';
import { parseCompleteJsonl } from './report-opt10-wca100.mjs';
import { validateNativeReview, validateNativeProtection, validateNativeRows } from './native-multithread-report.mjs';
import { validatePreparedRequest, validateWasmSummary } from './run-multithread.mts';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const BASE = resolve(ROOT, '.tmp/cubeopt-reverse');
const TARGET = resolve(ROOT, 'core/packages/client/app/[lang]/dev/solvers/compare/unified-benchmark.ts');
const SHA = /^[a-f0-9]{64}$/;
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
type Result = { id: string; machineId: 'mac'; threads: number; seconds: number; peakRssBytes: number };

function read(path: string, maximum = 32 * 1024 ** 2) {
  assert(isAbsolute(path) && resolve(path) === path && path.startsWith(BASE + '/'), 'Expected local research evidence');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    assert(info.isFile() && info.size > 0 && info.size <= maximum, `Invalid bounded evidence: ${path}`);
    return readFileSync(fd);
  } finally { closeSync(fd); }
}
function json(path: string, expectedHash?: string) {
  const bytes = read(path);
  if (expectedHash !== undefined) assert(SHA.test(expectedHash) && hash(bytes) === expectedHash, `Changed evidence: ${path}`);
  return JSON.parse(bytes.toString('utf8'));
}
const timestamp = (value: string) => { const n = Date.parse(value); assert(Number.isFinite(n), 'Invalid evidence timestamp'); return n; };
function protocol(value: any, corpus: any) {
  assert.equal(value.corpusSha256, corpus.corpusSha256);
  assert.equal(value.threads, 18); assert.equal(value.cases, 100);
  assert.equal(value.measuredPasses, 1); assert.equal(value.warmupCases, 0);
  assert.equal(value.machine.platform, 'darwin'); assert.equal(value.machine.arch, 'arm64');
}
function result(id: string, seconds: number, peakRssBytes: number): Result {
  assert(COMPARISON_ROWS.some(row => row.id === id && row.execution === 'supported'), `Unknown/disabled result: ${id}`);
  assert(Number.isFinite(seconds) && seconds >= 0, 'Invalid solve time');
  assert(Number.isSafeInteger(peakRssBytes) && peakRssBytes > 0, 'Invalid peak RSS');
  return { id, machineId: 'mac', threads: 18, seconds, peakRssBytes };
}

export function validateCompactReport(path: string, corpus: any, reference: any[]) {
  const compact = json(path);
  assert.equal(compact.schema, 'cuberoot.multithread-wca100-result.v1');
  assert.equal(compact.complete, true); protocol(compact, corpus);
  assert.equal(compact.machine.logicalCpus, 18); assert.equal(compact.machine.cpuModel, 'Apple M5 Pro');
  const report = json(compact.reportPath, compact.reportSha256);
  const request = json(compact.requestPath, compact.requestSha256);
  const reviewBytes = read(compact.reviewPath), review = json(compact.reviewPath, compact.reviewSha256);
  const resources = json(compact.resourcesPath, compact.resourcesSha256), exit = json(compact.exitPath, compact.exitSha256);
  assert.equal(request.reviewPath, compact.reviewPath); assert.equal(request.reviewSha256, compact.reviewSha256);
  const policy = validatePreparedRequest(request, review, reviewBytes, 18);
  assert.deepEqual(review.machine, compact.machine);
  assert.equal(review.input.corpusSha256, corpus.corpusSha256);
  const prefix = resolve(BASE, review.label);
  assert.equal(compact.resourcesPath, `${prefix}-resources.json`); assert.equal(compact.exitPath, `${prefix}-exit.json`);
  assert.equal(exit.exitCode, 0); assert.equal(exit.signal, null); assert.equal(exit.spawnError, null);
  const receipt = resources.multithreadReviewReceipt;
  assert.equal(receipt?.schema, 'cuberoot.multithread-wca100-consumption.v1');
  assert.equal(receipt.reviewPath, compact.reviewPath); assert.equal(receipt.reviewSha256, compact.reviewSha256);
  for (const key of Object.keys(review)) if (key !== 'schema') assert.deepEqual(receipt[key], review[key], `Receipt differs: ${key}`);
  assert.equal(receipt.commandSha256, hash(JSON.stringify([request.executable, ...request.args])));
  assert.equal(receipt.before.boot, review.boot); assert.equal(receipt.before.swapouts, review.swapouts);
  assert.equal(resources.boot, review.boot); assert.equal(resources.swapouts, review.swapouts);
  assert.equal(resources.stopped, ''); assert.equal(resources.trigger, null); assert.equal(resources.pressure, 1);
  for (const key of ['backend', 'variant', 'h', 'entry', 'mode', 'measureNativeRss', 'tableBytes', 'rssLimit', 'deadlineMs'])
    assert.equal(resources[key], policy[key], `Resource policy differs: ${key}`);
  assert(resources.peakRss > 0 && resources.peakRss <= resources.rssLimit && resources.minimumHeadroom >= 2 * 2 ** 30);
  assert(timestamp(resources.sampledAt) >= timestamp(receipt.consumedAt));
  assert(timestamp(exit.finishedAt) >= timestamp(resources.sampledAt));
  assert(timestamp(compact.completedAt) >= timestamp(exit.finishedAt));
  protocol(report, corpus);
  let results: Result[];
  if (policy.entry === 'native') {
    assert.equal(report.schema, 'cuberoot.native-multithread.wca100-report.v1');
    assert.equal(report.complete, true); assert.equal(report.performanceEligible, true);
    assert.equal(report.runtime, 'native'); assert.equal(report.batchThreads, 1); assert.equal(report.contexts, 8);
    const identity = validateNativeReview(review, corpus, corpus.cases.map((c: any) => `${c.id}\t${c.scramble}\n`).join(''));
    assert.equal(report.id, identity.id); assert.deepEqual(report.machine, compact.machine);
    for (const key of ['independentlyVerifiedSolutions', 'independentlyReplayedReferenceSolutions', 'optimalLengthsMatched']) assert.equal(report[key], 100);
    for (const [key, value] of Object.entries({ inputOrder: 'wca-first100-source-order', processes: 1,
      threadsPerScramble: 18, concurrentScrambles: 1, measuredPasses: 1, warmupCases: 0 })) assert.equal(report.protocol[key], value);
    assert.equal(report.protection.triggered, false);
    assert.deepEqual(report.protection.resources, resources); assert.deepEqual(report.protection.completion, exit);
    validateNativeProtection(review, receipt, resources, exit, compact.reviewPath, compact.reviewSha256);
    for (const [file, sha] of [[compact.resourcesPath, compact.resourcesSha256], [compact.exitPath, compact.exitSha256], [compact.reviewPath, compact.reviewSha256]])
      assert.equal(report.evidence[file]?.sha256, sha, 'Full report must bind its execution evidence');
    assert.equal(report.totalSeconds, validateNativeRows(report.perCase, reference, corpus));
    for (const [i, row] of report.perCase.entries()) {
      assert.equal(row.index, i); assert.equal(row.independentlyReplayed, true); assert.equal(row.referenceLength, reference[i].length);
    }
    assert.equal(report.peakRssBytes, report.processTiming.peakRssBytes);
    assert(report.peakRssBytes <= resources.rssLimit);
    results = [result(report.id, report.totalSeconds, report.peakRssBytes)];
  } else {
    assert(policy.wasmConfig); const directory = policy.wasmConfig.out;
    assert.equal(compact.reportPath, resolve(directory, 'report.json'));
    const input = json(resolve(directory, 'input.json'));
    validateWasmSummary(report, input, review.variant, corpus);
    for (const key of ['platform', 'arch', 'cpuModel', 'osRelease']) assert.equal(report.machine[key], compact.machine[key]);
    results = ['rust', 'original'].map(engine => {
      const summary = report.engines[engine], dir = resolve(directory, engine);
      assert.deepEqual(summary, json(resolve(dir, 'report.json')));
      for (const key of ['cases', 'verifiedSolutions', 'optimalLengthsMatched']) assert.equal(summary[key], 100);
      assert.equal(summary.processExited, true); assert.equal(summary.threads, 18);
      assert.equal(summary.measuredPasses, 1); assert.equal(summary.warmupCases, 0);
      const rows = parseCompleteJsonl(read(resolve(dir, 'results.jsonl')).toString(), 100);
      const raw = parseCompleteJsonl(read(resolve(dir, 'raw.jsonl')).toString(), 102);
      assert.equal(raw[0].type, 'ready'); assert.equal(raw[0].threads, 18); assert.equal(raw[0].warmupCases, 0);
      assert.equal(raw.at(-1).type, 'finished'); assert.equal(raw.at(-1).cases, 100); assert.equal(raw.at(-1).threads, 18);
      for (const [i, row] of rows.entries()) {
        assert.equal(row.engine, engine); assert.equal(row.id, corpus.cases[i].id); assert.equal(row.index, i); assert.equal(row.threads, 18);
        assert.equal(row.verified, true); assert.equal(row.optimalLengthMatched, true); assert.equal(row.length, reference[i].length);
        assert.equal(input.cases[i].htm, reference[i].length);
        assert.deepEqual(row, { ...raw[i + 1], verified: true, optimalLengthMatched: true, expectedLength: reference[i].length });
        assert(Number.isFinite(row.seconds) && row.seconds >= 0);
        if (engine === 'rust') validateSharedDepthResults(row.search, 18);
      }
      assert.equal(summary.totalSeconds, rows.reduce((n: number, row: any) => n + row.seconds, 0));
      assert.equal(summary.peakRssBytes, raw.at(-1).maxRssKiB * 1024); assert(summary.peakRssBytes <= resources.rssLimit);
      return result(engine === 'rust' ? `rust-wasm-opt-${review.variant}` : `opt-${review.variant}`, summary.totalSeconds, summary.peakRssBytes);
    });
  }
  assert.deepEqual(compact.results, results, 'Compact numbers differ from the full verified report');
  return { results, machine: compact.machine };
}

/** Each invocation supplies the full desired result set; omitted history is not merged. */
export function publishMultithread(paths: string[]) {
  assert(paths.length > 0 && new Set(paths).size === paths.length, 'Supply distinct --report files');
  const before = readFileSync(TARGET, 'utf8'), corpus = readWca100();
  const reference = parseCompleteJsonl(read(resolve(BASE, 'wca100-rust-h10-v2.jsonl')).toString(), 400).slice(0, 100);
  const referenceReport = json(resolve(BASE, 'wca100-rust-h10-v2-report.json'));
  assert.equal(referenceReport.corpusSha256, corpus.corpusSha256); assert.equal(referenceReport.verified, 400);
  for (const [i, row] of reference.entries()) { assert.equal(row.id, `r0_${corpus.cases[i].id}`); assert.equal(row.cancelled, false); }
  const checked = paths.map(path => validateCompactReport(path, corpus, reference));
  checked.forEach(item => assert.deepEqual(item.machine, checked[0].machine, 'Cannot combine different machines'));
  const results = checked.flatMap(item => item.results);
  assert.equal(new Set(results.map(row => row.id)).size, results.length, 'Duplicate solver result');
  const order = COMPARISON_ROWS.map(row => row.id); results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  assert(before.includes(`corpusSha256: '${corpus.corpusSha256}'`), 'Page corpus changed');
  const pattern = /^  results: \[[\s\S]*?\] as MultithreadResult\[\],$/gm;
  assert.equal([...before.matchAll(pattern)].length, 1, 'Expected one typed result array');
  const formatted = JSON.stringify(results, null, 2).replace(/\n/g, '\n  ');
  const after = before.replace(pattern, `  results: ${formatted} as MultithreadResult[],`);
  assert.equal(readFileSync(TARGET, 'utf8'), before, 'Page changed while validating reports');
  const temporary = `${TARGET}.multithread-new`;
  writeFileSync(temporary, after, { flag: 'wx' }); renameSync(temporary, TARGET);
  return { localOnly: true, reports: paths.length, results, target: TARGET };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), paths: string[] = [];
  while (args.length) {
    assert(args.shift() === '--report' && args[0] && !args[0].startsWith('--'), 'Usage: publish-multithread.mts --report COMPACT.json [--report COMPACT.json ...]');
    paths.push(resolve(args.shift()!));
  }
  console.log(JSON.stringify(publishMultithread(paths), null, 2));
}
