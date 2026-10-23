/**
 * Jing Pyraminx / Halpern-Meier Pyramid, exact complete distribution.
 * Physical moves come directly from the existing /sim `t f 0` geometry in
 * cubing.js PuzzleGeometry. Four face centres fix the reference frame; the
 * four face turns and their inverses are the full move alphabet modulo whole
 * rotations. Every +/-120-degree face turn costs one move; no trivial tips.
 *
 * Corners: 4!/2 even permutations * 3^3 sum-zero twists = 324 coordinates.
 * Edges: 6!/2 even permutations * 2^5 even flips = 11,520 coordinates.
 * Product arena: 3,732,480, about 18 MiB including the BFS queue and distances.
 * Closure and maximum distance are computed, not assumed from these bounds.
 * The independent complete histogram is Jaap Scherphuis's original search:
 * https://www.jaapsch.net/puzzles/pyraminx.htm (Jing / H-M Pyramid column).
 */
import { performance } from 'node:perf_hooks';
import { Move } from 'cubing/alg';
import { KPuzzle, type KPattern, type KTransformationData } from 'cubing/kpuzzle';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { PG_PUZZLES } from '../app/[lang]/sim/pgCatalog';
import { completedProductCoordinates, type ProductCheckpointOptions } from './exact-coordinate-checkpoint.mts';
import { assertExact, nextProductCoordinate, orientationRank,
  permutationRank, productCoordinateAllStates, productCoordinateExamples, unrankOrientation, unrankPermutation,
  type ProductCoordinateMoves } from './exact-coordinate-bfs.mts';

const MOVE_COUNT = 8;
const REFERENCE_HISTOGRAM = [1, 8, 48, 288, 1728, 10128, 57780, 305483,
  1239266, 1879631, 237320, 778, 21] as const;
const REFERENCE_URL = 'https://www.jaapsch.net/puzzles/pyraminx.htm';

function parity(permutation: ArrayLike<number>): number {
  let result = 0;
  for (let i = 0; i < permutation.length; i++) {
    for (let j = i + 1; j < permutation.length; j++) result ^= Number(permutation[i] > permutation[j]);
  }
  return result;
}

function buildFactor(orbit: 'CORNERS' | 'EDGES', n: 4 | 6, orientationBase: 2 | 3,
  moves: readonly KTransformationData[]) {
  const fullPermutationCount = n === 4 ? 24 : 720;
  const permutationCount = fullPermutationCount / 2;
  const orientationCount = orientationBase ** (n - 1);
  const count = permutationCount * orientationCount;
  const compactRank = new Int16Array(fullPermutationCount).fill(-1);
  const fullRank = new Uint16Array(permutationCount);
  const pieces = new Uint8Array(n), nextPieces = new Uint8Array(n);
  let evenCount = 0;
  for (let rank = 0; rank < fullPermutationCount; rank++) {
    unrankPermutation(rank, pieces);
    assertExact(permutationRank(pieces) === rank, `${orbit} permutation ranking is not bijective`);
    if (parity(pieces)) continue;
    compactRank[rank] = evenCount;
    fullRank[evenCount++] = rank;
  }
  assertExact(evenCount === permutationCount && compactRank[0] === 0, `${orbit} parity coordinate is invalid`);
  const table = new Uint16Array(count * MOVE_COUNT);
  const orientations = new Uint8Array(n), nextOrientations = new Uint8Array(n);
  for (let permutation = 0; permutation < permutationCount; permutation++) {
    unrankPermutation(fullRank[permutation], pieces);
    for (let orientation = 0; orientation < orientationCount; orientation++) {
      unrankOrientation(orientation, orientationBase, orientations.subarray(0, n - 1));
      let sum = 0;
      for (let i = 0; i < n - 1; i++) sum += orientations[i];
      orientations[n - 1] = (orientationBase - sum % orientationBase) % orientationBase;
      for (let m = 0; m < MOVE_COUNT; m++) {
        const move = moves[m][orbit];
        let nextSum = 0;
        for (let i = 0; i < n; i++) {
          nextPieces[i] = pieces[move.permutation[i]];
          nextOrientations[i] = (orientations[move.permutation[i]] + move.orientationDelta[i]) % orientationBase;
          nextSum += nextOrientations[i];
        }
        const nextPermutation = compactRank[permutationRank(nextPieces)];
        assertExact(nextPermutation >= 0 && nextSum % orientationBase === 0,
          `${orbit} transition violates the independently checked coordinate constraints`);
        table[(permutation * orientationCount + orientation) * MOVE_COUNT + m] = nextPermutation
          * orientationCount + orientationRank(nextOrientations.subarray(0, n - 1), orientationBase);
      }
    }
  }
  const index = (pattern: KPattern): number => {
    const state = pattern.patternData[orbit];
    const permutation = compactRank[permutationRank(state.pieces)];
    const sum = state.orientation.reduce((a, b) => a + b, 0);
    assertExact(permutation >= 0 && sum % orientationBase === 0, `${orbit} pattern violates the factor coordinate`);
    return permutation * orientationCount + orientationRank(state.orientation.slice(0, n - 1), orientationBase);
  };
  return { count, table, index, arrayBytes: table.byteLength + compactRank.byteLength + fullRank.byteLength };
}

