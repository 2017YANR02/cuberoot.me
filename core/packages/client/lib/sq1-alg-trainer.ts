import {
  SQ1_TOKEN_RE,
  applySq1Scramble,
  canonicalSq1Alg,
  invertSq1Alg,
  type Sq1State,
} from '@cuberoot/shared/sq1-notation';
import {
  isSq1Sliceable,
  rotateSq1StateLayer,
  sq1ParityAtDefaultLayerPositions,
  traceSq1Algorithm,
} from '@/lib/sq1-tools';
import {
  SQ1_ALG_TRAINER_CASES,
  SQ1_ALG_TRAINER_GROUPS,
  type Sq1AlgTrainerCase,
  type Sq1AlgTrainerParity,
} from '@/lib/sq1-alg-trainer-data';

export { SQ1_ALG_TRAINER_CASES, SQ1_ALG_TRAINER_GROUPS };
export type { Sq1AlgTrainerCase, Sq1AlgTrainerGroupId, Sq1AlgTrainerParity } from '@/lib/sq1-alg-trainer-data';

export type Sq1MiddleStrategy = 'random' | 'never' | 'always';

export interface Sq1AlgTrainerRound {
  case: Sq1AlgTrainerCase;
  scramble: string;
  state: Sq1State;
  middleFlipped: boolean;
}

const SQUARE_ROTATIONS = [0, 3, -3, 6] as const;
const LAYER_TURNS = [0, 1, 2, 3, 4, 5, 6, -1, -2, -3, -4, -5] as const;

/**
 * A setup for the solved outer pieces with the middle layer flipped. This is
 * the inverse of Jaap's solution for `A1B2C3D45E6F7G8H/`, the same solver
 * state convention used by Squanmate.
 */
export const SQ1_MIDDLE_FLIP_SETUP = canonicalSq1Alg('(-6,2)/(-6,0)/(-6,0)/(0,-2)');

