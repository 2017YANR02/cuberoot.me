import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { assertBenchmarkGuard, initializeBenchmarkModule, measureBenchmarkCase,
  parseWasmBenchmarkArguments, readWca100, sharedBuildSources, validateSharedDepthResults, wasmBuildContract } from './wasm-benchmark.mjs';

const args = ['--variant', '8', '--table', 'table', '--small', 'small', '--wasm', 'module.wasm', '--out', 'fresh'];
const sharedBuild = { schema: 'cuberoot.rust-opt-shared-wasm64.build.v1', target: 'wasm64-unknown-unknown',
  abiVersion: 2, threads: 4, maxThreads: 4, memory64: true, sharedTable: true,
  supportedVariants: [1,2,3,4,5,6,7,8,9], workerSha256: 'a'.repeat(64) };

test('Opt8 four-thread protocol is explicit; old single-thread defaults and fixed corpus remain', () => {
  assert.equal(parseWasmBenchmarkArguments(args).threads, 1);
  for (const engine of ['rust', 'original', 'both']) {
    const parsed = parseWasmBenchmarkArguments([...args, '--threads', '4', '--engine', engine]);
    assert.equal(parsed.threads, 4); assert.equal(parsed.variant, 8); assert.equal(parsed.engine, engine);
  }
  for (const extra of [['--threads','2'], ['--threads','04'], ['--threads','0'], ['--warmup','1'], ['--repeat','3'], ['--cases','other.json']]) {
    assert.throws(() => parseWasmBenchmarkArguments([...args, ...extra]));
  }
  assert.throws(() => parseWasmBenchmarkArguments([...args.map(x => x === '8' ? '9' : x), '--threads', '4']));
  const corpus = readWca100(); assert.equal(corpus.cases.length, 100);
  assert.equal(corpus.cases[0].id, '22001'); assert.equal(corpus.cases[99].id, '273001');
});

test('a four-thread request cannot inherit an old single-thread guard authorization', () => {
  const lock = { pid: 123, entry: 'wasm-benchmark.mjs' };
  assert.doesNotThrow(() => assertBenchmarkGuard({ threads: 1 }, lock, 123));
  assert.throws(() => assertBenchmarkGuard({ threads: 4 }, lock, 123), /explicitly budget/);
  assert.doesNotThrow(() => assertBenchmarkGuard({ threads: 4 }, { ...lock, wasmThreads: 4 }, 123));
  assert.throws(() => assertBenchmarkGuard({ threads: 4 }, { ...lock, wasmThreads: 4 }, 124));
});

test('matched Opt8 original and Rust runs use TurboFan without broadening other cohorts', () => {
  for (const engine of ['rust', 'original']) {
    const parsed = parseWasmBenchmarkArguments([...args, '--threads', '4', '--engine', engine, '--compiler', 'turbofan']);
    assert.equal(parsed.compiler, 'turbofan'); assert.equal(parsed.engine, engine);
  }
  for (const extra of [ ['--threads', '1', '--engine', 'original'], ['--threads', '4', '--engine', 'both'] ])
    assert.throws(() => parseWasmBenchmarkArguments([...args, ...extra, '--compiler', 'turbofan']));
});

test('four-thread Rust requires an actual shared build and a frozen worker artifact', () => {
  const config = { variant: 8, threads: 4 };
  assert.deepEqual(wasmBuildContract(config, sharedBuild), {
    shared: true, wrapper: 'cube48opt-rust8.mjs', worker: 'cube48opt-rust8-worker.mjs',
  });
  for (const change of [{ abiVersion: 1 }, { sharedTable: false }, { maxThreads: 1 },
    { supportedVariants: [9] }, { workerSha256: undefined }, { memory64: false }]) {
    assert.throws(() => wasmBuildContract(config, { ...sharedBuild, ...change }));
  }
  const old = { schema: 'cuberoot.rust-opt-wasm64.build.v1', target: 'wasm64-unknown-unknown', threads: 1 };
  assert.equal(wasmBuildContract({ variant: 9, threads: 1 }, old).shared, false);
  assert.throws(() => wasmBuildContract(config, old), /ABI1/);
});

test('both engines adopt requested threads and await initialization without startup solves', async () => {
  const calls = [];
  const original = { init: async (...args) => { calls.push(args); await Promise.resolve(); return 0; } };
  await initializeBenchmarkModule(original, 'original', 4);
  assert.deepEqual(calls, [[0,4],[-1,4]]);
  let initialized = false;
  const rust = { metadata: { threads: 4, abiVersion: 2, sharedTable: true },
    init: async (...args) => { calls.push(args); await Promise.resolve(); initialized = true; } };
  await initializeBenchmarkModule(rust, 'rust', 4);
  assert.equal(initialized, true); assert.deepEqual(calls, [[0,4],[-1,4],[0,4]]);
  await assert.rejects(initializeBenchmarkModule({ ...rust, metadata: { ...rust.metadata, threads: 1 } }, 'rust', 4));
});

test('shared source evidence binds both adapters, the ABI and search implementation', () => {
  const names = ['wasm-adapter/shared/cube48opt-rust8.mjs', 'wasm-adapter/shared/cube48opt-rust8-worker.mjs',
    'wasm-adapter/shared/src/lib.rs', 'src/search.rs'];
  const sourceHashes = Object.fromEntries(names.map(name => ['solver/experiments/cube48opt-rust/' + name, 'b'.repeat(64)]));
  const metadata = () => ({ sourceHashes, sourceDigest: createHash('sha256').update(JSON.stringify(sourceHashes)).digest('hex') });
  assert.equal(sharedBuildSources(metadata()), sourceHashes);
  assert.throws(() => sharedBuildSources({ ...metadata(), sourceDigest: 'c'.repeat(64) }));
  delete sourceHashes['solver/experiments/cube48opt-rust/src/search.rs'];
  assert.throws(() => sharedBuildSources(metadata()), /Missing build source/);
});