function makeModel() {
  const catalog = PG_PUZZLES.find(puzzle => puzzle.id === 'jingpyraminx');
  assertExact(catalog, 'Jing Pyraminx missing from the simulator catalog');
  const pg = getPuzzleGeometryByDesc(catalog.def, {
    allMoves: true, orientCenters: false, addRotations: false,
  });
  const definition = pg.getKPuzzleDefinition(true);
  assertExact(JSON.stringify(definition.orbits) === JSON.stringify([
    { orbitName: 'CORNERS', numPieces: 4, numOrientations: 3 },
    { orbitName: 'EDGES', numPieces: 6, numOrientations: 2 },
    { orbitName: 'CENTERS', numPieces: 4, numOrientations: 1 },
  ]), 'unexpected Jing Pyraminx PG orbits');
  const puzzle = new KPuzzle(definition);
  const bases = Object.entries(definition.moves).filter(([, move]) =>
    move.CENTERS.permutation.every((piece, slot) => piece === slot)
    && move.CENTERS.orientationDelta.every(value => value === 0),
  ).map(([name]) => name);
  assertExact(bases.length === 4, 'expected four fixed-centre Jing face turns');
  const fixedCorners = new Set<number>();
  for (const base of bases) {
    assertExact(puzzle.moveToTransformation(base).repetitionOrder() === 3, 'Jing face turn is not order three');
    const data = definition.moves[base].CORNERS;
    const fixed = data.permutation.map((piece, slot) => piece === slot ? slot : -1).filter(slot => slot >= 0);
    assertExact(fixed.length === 1, 'Jing face turn does not cycle exactly three corners');
    fixedCorners.add(fixed[0]);
  }
  assertExact(fixedCorners.size === 4, 'Jing generators do not cover four faces');
  const moveNames = bases.flatMap(name => [name, `${name}'`]);
  const externalMoveNames = moveNames.map(name => {
    const move = pg.notationMapper.notationToExternal(new Move(name));
    assertExact(move, `unmapped Jing download move ${name}`);
    return move.toString();
  });
  const transformations = moveNames.map(name => puzzle.moveToTransformation(name).transformationData);
  const corners = buildFactor('CORNERS', 4, 3, transformations);
  const edges = buildFactor('EDGES', 6, 2, transformations);
  assertExact(corners.count === 324 && edges.count === 11520, 'unexpected Jing factor bounds');
  const product: ProductCoordinateMoves = {
    firstCount: edges.count, secondCount: corners.count, moveCount: MOVE_COUNT,
    firstMoves: edges.table, secondMoves: corners.table,
  };
  const index = (pattern: KPattern): number => {
    assertExact(pattern.patternData.CENTERS.pieces.every((piece, slot) => piece === slot), 'Jing reference frame changed');
    return edges.index(pattern) * corners.count + corners.index(pattern);
  };
  const solved = puzzle.defaultPattern();
  assertExact(index(solved) === 0, 'Jing default pattern is not coordinate zero');
  return { product, puzzle, solved, moveNames, externalMoveNames, index, description: catalog.def,
    arrayBytes: corners.arrayBytes + edges.arrayBytes };
}

