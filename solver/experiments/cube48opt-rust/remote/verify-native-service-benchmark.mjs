#!/usr/bin/env node
// Small evidence only: no table access, native execution or WASM instantiation.
// Replay every solution using cubing.js, against the committed WCA corpus and
// an explicitly pinned historical H10 reference supplied by the operator.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LIMITS, parseResult, readCorpus, summarizeCandidates, validateCandidatePlan } from './native-service-benchmark.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const ENGINES = ['wasm', 'avx2', 'avx512'];
const TABLE_SHA = '0c742e0ad31d2c6bb428ae8658fa0fe88ffe2f7ac09072dbc3eaab8fcad850f1';
const SMALL_SHA = '90c95b69404f00858e32529f83daa985d0c377a745b288a5d0fd4261cf3e6dbd';
// Preserved first Linux WASM/AVX2/AVX-512 acceptance harness, before candidate plans.
const ORIGINAL_HARNESS_SHA = '03e6991419ae4f73124e37b2f9b90b62a8927aa4ace9952435f2687cc791bdeb';
const NATIVE_V4_HARNESS_SHA = 'bad53190e2555b562834fe58e8a88bbe3c58235b8865b09faf46d1b8ebff68b2';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function parseArguments(argv) {
  assert.equal(argv.length, 6, 'usage: verify-native-service-benchmark.mjs --run ABS_DOWNLOADED_DIR --reference ABS_H10_JSONL --reference-sha256 SHA256');
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    assert(['--run', '--reference', '--reference-sha256'].includes(key) && !Object.hasOwn(values, key));
    assert(key === '--reference-sha256' ? /^[a-f0-9]{64}$/.test(argv[i + 1]) : isAbsolute(argv[i + 1]));
    values[key] = argv[i + 1];
  }
  return { directory: resolve(values['--run']), reference: resolve(values['--reference']), referenceSha256: values['--reference-sha256'] };
}

function readSmall(path, maxBytes = 16 * 1024 ** 2) {
  const stat = lstatSync(path);
  assert(stat.isFile() && stat.size <= maxBytes, `Evidence must be a bounded regular file: ${path}`);
  return readFileSync(path);
}

function rows(bytes) {
  const text = bytes.toString('utf8'); assert(text.endsWith('\n'), 'Incomplete JSONL last record');
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}

export function replay(puzzle, item, result, expectedLength) {
  assert(typeof result.solution === 'string');
  const parsed = parseResult(`${item.id}\t${result.length}\t${result.solution}`, item.id);
  assert.equal(parsed.length, expectedLength, `Historical optimal length differs: ${item.id}`);
  const actual = puzzle.defaultPattern().applyAlg(`${item.scramble} ${parsed.solution}`).patternData;
  const solved = puzzle.defaultPattern().patternData;
  assert.deepEqual(actual.CORNERS, solved.CORNERS, `Corners not solved: ${item.id}`);
  assert.deepEqual(actual.EDGES, solved.EDGES, `Edges not solved: ${item.id}`);
}

