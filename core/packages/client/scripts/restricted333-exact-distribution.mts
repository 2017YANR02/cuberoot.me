/**
 * Complete distributions of two explicitly RESTRICTED 3x3 move groups.
 * These are not the diameter or distribution of the full 3x3 cube.
 *
 * half: U2/R2/F2/D2/L2/B2, each half turn costs one; centres fixed.
 * lsemu: U/U2/U'/M/M2/M', each token costs one; corner AUF and centre
 *        permutation are part of the state/goal, centre logo twist is not.
 *
 * Source generators: public project Kociemba and geometric STM cube models.
 * Independent oracle: cubing.js 3x3 KPuzzle, with every generator convention
 * checked explicitly. Only compact factor closures allocate during preparation;
 * the full BFS uses the shared fixed arena, without a per-state object Map.
 */
import { performance } from 'node:perf_hooks';
import { ALL_MOVES, MOVE_NAMES } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { MOVE_OPS, STM_MOVE_NAMES, type MoveOp } from '@cuberoot/puzzle-solvers/stm-cube';
import { puzzles } from 'cubing/puzzles';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { completedProductCoordinates, type ProductCheckpointOptions } from './exact-coordinate-checkpoint.mts';
import { assertExact, nextProductCoordinate, orientationRank,
  permutationRank, productCoordinateAllStates, productCoordinateExamples, unrankOrientation, unrankPermutation,
  type ProductCoordinateMoves } from './exact-coordinate-bfs.mts';

const CP_TO_KP = [0, 3, 2, 1, 4, 5, 6, 7] as const;
const EP_TO_KP = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10] as const;
// STM centres U,D,R,L,F,B; cubing.js centres U,L,F,R,B,D.
const CENTER_TO_KP = [0, 5, 3, 1, 2, 4] as const;
const KP_TO_CENTER = [0, 3, 4, 2, 5, 1] as const;
const SIX_MOVES = 6;
type Event = 'half' | 'lsemu';

/** Dense factor rank -> compact reachable index; at most 40,320 entries. */
function factorClosure(capacity: number, expected: number, moveRank: (rank: number, move: number) => number) {
  assertExact(capacity <= 40320, 'restricted-333 factor unexpectedly large');
  const compact = new Int16Array(capacity).fill(-1), ranks = new Uint16Array(capacity);
  compact[0] = 0;
  let count = 1;
  for (let head = 0; head < count; head++) {
    for (let move = 0; move < SIX_MOVES; move++) {
      const next = moveRank(ranks[head], move);
      assertExact(Number.isInteger(next) && next >= 0 && next < capacity, 'factor escaped dense arena');
      if (compact[next] >= 0) continue;
      assertExact(count < 32768 && count < capacity, 'factor compact index overflow');
      compact[next] = count;
      ranks[count++] = next;
    }
  }
  assertExact(count === expected, 'restricted-333 factor closure has an unexpected size');
  const moves = new Uint16Array(count * SIX_MOVES);
  for (let state = 0; state < count; state++) {
    for (let move = 0; move < SIX_MOVES; move++) {
      const next = compact[moveRank(ranks[state], move)];
      assertExact(next >= 0, 'factor table is not closed');
      moves[state * SIX_MOVES + move] = next;
    }
  }
  return { compact, moves, count, arrayBytes: compact.byteLength + ranks.byteLength + moves.byteLength };
}

/** Exact projection of an independent library state into the public project convention. */
export function projectPattern(pattern: KPattern): {
  cp: number[]; co: number[]; ep: number[]; eo: number[]; center: number[];
} {
  const corner = pattern.patternData.CORNERS, edge = pattern.patternData.EDGES;
  const center = pattern.patternData.CENTERS;
  return {
    cp: CP_TO_KP.map(slot => CP_TO_KP[corner.pieces[slot]]),
    co: CP_TO_KP.map(slot => corner.orientation[slot]),
    ep: EP_TO_KP.map(slot => EP_TO_KP[edge.pieces[slot]]),
    eo: EP_TO_KP.map(slot => edge.orientation[slot]),
    center: CENTER_TO_KP.map(slot => KP_TO_CENTER[center.pieces[slot]]),
  };
}
type ProjectState = ReturnType<typeof projectPattern>;

