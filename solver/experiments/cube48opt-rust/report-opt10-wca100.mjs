#!/usr/bin/env node
// Read-only solution replay. Never starts an engine or scans the large table.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readWca100 } from './wasm-benchmark.mjs';
import { verify } from './benchmark.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const BASE = resolve(ROOT, '.tmp/cubeopt-reverse');
const PREFIX = resolve(BASE, 'wca100-rust-opt10-single');
const OUTPUT = `${PREFIX}-report.json`;
const TABLE = resolve(BASE, 'opt10-generated/cuberoot-opt10.dat');
const METADATA = resolve(BASE, 'opt10-generated/generation-metadata.json');
const BINARY = resolve(HERE, 'target/opt10/release/cube48opt-research');
const TABLE_BYTES = 31_130_911_744;
const RSS_LIMIT = 31_130_910_720 + 2 ** 30;
const CORE_SOURCES = ['src/opt10_generate.rs', 'src/opt10.rs', 'src/opt10_table.rs', 'src/coord.rs', 'src/cube.rs'];
const SHA = /^[a-f0-9]{64}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));

export function parseCompleteJsonl(source, count) {
  assert(source.endsWith('\n'), 'Result stream lacks its final newline');
  const lines = source.split('\n').slice(0, -1);
  assert.equal(lines.length, count, `Expected exactly ${count} complete result records`);
  assert(lines.every(line => line.trim().length > 0), 'Blank result records are not permitted');
  return lines.map(line => JSON.parse(line));
}

export function readSuccessfulTiming(stderr, completion) {
  assert.equal(completion.exitCode, 0, 'The guarded solve did not exit successfully');
  assert.equal(completion.signal, null, 'The guarded solve was terminated');
  assert(Number.isFinite(Date.parse(completion.finishedAt)), 'Missing completion timestamp');
  assert(!/terminated by signal|Command (?:terminated|exited with non-zero)|Error:|panicked|internal solution replay failed/i.test(stderr), 'Failure recorded in solver stderr');
  const peaks = [...stderr.matchAll(/^\s*(\d+)\s+maximum resident set size\s*$/gm)];
  assert.equal(peaks.length, 1, 'Expected one completed macOS time -l measurement');
  const peakRssBytes = Number(peaks[0][1]);
  assert(Number.isSafeInteger(peakRssBytes) && peakRssBytes > 0 && peakRssBytes <= RSS_LIMIT, 'Native RSS exceeds the Opt10 run budget');
  const real = [...stderr.matchAll(/^\s*([0-9]+(?:\.[0-9]+)?)\s+real\s+([0-9]+(?:\.[0-9]+)?)\s+user\s+([0-9]+(?:\.[0-9]+)?)\s+sys\s*$/gm)];
  assert.equal(real.length, 1, 'Missing process completion timing');
  return { peakRssBytes, processWallSeconds: Number(real[0][1]), userSeconds: Number(real[0][2]), systemSeconds: Number(real[0][3]) };
}

export function validateResources(resource, mode) {
  assert.equal(resource.backend, 'opt10'); assert.equal(resource.entry, 'native');
  assert.equal(resource.mode, mode); assert.equal(resource.variant, null); assert.equal(resource.h, null);
  assert.equal(resource.tableBytes, TABLE_BYTES); assert.equal(resource.rssLimit, RSS_LIMIT);
  assert.equal(resource.stopped, '', 'Memory, deadline or interruption protection triggered');
  assert.equal(resource.pressure, 1);
  assert(typeof resource.boot === 'string' && resource.boot.length > 0);
  assert(Number.isSafeInteger(resource.swapouts) && resource.swapouts >= 0);
  assert(Number.isFinite(resource.peakRss) && resource.peakRss > 0 && resource.peakRss <= RSS_LIMIT);
  assert(Number.isFinite(resource.minimumHeadroom) && resource.minimumHeadroom >= 2 * 2 ** 30);
  assert(Number.isFinite(Date.parse(resource.sampledAt)));
  if (mode === 'solve-opt10') assert.equal(resource.measureNativeRss, true);
}

