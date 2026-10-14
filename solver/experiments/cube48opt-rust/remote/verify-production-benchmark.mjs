#!/usr/bin/env node
// Report-only: read small JSON/artifacts and replay all solutions using cubing.js.
// No WASM instantiation, table access, solve process or server access.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verify } from '../benchmark.mjs';
import { parsePrintedSolution, readWca100, sharedBuildSources, validateSharedDepthResults, wasmBuildContract } from '../wasm-benchmark.mjs';
import { getVariant } from '../variants.mjs';
import { readBaseline } from './rust-candidate-benchmark.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const jsonl = path => readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line));

export async function verifyProductionBenchmark(directory) {
  const inputFile = resolve(directory, 'input.json'), reportFile = resolve(directory, 'report.json');
  const input = json(inputFile), report = json(reportFile), corpus = readWca100();
  assert.equal(input.schema, 'cuberoot.opt8.production-benchmark-input.v1');
  assert.equal(report.schema, 'cuberoot.opt8.production-benchmark-report.v1'); assert.equal(report.complete, true);
  assert.equal(report.inputSha256, hash(readFileSync(inputFile)));
  assert.deepEqual(report.machine, input.machine);
  assert.equal(input.tableBytes, getVariant(8).tableBytes);
  assert.equal(input.tableSha256, '0c742e0ad31d2c6bb428ae8658fa0fe88ffe2f7ac09072dbc3eaab8fcad850f1');
  assert.equal(report.tableSha256, input.tableSha256);
  const build = json(resolve(directory, 'rust-build-metadata.json'));
  assert.deepEqual(build, input.rustBuild); wasmBuildContract({ variant: 8, threads: 4 }, build); sharedBuildSources(build);
  assert.equal(input.artifacts.original.sha256.wasm, getVariant(8).wasmSha256);
  assert.equal(input.artifacts.original.sha256.wrapper, getVariant(8).wrapperSha256);
  assert.equal(input.artifacts.rust.sha256.wasm, build.wasmSha256);
  assert.equal(input.artifacts.rust.sha256.wrapper, build.wrapperSha256);
  assert.equal(input.artifacts.rust.sha256.worker, build.workerSha256);
  assert.equal(input.artifacts.rust.sha256.small, '90c95b69404f00858e32529f83daa985d0c377a745b288a5d0fd4261cf3e6dbd');
  assert.equal(report.machine.platform, 'linux'); assert.equal(report.independentReplay, false);
  const reused = input.baselineReusedFrom !== undefined;
  if (reused) {
    assert.deepEqual(report.baselineReusedFrom, input.baselineReusedFrom);
    for (const value of [input, report]) { assert.equal(value.freshPaired, false); assert.deepEqual(value.executedEngines, ['rust']); }
    const archived = readBaseline(resolve(directory, 'baseline'), input.baselineReusedFrom.originalReportSha256, input, input.baselineReusedFrom.bootId);
    const { directory: archivedDirectory, ...archivedEvidence } = archived.evidence;
    const { directory: originalDirectory, ...recordedEvidence } = input.baselineReusedFrom;
    assert(typeof originalDirectory === 'string' && originalDirectory.startsWith('/'));
    assert.deepEqual(archivedEvidence, recordedEvidence);
    for (const [name, digest] of Object.entries(recordedEvidence.files)) {
      if (name.startsWith('original/')) assert.equal(hash(readFileSync(resolve(directory, name))), digest, `Reused original evidence differs: ${name}`);
    }
    const rustResources = jsonl(resolve(directory, 'rust/resources.jsonl')); assert(rustResources.length > 0);
    assert(rustResources.every(sample => sample.bootId === recordedEvidence.bootId), 'Candidate boot differs from baseline');
  } else {
    assert.equal(report.baselineReusedFrom, undefined);
    assert(!report.executedEngines || JSON.stringify(report.executedEngines) === JSON.stringify(['original', 'rust']));
  }
  for (const value of [input, report]) {
    assert.equal(value.variant, 8); assert.equal(value.threads, 4); assert.equal(value.measuredPasses, 1); assert.equal(value.warmupCases, 0);
    assert.deepEqual(value.engineOrder, reused ? ['rust'] : ['original', 'rust']); assert.equal(value.corpusSha256, corpus.corpusSha256);
  }
  const reference = json(resolve(directory, 'reference-first-pass.json'));
  const historical = jsonl(resolve(ROOT, '.tmp/cubeopt-reverse/wca100-rust-h10-v2.jsonl'));
  assert.equal(historical.length, 400); assert.deepEqual(reference, historical.slice(0, 100), 'Reference must match preserved H10 first pass');
  const { cube3x3x3 } = await import(pathToFileURL(resolve(ROOT,
    'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')));
  const puzzle = await cube3x3x3.kpuzzle(); assert.equal(input.cases.length, 100);
  for (const [index, item] of corpus.cases.entries()) {
    assert.equal(reference[index].id, `r0_${item.id}`); assert.equal(reference[index].cancelled, false);
    verify(puzzle, item, reference[index]);
    assert.deepEqual(input.cases[index], { ...item, htm: reference[index].length });
  }
  const evidence = {};
  for (const engine of ['original', 'rust']) {
    const dir = resolve(directory, engine), rawPath = resolve(dir, 'raw.jsonl'), rowsPath = resolve(dir, 'results.jsonl');
    const raw = jsonl(rawPath), rows = jsonl(rowsPath), exit = json(resolve(dir, 'exit.json'));
    assert.equal(exit.code, 0); assert.equal(exit.signal, null); assert.equal(raw.length, 102); assert.equal(rows.length, 100);
    const [ready] = raw, finished = raw.at(-1), summary = report.engines[engine];
    assert.equal(ready.type, 'ready'); assert.equal(ready.engine, engine); assert.equal(ready.threads, 4); assert.equal(ready.warmupCases, 0);
    assert.equal(ready.loaded.sha256, input.tableSha256); assert.equal(ready.loaded.bytes, input.tableBytes);
    assert.equal(finished.type, 'finished'); assert.equal(finished.cases, 100); assert.equal(finished.threads, 4);
    assert.equal(finished.engine, engine); assert.equal(summary.engine, engine); assert.equal(summary.cases, 100);
    assert.equal(summary.measuredPasses, 1); assert.equal(summary.warmupCases, 0); assert.deepEqual(summary.artifacts, input.artifacts[engine]);
    assert.equal(summary.processExited, true); assert.equal(summary.optimalLengthsMatched, 100); assert.equal(summary.threads, 4);
    for (const [index, item] of input.cases.entries()) {
      const row = rows[index], original = raw[index + 1]; assert.equal(original.type, 'result'); assert.equal(original.engine, engine);
      assert.equal(row.index, index); assert.equal(row.id, item.id); assert.equal(row.threads, 4);
      assert.deepEqual(row, { ...original, expectedLength: item.htm, optimalLengthMatched: true, independentlyReplayed: false });
      const printed = parsePrintedSolution(row.output); assert.equal(printed.solution, row.solution); assert.equal(printed.length, row.length);
      assert(Number.isFinite(row.seconds) && row.seconds >= 0); verify(puzzle, item, row);
      if (engine === 'rust') {
        assert.equal(row.search.cancelled, false); assert.equal(row.search.threads, 4); assert.equal(row.search.contexts, 8);
        assert.equal(row.search.length, row.length); assert.equal(row.search.solution, row.solution);
        assert.equal(row.search.completed_depth, row.length ? row.length - 1 : null); validateSharedDepthResults(row.search, 4);
      }
    }
    assert.equal(summary.totalSeconds, rows.reduce((sum, row) => sum + row.seconds, 0));
    assert.equal(summary.peakRssBytes, finished.maxRssKiB * 1024); assert.equal(summary.loadSeconds, ready.loadSeconds);
    assert.deepEqual(summary, json(resolve(dir, 'report.json')));
    assert.deepEqual(report.artifacts[engine], input.artifacts[engine]);
    for (const [role, remotePath] of Object.entries(input.artifacts[engine].files)) {
      assert.equal(hash(readFileSync(resolve(directory, 'artifacts', engine, basename(remotePath)))), input.artifacts[engine].sha256[role]);
    }
    evidence[engine] = { rawSha256: hash(readFileSync(rawPath)), resultsSha256: hash(readFileSync(rowsPath)), verifiedSolutions: 100,
      totalSeconds: summary.totalSeconds, artifacts: input.artifacts[engine] };
  }
  assert.equal(report.originalOverRustTotalRatio, evidence.original.totalSeconds / evidence.rust.totalSeconds);
  assert.equal(report.rustFasterOnThisRun, report.originalOverRustTotalRatio > 1);
  const result = { schema: 'cuberoot.opt8.production-benchmark-verification.v1', createdAt: new Date().toISOString(),
    inputSha256: hash(readFileSync(inputFile)), reportSha256: hash(readFileSync(reportFile)), allSolutionsVerified: true,
    verifiedSolutions: { original: 100, rust: 100 }, verifiedReferenceSolutions: 100,
    variant: 8, threads: 4, measuredPasses: 1, warmupCases: 0, corpusSha256: corpus.corpusSha256,
    tableSha256: input.tableSha256, artifacts: input.artifacts, engines: evidence,
    executedEngines: reused ? ['rust'] : ['original', 'rust'], freshPaired: !reused,
    ...(reused ? { baselineReusedFrom: input.baselineReusedFrom } : {}),
    originalOverRustTotalRatio: report.originalOverRustTotalRatio, rustFasterOnThisRun: report.rustFasterOnThisRun,
    note: 'All 200 returned solutions and preserved H10 first-pass references independently replayed with cubing.js; no additional solve was run.' };
  writeFileSync(resolve(directory, 'independent-verification.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'usage: verify-production-benchmark.mjs LOCAL_DOWNLOADED_RUN_DIR');
  verifyProductionBenchmark(resolve(process.argv[2])).then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
