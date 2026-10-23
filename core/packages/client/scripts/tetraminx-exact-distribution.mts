/**
 * Exact Tetraminx distribution for the existing /sim geometry.
 * Geometry and primitive transformations: cubing.js PuzzleGeometry, through
 * the repository's PG_PUZZLES catalog (t v 1/3). This is the complete tipless
 * puzzle in a fixed vertex frame: four vertex turns, +/-120 degrees each cost
 * one move. Opposite wide turns differ by a whole-puzzle rotation; rotations
 * are frame changes, not additional counted moves or additional states.
 *
 * This implementation only enumerates on an explicit enumerateTetraminx()
 * call. A fixed 3,732,480-coordinate arena bounds allocation before searching;
 * no full-state object/string Map, recursive search, download or large table.
 * The reachable closure and diameter are measured, never inferred from the
 * larger PG group that also includes changes of the vertex frame.
 */
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Move } from 'cubing/alg';
import { KPuzzle, type KPattern } from 'cubing/kpuzzle';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { PG_PUZZLES } from '../app/[lang]/sim/pgCatalog';
import { completedProductCoordinates, type ProductCheckpointOptions } from './exact-coordinate-checkpoint.mts';
import { orientationRank, permutationRank, productCoordinateAllStates, productCoordinateExamples,
  unrankOrientation, unrankPermutation, type ExactDistributionExample } from './exact-coordinate-bfs.mts';

const PERMUTATIONS = 720;
const EDGE_ORIENTATIONS = 64;
const CORNER_ORIENTATIONS = 81;
const EDGE_COORDINATES = PERMUTATIONS * EDGE_ORIENTATIONS;
const DENSE_COORDINATES = EDGE_COORDINATES * CORNER_ORIENTATIONS;
const MOVE_COUNT = 8;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`tetraminx: ${message}`);
}

function patternIndex(pattern: KPattern): number {
  const { EDGES: edges, CORNERS: corners } = pattern.patternData;
  assert(corners.pieces.every((piece, slot) => piece === slot), 'vertex frame changed');
  return (permutationRank(edges.pieces) * EDGE_ORIENTATIONS
    + orientationRank(edges.orientation, 2)) * CORNER_ORIENTATIONS
    + orientationRank(corners.orientation, 3);
}