function validateGeneration(metadata) {
  assert.equal(metadata.schema, 'cuberoot.opt10.generation-metadata.v1');
  assert.equal(metadata.binary.path, BINARY); assert(SHA.test(metadata.binary.sha256));
  assert.equal(metadata.table.path, TABLE); assert.equal(metadata.table.bytes, TABLE_BYTES);
  assert(SHA.test(metadata.table.headerSha256) && SHA.test(metadata.table.payloadSha256));
  assert.equal(metadata.generation.exitCode, 0);
  assert.equal(metadata.generation.completedDepth, 12);
  validateResources(metadata.generation.resources, 'generate-opt10');
  assert(lstatSync(BINARY).isFile());
  assert.equal(hash(readFileSync(BINARY)), metadata.binary.sha256, 'The benchmark binary differs from generation provenance');
  for (const source of CORE_SOURCES) {
    assert(SHA.test(metadata.sourceSha256?.[source] ?? ''), `Missing source provenance: ${source}`);
    assert.equal(hash(readFileSync(resolve(HERE, source))), metadata.sourceSha256[source], `Core source changed since generation: ${source}`);
  }
  assert(lstatSync(TABLE).isFile()); assert.equal(statSync(TABLE).size, TABLE_BYTES);
  const header = Buffer.alloc(1024), fd = openSync(TABLE, 'r');
  try { assert.equal(readSync(fd, header, 0, 1024, 0), 1024, 'Incomplete Opt10 header'); }
  finally { closeSync(fd); }
  assert.equal(hash(header), metadata.table.headerSha256);
  assert.equal(header.subarray(104, 136).toString('hex'), metadata.table.payloadSha256);
  assert.equal(header[58], metadata.generation.completedDepth);
  assert.equal(header[59], 1, 'The Opt10 table is not finalized');
}

async function main() {
  assert.equal(process.argv.length, 2, 'Run report-opt10-wca100.mjs without arguments');
  assert(!existsSync(OUTPUT), `Refusing to replace existing report: ${OUTPUT}`);
  const completionPath = `${PREFIX}-exit.json`;
  const completion = json(completionPath), stderrPath = `${PREFIX}.stderr.log`;
  const stderr = readFileSync(stderrPath, 'utf8');
  const timing = readSuccessfulTiming(stderr, completion);
  const resourcePath = `${PREFIX}-resources.json`, resource = json(resourcePath);
  validateResources(resource, 'solve-opt10');
  assert(Date.parse(resource.sampledAt) <= Date.parse(completion.finishedAt), 'Resource report is newer than the recorded completion');
  const metadata = json(METADATA); validateGeneration(metadata);
  const generationResource = metadata.generation.resources;
  assert.equal(resource.boot, generationResource.boot, 'System boot changed between generation and benchmark');
  assert.equal(resource.swapouts, generationResource.swapouts, 'Swap-out baseline changed between generation and benchmark');
  assert(Date.parse(resource.sampledAt) >= Date.parse(generationResource.sampledAt));

  const corpus = readWca100(), inputPath = resolve(BASE, 'wca100-single.tsv');
  const expectedInput = corpus.cases.map(item => `${item.id}\t${item.scramble}\n`).join('');
  assert.equal(readFileSync(inputPath, 'utf8'), expectedInput, 'Solve input must be the exact frozen WCA100 order');
  const rawPath = `${PREFIX}.jsonl`, raw = readFileSync(rawPath, 'utf8');
  const rows = parseCompleteJsonl(raw, 100);
  assert(Date.parse(resource.sampledAt) >= statSync(rawPath).mtimeMs, 'Guard has not recorded the finished result stream');
  const historicalPath = resolve(BASE, 'wca100-rust-h10-v2.jsonl');
  const historical = parseCompleteJsonl(readFileSync(historicalPath, 'utf8'), 400);
  const historicalReportPath = resolve(BASE, 'wca100-rust-h10-v2-report.json');
  const historicalReport = json(historicalReportPath);
  assert.equal(historicalReport.corpusSha256, corpus.corpusSha256);
  assert.equal(historicalReport.verified, 400); assert.equal(historicalReport.threads, 1);
  assert.equal(historicalReport.resource.stopped, '');
  const { cube3x3x3 } = await import(pathToFileURL(resolve(ROOT, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  let totalSeconds = 0, historicalFirstPassSeconds = 0;
  const perCase = [];
  for (const [index, item] of corpus.cases.entries()) {
    const row = rows[index], previous = historical[index];
    assert.equal(row.id, item.id); assert.equal(previous.id, `r0_${item.id}`);
    assert.equal(row.cancelled, false); assert.equal(previous.cancelled, false);
    assert.equal(row.contexts, 8); assert.equal(previous.contexts, 8);
    for (const value of [row.seconds, previous.seconds]) assert(Number.isFinite(value) && value >= 0);
    assert.equal(row.completed_depth, row.length === 0 ? null : row.length - 1);
    verify(puzzle, item, previous);
    verify(puzzle, { ...item, htm: previous.length }, row);
    totalSeconds += row.seconds; historicalFirstPassSeconds += previous.seconds;
    perCase.push({ index, id: row.id, sourceLine: item.sourceLine, solution: row.solution,
      length: row.length, seconds: row.seconds, historicalH10FirstPassSeconds: previous.seconds,
      independentlyReplayed: true, optimalLengthMatched: true });
  }
  assert(totalSeconds <= timing.processWallSeconds + 0.05, 'Single-thread solve sum exceeds whole-process elapsed time');
  const report = {
    schema: 'cuberoot.rust-opt10.wca100-report.v1', backend: 'rust-opt10', corpusSha256: corpus.corpusSha256,
    cases: 100, measuredPasses: 1, warmupCases: 0, threads: 1, contexts: 8,
    independentlyVerifiedSolutions: 100, independentlyReplayedReferenceSolutions: 100, optimalLengthsMatched: 100,
    totalSolveSeconds: totalSeconds, peakNativeRssBytes: timing.peakRssBytes,
    sampledPeakProcessTreeRssBytes: resource.peakRss, processTiming: timing,
    method: 'Exactly the frozen WCA first 100 scrambles in source order; one persistent native process; one pass and no extra warmup',
    measurement: 'Sum of native solve elapsed seconds; table loading, table validation and report-time replay excluded',
    nativeRssMethod: 'macOS /usr/bin/time -l maximum resident set size in bytes, including process startup, table validation and all 100 solves',
    processTreeRssMethod: 'Guard sample of the complete process tree; sampled peak can differ from the native kernel rusage peak',
    protection: { triggered: false, sameBootAndSwapBaselineAsGeneration: true, resource },
    completion, generationMetadata: metadata,
    historicalReference: {
      backend: 'rust-h10', pass: 'r0, first pass of the retained historical four-pass run',
      totalSolveSeconds: historicalFirstPassSeconds, cases: 100,
      pairedBenchmark: false, speedupClaim: null,
      note: 'Historical timing reference only: not a contemporaneous comparison with the same build. No acceleration conclusion is justified.',
    },
    perCase,
    evidence: Object.fromEntries([rawPath, stderrPath, resourcePath, completionPath, METADATA, historicalPath,
      historicalReportPath, inputPath].map(file => [file, { sha256: hash(readFileSync(file)), bytes: statSync(file).size }])),
    limits: [
      'One pass does not estimate timing variability.',
      'Independent replay proves each solution solves its scramble; matching retained H10 lengths is cross-engine evidence, not an independent mathematical proof of optimality.',
      'Only the 1024-byte Opt10 header is read here. The large payload digest comes from finalized generation metadata; the native solve loader validates the payload.',
      'This report writes no webpage and makes no publication or performance superiority claim.',
    ],
  };
  writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ report: OUTPUT, cases: 100, totalSolveSeconds: totalSeconds,
    peakNativeRssBytes: timing.peakRssBytes, sampledPeakProcessTreeRssBytes: resource.peakRss,
    historicalH10FirstPassSeconds: historicalFirstPassSeconds, speedupClaim: null }, null, 2) + '\n');
}