/** KPuzzle executes each probe without using any handwritten factor tables. */
function verifyTransitions(model: ReturnType<typeof makeModel>): number {
  let pattern = model.solved;
  let state = 0, checked = 0, seed = 0x78253916;
  for (let step = 0; step < 512; step++) {
    for (let move = 0; move < MOVE_COUNT; move++) {
      const next = nextProductCoordinate(model.product, state, move);
      assertExact(next === model.index(pattern.applyMove(model.moveNames[move])),
        `Jing coordinate/library mismatch at ${step}/${move}`);
      assertExact(nextProductCoordinate(model.product, next, move ^ 1) === state, 'Jing inverse transition mismatch');
      checked++;
    }
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const move = (seed >>> 16) % MOVE_COUNT;
    pattern = pattern.applyMove(model.moveNames[move]);
    state = nextProductCoordinate(model.product, state, move);
  }
  return checked;
}

/** Explicit invocation only: importing the module never starts enumeration. */
export async function enumerateJingPyraminx(options: ProductCheckpointOptions = {}) {
  const preparationStart = performance.now();
  const model = makeModel();
  const preparationMs = performance.now() - preparationStart;
  const verifyStart = performance.now();
  const independentTransitionChecks = verifyTransitions(model);
  let verificationMs = performance.now() - verifyStart;
  const graphStart = performance.now();
  const graph = completedProductCoordinates(model.product, options);
  const graphMs = preparationMs + performance.now() - graphStart;
  const exampleStart = performance.now();
  const examples = productCoordinateExamples(model.product, model.moveNames, graph, move => move ^ 1);
  const examplesMs = performance.now() - exampleStart;
  const finalVerifyStart = performance.now();
  const { histogram } = graph;
  assertExact(histogram.length === REFERENCE_HISTOGRAM.length
    && histogram.every((count, depth) => count === REFERENCE_HISTOGRAM[depth]),
  'computed Jing closure differs from Jaap Scherphuis independent complete distribution');
  const replayed = new Set<number>();
  for (const example of examples) {
    const state = model.solved.applyAlg(example.scramble);
    const index = model.index(state);
    assertExact(graph.distance[index] === example.distance, 'Jing library replay misses its distance bin');
    assertExact(!replayed.has(index), 'Jing examples contain a duplicate state');
    replayed.add(index);
    assertExact(state.applyAlg(example.solution).isIdentical(model.solved), 'Jing library replay does not solve example');
  }
  verificationMs += performance.now() - finalVerifyStart;
  return {
    id: 'jingpyraminx', label: 'Jing Pyraminx / 晶氏金字塔',
    metric: 'fixed face-centre frame; each +/-120-degree face turn = 1; no tips; whole rotations ignored',
    stateCount: graph.total, total: graph.total, godsNumber: histogram.length - 1, histogram, examples,
    allStates: productCoordinateAllStates(model.product, model.externalMoveNames, graph, move => move ^ 1),
    examplesLimitPerDepth: 12, deepestExamplesComplete: histogram.at(-1)! <= 256,
    estimatedArrayBytes: model.arrayBytes + graph.arrayBytes,
    denseCoordinateUpperBound: model.product.firstCount * model.product.secondCount,
    timingMs: { graph: graphMs, examples: examplesMs, solve: 0, verification: verificationMs },
    verification: {
      closed: true, directedEdgesChecked: graph.edgeChecks,
      allEdgesDistanceDifferenceAtMostOne: true, allNonRootStatesHaveDescendingEdge: true,
      independentTransitionChecks, independentlyReplayedExamples: examples.length,
      referenceHistogramMatches: true, referenceHistogramSource: `${REFERENCE_URL} (Jing / H-M Pyramid)`,
      geometrySource: `sim/pgCatalog.ts jingpyraminx: ${model.description}; cubing.js PuzzleGeometry`,
      moveNames: model.moveNames, scope: 'full reachable Jing Pyraminx; fixed face-centre frame; no sampling',
    },
  };
}