function makeModel() {
  const catalog = PG_PUZZLES.find(puzzle => puzzle.id === 'tetraminx');
  assert(catalog, 'Tetraminx missing from the simulator catalog');
  const pg = getPuzzleGeometryByDesc(catalog.def, {
    allMoves: true, orientCenters: false, addRotations: false,
  });
  const definition = pg.getKPuzzleDefinition(true);
  const expectedOrbits = [{ orbitName: 'EDGES', numPieces: 6, numOrientations: 2 },
    { orbitName: 'CORNERS', numPieces: 4, numOrientations: 3 }];
  assert(JSON.stringify(definition.orbits) === JSON.stringify(expectedOrbits), 'unexpected PG orbit model');
  const puzzle = new KPuzzle(definition);
  // Select physical vertex turns by their action, not a hand-copied name list:
  // each fixes all four axial positions and twists exactly one axial piece.
  const bases = Object.entries(definition.moves).filter(([, data]) => {
    const corners = data.CORNERS;
    return corners.permutation.every((piece, slot) => piece === slot)
      && corners.orientationDelta.filter(value => value !== 0).length === 1;
  }).map(([name]) => name);
  assert(bases.length === 4, 'expected four fixed-frame vertex generators');
  const twistedVertices = new Set<number>();
  for (const name of bases) {
    const transformation = puzzle.moveToTransformation(name);
    assert(transformation.repetitionOrder() === 3, `${name} is not a 120-degree vertex turn`);
    twistedVertices.add(definition.moves[name].CORNERS.orientationDelta.findIndex(value => value !== 0));
  }
  assert(twistedVertices.size === 4, 'generators do not cover all four vertices');
  const moveNames = bases.flatMap(name => [name, `${name}'`]);
  const externalMoveNames = moveNames.map(name => {
    const move = pg.notationMapper.notationToExternal(new Move(name));
    assert(move, `unmapped download move ${name}`);
    return move.toString();
  });
  const moves = moveNames.map(name => puzzle.moveToTransformation(name).transformationData);
  const permutationMoves = new Uint16Array(PERMUTATIONS * MOVE_COUNT);
  const orientationMoves = new Uint8Array(EDGE_ORIENTATIONS * MOVE_COUNT);
  const cornerMoves = new Uint8Array(CORNER_ORIENTATIONS * MOVE_COUNT);
  const pieces = new Uint8Array(6), transformedPieces = new Uint8Array(6);
  for (let rank = 0; rank < PERMUTATIONS; rank++) {
    unrankPermutation(rank, pieces);
    assert(permutationRank(pieces) === rank, 'permutation ranking is not bijective');
    for (let m = 0; m < MOVE_COUNT; m++) {
      for (let i = 0; i < 6; i++) transformedPieces[i] = pieces[moves[m].EDGES.permutation[i]];
      permutationMoves[rank * MOVE_COUNT + m] = permutationRank(transformedPieces);
    }
  }
  function buildOrientationMoves(orbit: 'EDGES' | 'CORNERS', base: number, count: number,
    table: Uint8Array): void {
    const size = orbit === 'EDGES' ? 6 : 4;
    const original = new Uint8Array(size), transformed = new Uint8Array(size);
    for (let rank = 0; rank < count; rank++) {
      unrankOrientation(rank, base, original);
      for (let m = 0; m < MOVE_COUNT; m++) {
        const move = moves[m][orbit];
        for (let i = 0; i < size; i++) {
          transformed[i] = (original[move.permutation[i]] + move.orientationDelta[i]) % base;
        }
        table[rank * MOVE_COUNT + m] = orientationRank(transformed, base);
      }
    }
  }
  buildOrientationMoves('EDGES', 2, EDGE_ORIENTATIONS, orientationMoves);
  buildOrientationMoves('CORNERS', 3, CORNER_ORIENTATIONS, cornerMoves);
  // Folding edge permutation + orientation saves one division per BFS edge.
  const edgeMoves = new Uint16Array(EDGE_COORDINATES * MOVE_COUNT);
  for (let edge = 0; edge < EDGE_COORDINATES; edge++) {
    const permutation = Math.floor(edge / EDGE_ORIENTATIONS);
    const orientation = edge % EDGE_ORIENTATIONS;
    for (let m = 0; m < MOVE_COUNT; m++) {
      edgeMoves[edge * MOVE_COUNT + m] = permutationMoves[permutation * MOVE_COUNT + m]
        * EDGE_ORIENTATIONS + orientationMoves[orientation * MOVE_COUNT + m];
    }
  }
  const next = (index: number, move: number): number => edgeMoves[Math.floor(index / CORNER_ORIENTATIONS)
    * MOVE_COUNT + move] * CORNER_ORIENTATIONS
    + cornerMoves[(index % CORNER_ORIENTATIONS) * MOVE_COUNT + move];
  const solved = puzzle.defaultPattern();
  assert(patternIndex(solved) === 0, 'default pattern is not coordinate zero');
  return { puzzle, moveNames, externalMoveNames, moves, edgeMoves, cornerMoves, next, solved,
    description: catalog.def,
    arrayBytes: permutationMoves.byteLength + orientationMoves.byteLength + cornerMoves.byteLength
      + edgeMoves.byteLength };
}

/** Independent library execution checks the handwritten coordinate transition. */
function verifyTransitions(model: ReturnType<typeof makeModel>): number {
  let pattern = model.solved;
  let index = 0, checked = 0, seed = 0x17392648;
  for (let step = 0; step < 256; step++) {
    for (let m = 0; m < MOVE_COUNT; m++) {
      const expected = patternIndex(pattern.applyMove(model.moveNames[m]));
      assert(model.next(index, m) === expected, `coordinate/library mismatch at probe ${step}/${m}`);
      assert(model.next(model.next(index, m), m ^ 1) === index, 'inverse transition mismatch');
      checked++;
    }
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const move = (seed >>> 16) % MOVE_COUNT;
    pattern = pattern.applyMove(model.moveNames[move]);
    index = model.next(index, move);
  }
  return checked;
}

