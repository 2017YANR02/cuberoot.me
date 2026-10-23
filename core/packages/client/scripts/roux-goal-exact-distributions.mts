/**
 * Exact distributions on the existing 184,320-state U/M LSE group.
 * EOLR and EO+DM are training subgoals, not full-cube solutions. Their target
 * equivalence is the existing Roux trainer's PrunerConfig, independently
 * checked against explicit cubing.js piece/centre predicates.
 *
 * No enumeration happens on import. The serial resource guard owns scheduling.
 * QTM here means quarter SLICE turns: U/M +/-90 cost 1, U2/M2 cost 2.
 * It must not be presented as the outer-face QTM of the unrestricted 3x3.
 */
import { performance } from 'node:perf_hooks';
import { puzzles } from 'cubing/puzzles';
import type { KPattern } from 'cubing/kpuzzle';
import { CubieCube } from '../lib/roux/CubeLib.ts';
import { eodmPrunerConfig, eolrPrunerConfig } from '../lib/roux/Pruner.ts';
import { EOLR_GOAL_ALGS_AC, EOLR_GOAL_ALGS_MC } from '../lib/roux/eolr-goal.ts';
import { assertExact, nextProductCoordinate } from './exact-coordinate-bfs.mts';
import { lseModel, projectPattern, verifyGeneratorConventions } from './restricted333-exact-distribution.mts';

export type RouxDistributionEvent = 'lsemu-qtm' | 'roux-eolr-ac' | 'roux-eolr-mc' | 'roux-eodm';
type Physical = ReturnType<typeof projectPattern>;
export interface RouxStateRow { depth: number; scramble: string }

const TOTAL = 184320;
const ALL_MOVES = [0, 1, 2, 3, 4, 5] as const;
const QUARTER_MOVES = [0, 2, 3, 5] as const;
const FREE = [0, 1, 2, 3, 5, 7] as const;
// Roux CubeLib -> public Kociemba/STM piece numbering, from Defs.ts face tuples.
const ROUX_CP = [1, 2, 3, 0, 5, 6, 7, 4] as const;
const ROUX_EP = [1, 2, 3, 0, 5, 6, 7, 4, 9, 10, 11, 8] as const;
const ROUX_TP = [0, 1, 4, 5, 3, 2] as const;
const LABELS: Record<RouxDistributionEvent, string> = {
  'lsemu-qtm': 'LSE quarter-slice-turn metric / LSE 四分之一切片转度量',
  'roux-eolr-ac': 'Roux EOLR AC setup target / Roux EOLR AC 准备目标',
  'roux-eolr-mc': 'Roux EOLR MC setup target / Roux EOLR MC 准备目标',
  'roux-eodm': 'Roux EO+DM subgoal / Roux EO+DM 子目标',
};

function rouxCube(state: Physical): CubieCube {
  const remap = (pieces: number[], slots: readonly number[]) => slots.map(slot => slots.indexOf(pieces[slot]));
  return new CubieCube({ cp: remap(state.cp, ROUX_CP), co: ROUX_CP.map(slot => state.co[slot]),
    ep: remap(state.ep, ROUX_EP), eo: ROUX_EP.map(slot => state.eo[slot]), tp: remap(state.center, ROUX_TP) });
}

function stateKey(state: Physical): string {
  return [state.cp, state.co, state.ep, state.eo, state.center].map(values => values.join(',')).join('/');
}

function isSolved(state: Physical): boolean {
  return state.cp.every((piece, slot) => piece === slot) && state.co.every(value => value === 0)
    && state.ep.every((piece, slot) => piece === slot) && state.eo.every(value => value === 0)
    && state.center.every((piece, slot) => piece === slot);
}

/** Physical EOLR projection, deliberately independent of the packed trainer encoder. */
function eolrSignature(state: Physical): string {
  const centreFamily = state.center[0] === 0 || state.center[0] === 1 ? 'UD' : 'FB';
  return [FREE.map(slot => state.eo[slot]).join(''), state.ep.indexOf(2), state.ep.indexOf(0),
    state.cp[1], centreFamily].join('/');
}

