/**
 * The shape-changing physical Pyramorphix, not PG's `t e 0` half-turn subgroup.
 * Its eight pieces are a 2x2x2 cube with one tetrad flattened: UFL, UBR, DFR,
 * DBL are the four visible three-colour corners; the other four pieces have
 * one colour and no observable twist. Fixing DBL position AND twist removes
 * whole-puzzle rotations. The remaining coordinate is 7! * 3^3 = 136,080.
 *
 * Jaap explicitly describes this DBL / U,R,F frame and both exact histograms:
 * https://www.jaapsch.net/puzzles/pyramorf.htm
 * Source transitions use the project's public Kociemba model. Independent
 * replay uses cubing.js's 2x2 KPuzzle, projected to visible Pyramorphix state.
 * Hidden flat-piece orientations must NOT be required to return to zero.
 */
import { performance } from 'node:perf_hooks';
import { ALL_MOVES, MOVE_NAMES } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { KPattern, type KPuzzle } from 'cubing/kpuzzle';
import { puzzles } from 'cubing/puzzles';
import { completedProductCoordinates, type ProductCheckpointOptions } from './exact-coordinate-checkpoint.mts';
import { assertExact, nextProductCoordinate,
  orientationRank, permutationRank, productCoordinateAllStates, productCoordinateExamples,
  unrankOrientation, unrankPermutation, type ProductCoordinateMoves } from './exact-coordinate-bfs.mts';

const FREE_SLOTS = [0, 1, 2, 3, 4, 5, 7] as const;
const VISIBLE_PIECES = [1, 3, 4] as const;
const FLAT_PIECES = [0, 2, 5, 7] as const;
// cubing.js orders top corners URF, UBR, ULB, UFL; Kociemba uses URF,UFL,ULB,UBR.
const KOCIEMBA_TO_KPUZZLE = [0, 3, 2, 1, 4, 5, 6, 7] as const;
const PERMUTATIONS = 5040, ORIENTATIONS = 27, STATES = PERMUTATIONS * ORIENTATIONS;
const REFERENCE_URL = 'https://www.jaapsch.net/puzzles/pyramorf.htm';
const METRICS = {
  HTM: {
    id: 'pyramorphix', moveIds: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    histogram: [1, 9, 54, 321, 1835, 9716, 39536, 68424, 16120, 64],
    description: 'HTM: each quarter or half face turn = 1',
  },
  QTM: {
    id: 'pyramorphix-qtm', moveIds: [0, 2, 3, 5, 6, 8],
    histogram: [1, 6, 27, 120, 534, 2256, 8633, 26174, 48585, 39312, 10260, 172],
    description: 'QTM: each quarter face turn = 1; half turn = 2',
  },
} as const;
type Metric = keyof typeof METRICS;

export function pyramorphixVisibleCoordinate(pattern: KPattern): number {
  const { pieces, orientation } = pattern.patternData.CORNERS;
  const permutation = new Uint8Array(7), twists = new Uint8Array(3);
  assertExact(pieces[6] === 6 && orientation[6] === 0, 'Pyramorphix DBL reference corner changed');
  for (let i = 0; i < FREE_SLOTS.length; i++) {
    const kpSlot = KOCIEMBA_TO_KPUZZLE[FREE_SLOTS[i]];
    const piece = KOCIEMBA_TO_KPUZZLE[pieces[kpSlot]];
    permutation[i] = piece === 7 ? 6 : piece;
    for (let corner = 0; corner < VISIBLE_PIECES.length; corner++) {
      if (piece === VISIBLE_PIECES[corner]) twists[corner] = orientation[kpSlot];
    }
  }
  return permutationRank(permutation) * ORIENTATIONS + orientationRank(twists, 3);
}

function verifyMoveConvention(puzzle: KPuzzle, moveIds: readonly number[]): void {
  assertExact(JSON.stringify(puzzle.definition.orbits) === JSON.stringify([
    { orbitName: 'CORNERS', numPieces: 8, numOrientations: 3 },
  ]), 'unexpected independent 2x2 KPuzzle orbit');
  for (const id of moveIds) {
    const project = ALL_MOVES[id];
    const library = puzzle.moveToTransformation(MOVE_NAMES[id]).transformationData.CORNERS;
    for (let slot = 0; slot < 8; slot++) {
      const librarySlot = KOCIEMBA_TO_KPUZZLE[slot];
      assertExact(library.permutation[librarySlot] === KOCIEMBA_TO_KPUZZLE[project.cp[slot]]
        && library.orientationDelta[librarySlot] === project.co[slot],
      `project/cubing 2x2 corner convention mismatch at ${MOVE_NAMES[id]}/${slot}`);
    }
  }
}

