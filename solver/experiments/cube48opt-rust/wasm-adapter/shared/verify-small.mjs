// Bounded actual-WASM verification with a zero-bound fixture oracle. No PDB
// allocation or read; independent BFS supplies exact shallow distances.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import createModule from './cube48opt-rust8.mjs';
import { shallowCorpus, replay } from '../../validate.mjs';

export async function verifySmall(wasmPath, root) {
  const { cube3x3x3 } = await import(pathToFileURL(resolve(root,
    'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')));
  const puzzle = await cube3x3x3.kpuzzle();
  const shallow = shallowCorpus(puzzle).cases.filter(c => c.htm <= 2);
  assert.equal(shallow.length, 262);
  const corpus = JSON.parse(readFileSync(resolve(root, 'solver/testdata/benchmarks/wca-first100.json'), 'utf8'));
  const compiled = await WebAssembly.compile(readFileSync(wasmPath));
  const probe = await createModule({ wasmModule: compiled, variant: 8, threads: 1, instantiateOnly: true });
  const batchProbeChecks = probe.wasmInstance.exports.cubeopt_fixture_verify_batch_probes();
  assert.equal(batchProbeChecks, 3072, 'Synthetic batch loads/decode must match scalar for all codes, slots and None masks');
  const variants = [];
  for (let variant = 1; variant <= 9; variant++) {
    const snapshot = readFileSync(resolve(root, `.tmp/cubeopt-reverse/opt${variant}-generated/small-memory.bin`));
    for (const threads of [1,2,4]) {
    const m = await createModule({ wasmModule: compiled, variant, threads, fixture: true, smallTableBytes: snapshot });
    try {
      assert(m.HEAPU8.length < 300 * 1024 ** 2);
      assert.throws(() => m._get_mem_ptr(), /No pruning allocation/);
      await m.init(0, threads);
      let cancelledSiblings = 0;
      const workerNodes = Array(threads).fill(0);
      for (const c of shallow) {
        const result = await m.solve(c.scramble, { maxDepth: 2 });
        replay(puzzle, c, result);
        assert.equal(result.threads, threads);
        assert.equal(result.completed_depth, result.length === 0 ? null : result.length - 1);
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
    pdbAllocatedBytes: 0, batchProbeChecks, variants, independentlyVerifiedSolutions: variants.length * shallow.length,
    scalarCoordinateChecks: variants.reduce((n,v)=>n+v.coordinateCases*v.workers,0),
    failedWorkerStartupRejected:true,failedWorkerRequestRejected:true,failedPoolCannotBeReused:true,
    activeStartupCloseSettled:true,activeRequestCloseSettled:true,repeatedCloseSettled:true,
    note: 'Zero-bound fixture search through depth 2; no PDB and no performance claim. Production artifact omits fixture exports.' };
}
