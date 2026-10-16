// Bounded actual-WASM verification with a zero-bound fixture oracle. No PDB
// allocation or read; independent BFS supplies exact shallow distances.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import createModule, { sharedMemoryLayout } from './cube48opt-rust8.mjs';
import { INITIAL_BYTES, WORKER_REGION_BYTES, MAX_THREADS, instantiate } from './cube48opt-rust8-worker.mjs';
import { shallowCorpus, replay } from '../../validate.mjs';

export async function verifySmall(wasmPath, root, { additionalThreadCounts = [] } = {}) {
  const { cube3x3x3 } = await import(pathToFileURL(resolve(root,
    'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')));
  const puzzle = await cube3x3x3.kpuzzle();
  const shallow = shallowCorpus(puzzle).cases.filter(c => c.htm <= 2);
  assert.equal(shallow.length, 262);
  const corpus = JSON.parse(readFileSync(resolve(root, 'solver/testdata/benchmarks/wca-first100.json'), 'utf8'));
  const compiled = await WebAssembly.compile(readFileSync(wasmPath));
  const probe = await createModule({ wasmModule: compiled, variant: 8, instantiateOnly: true });
  const MAX_THREADS = probe.wasmInstance.exports.cubeopt_max_threads();
  assert([4,18].includes(MAX_THREADS));
  const threadCounts = [...new Set([1,2,4,...additionalThreadCounts,MAX_THREADS])];
  assert(threadCounts.every(n => Number.isInteger(n) && n > 0 && n <= MAX_THREADS));
  assert.equal(probe.metadata.threads, 4, 'Default thread count remains four');
  assert.equal(probe.wasmInstance.exports.cubeopt_max_threads(), MAX_THREADS);
  for (const threads of [0, MAX_THREADS + 1, 1.5]) {
    await assert.rejects(createModule({ wasmModule: compiled, threads, instantiateOnly: true }),
      MAX_THREADS === 4 && threads === 5 ? /This WASM supports at most 4 workers/ : /threads must/);
  }
  assert.equal(probe.wasmInstance.exports.cubeopt_fixture_create(0, MAX_THREADS + 1, 8), 0n);
  assert.equal(probe.wasmInstance.exports.cubeopt_fixture_create(MAX_THREADS, MAX_THREADS, 8), 0n);
  await assert.rejects(instantiate(compiled, probe.wasmMemory, INITIAL_BYTES), /Worker region must fit/);
  assert.throws(() => sharedMemoryLayout(INITIAL_BYTES, 16 * 1024 ** 3, MAX_THREADS), /exceed/);
  const layouts = Array.from({ length: 9 }, (_, i) => ({ variant: i + 1,
    ...sharedMemoryLayout(INITIAL_BYTES, Number(probe.wasmInstance.exports.cubeopt_table_bytes(i + 1)), MAX_THREADS) }));
  assert(layouts.every(l => l.requiredBytes <= 16 * 1024 ** 3));
  const batchProbeChecks = probe.wasmInstance.exports.cubeopt_fixture_verify_batch_probes();
  assert.equal(batchProbeChecks, 3072, 'Synthetic batch loads/decode must match scalar for all codes, slots and None masks');
  const cosetBatchEnabled = probe.wasmInstance.exports.cubeopt_fixture_coset_batch_enabled() === 1;
  const rootBoundEnabled = probe.wasmInstance.exports.cubeopt_root_bound_enabled?.() === 1;
  const lazyNormalEnabled = probe.wasmInstance.exports.cubeopt_lazy_normal_enabled?.() === 1;
  const opt9BatchEnabled = probe.wasmInstance.exports.cubeopt_fixture_opt9_batch_enabled?.() === 1;
  const opt9SelectEnabled = probe.wasmInstance.exports.cubeopt_fixture_opt9_select_enabled?.() === 1;
  const opt9SelectProbeChecks = opt9SelectEnabled
    ? probe.wasmInstance.exports.cubeopt_fixture_verify_opt9_select_probes() : 0;
  if (opt9SelectEnabled) assert.equal(opt9SelectProbeChecks,3072,'Select decoder must preserve all codes, slots and sparse masks');
  const paddedStateLayout = probe.wasmInstance.exports.cubeopt_fixture_padded_layout?.() ?? 0;
  assert([0,0x401814].includes(paddedStateLayout), 'Padded state must retain Cube20 / storage24 / Frame64');
  const genericProbeChecks = probe.wasmInstance.exports.cubeopt_fixture_verify_generic_probes();
  assert.equal(genericProbeChecks, 18432, 'Production generic decoder across all variants and codes');
  let deepPrefixes;
  const variants = [];
  for (let variant = 1; variant <= 9; variant++) {
    const snapshot = readFileSync(resolve(root, `.tmp/cubeopt-reverse/opt${variant}-generated/small-memory.bin`));
    for (const threads of threadCounts) {
    const m = await createModule({ wasmModule: compiled, variant, threads, fixture: true, smallTableBytes: snapshot });
    try {
      assert.equal(m.HEAPU8.length, INITIAL_BYTES + threads * WORKER_REGION_BYTES);
      assert(m.HEAPU8.length < 1.25 * 1024 ** 3);
      assert.throws(() => m._get_mem_ptr(), /No pruning allocation/);
      await m.init(0, threads);
      let cancelledSiblings = 0;
      const workerNodes = Array(threads).fill(0);
      for (const c of shallow) {
        const result = await m.solve(c.scramble, { maxDepth: 2 });
        replay(puzzle, c, result);
        assert.equal(result.threads, threads);
        assert.equal(result.completed_depth, result.length === 0 ? null : result.length - 1);
        for (const depth of result.depthResults) {
          assert.deepEqual(depth.map(r => r.worker), Array.from({ length: threads }, (_, i) => i),
            'Every depth must settle exactly once for every shard');
          for (const row of depth) {
            if (cosetBatchEnabled) assert.equal(row.cosetRemoved, 0,
              'A zero-bound fixture cannot supply any backward coset proof');
            else assert.equal(row.cosetRemoved, undefined, 'Existing artifacts retain their output fields');
          }
        }
        for (let d = 0; d < result.length; d++) {
          assert(result.depthResults[d].every(r => r.completed && !r.cancelled && r.solution === null));
        }
        cancelledSiblings += result.depthResults.at(-1).filter(r => r.cancelled).length;
        result.workers.forEach((n,i) => { workerNodes[i] += n; });
      }
      for (const c of [...shallow, ...corpus.cases]) {
        const indices = await m.fixtureCoordinates(c.scramble);
        assert.equal(new Set(indices).size, 1, 'worker coordinate disagreement');
      }
      assert(workerNodes.every(n => n > 262), 'every real worker must visit states');
      if (threads > 1) assert(cancelledSiblings > 0, 'same-depth cancellation was not exercised');
      if (variant === 9 && threads === MAX_THREADS) {
        deepPrefixes = await m.fixtureDeepPrefixes(corpus.cases[0].scramble);
        assert.equal(deepPrefixes.length,21);
        for (const [depth,rows] of deepPrefixes.entries()) {
          assert.deepEqual(rows.map(r=>r.worker),Array.from({length:threads},(_,i)=>i));
          assert(rows.every(r=>r.depth===depth));
          if (depth>=14) assert(rows.reduce((n,r)=>n+r.jobs,0)>0);
        }
      }
      const allocations = await m.allocationStats();
      assert(allocations.every(a => a.highWaterBytes < 8 * 1024 ** 2));
      variants.push({ variant, exactShallowCases: shallow.length, coordinateCases: shallow.length + corpus.cases.length,
        workers: threads, workerNodes, cancelledSiblings, allocations,
        snapshotSha256: createHash('sha256').update(snapshot).digest('hex') });
    } finally { await m.close(); }
    }
  }
  const snapshot = readFileSync(resolve(root,'.tmp/cubeopt-reverse/opt8-generated/small-memory.bin'));
  const failedStartup = await createModule({ wasmModule: compiled, variant:8,threads:4,fixture:true,smallTableBytes:snapshot,
    workerURL:new URL('data:text/javascript,throw%20new%20Error(%22fixture-startup-failure%22)') });
  await assert.rejects(failedStartup.init(0,4), /fixture-startup-failure/);
  await assert.rejects(failedStartup.init(0,4), /closed or failed/);
  await failedStartup.close();
  const failedRequest = await createModule({ wasmModule: compiled,variant:8,threads:4,fixture:true,smallTableBytes:snapshot,
    workerURL:new URL('data:text/javascript,'+encodeURIComponent("import {parentPort} from 'node:worker_threads'; parentPort.on('message',()=>{throw new Error('fixture-request-failure')});parentPort.postMessage({ready:true});")) });
  await failedRequest.init(0,4);
  await assert.rejects(failedRequest.solve('R'), /fixture-request-failure/);
  await assert.rejects(failedRequest.solve('R'), /healthy pool/);
  await failedRequest.close();
  const closedStartup = await createModule({ wasmModule:compiled,variant:8,threads:4,fixture:true,smallTableBytes:snapshot });
  const startupRejected = assert.rejects(closedStartup.init(0,4), /closed/);
  await closedStartup.close();
  await startupRejected;
  await assert.rejects(closedStartup.init(0,4), /closed or failed/);
  const closedRequest = await createModule({ wasmModule:compiled,variant:8,threads:4,fixture:true,smallTableBytes:snapshot });
  await closedRequest.init(0,4);
  const requestRejected = assert.rejects(closedRequest.solve('R U F', {maxDepth:3}), /closed/);
  await Promise.all([closedRequest.close(),closedRequest.close()]);
  await requestRejected;
  await assert.rejects(closedRequest.solve('R'), /healthy pool/);
  return { schema: 'cuberoot.rust-opt-shared-small.v1', node: process.versions.node,
    pdbAllocatedBytes: 0, maxThreads: MAX_THREADS, threadCounts,
    maxThreadLayouts: layouts, batchProbeChecks, batchProbeVariants: [8,9], cosetBatchEnabled, rootBoundEnabled, lazyNormalEnabled, opt9BatchEnabled, opt9SelectEnabled, opt9SelectProbeChecks, paddedStateLayout, genericProbeChecks, deepPrefixes, variants, independentlyVerifiedSolutions: variants.length * shallow.length,
    scalarCoordinateChecks: variants.reduce((n,v)=>n+v.coordinateCases*v.workers,0),
    failedWorkerStartupRejected:true,failedWorkerRequestRejected:true,failedPoolCannotBeReused:true,
    activeStartupCloseSettled:true,activeRequestCloseSettled:true,repeatedCloseSettled:true,
    note: 'Zero-bound fixture search through depth 2; no PDB and no performance claim. Production artifact omits fixture exports.' };
}
