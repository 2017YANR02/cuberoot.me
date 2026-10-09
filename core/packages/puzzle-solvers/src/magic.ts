/**
 * Rubik's Magic / Master Magic practice routes.
 *
 * These are string-connected folding panels, not face-turning cubes. F means
 * one step along the documented folding route, F' retraces that step. The
 * bounded route deliberately does not claim to solve arbitrary string states.
 * Forward / Backward retain CubeRoot's existing timer strings. They choose the
 * rectangle -> target or target -> rectangle direction respectively.
 * Historical competition rules did not scramble these events.
 */
import { MAGIC_EIGHT_STEPS, magicEightPoses, magicEightLayerOffsets, type MagicPose } from './magic-eight-path';
import { MAGIC_TWELVE_STEPS, magicTwelvePoses, magicTwelveLayerOffsets } from './magic-twelve-path';

export type { MagicPose } from './magic-eight-path';
export type MagicPuzzle = 'magic' | 'mmagic';
export type MagicDirection = 'Forward' | 'Backward';
export type MagicMove =
  | { kind: 'fold'; dir: 1 | -1 }
  | { kind: 'setup'; direction: MagicDirection };
export interface MagicState { direction: MagicDirection; step: number }

export function isMagicPuzzle(value: unknown): value is MagicPuzzle {
  return value === 'magic' || value === 'mmagic';
}

export function magicStepCount(puzzle: MagicPuzzle): number {
  return puzzle === 'magic' ? MAGIC_EIGHT_STEPS : MAGIC_TWELVE_STEPS;
}

export function magicTileCount(puzzle: MagicPuzzle): 8 | 12 {
  return puzzle === 'magic' ? 8 : 12;
}

function spans(text: string): string[] {
  return text.match(/\s+|M\s+(?:Forward|Backward)\b|[^\s]+/gi) ?? [];
}

function parseToken(token: string, puzzle: MagicPuzzle): MagicMove {
  const normalized = token.trim().replace(/[’′]/g, "'");
  if (/^F'?$/i.test(normalized)) return { kind: 'fold', dir: normalized.endsWith("'") ? -1 : 1 };
  const direction = /^(M\s+)?(Forward|Backward)$/i.exec(normalized);
  if (direction && (!direction[1] || puzzle === 'mmagic')) {
    return { kind: 'setup', direction: direction[2].toLowerCase() === 'forward' ? 'Forward' : 'Backward' };
  }
  throw new Error(`Invalid ${puzzle} notation: ${token}`);
}

export function classifyMagicTokens(text: string, puzzle: MagicPuzzle): Array<{ text: string; bad: boolean }> {
  return spans(text).map(token => {
    try { if (token.trim()) parseToken(token, puzzle); return { text: token, bad: false }; }
    catch { return { text: token, bad: true }; }
  });
}

export function parseMagicMoves(text: string, puzzle: MagicPuzzle): MagicMove[] {
  return spans(text).filter(token => token.trim()).map(token => parseToken(token, puzzle));
}

/** Preview/generator inputs are practice directions, not cube algorithms. */
export function parseMagicSetup(text: string, puzzle: MagicPuzzle): MagicDirection {
  if (!text.trim()) return 'Forward';
  const moves = parseMagicMoves(text, puzzle);
  if (moves.length !== 1 || moves[0].kind !== 'setup') throw new Error(`Invalid ${puzzle} practice direction`);
  return moves[0].direction;
}

export function magicMoveToString(move: MagicMove): string {
  return move.kind === 'setup' ? move.direction : move.dir === 1 ? 'F' : "F'";
}

export function magicMovesToString(moves: readonly MagicMove[]): string {
  return moves.map(magicMoveToString).join(' ');
}

/** Only fold tokens have inverses; a direction is a starting configuration. */
export function invertMagicMoves(moves: readonly MagicMove[]): MagicMove[] {
  if (moves.some(move => move.kind === 'setup')) throw new Error('A Magic practice direction is a setup, not an invertible fold');
  return [...moves].reverse().map(move => ({ kind: 'fold', dir: (move as { dir: 1 | -1 }).dir === 1 ? -1 : 1 }));
}

export function initialMagicState(direction: MagicDirection = 'Forward'): MagicState {
  return { direction, step: 0 };
}

export function applyMagicMove(state: MagicState, move: MagicMove, puzzle: MagicPuzzle): MagicState {
  if (move.kind === 'setup') return initialMagicState(move.direction);
  const next = state.step + move.dir;
  if (next < 0 || next > magicStepCount(puzzle)) throw new Error('Fold is outside the documented Magic route');
  return { ...state, step: next };
}

export function magicStateFromMoves(puzzle: MagicPuzzle, text: string, start = initialMagicState()): MagicState {
  return parseMagicMoves(text, puzzle).reduce((state, move) => applyMagicMove(state, move, puzzle), start);
}

/** Reject a whole paste atomically, including legal tokens in an illegal order. */
export function magicSequenceValid(puzzle: MagicPuzzle, setup: string, algorithm = ''): boolean {
  try {
    const start = magicStateFromMoves(puzzle, setup);
    const moves = parseMagicMoves(algorithm, puzzle);
    if (moves.some(move => move.kind === 'setup')) return false;
    moves.reduce((state, move) => applyMagicMove(state, move, puzzle), start);
    return true;
  } catch { return false; }
}

export function magicRoutePosition(puzzle: MagicPuzzle, state: MagicState): number {
  return state.direction === 'Forward' ? state.step : magicStepCount(puzzle) - state.step;
}

/** Continuous, rigid tile poses in a common XY/front-Z frame, tile edge = 1. */
export function magicPoses(puzzle: MagicPuzzle, position: number): MagicPose[] {
  if (!Number.isFinite(position) || position < 0 || position > magicStepCount(puzzle)) throw new RangeError('Invalid Magic route position');
  return puzzle === 'magic' ? magicEightPoses(position) : magicTwelvePoses(position);
}

/** Render-only stack spacing, measured in half a tile's thickness along its normal. */
export function magicLayerOffsets(puzzle: MagicPuzzle, position: number): number[] {
  return puzzle === 'magic' ? magicEightLayerOffsets(position) : magicTwelveLayerOffsets(position);
}

export function magicSolution(puzzle: MagicPuzzle, state = initialMagicState()): string {
  return Array.from({ length: magicStepCount(puzzle) - state.step }, () => 'F').join(' ');
}

/** Cancel only adjacent opposite folds; same-direction folds are distinct steps. */
export function reduceMagicAlg(text: string, puzzle: MagicPuzzle): string {
  const out: MagicMove[] = [];
  for (const move of parseMagicMoves(text, puzzle)) {
    const prev = out.at(-1);
    if (move.kind === 'fold' && prev?.kind === 'fold' && move.dir !== prev.dir) out.pop();
    else out.push(move);
  }
  return magicMovesToString(out);
}
