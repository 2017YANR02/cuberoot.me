/**
 * SQ1 state model + scramble parser.
 *
 * 24-slot piece array (12 top + 12 bottom). Corners occupy 2 consecutive slots
 * (60° span, same id); edges occupy 1 slot (30° span). Solved id range:
 * top 0..7, bottom 8..15. Layout follows tnoodle SquareOnePuzzle.java.
 *
 * Move kinds:
 *   - 'turn'  : (top, bot) integer 30° unit layer rotations
 *   - 'slice' : flip the east-half slabs across the chord-perp axis
 *
 * Notation: parser is shared with `pages/gen/sq1_svg.ts` (single source of
 * truth, `parseSq1Tokens`). Supports `(t,b) / (t,b) / ...`, paren-/comma-/
 * space-optional forms, and `t` single-number shorthand = `(t, 0)`.
 */
import { parseSq1Tokens, type Sq1Token } from '../../../gen/sq1_svg';

export interface Sq1State {
  /** True when the equator slice is in solved orientation (F on +Z, B on -Z). */
  sliceSolved: boolean;
  /** 24 piece ids: 12 top + 12 bottom. Corners occupy 2 consecutive slots. */
  pieces: number[];
}

export type Sq1Move = Sq1Token;

export const SOLVED_PIECES: number[] = [
  0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7,
  8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15,
];

export function solvedSq1(): Sq1State {
  return { pieces: SOLVED_PIECES.slice(), sliceSolved: true };
}

export function parseSq1Scramble(scramble: string): Sq1Move[] {
  return parseSq1Tokens(scramble);
}

export function applySq1Move(state: Sq1State, move: Sq1Move): Sq1State {
  if (move.kind === 'slice') {
    const pieces = state.pieces.slice();
    for (let i = 0; i < 6; i++) {
      const c = pieces[i + 12];
      pieces[i + 12] = pieces[i + 6];
      pieces[i + 6] = c;
    }
    return { pieces, sliceSolved: !state.sliceSolved };
  }
  const t = ((-move.top % 12) + 12) % 12;
  const b = ((-move.bot % 12) + 12) % 12;
  const next = state.pieces.slice();
  const oldTop = state.pieces.slice(0, 12);
  for (let i = 0; i < 12; i++) next[i] = oldTop[(t + i) % 12];
  const oldBot = state.pieces.slice(12, 24);
  for (let i = 0; i < 12; i++) next[i + 12] = oldBot[(b + i) % 12];
  return { pieces: next, sliceSolved: state.sliceSolved };
}

export function applySq1Scramble(scramble: string): Sq1State {
  let state = solvedSq1();
  for (const m of parseSq1Scramble(scramble)) state = applySq1Move(state, m);
  return state;
}

/** Render a Sq1Move back to canonical string token. */
export function moveToString(m: Sq1Move): string {
  return m.kind === 'slice' ? '/' : `(${m.top},${m.bot})`;
}

/** Stringify a list of moves, space-separated. */
export function movesToString(moves: Sq1Move[]): string {
  return moves.map(moveToString).join(' ');
}