export function verifyGeneratorConventions(puzzle: KPuzzle, names: readonly string[], operations: readonly MoveOp[]) {
  for (let move = 0; move < SIX_MOVES; move++) {
    const oracle = projectPattern(puzzle.defaultPattern().applyMove(names[move]));
    const project = operations[move];
    for (const [actual, expected] of [
      [oracle.cp, project.cpFrom], [oracle.co, project.coAdd],
      [oracle.ep, project.epFrom], [oracle.eo, project.eoAdd],
      [oracle.center, project.centerFrom],
    ]) assertExact(actual.length === expected.length && actual.every((value, i) => value === expected[i]),
      `restricted-333 generator convention mismatch for ${names[move]}`);
  }
}

function halfModel() {
  const moveIds = [1, 4, 7, 10, 13, 16];
  const moveNames = moveIds.map(id => MOVE_NAMES[id]);
  const operations = moveNames.map(name => MOVE_OPS[STM_MOVE_NAMES.indexOf(name)]);
  const projectMoves = moveIds.map(id => ALL_MOVES[id]);
  for (let m = 0; m < SIX_MOVES; m++) {
    const kociemba = projectMoves[m], geometric = operations[m];
    assertExact(kociemba.cp.every((value, i) => value === geometric.cpFrom[i])
      && kociemba.ep.every((value, i) => value === geometric.epFrom[i])
      && kociemba.co.every(value => value === 0) && kociemba.eo.every(value => value === 0),
    'half-turn Kociemba / geometric model mismatch');
  }
  const cp = new Uint8Array(8), nextCp = new Uint8Array(8);
  const corners = factorClosure(40320, 96, (rank, move) => {
    unrankPermutation(rank, cp);
    for (let slot = 0; slot < 8; slot++) nextCp[slot] = cp[projectMoves[move].cp[slot]];
    return permutationRank(nextCp);
  });
  const edgeOrbits = [[0, 2, 4, 6], [1, 3, 5, 7], [8, 9, 10, 11]] as const;
  const edgeOrbit = new Uint8Array(12), edgeWithinOrbit = new Uint8Array(12);
  edgeOrbits.forEach((orbit, group) => orbit.forEach((piece, position) => {
    edgeOrbit[piece] = group; edgeWithinOrbit[piece] = position;
  }));
  const ep = new Uint8Array(12), nextEp = new Uint8Array(12), four = new Uint8Array(4);
  const edgeRank = (state: ArrayLike<number>) => {
    let rank = 0, factor = 1;
    for (let group = 0; group < 3; group++) {
      for (let i = 0; i < 4; i++) {
        const piece = state[edgeOrbits[group][i]];
        assertExact(edgeOrbit[piece] === group, 'half-turn edge left its tetrad');
        four[i] = edgeWithinOrbit[piece];
      }
      rank += factor * permutationRank(four);
      factor *= 24;
    }
    return rank;
  };
  const edges = factorClosure(24 ** 3, 6912, (rank, move) => {
    for (const orbit of edgeOrbits) {
      unrankPermutation(rank % 24, four);
      rank = Math.floor(rank / 24);
      for (let i = 0; i < 4; i++) ep[orbit[i]] = orbit[four[i]];
    }
    for (let slot = 0; slot < 12; slot++) nextEp[slot] = ep[projectMoves[move].ep[slot]];
    return edgeRank(nextEp);
  });
  const index = (state: ProjectState) => {
    assertExact(state.co.every(value => value === 0) && state.eo.every(value => value === 0)
      && state.center.every((piece, slot) => piece === slot), 'half-turn state violated its fixed frame/orientation');
    const a = corners.compact[permutationRank(state.cp)], b = edges.compact[edgeRank(state.ep)];
    assertExact(a >= 0 && b >= 0, 'half-turn oracle state outside factor closure');
    return a * edges.count + b;
  };
  return {
    id: 'half' as const, label: '3×3 half-turn subgroup / 三阶仅半转子群',
    metric: 'restricted generators U2/R2/F2/D2/L2/B2 only; each half turn = 1; fixed centre frame',
    product: { firstCount: corners.count, secondCount: edges.count, moveCount: SIX_MOVES,
      firstMoves: corners.moves, secondMoves: edges.moves } satisfies ProductCoordinateMoves,
    moveNames, operations, index, inverseMove: (move: number) => move,
    expectedTotal: 663552, arrayBytes: corners.arrayBytes + edges.arrayBytes,
    source: 'public Kociemba half-turn generators; independently derived project STM geometry; cubing.js 3x3 KPuzzle',
  };
}

