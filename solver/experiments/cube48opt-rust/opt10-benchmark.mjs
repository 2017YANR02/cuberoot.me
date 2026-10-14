#!/usr/bin/env node
// Prepare/report only. This script never starts a process, reads a PDB payload,
// or runs a solver. The operator launches the printed command through guard.mts.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWca100 } from './wasm-benchmark.mjs';
import { opt10BenchmarkPaths as paths, opt10BenchmarkSourceHashes, reportOpt10Wca100,
  validateGeneration, validateOpt10Launch } from './report-opt10-wca100.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

export function parseOpt10BenchmarkArguments(args) {
  assert.equal(args.length, 1, 'Usage: opt10-benchmark.mjs --plan | --prepare | --report');
  assert(['--plan', '--prepare', '--report'].includes(args[0]), 'Only preparation and reporting are supported; no engine is started');
  return args[0];
}

export function opt10BenchmarkPlan(reviewPath = process.env.CUBEOPT_OPT10_REVIEW) {
  return { program: process.execPath, cwd: paths.root,
    args: ['--experimental-strip-types', paths.guard, 'wca100-rust-opt10-single', paths.binary,
      'solve-opt10', paths.small, paths.table, '8', '20', '0'],
    env: { CUBEOPT_BACKEND: 'opt10', CUBEOPT_SOLVE_THREADS: '1', CUBEOPT_MEASURE_RSS: '1',
      ...(reviewPath ? { CUBEOPT_OPT10_REVIEW: resolve(reviewPath) } : {}) },
    cases: 100, measuredPasses: 1, warmupCases: 0, threads: 1, contexts: 8,
    stdin: paths.input, stdout: paths.raw, stderr: paths.stderr, completion: paths.completion,
    completionFields: ['exitCode', 'signal', 'finishedAt'], requiredEnvironment: ['CUBEOPT_OPT10_REVIEW'],
    report: paths.report, rerunsOrRetries: 0,
    incompatibleEnvironmentKeys: ['CUBEOPT_VARIANT', 'CUBEOPT_H', 'CUBEOPT_BENCHMARK', 'CUBEOPT_RESOURCE_REVIEW'] };
}

async function run() {
  const mode = parseOpt10BenchmarkArguments(process.argv.slice(2));
  if (mode === '--report') { await reportOpt10Wca100(); return; }
  const corpus = readWca100(), plan = opt10BenchmarkPlan();
  if (mode === '--plan') {
    console.log(JSON.stringify({ ...plan, corpusSha256: corpus.corpusSha256,
      firstId: corpus.cases[0].id, lastId: corpus.cases.at(-1).id,
      requirement: 'Completed Opt10 generation metadata and finalized table; existing resource guard must permit this run.' }, null, 2));
    return;
  }
  const outputs = [paths.launch, paths.raw, paths.stderr, paths.resources,
    paths.completion, paths.report, paths.failure];
  for (const file of outputs) assert(!existsSync(file), `Refusing to replace or resume an existing run: ${file}`);
  // This validates provenance and reads only the 1024-byte finalized header.
  // The native loader will validate the full payload inside the guarded process.
  const metadataBytes = readFileSync(paths.metadata);
  validateGeneration(JSON.parse(metadataBytes));
  assert(lstatSync(paths.small).isFile() && lstatSync(paths.small).size === 818_008);
  const input = corpus.cases.map(item => `${item.id}\t${item.scramble}\n`).join('');
  if (existsSync(paths.input)) assert.equal(readFileSync(paths.input, 'utf8'), input, 'Fixed guard input differs; never overwrite it');
  const reviewPath = plan.env.CUBEOPT_OPT10_REVIEW;
  assert(reviewPath, 'CUBEOPT_OPT10_REVIEW must explicitly name the solve-stage review');
  const reviewInfo = lstatSync(reviewPath);
  assert(reviewInfo.isFile() && reviewInfo.size <= 64 * 1024, 'Review must be a bounded regular JSON file');
  const reviewBytes = readFileSync(reviewPath);
  JSON.parse(reviewBytes); // The guard validates and consumes the complete policy.
  const launch = { schema: 'cuberoot.rust-opt10.wca100-launch.v1', preparedAt: new Date().toISOString(),
    corpusSha256: corpus.corpusSha256, cases: 100, measuredPasses: 1, warmupCases: 0, threads: 1, contexts: 8,
    binary: { path: paths.binary, sha256: hash(readFileSync(paths.binary)) },
    small: { path: paths.small, bytes: 818_008, sha256: hash(readFileSync(paths.small)) },
    generationMetadataSha256: hash(metadataBytes), sourceSha256: opt10BenchmarkSourceHashes(),
    review: { path: reviewPath, sha256: hash(reviewBytes) },
    input: { path: paths.input, sha256: hash(input), bytes: Buffer.byteLength(input) },
    command: { program: plan.program, cwd: plan.cwd, args: plan.args, env: plan.env } };
  validateOpt10Launch(launch, corpus, input);
  mkdirSync(paths.base, { recursive: true });
  // Exclusive manifest creation reserves this fixed run identity. Failed
  // preparation retains its evidence and never starts or resumes a computation.
  save(paths.launch, launch);
  try {
    if (!existsSync(paths.input)) writeFileSync(paths.input, input, { flag: 'wx' });
    console.log(JSON.stringify({ prepared: true, engineStarted: false, launch: paths.launch,
      corpusSha256: corpus.corpusSha256, ...plan }, null, 2));
  } catch (error) {
    save(paths.failure, { error: String(error.stack ?? error), failedAt: new Date().toISOString(),
      preservedPrefix: paths.prefix, automaticallyRetried: false });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  run().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