export async function verifyNativeServiceBenchmark({ directory, reference, referenceSha256 }) {
  assert(!existsSync(resolve(directory, 'failure.json')), 'Benchmark failed');
  const digests = {};
  const read = (name, limit) => {
    const bytes = readSmall(resolve(directory, name), limit); digests[name] = hash(bytes); return bytes;
  };
  const input = JSON.parse(read('input.json')), report = JSON.parse(read('report.json'));
  assert.equal(input.schema, 'cuberoot.opt8.native-service-benchmark-input.v1');
  assert.equal(report.schema, 'cuberoot.opt8.native-service-benchmark-report.v1');
  const comparisonMode = input.mode === 'service-comparison';
  const candidateMode = input.mode === 'native-candidates' || comparisonMode;
  assert(candidateMode || input.mode === undefined, 'Unknown benchmark mode');
  let engineOrder = ENGINES;
  if (candidateMode) {
    assert.equal(report.mode, input.mode);
    validateCandidatePlan(input.candidatePlan);
    assert.equal(input.candidatePlan.schema, comparisonMode ? 'cuberoot.opt8.service-comparison/v1' : 'cuberoot.opt8.native-candidates/v1');
    const planBytes = read('candidates.json');
    assert.equal(hash(planBytes), input.candidatePlanSha256); assert.deepEqual(JSON.parse(planBytes), input.candidatePlan);
    engineOrder = input.candidatePlan.passes.map(pass => pass.label);
    for (const pass of input.candidatePlan.passes) {
      if (comparisonMode && pass.kind === 'wasm') {
        assert.equal(input.assets.wasm.manifest.files.wasm.sha256, pass.sha256); continue;
      }
      assert.equal(input.assets.binaries?.[pass.binary]?.sha256, pass.sha256, 'Candidate does not match recorded executable');
      assert(input.assets.binaries[pass.binary].identity);
    }
  } else assert.equal(report.mode, undefined);
  assert.equal(report.complete, true); assert.equal(report.independentReplay, false); assert.equal(report.lengthMatches, engineOrder.length * 100);
  assert.deepEqual(input.engineOrder, engineOrder); assert.deepEqual(Object.keys(report.engines), engineOrder);
  assert.equal(input.measuredPasses, 1); assert.equal(input.warmupCases, 0);
  assert.deepEqual(input.limits, LIMITS);
  const currentHarnessSha = hash(readSmall(resolve(dirname(fileURLToPath(import.meta.url)), 'native-service-benchmark.mjs')));
  assert(input.sourceSha256 === currentHarnessSha || (!comparisonMode && input.sourceSha256 === NATIVE_V4_HARNESS_SHA)
    || (!candidateMode && input.sourceSha256 === ORIGINAL_HARNESS_SHA),
    'Harness source differs from the versions understood by this verifier');
  if (input.sourceSha256 === currentHarnessSha) assert.equal(input.memoryEvidence, 'ready-and-complete-v1');
  if (input.memoryEvidence) {
    assert.equal(input.memoryEvidence, 'ready-and-complete-v1');
    const settings = JSON.parse(read('system-memory-settings.json'));
    for (const key of ['enabled', 'defrag', 'hpage_pmd_size']) {
      assert(settings.transparentHugepage[key] === null || typeof settings.transparentHugepage[key] === 'string');
    }
  }
  assert.deepEqual(report.machine, input.machine); assert.equal(input.machine.platform, 'linux'); assert.equal(input.machine.arch, 'x64');
  const { corpus, fileSha256 } = readCorpus(resolve(ROOT, 'solver/testdata/benchmarks/wca-first100.json'));
  assert.deepEqual(input.cases, corpus.cases, 'Cases differ from committed WCA first100');
  assert.equal(input.corpusSha256, corpus.corpusSha256); assert.equal(report.corpusSha256, corpus.corpusSha256);
  assert.equal(input.corpusFileSha256, fileSha256, 'Corpus file bytes differ from committed corpus');
  const manifest = input.assets.manifest;
  assert(candidateMode ? ['rust-wasm', 'rust-native'].includes(manifest.engine) : manifest.engine === 'rust-wasm');
  assert.equal(manifest.variant, 'opt8'); assert.equal(manifest.maxThreads, 4);
  assert.equal(manifest.files.table.sha256, TABLE_SHA); assert.equal(manifest.files.table.bytes, 7_782_727_680);
  assert.equal(manifest.files.snapshot.sha256, SMALL_SHA); assert.equal(manifest.files.snapshot.bytes, 818_008);
  assert.equal(input.assets.tableIdentity.size, '7782727680');
  for (const key of candidateMode ? ['manifestSha256', 'pointerSha256'] : ['binarySha256', 'daemonSha256', 'manifestSha256', 'pointerSha256']) {
    assert(/^[a-f0-9]{64}$/.test(input.assets[key]));
  }
  if (comparisonMode) {
    const plan = input.candidatePlan, wasm = input.assets.wasm;
    assert.equal(manifest.engine, 'rust-native'); assert.equal(manifest.bundle, plan.production.bundle);
    assert.equal(input.assets.manifestSha256, plan.production.manifestSha256);
    assert.equal(manifest.files.binary.sha256, plan.passes[1].sha256);
    assert.equal(input.machine.node, plan.node.version);
    assert.equal(wasm.bundle, plan.wasm.bundle); assert.equal(wasm.store, plan.wasm.store);
    assert.equal(wasm.daemon, plan.wasm.daemon); assert.equal(wasm.daemonSha256, plan.wasm.daemonSha256);
    assert.equal(wasm.manifestSha256, plan.wasm.manifestSha256);
    assert.equal(wasm.manifest.engine, 'rust-wasm'); assert.equal(wasm.manifest.bundle, plan.wasm.bundle);
    assert.equal(wasm.manifest.maxThreads, 4); assert.equal(wasm.manifest.variant, 'opt8');
    assert.equal(wasm.files.table.sha256, TABLE_SHA); assert.equal(wasm.files.snapshot.sha256, SMALL_SHA);
    assert.deepEqual(wasm.files.table.identity, input.assets.tableIdentity);
    for (const [role, file] of Object.entries(wasm.files)) assert.equal(file.sha256, wasm.manifest.files[role].sha256);
  }

  const referenceBytes = readSmall(reference);
  assert.equal(hash(referenceBytes), referenceSha256, 'Pinned historical H10 reference changed');
  const historical = rows(referenceBytes); assert.equal(historical.length, 400, 'Expected preserved four-pass H10 WCA100 run');
  const firstPass = historical.slice(0, 100);
  const { cube3x3x3 } = await import(pathToFileURL(resolve(ROOT,
    'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')));
  const puzzle = await cube3x3x3.kpuzzle();
  for (const [i, item] of corpus.cases.entries()) {
    const expected = firstPass[i];
    assert.equal(expected.id, `r0_${item.id}`); assert.equal(expected.cancelled, false);
    assert.equal(expected.completed_depth, expected.length > 0 ? expected.length - 1 : null);
    replay(puzzle, item, expected, expected.length);
  }

  const evidence = {}, pids = new Set(); let bootId;
  for (const engine of engineOrder) {
    assert(!existsSync(resolve(directory, engine, 'failure.json')), `${engine} failed`);
    const results = rows(read(`${engine}/results.jsonl`));
    const summary = JSON.parse(read(`${engine}/report.json`));
    const startup = JSON.parse(read(`${engine}/startup.json`));
    const exit = JSON.parse(read(`${engine}/exit.json`));
    const resources = rows(read(`${engine}/resources.jsonl`));
    if (comparisonMode) {
      const probes = rows(read(`${engine}/admission.jsonl`));
      assert(probes.some(row => row.phase === 'preflight' && row.outcome === 'disabled'));
      for (const probe of probes) {
        assert(['disabled', 'cancelled'].includes(probe.outcome));
        assert(Number.isFinite(probe.durationMs) && probe.durationMs >= 0);
        if (probe.outcome === 'disabled') assert.equal(probe.body.enabled, false);
      }
    }
    const stdout = read(`${engine}/stdout.log`, LIMITS.logBytes).toString('utf8');
    if (existsSync(resolve(directory, engine, 'stderr.log'))) read(`${engine}/stderr.log`, LIMITS.logBytes);
    assert(stdout.endsWith('\n')); const lines = stdout.trimEnd().split('\n');
    assert.equal(lines.length, 101); assert.equal(lines[0], 'READY\t4'); assert.equal(results.length, 100);
    assert.deepEqual(summary, report.engines[engine]); assert.equal(summary.engine, engine); assert.equal(summary.cases, 100);
    assert.equal(summary.threads, 4); assert.equal(summary.processExited, true); assert.equal(summary.independentReplay, false);
    assert.equal(summary.measuredPasses, 1); assert.equal(summary.warmupCases, 0);
    assert(Number.isSafeInteger(summary.pid) && summary.pid > 0); assert(!pids.has(summary.pid)); pids.add(summary.pid);
    assert.equal(startup.engine, engine); assert.equal(startup.threads, 4); assert.equal(startup.readyLine, 'READY\t4');
    assert.equal(startup.pid, summary.pid); assert.equal(startup.startupSeconds, summary.startupSeconds);
    assert(Number.isFinite(startup.startupSeconds) && startup.startupSeconds >= 0 && startup.startupSeconds <= LIMITS.bootMs / 1000);
    assert.equal(exit.pid, summary.pid); assert.equal(exit.code, 0); assert.equal(exit.signal, null); assert.deepEqual(exit.remainingPids, []);
    for (const [i, item] of corpus.cases.entries()) {
      const row = results[i];
      assert.equal(row.pid, summary.pid); assert.equal(row.engine, engine); assert.equal(row.id, item.id);
      assert.equal(row.scramble, item.scramble); assert.equal(row.independentlyReplayed, false);
      assert(Number.isFinite(row.wallSeconds) && row.wallSeconds >= 0 && row.wallSeconds <= LIMITS.requestMs / 1000);
      assert.equal(row.raw, lines[i + 1]);
      assert.deepEqual(parseResult(row.raw, item.id), { id: row.id, length: row.length, solution: row.solution });
      replay(puzzle, item, row, firstPass[i].length);
    }
    assert.equal(summary.totalWallSeconds, results.reduce((sum, row) => sum + row.wallSeconds, 0));
    assert(resources.length > 0);
    for (const sample of resources) {
      if (comparisonMode) {
        for (const key of ['user', 'nice', 'system', 'idle', 'iowait', 'irq', 'softirq', 'steal']) assert(/^\d+$/.test(sample.cpuTicks[key]));
        assert(typeof sample.loadavg === 'string' && /^\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? /.test(sample.loadavg));
      }
      assert.equal(sample.pid, summary.pid); assert(Array.isArray(sample.processIds));
      assert(sample.processIds.every(pid => Number.isSafeInteger(pid) && pid > 0));
      assert(Number.isFinite(sample.treeRssBytes) && sample.treeRssBytes >= 0 && sample.treeRssBytes <= LIMITS.treeRssBytes);
      assert(Number.isFinite(sample.availableBytes) && sample.availableBytes >= LIMITS.reserveBytes);
      assert(sample.fullPressureAvg10 === null || (Number.isFinite(sample.fullPressureAvg10) && sample.fullPressureAvg10 <= LIMITS.fullPressureAvg10));
      assert(typeof sample.bootId === 'string' && sample.bootId.length > 0);
      bootId ??= sample.bootId; assert.equal(sample.bootId, bootId, 'Measurements crossed system boots');
    }
    assert.equal(summary.peakTreeRssBytes, Math.max(...resources.map(row => row.treeRssBytes)));
    let memory;
    if (input.memoryEvidence) {
      memory = {};
      for (const phase of ['ready', 'complete']) {
        const snapshot = JSON.parse(read(`${engine}/memory-${phase}.json`));
        const rollup = read(`${engine}/memory-${phase}.smaps_rollup`).toString('utf8');
        const rawStat = read(`${engine}/memory-${phase}.stat`).toString('utf8');
        const fields = rawStat.slice(rawStat.lastIndexOf(') ') + 2).trim().split(/\s+/);
        assert.equal(snapshot.pid, summary.pid); assert.equal(snapshot.phase, phase);
        assert.equal(Number(rawStat.slice(0, rawStat.indexOf(' ('))), summary.pid);
        for (const [key, procName] of [['anonHugePagesBytes', 'AnonHugePages'], ['rssBytes', 'Rss'], ['anonymousBytes', 'Anonymous'], ['swapBytes', 'Swap']]) {
          const match = rollup.match(new RegExp(`^${procName}:\\s+(\\d+) kB$`, 'm'));
          assert(match, `Missing ${procName} from memory evidence`); assert.equal(snapshot[key], Number(match[1]) * 1024);
        }
        for (const [key, index] of [['minorFaults', 7], ['majorFaults', 9], ['childMinorFaults', 8], ['childMajorFaults', 10]]) {
          assert(Number.isSafeInteger(snapshot[key]) && snapshot[key] >= 0); assert.equal(snapshot[key], Number(fields[index]));
        }
        memory[phase] = snapshot;
      }
      assert(memory.complete.minorFaults >= memory.ready.minorFaults);
      assert(memory.complete.majorFaults >= memory.ready.majorFaults);
      memory.solveMinorFaults = memory.complete.minorFaults - memory.ready.minorFaults;
      memory.solveMajorFaults = memory.complete.majorFaults - memory.ready.majorFaults;
    }
    evidence[engine] = { pid: summary.pid, verifiedSolutions: 100, historicalOptimalLengthsMatched: 100,
      startupSeconds: summary.startupSeconds, totalWallSeconds: summary.totalWallSeconds,
      peakTreeRssBytes: summary.peakTreeRssBytes, processExited: true, remainingPids: [], ...(memory ? { memory } : {}) };
  }
  // Compare the persisted representation: WASM has no binary/SIMD keys, and
  // JSON serialization omits those undefined fields in the shared summary.
  if (candidateMode) assert.deepEqual(report.candidates, JSON.parse(JSON.stringify(summarizeCandidates(input.candidatePlan.passes, report.engines))));
  else {
    assert.equal(report.wasmOverAvx2, evidence.wasm.totalWallSeconds / evidence.avx2.totalWallSeconds);
    assert.equal(report.wasmOverAvx512, evidence.wasm.totalWallSeconds / evidence.avx512.totalWallSeconds);
  }
  const verifiedSolutions = engineOrder.length * 100;
  const verification = { schema: 'cuberoot.opt8.native-service-benchmark-verification.v1', createdAt: new Date().toISOString(),
    allSolutionsVerified: true, verifiedSolutions, historicalOptimalLengthsMatched: verifiedSolutions, verifiedReferenceSolutions: 100,
    reference: { path: reference, sha256: referenceSha256, selectedPass: 0 }, corpusSha256: corpus.corpusSha256,
    committedCorpusFileSha256: fileSha256, inputSha256: digests['input.json'], reportSha256: digests['report.json'],
    files: digests, bootId, engines: evidence, artifacts: input.assets,
    ...(candidateMode ? { mode: input.mode, candidates: report.candidates, candidatePlan: input.candidatePlan }
      : { wasmOverAvx2: report.wasmOverAvx2, wasmOverAvx512: report.wasmOverAvx512 }),
    note: `All ${verifiedSolutions} returned solutions and 100 pinned H10 references independently replayed using cubing.js. Every benchmark length matches the historical H10 optimum. No additional solve or table load was performed.`,
    limitations: input.limitations };
  writeFileSync(resolve(directory, 'independent-verification.json'), JSON.stringify(verification, null, 2) + '\n', { flag: 'wx' });
  return verification;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyNativeServiceBenchmark(parseArguments(process.argv.slice(2)))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
