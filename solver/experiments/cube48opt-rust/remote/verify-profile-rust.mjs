#!/usr/bin/env node
// Report-only diagnostic verification: no WASM, PDB, process launch or network.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verify } from '../benchmark.mjs';
import { parsePrintedSolution, profilerNodeFlags, readWca100, sharedBuildSources,
  validateSharedDepthResults, wasmBuildContract } from '../wasm-benchmark.mjs';
import { getVariant } from '../variants.mjs';
import { readBaseline } from './rust-candidate-benchmark.mjs';
import { assertResources } from './production-benchmark.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => {
  const stat = lstatSync(file);
  assert(stat.isFile() && stat.size <= 16 * 1024 ** 2, `Not bounded verification evidence: ${file}`);
  return readFileSync(file);
};
const json = file => JSON.parse(read(file).toString());
const jsonl = file => read(file).toString().trim().split('\n').map(line => JSON.parse(line));

export function assertDiagnosticContract(input, report) {
  assert.equal(input.schema, 'cuberoot.opt8.production-profile-input.v1');
  assert.equal(report.schema, 'cuberoot.opt8.production-profile.v1');
  assert.equal(report.complete, true); assert.equal(report.independentReplay, false);
  assert.deepEqual(Object.keys(report.engines), ['rust']);
  for (const value of [input, report]) {
    assert.equal(value.diagnostic, true); assert.equal(value.performanceEligible, false);
    assert.equal(value.variant, 8); assert.equal(value.threads, 4);
    assert.equal(value.warmupCases, 0); assert.equal(value.measuredPasses, 1);
    assert.deepEqual(value.executedEngines, ['rust']); assert.deepEqual(value.engineOrder, ['rust']);
    assert.equal(value.originalOverRustTotalRatio, undefined);
    assert.equal(value.rustFasterOnThisRun, undefined);
  }
}