/** Read the existing independently derived Rust solver fixture; do not run it. */
async function referenceHistogram(): Promise<number[]> {
  const source = await readFile(new URL('../../../../solver/src/pyraminx_solver.rs', import.meta.url), 'utf8');
  const match = source.match(/const JAAPSCH_CORE_HIST:\s*\[usize;\s*12\]\s*=\s*\[([^\]]+)\]/);
  assert(match, 'independent Pyraminx core fixture is missing');
  const histogram = match[1].split(',').map(value => value.trim()).filter(Boolean)
    .map(value => Number(value.replaceAll('_', '')));
  assert(histogram.length === 12 && histogram.every(Number.isSafeInteger), 'invalid reference fixture');
  return histogram;
}

export type TetraminxDistributionExample = ExactDistributionExample;

export async function enumerateTetraminx(options: ProductCheckpointOptions = {}) {
  const preparationStart = performance.now();
  const model = makeModel();
  const preparationMs = performance.now() - preparationStart;
  const verifyStart = performance.now();
  const independentTransitionChecks = verifyTransitions(model);
  const expectedHistogram = await referenceHistogram();
  let verificationMs = performance.now() - verifyStart;

  const graphStart = performance.now();
  const product = { firstCount: EDGE_COORDINATES, secondCount: CORNER_ORIENTATIONS,
    moveCount: MOVE_COUNT, firstMoves: model.edgeMoves, secondMoves: model.cornerMoves };
  const graph = completedProductCoordinates(product, options);
  const { histogram, total: tail, edgeChecks } = graph;
  const graphMs = preparationMs + performance.now() - graphStart;

  const examplesStart = performance.now();
  const examples = productCoordinateExamples(product, model.moveNames, graph, move => move ^ 1);
  const examplesMs = performance.now() - examplesStart;

  const finalVerifyStart = performance.now();
  assert(histogram.length === expectedHistogram.length
    && histogram.every((count, depth) => count === expectedHistogram[depth]),
  'PG Tetraminx closure differs from the independent Pyraminx core distribution');
  for (const example of examples) {
    const state = model.solved.applyAlg(example.scramble);
    assert(graph.distance[patternIndex(state)] === example.distance, 'library replay misses the sample depth');
    assert(state.applyAlg(example.solution).isIdentical(model.solved), 'library replay does not solve the sample');
  }
  verificationMs += performance.now() - finalVerifyStart;
  return {
    id: 'tetraminx', label: 'Tetraminx / 截顶金字塔',
    metric: 'fixed vertex frame; each +/-120-degree vertex turn = 1; no tips; whole rotations ignored',
    stateCount: tail, total: tail, godsNumber: histogram.length - 1, histogram, examples,
    allStates: productCoordinateAllStates(product, model.externalMoveNames, graph, move => move ^ 1),
    examplesLimitPerDepth: 12, deepestExamplesComplete: histogram.at(-1)! <= 256,
    estimatedArrayBytes: model.arrayBytes + graph.arrayBytes,
    denseCoordinateUpperBound: DENSE_COORDINATES,
    timingMs: { graph: graphMs, examples: examplesMs, solve: 0, verification: verificationMs },
    verification: {
      closed: true, directedEdgesChecked: edgeChecks,
      allEdgesDistanceDifferenceAtMostOne: true, allNonRootStatesHaveDescendingEdge: true,
      independentTransitionChecks, independentlyReplayedExamples: examples.length,
      referenceHistogramMatches: true,
      referenceHistogramSource: 'solver/src/pyraminx_solver.rs: JAAPSCH_CORE_HIST (tipless Pyraminx core)',
      geometrySource: `sim/pgCatalog.ts tetraminx: ${model.description}; cubing.js PuzzleGeometry`,
      moveNames: model.moveNames,
      scope: 'full reachable tipless puzzle; fixed vertex frame; no sampling',
    },
  };
}