function choice<T>(items: readonly T[], random: () => number): T {
  if (items.length === 0) throw new Error('Cannot choose from an empty list');
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

/** Expand the extra notation accepted by Squanmate before using our parser. */
export function normalizeSquanmateSq1Algorithm(input: string): string {
  let expanded = input
    .replaceAll('’', "'")
    .replace(/\bM2\b/gi, '(1,0) / (-1,-1) / (0,1)')
    .replace(/\bU2\b/gi, '(6,0)')
    .replace(/\bD2\b/gi, '(0,6)')
    .replace(/\bU'/gi, '(-3,0)')
    .replace(/\bD'/gi, '(0,-3)')
    .replace(/\bU\b/gi, '(3,0)')
    .replace(/\bD\b/gi, '(0,3)')
    .replaceAll('*', ' ');

  const tokenPattern = new RegExp(SQ1_TOKEN_RE.source, 'g');
  const leftovers = expanded.replace(tokenPattern, '').replace(/\s/g, '');
  if (leftovers) throw new Error(`Unsupported Squanmate notation: ${leftovers}`);
  expanded = canonicalSq1Alg(expanded);
  return expanded;
}

function parityOf(state: Sq1State): Sq1AlgTrainerParity | null {
  return sq1ParityAtDefaultLayerPositions(state);
}

function isSquareSquare(state: Sq1State): boolean {
  return new Set(state.pieces.slice(0, 12)).size === 8
    && new Set(state.pieces.slice(12, 24)).size === 8;
}

function legalShapeTurns(state: Sq1State): Array<readonly [number, number]> {
  const result: Array<readonly [number, number]> = [];
  for (const top of LAYER_TURNS) {
    for (const bottom of LAYER_TURNS) {
      if (top === 0 && bottom === 0) continue;
      const topRotated = rotateSq1StateLayer(state, 'top', top);
      const rotated = rotateSq1StateLayer(topRotated, 'bottom', bottom);
      if (isSq1Sliceable(rotated)) result.push([top, bottom]);
    }
  }
  return result;
}

function randomCubeshapeSetup(parity: Sq1AlgTrainerParity, random: () => number): string {
  for (let attempt = 0; attempt < 240; attempt++) {
    let setup = '';
    let state = applySq1Scramble('');
    const slices = 5 + Math.floor(random() * 6);
    for (let index = 0; index < slices; index++) {
      const [top, bottom] = choice(legalShapeTurns(state), random);
      setup = canonicalSq1Alg(`${setup} (${top}, ${bottom}) /`);
      state = applySq1Scramble(setup);
    }
    if (!isSquareSquare(state) && parityOf(state) === parity) return setup;
  }
  throw new Error(`Could not generate a ${parity} cubeshape case`);
}

const EP_CASES = SQ1_ALG_TRAINER_CASES.filter((item) => item.groupId === 'edge-permutation');

function linCornerSetup(item: Sq1AlgTrainerCase, random: () => number): string {
  const solve = normalizeSquanmateSq1Algorithm(item.algorithm);
  const cornerSetup = invertSq1Alg(solve);
  const bottomSolved = item.name.includes('(bottom solved)');
  const injectors = [null, ...EP_CASES.filter((edgeCase) => !bottomSolved || edgeCase.name.endsWith('/ -'))];
  const matching: string[] = [];

  for (const injector of injectors) {
    const edgeSetup = injector
      ? invertSq1Alg(normalizeSquanmateSq1Algorithm(injector.algorithm))
      : '';
    const setup = canonicalSq1Alg(`${edgeSetup} ${cornerSetup}`);
    const trace = traceSq1Algorithm(setup);
    const finalState = trace.ok ? trace.steps.at(-1)?.state : null;
    if (finalState && parityOf(finalState) === item.parity) matching.push(setup);
  }

  if (matching.length === 0) throw new Error(`No ${item.parity} setup for ${item.name}`);
  return choice(matching, random);
}

function fixedCaseSetup(item: Sq1AlgTrainerCase, random: () => number): string {
  const solve = normalizeSquanmateSq1Algorithm(item.algorithm);
  const top = choice(SQUARE_ROTATIONS, random);
  const bottom = choice(SQUARE_ROTATIONS, random);
  return canonicalSq1Alg(invertSq1Alg(`(${top}, ${bottom}) ${solve}`));
}

function desiredMiddleFlipped(strategy: Sq1MiddleStrategy, random: () => number): boolean {
  if (strategy === 'always') return true;
  if (strategy === 'never') return false;
  return random() < 0.5;
}

function setMiddle(
  setup: string,
  strategy: Sq1MiddleStrategy,
  random: () => number,
): { setup: string; state: Sq1State } {
  const target = desiredMiddleFlipped(strategy, random);
  let normalized = canonicalSq1Alg(setup);
  let state = applySq1Scramble(normalized);
  if ((!state.sliceSolved) !== target) {
    normalized = canonicalSq1Alg(`${SQ1_MIDDLE_FLIP_SETUP} ${normalized}`);
    state = applySq1Scramble(normalized);
  }
  return { setup: normalized, state };
}

export function createSq1AlgTrainerRound(
  item: Sq1AlgTrainerCase,
  strategy: Sq1MiddleStrategy,
  random: () => number = Math.random,
): Sq1AlgTrainerRound {
  const baseSetup = item.groupId === 'cubeshape'
    ? randomCubeshapeSetup(item.parity, random)
    : item.groupId === 'lin-corner-permutation'
      ? linCornerSetup(item, random)
      : fixedCaseSetup(item, random);
  const result = setMiddle(baseSetup, strategy, random);
  const trace = traceSq1Algorithm(result.setup);
  if (!trace.ok) throw new Error(`Generated an illegal setup for ${item.name}: ${trace.reason}`);

  return {
    case: item,
    scramble: result.setup,
    state: result.state,
    middleFlipped: !result.state.sliceSolved,
  };
}

export function chooseSq1AlgTrainerCase(
  selectedIds: ReadonlySet<string>,
  random: () => number = Math.random,
): Sq1AlgTrainerCase | null {
  const selected = SQ1_ALG_TRAINER_CASES.filter((item) => selectedIds.has(item.id));
  return selected.length > 0 ? choice(selected, random) : null;
}