export async function verifyProfileRust(directory) {
  directory = resolve(directory);
  for (const name of ['failure.json', 'rust/failure.json']) assert(!existsSync(resolve(directory, name)), `Failed profile: ${name}`);
  const inputPath = resolve(directory, 'input.json'), reportPath = resolve(directory, 'report.json');
  const input = json(inputPath), report = json(reportPath);
  assertDiagnosticContract(input, report);
  assert.equal(report.inputSha256, sha(read(inputPath)));
  assert.deepEqual(report.machine, input.machine); assert.equal(input.machine.platform, 'linux');
  const corpus = readWca100(resolve(directory, 'cases-source.json'));
  assert.equal(input.corpusSha256, corpus.corpusSha256); assert.equal(report.corpusSha256, corpus.corpusSha256);
  assert.equal(input.tableBytes, getVariant(8).tableBytes);
  assert.equal(input.tableSha256, '0c742e0ad31d2c6bb428ae8658fa0fe88ffe2f7ac09072dbc3eaab8fcad850f1');
  assert.equal(report.tableSha256, input.tableSha256); assert.deepEqual(report.artifacts, input.artifacts);
  const build = json(resolve(directory, 'rust-build-metadata.json'));
  assert.deepEqual(build, input.rustBuild); wasmBuildContract({ variant: 8, threads: 4 }, build); sharedBuildSources(build);
  assert.equal(input.artifacts.rust.sha256.wasm, build.wasmSha256);
  assert.equal(input.artifacts.rust.sha256.wrapper, build.wrapperSha256);
  assert.equal(input.artifacts.rust.sha256.worker, build.workerSha256);
  assert.equal(input.artifacts.rust.sha256.small, '90c95b69404f00858e32529f83daa985d0c377a745b288a5d0fd4261cf3e6dbd');
  assert.equal(input.artifacts.original.sha256.wasm, getVariant(8).wasmSha256);
  assert.equal(input.artifacts.original.sha256.wrapper, getVariant(8).wrapperSha256);
  for (const engine of ['original', 'rust']) for (const [role, remotePath] of Object.entries(input.artifacts[engine].files)) {
    assert.equal(sha(read(resolve(directory, 'artifacts', engine, basename(remotePath)))), input.artifacts[engine].sha256[role]);
  }
  const sourceNames = new Set();
  for (const [remotePath, digest] of Object.entries(input.sourceHashes)) {
    const name = basename(remotePath); assert(!sourceNames.has(name), 'Ambiguous archived source basename'); sourceNames.add(name);
    assert.equal(sha(read(resolve(directory, 'source', name))), digest, `Archived source differs: ${name}`);
  }
  for (const name of ['profile-rust.mjs', 'production-benchmark.mjs', 'rust-candidate-benchmark.mjs', 'wasm-benchmark.mjs', 'variants.mjs']) assert(sourceNames.has(name), `Missing source binding: ${name}`);
  assert.deepEqual(report.baselineReusedFrom, input.baselineReusedFrom);
  const archived = readBaseline(resolve(directory, 'baseline'), input.baselineReusedFrom.originalReportSha256,
    input, input.baselineReusedFrom.bootId);
  const { directory: archivedDirectory, ...actualBaseline } = archived.evidence;
  const { directory: remoteBaseline, ...recordedBaseline } = input.baselineReusedFrom;
  assert(typeof remoteBaseline === 'string' && remoteBaseline.startsWith('/')); assert.deepEqual(actualBaseline, recordedBaseline);
  const referencePath = resolve(directory, 'reference-first-pass.json'), reference = json(referencePath);
  // prepare() pretty-serializes the retained reference. Its exact local bytes
  // need not equal the source descriptor's whitespace; bind that descriptor
  // through the fixture/baseline, and bind the reference values below.
  assert.equal(json(resolve(directory, 'fixture-input.json')).referenceFirstPass.sha256, input.referenceSha256);
  const historical = jsonl(resolve(ROOT, '.tmp/cubeopt-reverse/wca100-rust-h10-v2.jsonl'));
  assert.equal(historical.length, 400); assert.deepEqual(reference, historical.slice(0, 100));
  assert.deepEqual(reference, archived.reference);
  const rawPath = resolve(directory, 'rust/raw.jsonl'), resultsPath = resolve(directory, 'rust/results.jsonl');
  const raw = jsonl(rawPath), rows = jsonl(resultsPath), exitPath = resolve(directory, 'rust/exit.json'), exit = json(exitPath);
  assert.equal(exit.code, 0); assert.equal(exit.signal, null); assert.equal(raw.length, 102); assert.equal(rows.length, 100);
  const ready = raw[0], finished = raw.at(-1), summary = report.engines.rust;
  assert.deepEqual(json(resolve(directory, 'rust/startup.json')), ready);
  assert.equal(ready.type, 'ready'); assert.equal(ready.engine, 'rust'); assert.equal(ready.threads, 4); assert.equal(ready.warmupCases, 0);
  assert.equal(ready.loaded.sha256, input.tableSha256); assert.equal(ready.loaded.bytes, input.tableBytes);
  const flags = profilerNodeFlags(input.profiling.logDirectory, 'rust', true, 'linux');
  assert.deepEqual(input.profiling.nodeFlags, flags); assert.deepEqual(ready.profiler.execArgv, flags);
  assert.equal(ready.profiler.kind, 'v8-prof'); assert.equal(ready.profiler.diagnostic, true); assert.equal(ready.profiler.performanceEligible, false);
  assert.equal(ready.profiler.node, input.machine.node); assert(Number.isSafeInteger(ready.profiler.pid) && ready.profiler.pid > 0);
  const { pid: profilerPid, logs, logsClosedAfterExit, functionAttribution, ...recordedProfiling } = report.profiler;
  assert.equal(profilerPid, ready.profiler.pid); assert.equal(logsClosedAfterExit, true);
  assert.deepEqual(recordedProfiling, input.profiling);
  assert.equal(input.profiling.node, ready.profiler.node); assert.equal(input.profiling.v8, ready.profiler.v8);
  assert.equal(input.profiling.disassemblyFunctionIndex, 12); assert.equal(input.profiling.disassemblyFile, 'rust/stdout.log');
  assert(Array.isArray(logs) && logs.length >= 5); assert.equal(new Set(logs.map(log => log.name)).size, logs.length);
  for (const log of logs) {
    assert(/^isolate-[0-9a-fx]+-\d+-v8\.log$/.test(log.name) && log.name.endsWith(`-${profilerPid}-v8.log`));
    assert(Number.isSafeInteger(log.bytes) && log.bytes > 0 && /^[a-f0-9]{64}$/.test(log.sha256));
  }
  assert(logs.reduce((sum, log) => sum + log.bytes, 0) <= input.profiling.maximumLogBytes);
  assert.equal(finished.type, 'finished'); assert.equal(finished.engine, 'rust'); assert.equal(finished.cases, 100); assert.equal(finished.threads, 4);
  assert.deepEqual(summary, json(resolve(directory, 'rust/report.json')));
  for (const [key, expected] of Object.entries({ engine: 'rust', cases: 100, threads: 4, measuredPasses: 1, warmupCases: 0,
    optimalLengthsMatched: 100, processExited: true, diagnostic: true, performanceEligible: false })) assert.equal(summary[key], expected);
  assert.deepEqual(summary.profiler, ready.profiler); assert.deepEqual(summary.artifacts, input.artifacts.rust);
  assert.equal(summary.peakRssBytes, finished.maxRssKiB * 1024); assert.equal(summary.loadSeconds, ready.loadSeconds);
  const resources = jsonl(resolve(directory, 'rust/resources.jsonl')); assert(resources.length > 0);
  for (const sample of resources) {
    assert.equal(sample.bootId, input.baselineReusedFrom.bootId); assertResources(sample, sample.treeRssBytes);
    assert.equal(sample.rootPid, ready.profiler.pid);
  }
  const { cube3x3x3 } = await import(pathToFileURL(resolve(ROOT,
    'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')));
  const puzzle = await cube3x3x3.kpuzzle(); assert.equal(input.cases.length, 100);
  for (const [index, item] of corpus.cases.entries()) {
    assert.equal(reference[index].id, `r0_${item.id}`); assert.equal(reference[index].cancelled, false);
    verify(puzzle, item, reference[index]);
    const expected = { ...item, htm: reference[index].length }; assert.deepEqual(input.cases[index], expected);
    const row = rows[index], source = raw[index + 1];
    assert.equal(source.type, 'result'); assert.equal(source.engine, 'rust'); assert.equal(row.index, index);
    assert.equal(row.id, item.id); assert.equal(row.threads, 4);
    assert.deepEqual(row, { ...source, expectedLength: expected.htm, optimalLengthMatched: true, independentlyReplayed: false });
    assert(Number.isFinite(row.seconds) && row.seconds >= 0);
    const printed = parsePrintedSolution(row.output); assert.equal(printed.solution, row.solution); assert.equal(printed.length, row.length);
    assert.equal(row.search.cancelled, false); assert.equal(row.search.threads, 4); assert.equal(row.search.contexts, 8);
    assert.equal(row.search.length, row.length); assert.equal(row.search.solution, row.solution);
    assert.equal(row.search.completed_depth, row.length ? row.length - 1 : null); validateSharedDepthResults(row.search, 4);
    verify(puzzle, expected, row);
  }
  // Only validate the diagnostic wall-clock arithmetic. Never export a speed
  // ratio, baseline ranking or timing suitable for a deployment/performance gate.
  assert.equal(summary.totalSeconds, rows.reduce((sum, row) => sum + row.seconds, 0));
  const result = { schema: 'cuberoot.opt8.production-profile-verification.v1', createdAt: new Date().toISOString(),
    diagnostic: true, performanceEligible: false, allSolutionsVerified: true,
    verifiedSolutions: { rust: 100, reference: 100 }, optimalLengthsMatched: 100,
    variant: 8, threads: 4, measuredPasses: 1, warmupCases: 0, executedEngines: ['rust'],
    inputSha256: sha(read(inputPath)), reportSha256: sha(read(reportPath)), resultsSha256: sha(read(resultsPath)),
    rawSha256: sha(read(rawPath)), exitSha256: sha(read(exitPath)), referenceSha256: sha(read(referencePath)),
    referenceSourceSha256: input.referenceSha256, profileLogsRehashed: false,
    corpusSha256: corpus.corpusSha256, tableSha256: input.tableSha256, artifacts: input.artifacts.rust,
    sourceHashes: input.sourceHashes, baselineReusedFrom: input.baselineReusedFrom,
    note: 'All 100 profiled Rust solutions and 100 preserved H10 references independently replayed. Profiling timings are diagnostic only and cannot authorize deployment.' };
  writeFileSync(resolve(directory, 'profile-independent-verification.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'usage: verify-profile-rust.mjs LOCAL_DOWNLOADED_PROFILE_DIR');
  verifyProfileRust(resolve(process.argv[2])).then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
