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
import { parseSq1Tokens, type Sq1Token } from '@/lib/sq1-svg';

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

// ─── slash-validity (shape gating for U/D layer turns) ────────────────────
//
// The east slice cuts the equator between slots 5|6 and 11|0 on both top and
// bot. A slice is only physically possible when *neither* cut bisects a
// corner — i.e. corners (2 consecutive slots with same piece id) never
// straddle either boundary. This is a function of the discrete state only;
// the live render can sit anywhere mid-drag.

function layerSlashValid(pieces: number[], offset: number): boolean {
  return pieces[offset + 5] !== pieces[offset + 6]
    && pieces[offset + 11] !== pieces[offset + 0];
}

/** True iff the state allows an `/` slice without bisecting a corner. */
export function isSlashValid(state: Sq1State): boolean {
  return layerSlashValid(state.pieces, 0) && layerSlashValid(state.pieces, 12);
}

/**
 * Pick the integer-unit layer turn in [-6, 6] closest to `targetUnits` whose
 * resulting state stays slash-valid. The opposite layer is untouched, so its
 * validity is inherited. Ties (equal distance) prefer the smaller |U| —
 * dragging into a forbidden 30° wedge from solved snaps back to 0, not to
 * the next 60°.
 *
 * Always returns *some* U (0 if no non-zero candidate is closer); callers
 * commit only when U ≠ 0.
 */
export function snapValidLayerTurn(
  state: Sq1State,
  layer: 'top' | 'bot',
  targetUnits: number,
): number {
  let bestU = 0;
  let bestDist = Infinity;
  for (let u = -6; u <= 6; u++) {
    const move: Sq1Move = layer === 'top'
      ? { kind: 'turn', top: u, bot: 0 }
      : { kind: 'turn', top: 0, bot: u };
    const next = applySq1Move(state, move);
    if (!isSlashValid(next)) continue;
    const d = Math.abs(u - targetUnits);
    if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) < 1e-9 && Math.abs(u) < Math.abs(bestU))) {
      bestDist = d;
      bestU = u;
    }
  }
  return bestU;
}