test('async Rust timing includes completion barrier and retains real search fields', async () => {
  const lines = [], calls = []; let clock = 1000;
  const depthResults = [0,1].map(depth => Array.from({ length: 4 }, (_, worker) => ({
    depth, worker, nodes: depth ? worker + 2 : 0, solution: depth && worker === 0 ? "R'" : null,
    cancelled: false, completed: depth === 0,
  })));
  const raw = { solution: "R'", length: 1, completed_depth: 0, cancelled: false,
    contexts: 8, threads: 4, workers: [2,3,4,5], depthResults, nodes: 14 };
  const module = { solve_scramble: async (...args) => {
    calls.push(args); await Promise.resolve(); clock = 1250;
    lines.push("Solution found!: R'", 'Cube1 finished in 1'); return raw;
  } };
  const result = await measureBenchmarkCase(module, 'rust', { scramble: 'R' }, 4, lines, () => clock);
  assert.deepEqual(calls, [['R',4,1,true]]); assert.equal(result.seconds, 0.25);
  assert.equal(result.search, raw); assert.equal(result.threads, 4);
  assert.equal(Object.hasOwn(result.search, 'inverse_probes'), false);
  raw.depthResults[0][1].completed = false;
  await assert.rejects(measureBenchmarkCase(module, 'rust', { scramble: 'R' }, 4, lines, () => clock));
  raw.depthResults[0][1].completed = true;
  raw.cancelled = true;
  await assert.rejects(measureBenchmarkCase(module, 'rust', { scramble: 'R' }, 4, lines, () => clock));
});

test('synchronous original call is timed once with the same four-thread boundary', async () => {
  const lines = []; let calls = 0, clock = 500;
  const module = { solve_scramble: (...args) => {
    assert.deepEqual(args, ['R',4,1,true]); calls++; clock = 600;
    lines.push("Solution found!: R'", 'Cube1 finished in 1, tt=99 ms');
  } };
  const result = await measureBenchmarkCase(module, 'original', { scramble: 'R' }, 4, lines, () => clock);
  assert.equal(calls, 1); assert.equal(result.seconds, 0.1); assert.equal(result.engineReportedSeconds, 0.099);
  assert.equal(Object.hasOwn(result, 'search'), false);
});

test('root-bound skipping requires unanimous checked bounds and consecutive real depth results', () => {
  const threads = 4;
  const depthResults = [1,2].map(depth => Array.from({ length: threads }, (_, worker) => ({
    depth, worker, nodes: 1, solution: depth === 2 && worker === 0 ? "U' R'" : null,
    cancelled: false, completed: depth === 1,
  })));
  const raw = { solution: "U' R'", length: 2, completed_depth: 1, workers: [2,2,2,2], nodes: 8,
    initialDepth: 1, skippedDepths: 1, depthResults,
    rootBoundProof: { schema: 'cuberoot.root-bound-proof.v1', source: 'pdb-forward-inverse',
      lowerBound: 1, maximum: 13, oracleLookups: 16,
      workers: Array.from({ length: threads }, (_, worker) => ({ worker, normal: 0, inverse: 1 })) } };
  assert.doesNotThrow(() => validateSharedDepthResults(raw, threads));
  const mutations = [
    r => { delete r.rootBoundProof; },
    r => { delete r.initialDepth; },
    r => { r.initialDepth = 2; },
    r => { r.skippedDepths = 2; },
    r => { r.rootBoundProof.lowerBound = 2; },
    r => { r.rootBoundProof.workers[1].normal = 1; },
    r => { r.rootBoundProof.workers[1].worker = 0; },
    r => { r.rootBoundProof.workers.pop(); },
    r => { r.rootBoundProof.workers[0].inverse = 14; },
    r => { r.rootBoundProof.oracleLookups = 8; },
    r => { r.rootBoundProof.source = 'fixture-orientation-bound'; },
    r => { r.depthResults[0][0].depth = 0; },
    r => { r.depthResults[0][0].completed = false; },
    r => { r.depthResults.splice(0, 1); },
  ];
  for (const change of mutations) {
    const altered = structuredClone(raw); change(altered);
    assert.throws(() => validateSharedDepthResults(altered, threads));
  }
});

test('local eighteen-worker requests require matching ABI evidence and guard budget', () => {
  const build = { ...sharedBuild, maxThreads: 18, verifiedThreadCounts: [1, 2, 4, 18] };
  for (let variant = 1; variant <= 9; variant++) {
    const config = parseWasmBenchmarkArguments([...args.map(x => x === '8' ? String(variant) : x), '--threads', '18']);
    assert.equal(config.variant, variant); assert.equal(config.threads, 18);
    assert.equal(wasmBuildContract(config, build).shared, true);
    assert.throws(() => wasmBuildContract(config, sharedBuild), /exceed/);
    assert.throws(() => assertBenchmarkGuard(config, { pid: 123, entry: 'wasm-benchmark.mjs', wasmThreads: 4 }, 123));
    assert.doesNotThrow(() => assertBenchmarkGuard(config, { pid: 123, entry: 'wasm-benchmark.mjs', wasmThreads: 18 }, 123));
  }
  assert.throws(() => wasmBuildContract({ variant: 8, threads: 18 }, { ...build, verifiedThreadCounts: [4] }), /validation/);
  assert.throws(() => parseWasmBenchmarkArguments([...args, '--threads', '19']));
});