async function makeModel(metric: Metric) {
  const definition = METRICS[metric];
  const moveIds: readonly number[] = definition.moveIds;
  const moveCount = moveIds.length;
  const puzzle = await puzzles['2x2x2'].kpuzzle();
  verifyMoveConvention(puzzle, moveIds);
  const permutationMoves = new Uint16Array(PERMUTATIONS * moveCount);
  const twistDeltas = new Uint8Array(PERMUTATIONS * moveCount);
  const twistAddition = new Uint8Array(ORIENTATIONS * ORIENTATIONS);
  const permutation = new Uint8Array(7), nextPermutation = new Uint8Array(7);
  const pieces = new Uint8Array(8), deltas = new Uint8Array(3);
  for (let rank = 0; rank < PERMUTATIONS; rank++) {
    unrankPermutation(rank, permutation);
    assertExact(permutationRank(permutation) === rank, 'Pyramorphix permutation rank is not bijective');
    for (let slot = 0; slot < FREE_SLOTS.length; slot++) {
      pieces[FREE_SLOTS[slot]] = FREE_SLOTS[permutation[slot]];
    }
    pieces[6] = 6;
    for (let m = 0; m < moveCount; m++) {
      const move = ALL_MOVES[moveIds[m]];
      assertExact(move.cp[6] === 6 && move.co[6] === 0, 'Pyramorphix generator moves the DBL anchor');
      deltas.fill(0);
      for (let slot = 0; slot < FREE_SLOTS.length; slot++) {
        const destination = FREE_SLOTS[slot];
        const piece = pieces[move.cp[destination]];
        nextPermutation[slot] = piece === 7 ? 6 : piece;
        for (let corner = 0; corner < VISIBLE_PIECES.length; corner++) {
          if (piece === VISIBLE_PIECES[corner]) deltas[corner] = move.co[destination];
        }
      }
      permutationMoves[rank * moveCount + m] = permutationRank(nextPermutation);
      twistDeltas[rank * moveCount + m] = orientationRank(deltas, 3);
    }
  }
  const first = new Uint8Array(3), second = new Uint8Array(3), sum = new Uint8Array(3);
  for (let a = 0; a < ORIENTATIONS; a++) {
    unrankOrientation(a, 3, first);
    for (let b = 0; b < ORIENTATIONS; b++) {
      unrankOrientation(b, 3, second);
      for (let c = 0; c < 3; c++) sum[c] = (first[c] + second[c]) % 3;
      twistAddition[a * ORIENTATIONS + b] = orientationRank(sum, 3);
    }
  }
  // Expanding this very small coupled coordinate keeps the BFS shared and hot
  // loop simple: <4.7 MiB HTM table, <0.65 MiB queue + distance, no state Map.
  const moves = new Uint32Array(STATES * moveCount);
  for (let permutation = 0; permutation < PERMUTATIONS; permutation++) {
    for (let orientation = 0; orientation < ORIENTATIONS; orientation++) {
      const index = permutation * ORIENTATIONS + orientation;
      for (let move = 0; move < moveCount; move++) {
        const offset = permutation * moveCount + move;
        moves[index * moveCount + move] = permutationMoves[offset] * ORIENTATIONS
          + twistAddition[orientation * ORIENTATIONS + twistDeltas[offset]];
      }
    }
  }
  const secondMoves = new Uint8Array(moveCount);
  const product: ProductCoordinateMoves = {
    firstCount: STATES, secondCount: 1, moveCount, firstMoves: moves, secondMoves,
  };
  const moveNames = moveIds.map(id => MOVE_NAMES[id]);
  const inverseMove = (move: number) => {
    const id = moveIds[move];
    const inverseId = Math.floor(id / 3) * 3 + 2 - id % 3;
    const inverse = moveIds.indexOf(inverseId);
    assertExact(inverse >= 0, 'Pyramorphix alphabet is not inverse-closed');
    return inverse;
  };
  const solved = puzzle.defaultPattern();
  assertExact(pyramorphixVisibleCoordinate(solved) === 0, 'Pyramorphix solved pattern is not coordinate zero');
  return { product, puzzle, solved, moveNames, inverseMove, definition,
    // Include temporary factor arrays in the conservative peak estimate.
    arrayBytes: moves.byteLength + secondMoves.byteLength + permutationMoves.byteLength
      + twistDeltas.byteLength + twistAddition.byteLength };
}

