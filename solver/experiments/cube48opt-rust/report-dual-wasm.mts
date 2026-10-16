/** Independent result replay; this entry never starts a solver or loads a PDB. */
import assert from 'node:assert/strict';
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dualCandidateOutput, dualCandidateRequest, dualCandidateScopeConfig, isOpt9RoundScope,
  opt9CandidatePinnedBuild, opt9RoundScopes, validateOpt9CandidateBuildMetadata, type DualCandidateScope } from './wasm-dual-candidate-policy.mts';
import { openBase, openRoot } from './open-benchmark-policy.mts';
import { parsePrintedSolution, readWca100, validateSharedDepthResults } from './wasm-benchmark.mjs';
import { verify } from './benchmark.mjs';
import { getVariant } from './variants.mjs';
import { patchOriginalWrapper } from './original-wasm-compat.mjs';

/** Compare only fully exhausted work; winning/cancelled shards depend on timing. */
export function compareExhaustedShardWork(rows: any[], baseline: any[]) {
  assert.equal(rows.length, baseline.length);
  const metrics = ['nodes', 'probes', 'jobs', 'quarterRemoved'] as const;
  const zero = () => Object.fromEntries(metrics.map(key => [key, 0]));
  const totals = {candidate: zero(), baseline: zero()};
  let comparedShards = 0, differingShards = 0, skippedShards = 0;
  let exhaustedLayers = 0, differingLayers = 0;
  let firstDifference: any = null, firstLayerDifference: any = null;
  const exhausted = (shard: any) => shard?.completed === true && shard.cancelled === false && shard.solution === null;
  for (const [index, row] of rows.entries()) {
    const prior = baseline[index];
    assert.equal(row.id, prior.id); assert.equal(row.length, prior.length); assert.equal(row.threads, prior.threads);
    const previous = new Map<string, any>();
    for (const shard of prior.search.depthResults.flat()) {
      const key = `${shard.depth}/${shard.worker}`; assert(!previous.has(key)); previous.set(key, shard);
    }
    for (const shards of row.search.depthResults) {
      const depth = shards[0].depth, layer = {candidate: zero(), baseline: zero()};
      let layerCompared = 0;
      for (const shard of shards) {
        const before = previous.get(`${shard.depth}/${shard.worker}`);
        if (!exhausted(shard) || !exhausted(before)) { skippedShards++; continue; }
        comparedShards++; layerCompared++;
        let differs = false;
        for (const metric of metrics) {
          const actual = shard[metric], expected = before[metric];
          assert(Number.isSafeInteger(actual) && actual >= 0 && Number.isSafeInteger(expected) && expected >= 0);
          totals.candidate[metric] += actual; totals.baseline[metric] += expected;
          layer.candidate[metric] += actual; layer.baseline[metric] += expected;
          if (actual !== expected) {
            differs = true;
            firstDifference ??= {index, id: row.id, depth, worker: shard.worker, metric, baseline: expected, candidate: actual};
          }
        }
        differingShards += Number(differs);
      }
      if (depth < row.length) {
        assert.equal(layerCompared, row.threads, 'Every below-optimum shard must be exhausted in both runs');
        exhaustedLayers++;
        const metric = metrics.find(key => layer.candidate[key] !== layer.baseline[key]);
        if (metric) {
          differingLayers++;
          firstLayerDifference ??= {index, id: row.id, depth, metric, baseline: layer.baseline[metric], candidate: layer.candidate[metric]};
        }
      }
    }
  }
  return {cases: rows.length, metrics, comparedShards, equalShards: comparedShards - differingShards,
    differingShards, skippedShards, allMatched: differingShards === 0,
    workEquivalent: differingShards === 0 && differingLayers === 0, totals, firstDifference,
    exhaustedLayers, differingLayers, allExhaustedLayerTotalsMatched: differingLayers === 0, firstLayerDifference,
    note: 'Both frozen WASM artifacts use static sharding. Only completed, non-cancelled, no-solution shards are compared; any difference requires investigation before claiming equal search work. Winning/cancelled shards are excluded.'};
}

