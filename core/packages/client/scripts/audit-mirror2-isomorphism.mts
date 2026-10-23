/** Geometry isomorphism certificate only: no BFS or distance table. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { mirrorTables } from '@cuberoot/puzzle-render-core/engine/mirror/mirrorGeometry';
import { puzzles } from 'cubing/puzzles';

export async function auditMirror2Isomorphism() {
  const start = performance.now();
  const geometryPath = fileURLToPath(import.meta.resolve('@cuberoot/puzzle-render-core/engine/mirror/mirrorGeometry'));
  const worldPath = fileURLToPath(import.meta.resolve('@cuberoot/puzzle-render-core/engine/world'));
  const [geometrySource, worldSource] = await Promise.all([readFile(geometryPath, 'utf8'), readFile(worldPath, 'utf8')]);
  assert.match(worldSource, /const n = kind === 'mirror2' \? 2 : 3/);
  assert.match(worldSource, /new Cube\(n, true\)/);
  const tables = mirrorTables(2);
  const shapes = Array.from({ length: 8 }, (_, piece) => {
    const dimensions = tables.scale(piece);
    assert.equal(new Set(dimensions).size, 3, `Piece ${piece} has an invisible axis exchange`);
    return { piece, dimensions, unorderedSignature: [...dimensions].sort((a, b) => a - b).join('/'),
      cornerTwistSignatures: [0, 1, 2].map(shift => [...dimensions.slice(shift), ...dimensions.slice(0, shift)].join('/')) };
  });
  assert.equal(new Set(shapes.map(shape => shape.unorderedSignature)).size, 8, 'Geometrically indistinguishable pieces');
  assert.equal(new Set(shapes.flatMap(shape => shape.cornerTwistSignatures)).size, 24, 'Invisible corner twist');
  const puzzle = await puzzles['2x2x2'].kpuzzle();
  assert.deepEqual(puzzle.definition.orbits, [{ orbitName: 'CORNERS', numPieces: 8, numOrientations: 3 }]);
  const generators = ['U', 'R', 'F'].flatMap(face => [face, `${face}2`, `${face}'`]);
  const solved = puzzle.defaultPattern();
  let checks = 0, seed = 0x3928471, state = solved;
  const signature = (pattern: typeof solved) => pattern.patternData.CORNERS.pieces.map((piece, slot) =>
    `${piece}:${shapes[piece].cornerTwistSignatures[pattern.patternData.CORNERS.orientation[slot]]}`).join('|');
  for (let i = 0; i < 64; i++) {
    for (const move of generators) {
      const inverse = move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : `${move}'`;
      const next = state.applyMove(move);
      assert.equal(signature(next.applyMove(inverse)), signature(state));
      checks++;
    }
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    state = state.applyMove(generators[(seed >>> 16) % generators.length]);
  }
  return {
    event: 'mirror2', completed: true, certificateType: 'faithful-visible-shape-isomorphism',
    equivalentTo: '222', stateCount: 3674160, noStateEnumeration: true, noDistanceTable: true,
    geometry: { shapes, pivot: tables.pivot(), allEightPiecesDistinguishable: true,
      allThreeCornerTwistsDistinguishable: true },
    moveGraph: { sameLogicalNxNEngine: true, generators, independentlyCheckedInverseReplays: checks,
      metrics: { htm: 'U/R/F quarter, half and inverse turns each cost 1', qtm: 'quarter/inverse turns cost 1; half turns cost 2' } },
    proof: 'The renderer uses the same Cube(2) mechanism. All eight unordered dimension triples are distinct, so shape identifies every corner piece. Each piece has three distinct axis dimensions, so all three corner-twist states are visible. Shape adds no invisible identification and removes no legal move. Ignoring whole rotations therefore gives the same 7!*3^6 state graph as a standard 2x2 under both HTM and QTM. Exact histograms and optimal witnesses transfer without recomputation.',
    scope: 'Project mirror2 geometry; shape goal, whole-puzzle rotations ignored. This does not cover mirror models with repeated dimensions or indistinguishable pieces.',
    source: [geometryPath, worldPath].map((path, i) => ({ path,
      sha256: createHash('sha256').update(i ? worldSource : geometrySource).digest('hex') })),
    elapsedMs: performance.now() - start, maxRssBytes: process.resourceUsage().maxRSS * 1024,
    generatedAt: new Date().toISOString(),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = resolve(process.argv[2] ?? '../../../.local/small-puzzle-distributions-20261023/candidate-audit/mirror2-isomorphism.json');
  const report = await auditMirror2Isomorphism();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, stateCount: report.stateCount, checks: report.moveGraph.independentlyCheckedInverseReplays,
    elapsedMs: report.elapsedMs, maxRssBytes: report.maxRssBytes }));
}