function selfCheck() {
  const sample = Array.from({ length: 100 }, (_, id) => JSON.stringify({ id })).join('\n') + '\n';
  assert.equal(parseCompleteJsonl(sample, 100).length, 100);
  assert.throws(() => parseCompleteJsonl(sample, 99));
  assert.throws(() => parseCompleteJsonl(sample.slice(0, -1), 100));
  assert.throws(() => parseCompleteJsonl(sample + '\n', 100));
  const completion = { exitCode: 0, signal: null, finishedAt: '2026-10-13T14:30:00.000Z' };
  const stderr = ' 12.34 real 10.00 user 1.00 sys\n 31140000000 maximum resident set size\n';
  assert.equal(readSuccessfulTiming(stderr, completion).peakRssBytes, 31_140_000_000);
  assert.throws(() => readSuccessfulTiming(stderr, { ...completion, exitCode: 1 }));
  assert.throws(() => readSuccessfulTiming(stderr, { ...completion, signal: 'SIGTERM' }));
  assert.throws(() => readSuccessfulTiming(stderr + stderr, completion));
  assert.throws(() => readSuccessfulTiming('Command exited with non-zero status 1\n' + stderr, completion));
  const resource = { backend: 'opt10', entry: 'native', mode: 'solve-opt10', variant: null, h: null,
    tableBytes: TABLE_BYTES, rssLimit: RSS_LIMIT, stopped: '', pressure: 1, boot: 'fixture', swapouts: 0,
    peakRss: 31_150_000_000, minimumHeadroom: 3 * 2 ** 30, sampledAt: completion.finishedAt, measureNativeRss: true };
  validateResources(resource, 'solve-opt10');
  assert.throws(() => validateResources({ ...resource, stopped: 'protection' }, 'solve-opt10'));
  assert.throws(() => validateResources({ ...resource, minimumHeadroom: 2 ** 30 }, 'solve-opt10'));
  process.stdout.write('Opt10 report parser self-check passed; no table, solver or real benchmark read.\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === '--self-check') selfCheck();
  else main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