async function runReport() {
const variant = Number(process.argv[2]);
assert(variant === 8 || variant === 9);
assert(process.argv.length <= 4);
const scope = (process.argv[3] ?? 'coset') as DualCandidateScope;
assert(scope === 'coset' || scope === 'opt8-lazy' || scope === 'opt8-root' || scope === 'opt8-original' || isOpt9RoundScope(scope));
const opt9Round = isOpt9RoundScope(scope);
const original = scope === 'opt8-original', engineKey = original ? 'original' : 'rust';
const rootProofRequired = scope === 'opt8-lazy' || scope === 'opt8-root';
const config = dualCandidateScopeConfig(scope);
assert((config.variants as readonly number[]).includes(variant), 'This scope does not authorize that variant');
const count = variant === 8 ? 100 : 1000, threads = variant === 8 ? 4 : 16;
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
// Evidence only: bounded streaming never allocates or hashes a pruning table.
const sha = (path: string) => {
  const fd = openSync(path, 'r'), hash = createHash('sha256');
  try {
    const file = fstatSync(fd);
    assert(file.isFile() && file.size <= 128 * 2 ** 20, 'Evidence exceeds the report memory boundary');
    const buffer = Buffer.alloc(2 ** 20);
    for (let offset = 0; offset < file.size;) {
      const bytes = readSync(fd, buffer, 0, Math.min(buffer.length, file.size - offset), offset);
      assert(bytes > 0, 'Truncated evidence'); hash.update(buffer.subarray(0, bytes)); offset += bytes;
    }
    return hash.digest('hex');
  } finally { closeSync(fd); }
};
const lines = (path: string) => {
  const text = readFileSync(path, 'utf8'); assert(text.endsWith('\n'));
  return text.trim().split('\n').map(line => JSON.parse(line));
};
const request = dualCandidateRequest(variant, undefined, scope), out = dualCandidateOutput(variant, scope);
const resourcePath = resolve(openBase, request.label + '-resources.json');
const resource = read(resourcePath), exit = read(resolve(config.dir, `opt${variant}-exit.json`));
assert.equal(exit.exitCode, 0); assert.equal(resource.stopped, ''); assert.equal(resource.trigger, null);
assert.equal(resource.swapouts, config.swapouts); assert.equal(resource.pressure, 1);
assert(resource.minimumHeadroom >= 2 * 2 ** 30 && resource.peakRss > 0 && resource.peakRss <= resource.rssLimit);
const review = read(config.reviewPath), receiptPath = resolve(config.dir, `opt${variant}-receipt.json`), receipt = read(receiptPath);
let candidateBuildEvidence: any;
if (isOpt9RoundScope(scope)) {
  assert.deepEqual(review.round.scopes, opt9RoundScopes);
  assert.equal(review.round.stopPath, config.stopPath);
  assert.equal(receipt.round, review.round.id);
  const pinned = opt9CandidatePinnedBuild(scope);
  const metadataPath = resolve(dirname(pinned.wasm), 'build-metadata.json');
  assert.equal(review.builds[variant].wasm, pinned.wasm);
  assert.equal(sha(pinned.wasm), pinned.sha256);
  assert.equal(sha(metadataPath), pinned.metadataSha256);
  assert.equal(review.builds[variant].artifacts[metadataPath], pinned.metadataSha256);
  const build = read(metadataPath);
  // The policy owns candidate-specific flags: padded alone has no batch marker.
  validateOpt9CandidateBuildMetadata(scope, build);
  candidateBuildEvidence = {metadataSha256: pinned.metadataSha256, features: pinned.features,
    opt9BatchEnabled: build.smallCheck.opt9BatchEnabled, paddedStateLayout: build.smallCheck.paddedStateLayout,
    opt9SelectEnabled: build.smallCheck.opt9SelectEnabled ?? false,
    cosetBatchEnabled: build.smallCheck.cosetBatchEnabled, rootBoundEnabled: build.smallCheck.rootBoundEnabled,
    lazyNormalEnabled: build.smallCheck.lazyNormalEnabled,
    smallIndependentlyVerifiedSolutions: build.smallCheck.independentlyVerifiedSolutions,
    smallCheckSha256: build.smallCheckSha256};
}
assert.equal(review.authorization, config.authorization); assert.equal(review.swapouts, config.swapouts);
assert.equal(receipt.label, request.label); assert.equal(receipt.variant, variant);
assert.equal(receipt.engine, original ? 'original-wasm' : 'rust-wasm'); assert.equal(receipt.candidate, config.candidates[variant]);
assert.equal(receipt.reviewSha256, sha(config.reviewPath));
assert.deepEqual(resource.openBenchmarkReceipt, receipt);
assert.equal(resource.boot, review.boot); assert.equal(receipt.before.boot, review.boot);
assert.equal(receipt.before.swapouts, config.swapouts); assert.equal(receipt.before.pressure, 1);
assert.equal(resource.variant, variant); assert.equal(resource.tableBytes, 30_401_280 * 2 ** variant);
if (scope !== 'coset') {
  assert.equal(variant, opt9Round ? 9 : 8); assert.equal(review.scope, scope); assert.equal(receipt.scope, scope);
  assert.equal(review.schema, 'cuberoot.dual-wasm-candidate-review.v2');
  assert.equal(exit.cases, count); assert.equal(exit.threads, threads);
  assert.equal(exit.passes, 1); assert.equal(exit.warmupCases, 0);
  assert.deepEqual(Object.keys(review.builds), [String(variant)]); assert.deepEqual(Object.keys(review.inputs), [String(variant)]);
  for (const records of [review.history, review.sources, review.builds[variant].artifacts]) {
    assert(records && Object.keys(records).length > 0);
    for (const [path, hash] of Object.entries(records)) assert.equal(sha(path), hash, `Frozen evidence changed: ${path}`);
  }
}
const corpus = readWca100(resolve(openRoot, `solver/testdata/benchmarks/wca-first${count}.json`), count);
const harness = read(resolve(out, 'report.json')), engine = harness.engines[engineKey];
assert.equal(harness.variant, variant); assert.equal(harness.cases, count); assert.equal(harness.threads, threads);
assert.equal(harness.corpusSha256, corpus.corpusSha256); assert.equal(harness.compiler, 'turbofan');
assert.equal(harness.measuredPasses, 1); assert.equal(harness.warmupCases, 0);
assert.equal(engine.processExited, true); assert.equal(engine.verifiedSolutions, count);
// The existing harness has the independent H10 lengths for its first 100.
// This report independently checks all 1000 against the preserved Opt9 reference below.
assert.equal(engine.optimalLengthsMatched, opt9Round ? 100 : count);
if (!original) assert.equal(engine.artifacts.sha256.wasm, review.builds[variant].artifacts[review.builds[variant].wasm]);
assert.equal(harness.corpusSha256, review.inputs[variant].corpusSha256);
if (!original) assert.equal(engine.artifacts.sha256.small, review.inputs[variant].smallSha256);
if (scope !== 'coset') {
  assert.deepEqual(Object.keys(harness.engines), [engineKey]);
  const input = read(resolve(out, 'input.json'));
  assert.equal(input.engine, engineKey); assert.equal(input.variant, variant); assert.equal(input.threads, threads);
  assert.equal(input.cases.length, count); assert.equal(input.corpusSha256, corpus.corpusSha256);
  assert.equal(input.measuredPasses, 1); assert.equal(input.warmupCases, 0);
  assert.equal(input.tableSha256, harness.tableSha256); assert.equal(engine.tableSha256, harness.tableSha256);
  assert.deepEqual(input.artifacts[engineKey], engine.artifacts);
  assert.equal(sha(input.referenceFile), input.referenceSha256);
  for (const [role, path] of Object.entries(engine.artifacts.files)) {
    assert.equal(sha(path as string), engine.artifacts.sha256[role], `Frozen run artifact changed: ${role}`);
  }
}
let originalEvidence: any;
if (original) {
  const upstream = getVariant(8), evidence = review.original;
  assert(evidence, 'Original artifact review is required');
  assert.equal(evidence.wasmSha256, upstream.wasmSha256); assert.equal(sha(evidence.wasm), upstream.wasmSha256);
  assert.equal(evidence.wrapperSha256, upstream.wrapperSha256); assert.equal(sha(evidence.wrapper), upstream.wrapperSha256);
  assert.equal(evidence.compat, resolve(openRoot, 'solver/experiments/cube48opt-rust/original-wasm-compat.mjs'));
  assert.equal(evidence.compatSha256, sha(resolve(openRoot, 'solver/experiments/cube48opt-rust/original-wasm-compat.mjs')));
  const patched = patchOriginalWrapper(readFileSync(evidence.wrapper, 'utf8'));
  const patchedSha = createHash('sha256').update(patched).digest('hex');
  assert.equal(evidence.patchedWrapperSha256, patchedSha);
  assert.equal(receipt.artifactSha256, upstream.wasmSha256);
  assert.equal(receipt.upstreamWrapperSha256, upstream.wrapperSha256);
  assert.equal(receipt.wrapperSha256, patchedSha);
  assert.equal(engine.artifacts.sha256.wasm, upstream.wasmSha256);
  assert.equal(engine.artifacts.upstreamWrapperSha256, upstream.wrapperSha256);
  assert.equal(engine.artifacts.sha256.wrapper, patchedSha);
  assert.equal(readFileSync(engine.artifacts.files.wrapper, 'utf8'), patched);
  assert.equal(engine.resume, undefined); assert.equal(read(resolve(out, 'input.json')).resume, undefined);
  assert(!existsSync(resolve(out, 'rust/results.jsonl')), 'This run must not execute the Rust solver');
  originalEvidence = { upstreamWasmUnchanged: true, upstreamWasmSha256: upstream.wasmSha256,
    upstreamWrapperSha256: upstream.wrapperSha256, patchedWrapperSha256: patchedSha,
    compatibilitySourceSha256: evidence.compatSha256,
    note: 'Only the private JS pthread mailbox compatibility fix is applied; upstream WASM and pruning-table bytes are unchanged.' };
}
const rawPath = resolve(out, engineKey, 'results.jsonl'), rows = lines(rawPath);
assert.equal(rows.length, count);
const referencePath = resolve(openBase, 'wca1000-mt16-rust-native-opt9-exp-fixed.jsonl');
if (opt9Round) {
  assert.equal(review.history[referencePath], sha(referencePath), 'Independent 1000-case reference must be frozen');
  assert.equal(resource.rssLimit, 19_778_730_352);
  assert(!existsSync(resolve(out, 'original/results.jsonl')), 'Original Opt9 must not be rerun');
}
const reference = lines(referencePath);
assert.equal(reference.length, 1000);
const { cube3x3x3 } = await import(pathToFileURL(resolve(openRoot, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
const puzzle = await cube3x3x3.kpuzzle();
let cosetRemoved = 0, quarterRemoved = 0, rootSkippedDepths = 0, rootSkippedCases = 0, rootProofLookups = 0;
for (let i = 0; i < count; i++) {
  const row = rows[i], item = corpus.cases[i];
  assert.equal(row.index, i); assert.equal(row.id, item.id); assert.equal(reference[i].id, item.id);
  assert.equal(row.threads, threads); assert.equal(row.length, reference[i].length);
  assert(Number.isFinite(row.seconds) && row.seconds >= 0);
  verify(puzzle, item, row);
  if (original) {
    assert.equal(row.search, undefined, 'Original results must not claim Rust search metadata');
    const printed = parsePrintedSolution(row.output);
    assert.equal(printed.solution, row.solution); assert.equal(printed.length, row.length);
    assert.equal(printed.engineReportedSeconds, row.engineReportedSeconds);
    continue;
  }
  assert.equal(row.search.solution, row.solution); assert.equal(row.search.length, row.length);
  assert.equal(row.search.cancelled, false); assert.equal(row.search.threads, threads);
  assert.equal(row.search.completed_depth, row.length === 0 ? null : row.length - 1);
  validateSharedDepthResults(row.search, threads);
  if (opt9Round) {
    for (const field of ['initialDepth', 'skippedDepths', 'rootBoundProof'])
      assert.equal(row.search[field], undefined, 'Opt9 execution-cost candidates must retain every depth from zero');
  }
  if (rootProofRequired) {
    assert.equal(row.search.rootBoundProof?.source, 'pdb-forward-inverse');
    assert(Number.isSafeInteger(row.search.initialDepth) && row.search.initialDepth >= 0);
    // The checked WASM oracle is bound to the frozen artifact/table. The
    // independent reference also confirms none of these omitted depths can
    // contain a solution; validateSharedDepthResults checks every real barrier.
    assert(row.search.initialDepth <= reference[i].length);
    for (let depth = 0; depth < row.search.initialDepth; depth++) assert(depth < reference[i].length);
    rootSkippedDepths += row.search.skippedDepths;
    rootSkippedCases += Number(row.search.skippedDepths > 0);
    rootProofLookups += row.search.rootBoundProof.oracleLookups;
    assert.equal(row.search.probes, row.search.rootBoundProof.oracleLookups
      + row.search.depthResults.flat().reduce((sum: number, depth: any) => sum + depth.probes, 0));
  }
  for (const depth of row.search.depthResults.flat()) {
    if (scope === 'coset') assert(Number.isSafeInteger(depth.cosetRemoved) && depth.cosetRemoved >= 0);
    else assert.equal(depth.cosetRemoved, undefined, 'This candidate does not enable backward coset pruning');
    assert(Number.isSafeInteger(depth.quarterRemoved) && depth.quarterRemoved >= 0);
    cosetRemoved += depth.cosetRemoved ?? 0; quarterRemoved += depth.quarterRemoved;
  }
}
if (scope === 'coset') assert(cosetRemoved > 0 && quarterRemoved > 0, 'New pruning must execute on real benchmark states');
else if (rootProofRequired) assert(rootSkippedCases > 0 && rootSkippedDepths > 0 && quarterRemoved > 0, 'Enabled root-bound and quarter pruning must execute');
else if (opt9Round) assert(quarterRemoved > 0, 'Existing quarter pruning must execute');
const seconds = rows.reduce((sum, row) => sum + row.seconds, 0);
assert(Math.abs(seconds - engine.totalSeconds) < 1e-6);
let comparison: any;
let retainedRustComparison: any;
let matchedExhaustedShardWork: any;
if (original) {
  const baselinePath = resolve(openBase, 'wca100-local4-opt8-release4-turbofan-20261014/report.json');
  assert.equal(review.history[baselinePath], sha(baselinePath), 'Retained formal Rust baseline must be frozen in history');
  const baseline = read(baselinePath), rust = baseline.engines.rust;
  for (const field of ['variant', 'cases', 'threads', 'measuredPasses', 'warmupCases', 'corpusSha256',
    'tableSha256', 'node', 'compiler', 'method', 'measurement']) assert.deepEqual(harness[field], baseline[field], `Comparison protocol differs: ${field}`);
  assert.deepEqual(harness.machine, baseline.machine, 'Comparison must use the same local hardware/runtime');
  assert.equal(rust.processExited, true); assert.equal(rust.verifiedSolutions, 100); assert.equal(rust.optimalLengthsMatched, 100);
  assert(Math.abs(rust.totalSeconds - 33.368675666) < 1e-9);
  assert.equal(rust.artifacts.sha256.wasm, 'b600c699ab91c29f0bef5a14b7c2871bf1fb03d840b8813d5656266132433bb6');
  comparison = { baselineId: 'rust-opt8-wasm', baselineReportSha256: sha(baselinePath),
    baselineArtifactSha256: rust.artifacts.sha256.wasm, baselineSeconds: rust.totalSeconds,
    originalOverRustTotalRatio: seconds / rust.totalSeconds,
    rustTimeReductionPercent: (1 - rust.totalSeconds / seconds) * 100,
    matchedProtocol: true, sameMachine: true, sameTable: true, baselineRerun: false,
    note: 'Matches the retained local Rust release protocol. Runs occurred at different times; this is a single-pass comparison, not a same-session rerun.' };
}
if (opt9Round) {
  const priorDir = resolve(openBase, 'open-benchmark-20261015');
  const baselinePath = resolve(priorDir, 'original-wasm-report.json');
  const baselineInputPath = resolve(priorDir, 'original-wasm-resume431/input.json');
  const quarterReportPath = resolve(priorDir, 'rust-wasm-opt9-quarter-fixed-report.json');
  const quarterInputPath = resolve(priorDir, 'rust-wasm-opt9-quarter-fixed/input.json');
  const quarterRaw = resolve(priorDir, 'rust-wasm-opt9-quarter-fixed/rust/results.jsonl');
  for (const path of [baselinePath, baselineInputPath, quarterReportPath, quarterInputPath, quarterRaw])
    assert.equal(review.history[path], sha(path), 'Retained Opt9 evidence must be frozen in history');
  const baseline = read(baselinePath), baselineInput = read(baselineInputPath), quarter = read(quarterReportPath);
  const quarterInput = read(quarterInputPath);
  assert.equal(baseline.seconds, 83.655909546); assert.equal(baseline.verifiedSolutions, count);
  assert.equal(baseline.optimalLengthsMatched, count); assert.equal(baseline.exitCode, 0);
  assert.equal(quarter.verifiedSolutions, count); assert.equal(quarter.optimalLengthsMatched, count);
  assert.equal(quarter.exitCode, 0); assert.equal(quarter.rawSha256, sha(quarterRaw));
  assert(Math.abs(quarter.seconds - 93.745204850) < 1e-9);
  for (const field of ['variant', 'threads', 'measuredPasses', 'warmupCases', 'corpusSha256',
    'tableSha256', 'node', 'compiler', 'method', 'measurement', 'machine']) {
    assert.deepEqual(harness[field], baselineInput[field], `Opt9 comparison protocol differs: ${field}`);
    assert.deepEqual(harness[field], quarterInput[field], `Retained Rust comparison protocol differs: ${field}`);
  }
  assert.equal(baselineInput.cases.length, count);
  assert.equal(quarterInput.cases.length, count);
  const oldRows = lines(quarterRaw); assert.equal(oldRows.length, count);
  for (const old of oldRows) validateSharedDepthResults(old.search, threads);
  assert(Math.abs(oldRows.reduce((sum, row) => sum + row.seconds, 0) - quarter.seconds) < 1e-6);
  matchedExhaustedShardWork = {...compareExhaustedShardWork(rows, oldRows), baselineRawSha256: sha(quarterRaw),
    baselineReportSha256: sha(quarterReportPath)};
  retainedRustComparison = {baselineId: 'rust-opt9-wasm-quarter-fixed', baselineReportSha256: sha(quarterReportPath),
    baselineArtifactSha256: quarter.harnessSummary.artifacts.sha256.wasm, baselineSeconds: quarter.seconds,
    baselineOverCandidateTotalRatio: quarter.seconds / seconds, candidateTimeReductionPercent: (1 - seconds / quarter.seconds) * 100,
    matchedProtocol: true, sameMachine: true, sameTable: true, baselineRerun: false,
    note: 'Retained quarter-fixed Rust result; one pass per artifact at different times. Work equivalence is checked separately on fully exhausted shards.'};
  comparison = {baselineId: 'cube48opt-wasm', baselineReportSha256: sha(baselinePath), baselineSeconds: baseline.seconds,
    baselineArtifactSha256: baseline.harnessSummary.artifacts.sha256.wasm,
    originalOverRustTotalRatio: baseline.seconds / seconds, rustTimeReductionPercent: (1 - seconds / baseline.seconds) * 100,
    rustFasterOnThisRun: seconds < baseline.seconds, matchedProtocol: true, sameMachine: true, sameTable: true,
    baselineRerun: false, baselineContinuation: baseline.continuation,
    note: 'Retained original result contains 431 completed calls plus the remaining 569 after a JS compatibility repair; no case was repeated. New Rust run is one fresh pass, at a different time.'};
}
const resultId = original ? 'cube48opt8-wasm' : scope === 'coset' ? `rust-opt${variant}-wasm-coset`
  : opt9Round ? `rust-opt9-wasm-${scope.slice('opt9-'.length)}` : scope === 'opt8-lazy' ? 'rust-opt8-wasm-lazy-normal' : 'rust-opt8-wasm-root-bound';
const report = {
  schema: 'cuberoot.dual-wasm-candidate-result.v1', id: resultId, engine: original ? 'original-wasm' : 'rust-wasm',
  variant, date: new Date().toISOString(), cases: count, threads, passes: 1, warmupCases: 0, exitCode: 0,
  verifiedSolutions: count, optimalLengthsMatched: count, seconds, peakRssBytes: engine.peakRssBytes,
  processTreePeakRssBytes: resource.peakRss, minimumHeadroomBytes: resource.minimumHeadroom, swapoutsDelta: 0,
  nodes: null, ...(!original ? { searchNodes: rows.reduce((sum, row) => sum + row.search.nodes, 0), cosetRemoved, quarterRemoved } : {}),
  compiler: 'Node v24.21.0 · V8 TurboFan (--no-liftoff)', corpusSha256: corpus.corpusSha256,
  tableBytes: resource.tableBytes, tableSha256: harness.tableSha256, rawSha256: sha(rawPath),
  artifactSha256: engine.artifacts.sha256.wasm, resourceSha256: sha(resourcePath), resource, harnessSummary: engine,
  ...(scope !== 'coset' ? { scope, candidate: config.candidates[variant], ...(rootProofRequired ? {rootSkippedCases, rootSkippedDepths, rootProofLookups} : {}),
    reviewSha256: sha(config.reviewPath), receiptSha256: sha(receiptPath),
    historicalEvidenceVerified: Object.keys(review.history).length } : {}),
  ...(original ? { originalEvidence, comparison } : {}),
  ...(opt9Round ? {round: review.round.id, candidateBuildEvidence, comparison, retainedRustComparison, matchedExhaustedShardWork} : {}),
};
const path = resolve(config.dir, `opt${variant}-report.json`);
writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({path, id: resultId, scope, candidate: config.candidates[variant], seconds,
  peakRssBytes: report.peakRssBytes, processTreePeakRssBytes: resource.peakRss,
  verified: count, optimalLengthsMatched: count, cosetRemoved, quarterRemoved,
  ...(opt9Round ? {originalSeconds: comparison.baselineSeconds, retainedRustSeconds: retainedRustComparison.baselineSeconds,
    rustFasterOnThisRun: comparison.rustFasterOnThisRun, rustTimeReductionPercent: comparison.rustTimeReductionPercent,
    retainedRustTimeReductionPercent: retainedRustComparison.candidateTimeReductionPercent,
    exhaustedWorkEquivalent: matchedExhaustedShardWork.workEquivalent,
    differingExhaustedShards: matchedExhaustedShardWork.differingShards,
    differingExhaustedLayers: matchedExhaustedShardWork.differingLayers} : {})}));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runReport();