function goals(event: RouxDistributionEvent, solved: KPattern) {
  if (event === 'lsemu-qtm') return {
    matches: isSolved, referenceMatches: isSolved, expectedCount: 1, projectionCount: 1,
    description: 'All six LSE edges, corner AUF and centre positions solved; centre logo twists ignored.',
  };
  const config = event === 'roux-eodm' ? eodmPrunerConfig : eolrPrunerConfig(event === 'roux-eolr-ac' ? 0x01 : 0x10);
  const encodedGoals = new Set(config.solved_states.map(state => config.encode(state)));
  const matches = (state: Physical) => encodedGoals.has(config.encode(rouxCube(state)));
  if (event === 'roux-eodm') return {
    matches,
    referenceMatches: (state: Physical) => FREE.every(slot => state.eo[slot] === 0)
      && state.ep[5] === 5 && state.ep[7] === 7 && state.center[0] === 0,
    expectedCount: 48, projectionCount: encodedGoals.size,
    description: 'All six LSE edges oriented, DF and DB edges home, centres home; corner AUF and the four U-edge positions ignored. Exact existing eodmPrunerConfig goal.',
  };
  const algorithms = event === 'roux-eolr-ac' ? EOLR_GOAL_ALGS_AC : EOLR_GOAL_ALGS_MC;
  const signatures = new Set(algorithms.map(algorithm => eolrSignature(projectPattern(solved.applyAlg(algorithm)))));
  return {
    matches, referenceMatches: (state: Physical) => signatures.has(eolrSignature(state)),
    // Each of eight distinct projected targets has 24 physical completions.
    expectedCount: 192, projectionCount: encodedGoals.size,
    description: `Exact existing ${event === 'roux-eolr-ac' ? 'AC (0x01)' : 'MC (0x10)'} EOLR setup target set: all six edge orientations, UL/UR positions, corner AUF and centre M2-equivalence tracked; other edge permutation ignored. The solved identity is not added to the trainer's target set.`,
  };
}