export function lseModel() {
  const moveNames = ['U', 'U2', "U'", 'M', 'M2', "M'"];
  const operations = moveNames.map(name => MOVE_OPS[STM_MOVE_NAMES.indexOf(name)]);
  assertExact(operations.every(Boolean), 'LSE generators absent from public STM cube model');
  const free = [0, 1, 2, 3, 5, 7];
  const local = new Int8Array(12).fill(-1);
  free.forEach((piece, index) => { local[piece] = index; });
  for (const op of operations) {
    assertExact(op.coAdd.every(value => value === 0), 'LSE generator twists a corner');
    for (let slot = 0; slot < 12; slot++) {
      assertExact(local[slot] >= 0 ? local[op.epFrom[slot]] >= 0
        : op.epFrom[slot] === slot && op.eoAdd[slot] === 0, 'LSE generator left its six-edge orbit');
    }
  }
  // Four physical corner AUFs and four centre positions, including their parity
  // link with the six-edge permutation. Keep the full 720*4*4 dense factor and
  // discover its 5,760 reachable coordinates; don't silently drop centre parity.
  const cyclicFactor = (size: number, base: ArrayLike<number>, getMove: (move: MoveOp) => ArrayLike<number>) => {
    const ranks = new Uint16Array(4), byRank = new Int8Array(size === 8 ? 40320 : 720).fill(-1);
    let state = Uint8Array.from({ length: size }, (_, i) => i);
    for (let power = 0; power < 4; power++) {
      ranks[power] = permutationRank(state);
      assertExact(byRank[ranks[power]] < 0, 'LSE cyclic factor has order below four');
      byRank[ranks[power]] = power;
      state = Uint8Array.from({ length: size }, (_, i) => state[base[i]]);
    }
    assertExact(permutationRank(state) === 0, 'LSE cyclic factor does not close after four turns');
    const moves = new Uint8Array(4 * SIX_MOVES), next = new Uint8Array(size);
    for (let power = 0; power < 4; power++) {
      unrankPermutation(ranks[power], state);
      for (let m = 0; m < SIX_MOVES; m++) {
        const op = getMove(operations[m]);
        for (let i = 0; i < size; i++) next[i] = state[op[i]];
        const destination = byRank[permutationRank(next)];
        assertExact(destination >= 0, 'LSE cyclic factor is not closed');
        moves[power * SIX_MOVES + m] = destination;
      }
    }
    return { ranks, byRank, moves, arrayBytes: ranks.byteLength + byRank.byteLength + moves.byteLength };
  };
  const corners = cyclicFactor(8, operations[0].cpFrom, move => move.cpFrom);
  const centers = cyclicFactor(6, operations[3].centerFrom, move => move.centerFrom);
  const permutation = new Uint8Array(6), next = new Uint8Array(6);
  const permutationFactor = factorClosure(720 * 16, 5760, (rank, move) => {
    const cp = Math.floor(rank / 4) % 4, center = rank % 4;
    unrankPermutation(Math.floor(rank / 16), permutation);
    for (let slot = 0; slot < 6; slot++) next[slot] = permutation[local[operations[move].epFrom[free[slot]]]];
    return permutationRank(next) * 16 + corners.moves[cp * SIX_MOVES + move] * 4
      + centers.moves[center * SIX_MOVES + move];
  });
  const orientationMoves = new Uint8Array(32 * SIX_MOVES);
  for (let orientation = 0; orientation < 32; orientation++) {
    unrankOrientation(orientation, 2, permutation.subarray(0, 5));
    permutation[5] = permutation.subarray(0, 5).reduce((sum, value) => sum ^ value, 0);
    for (let move = 0; move < SIX_MOVES; move++) {
      let parity = 0;
      for (let slot = 0; slot < 6; slot++) {
        next[slot] = permutation[local[operations[move].epFrom[free[slot]]]] ^ operations[move].eoAdd[free[slot]];
        parity ^= next[slot];
      }
      assertExact(parity === 0, 'LSE generator violates even edge-flip parity');
      orientationMoves[orientation * SIX_MOVES + move] = orientationRank(next.subarray(0, 5), 2);
    }
  }
  const index = (state: ProjectState) => {
    assertExact(state.co.every(value => value === 0), 'LSE oracle state has a twisted corner');
    for (let slot = 0; slot < 12; slot++) if (local[slot] < 0) {
      assertExact(state.ep[slot] === slot && state.eo[slot] === 0, 'LSE oracle moves a block edge');
    }
    for (let slot = 0; slot < 6; slot++) {
      assertExact(local[state.ep[free[slot]]] >= 0, 'LSE oracle edge leaves its orbit');
      permutation[slot] = local[state.ep[free[slot]]];
      next[slot] = state.eo[free[slot]];
    }
    assertExact(next.reduce((sum, value) => sum ^ value, 0) === 0, 'LSE oracle has odd edge-flip parity');
    const cp = corners.byRank[permutationRank(state.cp)], center = centers.byRank[permutationRank(state.center)];
    assertExact(cp >= 0 && center >= 0, 'LSE oracle corner AUF or centre cycle is invalid');
    const compact = permutationFactor.compact[permutationRank(permutation) * 16 + cp * 4 + center];
    assertExact(compact >= 0, 'LSE oracle state violates the permutation/centre parity link');
    return compact * 32 + orientationRank(next.subarray(0, 5), 2);
  };
  // A small inverse factor map lets related Roux goals inspect physical states
  // without copying this coordinate or constructing a second full-state model.
  const rawByCompact = new Uint16Array(permutationFactor.count);
  permutationFactor.compact.forEach((compact, raw) => {
    if (compact >= 0) rawByCompact[compact] = raw;
  });
  const stateAt = (coordinate: number): ProjectState => {
    assertExact(Number.isInteger(coordinate) && coordinate >= 0 && coordinate < 184320,
      'LSE decode coordinate outside arena');
    const raw = rawByCompact[Math.floor(coordinate / 32)];
    const cp = new Uint8Array(8), center = new Uint8Array(6), pieces = new Uint8Array(6);
    const flips = new Uint8Array(6), ep = Array.from({ length: 12 }, (_, i) => i), eo = Array(12).fill(0);
    unrankPermutation(corners.ranks[Math.floor(raw / 4) % 4], cp);
    unrankPermutation(centers.ranks[raw % 4], center);
    unrankPermutation(Math.floor(raw / 16), pieces);
    unrankOrientation(coordinate % 32, 2, flips.subarray(0, 5));
    flips[5] = flips.subarray(0, 5).reduce((sum, value) => sum ^ value, 0);
    free.forEach((slot, i) => { ep[slot] = free[pieces[i]]; eo[slot] = flips[i]; });
    return { cp: [...cp], co: Array(8).fill(0), ep, eo, center: [...center] };
  };
  return {
    id: 'lsemu' as const, label: 'LSE U/M subgroup / LSE U、M 子群',
    metric: 'restricted generators U/U2/U\'/M/M2/M\' only; each token = 1; corner AUF and centre positions included; centre logo orientation ignored',
    product: { firstCount: permutationFactor.count, secondCount: 32, moveCount: SIX_MOVES,
      firstMoves: permutationFactor.moves, secondMoves: orientationMoves } satisfies ProductCoordinateMoves,
    moveNames, operations, index, stateAt, inverseMove: (move: number) => Math.floor(move / 3) * 3 + 2 - move % 3,
    expectedTotal: 184320,
    arrayBytes: permutationFactor.arrayBytes + orientationMoves.byteLength + corners.arrayBytes + centers.arrayBytes + rawByCompact.byteLength,
    source: 'public geometric STM cube model; independent cubing.js 3x3 KPuzzle; csTimer 333lse.js factor sizes 5760*32',
  };
}

