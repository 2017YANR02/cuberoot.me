import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { cleanRunEnvironment, validatePreparedRequest, validateWasmSummary } from './run-multithread.mts';
import { multithreadPaths } from './multithread-policy.mts';
import { readWca100 } from './wasm-benchmark.mjs';

test('clears inherited computation/profiler controls and only accepts prepared control keys', () => {
  assert.deepEqual(cleanRunEnvironment({ CUBEOPT_SEARCH_THREADS: '18', CUBEOPT_SOLVE_THREADS: '1' },
    { PATH: '/fixture', CUBEOPT_SEARCH_THREADS: '4', CUBEOPT_OPT10_REVIEW: '/old', NODE_OPTIONS: '--prof', NODE_PATH: '/old' }),
    { PATH: '/fixture', CUBEOPT_SEARCH_THREADS: '18', CUBEOPT_SOLVE_THREADS: '1' });
  assert.throws(() => cleanRunEnvironment({ NODE_OPTIONS: '--prof' }, {}));
  assert.throws(() => cleanRunEnvironment({ CUBEOPT_RESOURCE_REVIEW: '/old' }, {}));
});

test('only accepts a bound request for the dedicated guard protocol; does not spawn', () => {
  const base = dirname(multithreadPaths.input), reviewPath = resolve(base, 'fixture/launch.json');
  const review = { schema: 'cuberoot.multithread-wca100-review.v1', scope: 'mac18-wca100-single',
    label: 'wca100-mt18-fixture', executable: multithreadPaths.native,
    args: ['solve', resolve(base, 'opt1-generated/small-memory.bin'), resolve(base, 'opt1-generated/h48prun01.dat'), '8', '20', '0'],
    threads: 18, batchThreads: 1, cases: 100, measuredPasses: 1, warmupCases: 0 };
  const bytes = Buffer.from(JSON.stringify(review));
  const request = { schema: 'cuberoot.multithread-wca100-request.v1', reviewPath,
    reviewSha256: createHash('sha256').update(bytes).digest('hex'), label: review.label,
    executable: review.executable, args: [...review.args], env: { CUBEOPT_MULTITHREAD_REVIEW: reviewPath,
      CUBEOPT_BACKEND: 'opt', CUBEOPT_VARIANT: '1', CUBEOPT_SEARCH_THREADS: '18', CUBEOPT_SOLVE_THREADS: '1', CUBEOPT_MEASURE_RSS: '1' } };
  assert.equal(validatePreparedRequest(request, review, bytes, 18).entry, 'native');
  assert.throws(() => validatePreparedRequest(request, review, bytes, 4));
  for (const change of [(r: any) => { r.reviewSha256 = '0'.repeat(64); }, (r: any) => { r.executable = '/bin/sh'; },
    (r: any) => { r.env.CUBEOPT_SEARCH_THREADS = '4'; }, (r: any) => { r.env.CUBEOPT_SOLVE_THREADS = '18'; },
    (r: any) => { r.args.push('--anything'); }]) {
    const copy = structuredClone(request); change(copy); assert.throws(() => validatePreparedRequest(copy, review, bytes, 18));
  }
});

test('WASM compact protocol rejects old/server/single-engine/warmup results', () => {
  const corpus = readWca100();
  const shared = { variant: 8, threads: 18, measuredPasses: 1, warmupCases: 0,
    corpusSha256: corpus.corpusSha256, machine: { platform: 'darwin', arch: 'arm64' }, tableSha256: 'fixture' };
  const input = { ...shared, schema: 'cuberoot.rust-opt-wasm-benchmark-input.v2', engine: 'both',
    cases: corpus.cases.map((c: any) => ({ ...c, htm: 18 })) };
  const report = { ...shared, schema: 'cuberoot.rust-opt-wasm-benchmark-report.v2', cases: 100,
    sameSolveThreadCount: true, engines: { rust: {}, original: {} } };
  validateWasmSummary(report, input, 8, corpus);
  for (const change of [(r: any) => { r.threads = 4; }, (r: any) => { r.machine.platform = 'linux'; },
    (r: any) => { r.warmupCases = 100; }, (r: any) => { delete r.engines.original; }]) {
    const copy = structuredClone(report); change(copy); assert.throws(() => validateWasmSummary(copy, input, 8, corpus));
  }
});