function verifyTransitions(model: Awaited<ReturnType<typeof makeModel>>) {
  let pattern = model.solved, state = 0, seed = 0x5b2a1693;
  let transitions = 0, hiddenTwistChecks = 0;
  for (let step = 0; step < 512; step++) {
    // An alternative physical 2x2 lift changes only two flat-piece twists.
    // The twist sum remains valid; both lifts must project to identical moves.
    const orbit = pattern.patternData.CORNERS;
    const hiddenOrientation = orbit.orientation.slice();
    const hiddenSlots = FLAT_PIECES.slice(0, 2).map(piece => orbit.pieces.indexOf(KOCIEMBA_TO_KPUZZLE[piece]));
    hiddenOrientation[hiddenSlots[0]] = (hiddenOrientation[hiddenSlots[0]] + 1) % 3;
    hiddenOrientation[hiddenSlots[1]] = (hiddenOrientation[hiddenSlots[1]] + 2) % 3;
    const alternative = new KPattern(model.puzzle, { CORNERS: {
      pieces: orbit.pieces.slice(), orientation: hiddenOrientation,
    } });
    assertExact(pyramorphixVisibleCoordinate(alternative) === state, 'flat-piece twists affected the visible coordinate');
    for (let move = 0; move < model.product.moveCount; move++) {
      const next = nextProductCoordinate(model.product, state, move);
      assertExact(next === pyramorphixVisibleCoordinate(pattern.applyMove(model.moveNames[move])),
        `Pyramorphix coordinate/library mismatch at ${step}/${move}`);
      assertExact(next === pyramorphixVisibleCoordinate(alternative.applyMove(model.moveNames[move])),
        'Pyramorphix transition depends on invisible flat-piece twists');
      assertExact(nextProductCoordinate(model.product, next, model.inverseMove(move)) === state,
        'Pyramorphix inverse transition mismatch');
      transitions++;
      hiddenTwistChecks++;
    }
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const move = (seed >>> 16) % model.product.moveCount;
    pattern = pattern.applyMove(model.moveNames[move]);
    state = nextProductCoordinate(model.product, state, move);
  }
  return { transitions, hiddenTwistChecks };
}

async function enumerateMetric(metric: Metric, options: ProductCheckpointOptions) {
  const preparationStart = performance.now();
  const model = await makeModel(metric);
  const preparationMs = performance.now() - preparationStart;
  const verifyStart = performance.now();
  const checked = verifyTransitions(model);
  let verificationMs = performance.now() - verifyStart;
  const graphStart = performance.now();
  const graph = completedProductCoordinates(model.product, options);
  const graphMs = preparationMs + performance.now() - graphStart;
  const exampleStart = performance.now();
  const examples = productCoordinateExamples(model.product, model.moveNames, graph, model.inverseMove);
  const examplesMs = performance.now() - exampleStart;
  const finalVerifyStart = performance.now();
  const { histogram } = graph;
  assertExact(graph.total === STATES, 'Pyramorphix visible-coordinate closure did not reach every state');
  assertExact(histogram.length === model.definition.histogram.length
    && histogram.every((count, depth) => count === model.definition.histogram[depth]),
  `computed Pyramorphix ${metric} histogram differs from Jaap's independent complete search`);
  const replayed = new Set<number>();
  let solvedExamplesWithHiddenTwists = 0;
  for (const example of examples) {
    const state = model.solved.applyAlg(example.scramble);
    const index = pyramorphixVisibleCoordinate(state);
    assertExact(graph.distance[index] === example.distance, 'Pyramorphix replay misses its distance bin');
    assertExact(!replayed.has(index), 'Pyramorphix examples contain a duplicate visible state');
    replayed.add(index);
    const result = state.applyAlg(example.solution);
    assertExact(pyramorphixVisibleCoordinate(result) === 0, 'Pyramorphix replay does not solve the visible state');
    if (!result.isIdentical(model.solved)) solvedExamplesWithHiddenTwists++;
  }
  verificationMs += performance.now() - finalVerifyStart;
  return {
    id: model.definition.id, label: `Pyramorphix / 二阶金字塔${metric === 'QTM' ? ' (QTM)' : ''}`,
    metric: `${model.definition.description}; whole rotations ignored by fixed DBL corner; flat-piece twists invisible`,
    stateCount: graph.total, total: graph.total, godsNumber: histogram.length - 1, histogram, examples,
    allStates: productCoordinateAllStates(model.product, model.moveNames, graph, model.inverseMove),
    examplesLimitPerDepth: 12, deepestExamplesComplete: histogram.at(-1)! <= 256,
    estimatedArrayBytes: model.arrayBytes + graph.arrayBytes, denseCoordinateUpperBound: STATES,
    timingMs: { graph: graphMs, examples: examplesMs, solve: 0, verification: verificationMs },
    verification: {
      closed: true, directedEdgesChecked: graph.edgeChecks,
      allEdgesDistanceDifferenceAtMostOne: true, allNonRootStatesHaveDescendingEdge: true,
      independentTransitionChecks: checked.transitions, invisibleTwistIndependenceChecks: checked.hiddenTwistChecks,
      independentlyReplayedExamples: examples.length, solvedExamplesWithHiddenTwists,
      referenceHistogramMatches: true, referenceHistogramSource: `${REFERENCE_URL} (${metric} marginal)`,
      geometrySource: 'physical 2x2 shape modification; project Kociemba transitions; independent cubing.js 2x2 KPuzzle',
      moveNames: model.moveNames, visibleCornerPiecesKociemba: [...VISIBLE_PIECES, 6],
      scope: 'full shape-changing Pyramorphix; all eight pieces distinguished; four flat-piece twists unobservable; quotient by whole rotations; no sampling',
    },
  };
}

/** Importing this module never starts a BFS. Each metric is separately scheduled. */
export async function enumeratePyramorphix(options: ProductCheckpointOptions = {}) { return enumerateMetric('HTM', options); }
export async function enumeratePyramorphixQtm(options: ProductCheckpointOptions = {}) { return enumerateMetric('QTM', options); }