async function enumerateRestricted(event: Event, options: ProductCheckpointOptions) {
  const preparationStart = performance.now();
  const model = event === 'half' ? halfModel() : lseModel();
  const puzzle = await puzzles['3x3x3'].kpuzzle();
  const solved = puzzle.defaultPattern();
  const index = (pattern: KPattern) => model.index(projectPattern(pattern));
  const preparationMs = performance.now() - preparationStart;
  const verificationStart = performance.now();
  verifyGeneratorConventions(puzzle, model.moveNames, model.operations);
  assertExact(index(solved) === 0, 'restricted-333 root is not coordinate zero');
  let pattern = solved, state = 0, seed = 0x3519b36f, independentTransitionChecks = 0;
  for (let step = 0; step < 512; step++) {
    for (let move = 0; move < SIX_MOVES; move++) {
      const destination = nextProductCoordinate(model.product, state, move);
      assertExact(destination === index(pattern.applyMove(model.moveNames[move])),
        `${event} coordinate/library mismatch at ${step}/${move}`);
      assertExact(nextProductCoordinate(model.product, destination, model.inverseMove(move)) === state,
        `${event} inverse transition mismatch`);
      independentTransitionChecks++;
    }
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const move = (seed >>> 16) % SIX_MOVES;
    pattern = pattern.applyMove(model.moveNames[move]);
    state = nextProductCoordinate(model.product, state, move);
  }
  let verificationMs = performance.now() - verificationStart;
  const graphStart = performance.now();
  const graph = completedProductCoordinates(model.product, options);
  const graphMs = preparationMs + performance.now() - graphStart;
  const examplesStart = performance.now();
  const examples = productCoordinateExamples(model.product, model.moveNames, graph, model.inverseMove);
  const examplesMs = performance.now() - examplesStart;
  const finalVerifyStart = performance.now();
  assertExact(graph.total === model.expectedTotal, `${event} reachable closure did not fill its declared coordinate space`);
  const replayed = new Set<number>();
  for (const example of examples) {
    const library = solved.applyAlg(example.scramble), coordinate = index(library);
    assertExact(graph.distance[coordinate] === example.distance, `${event} replay misses its distance bin`);
    assertExact(!replayed.has(coordinate), `${event} repeated example state`);
    replayed.add(coordinate);
    const result = projectPattern(library.applyAlg(example.solution));
    assertExact(result.cp.every((piece, slot) => piece === slot) && result.co.every(value => value === 0)
      && result.ep.every((piece, slot) => piece === slot) && result.eo.every(value => value === 0)
      && result.center.every((piece, slot) => piece === slot), `${event} independent replay does not solve all pieces`);
  }
  verificationMs += performance.now() - finalVerifyStart;
  return {
    id: model.id, label: model.label, metric: model.metric,
    stateCount: graph.total, total: graph.total, godsNumber: graph.histogram.length - 1,
    histogram: graph.histogram, examples, examplesLimitPerDepth: 12,
    allStates: productCoordinateAllStates(model.product, model.moveNames, graph, model.inverseMove),
    deepestExamplesComplete: graph.histogram.at(-1)! <= 256,
    estimatedArrayBytes: model.arrayBytes + graph.arrayBytes,
    denseCoordinateUpperBound: model.product.firstCount * model.product.secondCount,
    timingMs: { graph: graphMs, examples: examplesMs, solve: 0, verification: verificationMs },
    verification: {
      closed: true, directedEdgesChecked: graph.edgeChecks,
      allEdgesDistanceDifferenceAtMostOne: true, allNonRootStatesHaveDescendingEdge: true,
      independentTransitionChecks, independentlyReplayedExamples: examples.length,
      referenceHistogramAvailable: false,
      proof: 'complete closure; root distance zero; every edge is 1-Lipschitz; every non-root has a descending edge; independent cubing.js transition/sample replay',
      geometrySource: model.source, moveNames: model.moveNames,
      scope: 'complete reachable states of the explicitly restricted 3x3 generator set; not full 3x3; no sampling',
    },
  };
}

/** Importing does not enumerate. The caller must schedule each full BFS separately. */
export async function enumerateHalfTurnCube(options: ProductCheckpointOptions = {}) { return enumerateRestricted('half', options); }
export async function enumerateLseMu(options: ProductCheckpointOptions = {}) { return enumerateRestricted('lsemu', options); }