function algorithmCost(event: RouxDistributionEvent, algorithm: string): number {
  const tokens = algorithm.trim().split(/\s+/).filter(Boolean);
  assertExact(tokens.every(token => /^(?:U|M)(?:2|')?$/.test(token)), 'Roux witness uses a move outside U/M');
  return tokens.reduce((sum, token) => sum + (event === 'lsemu-qtm' && token.endsWith('2') ? 2 : 1), 0);
}

/** Independent witness replay only: no coordinate tables, no BFS, no large allocations. */
export async function validateRouxWitness(event: RouxDistributionEvent, scramble: string, solution: string,
  expectedDistance?: number) {
  assertExact(Object.hasOwn(LABELS, event), 'unknown Roux distribution event');
  algorithmCost(event, scramble);
  const cost = algorithmCost(event, solution);
  if (expectedDistance !== undefined) assertExact(cost === expectedDistance, 'Roux witness cost differs from its bin');
  const puzzle = await puzzles['3x3x3'].kpuzzle(), solved = puzzle.defaultPattern();
  const source = projectPattern(solved.applyAlg(scramble)), target = projectPattern(solved.applyAlg(`${scramble} ${solution}`));
  const goal = goals(event, solved);
  assertExact(goal.matches(target) && goal.referenceMatches(target), 'Roux witness misses its stated training goal');
  assertExact(rouxCube(source).serialize() === new CubieCube().apply(scramble).serialize(),
    'Roux source differs between CubeLib and cubing.js');
  assertExact(rouxCube(target).serialize() === new CubieCube().apply(`${scramble} ${solution}`).serialize(),
    'Roux target differs between CubeLib and cubing.js');
  return { canonicalStateKey: stateKey(source), moveCost: cost, goalReached: true };
}

export async function enumerateRouxGoal(event: RouxDistributionEvent) {
  assertExact(Object.hasOwn(LABELS, event), 'unknown Roux distribution event');
  const preparationStart = performance.now();
  const model = lseModel(), puzzle = await puzzles['3x3x3'].kpuzzle(), solved = puzzle.defaultPattern();
  const goal = goals(event, solved), moves = event === 'lsemu-qtm' ? QUARTER_MOVES : ALL_MOVES;
  const preparationMs = performance.now() - preparationStart;
  let verificationStart = performance.now();
  verifyGeneratorConventions(puzzle, model.moveNames, model.operations);
  assertExact(model.expectedTotal === TOTAL && model.index(projectPattern(solved)) === 0, 'unexpected LSE domain');
  let pattern = solved, coordinate = 0, seed = 0x3f7ae821, independentTransitionChecks = 0;
  for (let step = 0; step < 512; step++) {
    for (const move of ALL_MOVES) {
      const library = projectPattern(pattern.applyMove(model.moveNames[move]));
      const next = nextProductCoordinate(model.product, coordinate, move);
      assertExact(model.index(library) === next && stateKey(model.stateAt(next)) === stateKey(library),
        'Roux coordinate transition/decode differs from cubing.js');
      const roux = new CubieCube().apply(model.moveNames[move]);
      assertExact(rouxCube(projectPattern(solved.applyMove(model.moveNames[move]))).serialize() === roux.serialize(),
        'Roux generator mapping differs from CubeLib');
      assertExact(nextProductCoordinate(model.product, next, model.inverseMove(move)) === coordinate,
        'Roux inverse transition differs');
      independentTransitionChecks++;
    }
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const move = (seed >>> 16) % 6;
    pattern = pattern.applyMove(model.moveNames[move]);
    coordinate = nextProductCoordinate(model.product, coordinate, move);
  }
  let verificationMs = performance.now() - verificationStart;
  const graphStart = performance.now();
  const distance = new Uint8Array(TOTAL).fill(255), queue = new Uint32Array(TOTAL);
  // A compact identity-rooted spanning tree supplies REAL source scrambles for
  // arbitrary subgoal states. Inverting a subgoal solution would start at the
  // wrong physical state. No second distance histogram is computed or exported.
  const parentMove = new Uint8Array(TOTAL).fill(255);
  queue[0] = 0; parentMove[0] = 254;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const state = queue[head];
    for (const move of moves) {
      const next = nextProductCoordinate(model.product, state, move);
      if (parentMove[next] !== 255) continue;
      assertExact(tail < TOTAL, 'Roux identity tree exceeds arena');
      parentMove[next] = move; queue[tail++] = next;
    }
  }
  assertExact(tail === TOTAL, 'Roux generators do not reach the full LSE domain');
  tail = 0;
  for (let state = 0; state < TOTAL; state++) {
    const physical = model.stateAt(state);
    assertExact(model.index(physical) === state, 'Roux coordinate decoder is not bijective');
    const matched = goal.matches(physical);
    assertExact(matched === goal.referenceMatches(physical), 'Roux trainer goal disagrees with physical goal predicate');
    if (!matched) continue;
    distance[state] = 0; queue[tail++] = state;
  }
  const goalCount = tail;
  assertExact(goalCount === goal.expectedCount, 'Roux physical goal count changed');
  const histogram = [goalCount], samplesByDepth: number[][] = [[...queue.subarray(0, Math.min(tail, 256))]];
  let head = 0, depth = 0;
  while (head < tail) {
    const end = tail;
    while (head < end) {
      const state = queue[head++];
      assertExact(distance[state] === depth, 'Roux BFS layer queue out of order');
      for (const move of moves) {
        const next = nextProductCoordinate(model.product, state, move);
        if (distance[next] !== 255) continue;
        assertExact(tail < TOTAL && depth + 1 < 255, 'Roux BFS exceeds bounded arena');
        distance[next] = depth + 1; queue[tail++] = next;
        histogram[depth + 1] = (histogram[depth + 1] ?? 0) + 1;
        const samples = samplesByDepth[depth + 1] ??= [];
        if (samples.length < 256) samples.push(next);
      }
    }
    console.log(JSON.stringify({ event, phase: 'bfs-layer', depth, visited: tail, total: TOTAL }));
    depth++;
  }
  assertExact(tail === TOTAL && histogram.reduce((sum, count) => sum + count, 0) === TOTAL,
    'Roux multi-source graph did not fill the physical domain');
  const graphMs = preparationMs + performance.now() - graphStart;
  verificationStart = performance.now();
  let directedEdgesChecked = 0;
  for (let state = 0; state < TOTAL; state++) {
    let descending = distance[state] === 0;
    for (const move of moves) {
      const next = nextProductCoordinate(model.product, state, move);
      assertExact(Math.abs(distance[state] - distance[next]) <= 1, 'Roux edge violates distance Lipschitz bound');
      if (distance[next] + 1 === distance[state]) descending = true;
      directedEdgesChecked++;
    }
    assertExact(descending, 'Roux non-goal has no descending edge');
  }
  verificationMs += performance.now() - verificationStart;
  const scrambleFor = (original: number) => {
    const inversePath: number[] = [];
    let state = original;
    while (state !== 0) {
      const move = parentMove[state];
      assertExact(move < 6 && inversePath.length < TOTAL, 'Roux source tree is invalid');
      inversePath.push(move);
      state = nextProductCoordinate(model.product, state, model.inverseMove(move));
    }
    return inversePath.reverse().map(move => model.moveNames[move]).join(' ');
  };
  const examplesStart = performance.now();
  const examples: { distance: number; scramble: string; solution: string }[] = [];
  const replayed = new Set<number>();
  for (let depth = 0; depth < histogram.length; depth++) {
    const limit = depth === histogram.length - 1 && histogram[depth] <= 256 ? 256 : 12;
    for (const original of samplesByDepth[depth].slice(0, limit)) {
      let state = original;
      const solution: string[] = [];
      while (distance[state] > 0) {
        const move = moves.find(move => distance[nextProductCoordinate(model.product, state, move)] + 1 === distance[state]);
        assertExact(move !== undefined, 'Roux witness cannot descend to a goal');
        solution.push(model.moveNames[move]); state = nextProductCoordinate(model.product, state, move);
      }
      const example = { distance: depth, scramble: scrambleFor(original), solution: solution.join(' ') };
      assertExact(!replayed.has(original), 'duplicate Roux example state'); replayed.add(original);
      assertExact(model.index(projectPattern(solved.applyAlg(example.scramble))) === original, 'Roux scramble changed source state');
      await validateRouxWitness(event, example.scramble, example.solution, depth);
      examples.push(example);
    }
  }
  const examplesMs = performance.now() - examplesStart;
  function* rows(): Iterable<RouxStateRow> {
    for (let state = 0; state < TOTAL; state++) yield { depth: distance[state], scramble: scrambleFor(state) };
  }
  return {
    id: event, label: LABELS[event], stateCount: TOTAL, total: TOTAL, histogram,
    godsNumber: histogram.length - 1, goalCount, projectedGoalCount: goal.projectionCount,
    identityDistance: distance[0], goalDefinition: goal.description,
    metric: event === 'lsemu-qtm'
      ? 'QSTM: U/U\'/M/M\' cost 1; U2/M2 cost 2. Restricted U/M group; corner AUF and centre positions included.'
      : 'STM: U/U2/U\'/M/M2/M\' each cost 1. Distance to the specified Roux training subgoal within the complete LSE U/M domain.',
    examples, examplesLimitPerDepth: 12, deepestExamplesComplete: histogram.at(-1)! <= 256,
    estimatedArrayBytes: model.arrayBytes + distance.byteLength + queue.byteLength + parentMove.byteLength,
    denseCoordinateUpperBound: TOTAL,
    timingMs: { graph: graphMs, examples: examplesMs, solve: 0, verification: verificationMs },
    // Consumed once by the worker before JSON persistence; never serialized.
    allStates: rows(),
    verification: { closed: true, directedEdgesChecked, allEdgesDistanceDifferenceAtMostOne: true,
      allNonGoalStatesHaveDescendingEdge: true, allPhysicalGoalPredicatesChecked: TOTAL,
      independentTransitionChecks, independentlyReplayedExamples: examples.length,
      referenceHistogramAvailable: false, moveNames: moves.map(move => model.moveNames[move]),
      proof: 'All 184320 physical states reached; exact trainer and independent physical goal predicates agree on every state; every edge is 1-Lipschitz; every non-goal has a descending edge; cubing.js/CubeLib witness replay.',
      geometrySource: 'Existing geometric STM LSE coordinate; independent cubing.js 3x3 KPuzzle and existing Roux CubeLib.',
      scope: 'Complete LSE physical-state domain; fixed frame and explicit target equivalence. EOLR/EO+DM are subgoals, not whole-cube solutions.' },
  };
}

export const enumerateLseQtm = () => enumerateRouxGoal('lsemu-qtm');
export const enumerateRouxEolrAc = () => enumerateRouxGoal('roux-eolr-ac');
export const enumerateRouxEolrMc = () => enumerateRouxGoal('roux-eolr-mc');
export const enumerateRouxEodm = () => enumerateRouxGoal('roux-eodm');
