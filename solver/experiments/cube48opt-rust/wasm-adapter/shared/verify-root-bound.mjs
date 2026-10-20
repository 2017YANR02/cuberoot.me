// Actual-WASM start-depth proof check. Only small coordinate snapshots are
// loaded: the fixture supplies an admissible nonzero orientation bound and the
// subsequent search uses the zero oracle. Independent cubing.js BFS supplies
// the exact distance against which every omitted depth is checked.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import createModule, { validateRootBoundProof } from './cube48opt-rust8.mjs';
import { INITIAL_BYTES, WORKER_REGION_BYTES } from './cube48opt-rust8-worker.mjs';
import { shallowCorpus, replay } from '../../validate.mjs';

export async function verifyRootBound(wasmPath, root) {
  const compiled = await WebAssembly.compile(readFileSync(wasmPath));
  const probe = await createModule({ wasmModule: compiled, variant: 8, instantiateOnly: true });
  if (!probe.metadata.rootBoundEnabled) return { enabled: false, pdbAllocatedBytes: 0 };
  const { cube3x3x3 } = await import(pathToFileURL(resolve(root,
    'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')));
  const puzzle = await cube3x3x3.kpuzzle();
  const shallow = shallowCorpus(puzzle).cases.filter(c => c.htm <= 2);
  assert.equal(shallow.length, 262);
  await assert.rejects(createModule({ wasmModule: compiled, fixtureRootBound: true, instantiateOnly: true }), /fixture requires/);
  const variants = [];
  for (const [variant, threads] of [[8, 4], [9, probe.metadata.maxThreads]]) {
    const snapshot = readFileSync(resolve(root, `.tmp/cubeopt-reverse/opt${variant}-generated/small-memory.bin`));
    const m = await createModule({ wasmModule: compiled, variant, threads, fixture: true,
      fixtureRootBound: true, smallTableBytes: snapshot });
    let skippedDepths = 0, skippedCases = 0, cancelledSiblings = 0;
    try {
      assert.equal(m.HEAPU8.length, INITIAL_BYTES + threads * WORKER_REGION_BYTES);
      assert.throws(() => m._get_mem_ptr(), /No pruning allocation/);
      await m.init(0, threads);
      for (const c of shallow) {
        const result = await m.solve(c.scramble, { maxDepth: 2 });
        replay(puzzle, c, result);
        assert.equal(result.rootBoundProof.source, 'fixture-orientation-bound');
        const lower = validateRootBoundProof(result.rootBoundProof, threads, { allowFixture: true });
        assert.equal(result.initialDepth, lower); assert.equal(result.skippedDepths, lower);
        assert(lower <= c.htm, `inadmissible bound for ${c.id}`);
        for (let depth = 0; depth < lower; depth++) assert(depth < c.htm, 'Skipped depth must be impossible by independent BFS');
        assert.equal(result.depthResults.length, c.htm - lower + 1);
        for (const [offset, rows] of result.depthResults.entries()) {
          const depth = lower + offset;
          assert.equal(rows.length, threads);
          assert.deepEqual(rows.map(r => r.worker), Array.from({ length: threads }, (_, i) => i));
          assert(rows.every(r => r.depth === depth), 'No gaps or fabricated empty depths');
          if (depth < c.htm) assert(rows.every(r => r.completed && !r.cancelled && r.solution === null));
        }
        assert.equal(result.completed_depth, c.htm ? c.htm - 1 : null);
        assert.equal(result.probes, result.rootBoundProof.oracleLookups
          + result.depthResults.flat().reduce((sum, r) => sum + r.probes, 0));
        skippedDepths += lower; skippedCases += Number(lower > 0);
        cancelledSiblings += result.depthResults.at(-1).filter(r => r.cancelled).length;
      }
      assert(skippedCases > 0 && skippedDepths >= skippedCases, 'The fixture must exercise genuine nonzero skipping');
      // An impossible caller limit produces no solve result and no fake depth
      // work; a subsequent solved cube must reset the persisted start depth.
      const below = await m.solve('R', { maxDepth: 0 });
      assert.equal(below.solution, null); assert.equal(below.length, null);
      assert(below.initialDepth > 0); assert.equal(below.depthResults.length, 0);
      assert.equal(below.completed_depth, 0); assert.equal(below.nodes, 0);
      await assert.rejects(m.solve('R', { maxNodes: 1 }), /maxNodes=0/);
      const solved = await m.solve('', { maxDepth: 0 });
      assert.equal(solved.initialDepth, 0); assert.equal(solved.length, 0);
      assert.equal(solved.depthResults.length, 1);
      variants.push({ variant, threads, exactShallowCases: shallow.length, skippedCases,
        skippedDepths, cancelledSiblings, belowBoundReturnedUnsolved: true, nextCubeResetVerified: true });
    } finally { await m.close(); }
  }
  return { schema: 'cuberoot.wasm-root-bound-small.v1', enabled: true, pdbAllocatedBytes: 0,
    proofSource: 'fixture-orientation-bound', variants,
    independentlyVerifiedSolutions: variants.reduce((n, v) => n + v.exactShallowCases, 0),
    note: 'Every skipped depth checked against exact shallow BFS; no large table, benchmark or performance claim.' };
}
