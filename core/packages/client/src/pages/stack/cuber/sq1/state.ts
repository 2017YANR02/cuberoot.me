/**
 * SQ1 state model + scramble parser.
 *
 * 24-slot piece array (12 top + 12 bottom). Corners occupy 2 consecutive slots
 * (60° span, same id); edges occupy 1 slot (30° span). Solved id range:
 * top 0..7, bottom 8..15. Layout & semantics verbatim from tnoodle SquareOnePuzzle.java.
 *
 * Geometry mapping (for the 3D renderer, NOT used by the state machine itself):
 *   - Top slot k (0..11) sits at angle θ_top(k) = (k * 30° + 15°) around +Y axis,
 *     measured CCW from the +X axis, at height y = +halfH.
 *     Slot 0 spans 0..30° (i.e. center 15°). With +15° offset slot 0's wedge
 *     center is at 15° i.e. just CCW of +X axis. This places the slash plane
 *     (X=0) between slots 5-6 (left half = 0..5, right half = 6..11) when
 *     measured CCW from +X.
 *   - Bottom slot k (0..11): same θ but at y = -halfH.
 *   - Slash plane: x = 0 (YZ plane). The slash rotation swaps right-half slots
 *     [6..11] top with bottom right-half slots [12..17]. This implies slot 6 top
 *     and slot 12 bottom are at the same (x,z) — so bottom slot ordering must
 *     also place slot 12..17 on the +X side. We define bottom slot k angle =
 *     θ_top((k - 6 + 24) % 12) so that bottom slot 12 = top slot 6, bottom slot
 *     13 = top slot 7, etc., aligning the slash pairing.
 *
 *     i.e. bottomAngle(k) = topAngle((k - 6 + 24) % 12) for k in 0..11
 *     (where k is the local bottom index 0..11, mapped from array index 12..23).
 */

export const SQ1_FACE_KEYS = ['L', 'B', 'R', 'F', 'U', 'D'] as const;
export type Sq1FaceKey = typeof SQ1_FACE_KEYS[number];

/** Default WCA-ish scheme (matches tnoodle SquareOnePuzzle.java). */
export const DEFAULT_SQ1_COLORS: Record<Sq1FaceKey, string> = {
  L: '#0000FF', // blue
  B: '#FF8000', // orange
  R: '#00FF00', // green
  F: '#FF0000', // red
  U: '#FFFF00', // yellow
  D: '#FFFFFF', // white
};

export interface Sq1State {
  /** True when the equator slice is in solved orientation (F on +Z, B on -Z). */
  sliceSolved: boolean;
  /** 24 piece ids: 12 top + 12 bottom. Corners occupy 2 consecutive slots. */
  pieces: number[];
}

export const SOLVED_PIECES: number[] = [
  0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7,
  8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15,
];

/** Solved state factory. */
export function solvedSq1(): Sq1State {
  return { pieces: SOLVED_PIECES.slice(), sliceSolved: true };
}

/** A single SQ1 move: either (top, bottom) layer turn, or slash. */
export type Sq1Move =
  | { kind: 'turn'; top: number; bottom: number }
  | { kind: 'slash' };

/** Tokenizer (verbatim from sq1_svg.ts). */
const SQ1_TOKEN_RE = /(\/)|\(?\s*(-?\d+)\s*(?:,\s*|\s+|(?=-?\d))(-?\d+)\s*\)?/g;

/** Parse a scramble string into a list of canonical Sq1Move's. */
export function parseSq1Scramble(scramble: string): Sq1Move[] {
  const moves: Sq1Move[] = [];
  const re = new RegExp(SQ1_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(scramble)) !== null) {
    if (m[1] === '/') {
      moves.push({ kind: 'slash' });
    } else if (m[2] !== undefined) {
      const top = parseInt(m[2], 10);
      const bottom = parseInt(m[3], 10);
      moves.push({ kind: 'turn', top, bottom });
    }
  }
  return moves;
}

/** Apply one Sq1Move to a state in-place style (returns a NEW state). */
export function applySq1Move(state: Sq1State, move: Sq1Move): Sq1State {
  if (move.kind === 'slash') {
    const pieces = state.pieces.slice();
    for (let i = 0; i < 6; i++) {
      const c = pieces[i + 12];
      pieces[i + 12] = pieces[i + 6];
      pieces[i + 6] = c;
    }
    return { pieces, sliceSolved: !state.sliceSolved };
  }
  // Turn: tnoodle semantics — applying (t, b) shifts CW so the layer's piece
  // at slot 0 came from slot t (top) / slot b (bottom). i.e. pieces' indices
  // rotate by -t mod 12 for top, -b mod 12 for bottom.
  const t = ((-move.top % 12) + 12) % 12;
  const b = ((-move.bottom % 12) + 12) % 12;
  const next = state.pieces.slice();
  const oldTop = state.pieces.slice(0, 12);
  for (let i = 0; i < 12; i++) next[i] = oldTop[(t + i) % 12];
  const oldBot = state.pieces.slice(12, 24);
  for (let i = 0; i < 12; i++) next[i + 12] = oldBot[(b + i) % 12];
  return { pieces: next, sliceSolved: state.sliceSolved };
}

/** Apply a full scramble string. Convenience wrapper. */
export function applySq1Scramble(scramble: string): Sq1State {
  let state = solvedSq1();
  for (const m of parseSq1Scramble(scramble)) {
    state = applySq1Move(state, m);
  }
  return state;
}

/** A turn is "legal" only when both layers can split cleanly (no corner
 * straddles the slash plane). This is a sanity-check predicate for animation —
 * for animation we don't enforce it (the user feeds canonical scrambles).
 * Definition: slot 5↔6 boundary and slot 11↔0 boundary must NOT split a corner.
 * Implementation: check pieces[5] !== pieces[6] AND pieces[11] !== pieces[0],
 * same for the bottom layer. */
export function isSlashLegal(state: Sq1State): boolean {
  const p = state.pieces;
  return (
    p[5] !== p[6] && p[11] !== p[0] &&
    p[17] !== p[18] && p[23] !== p[12]
  );
}

/** Get a piece's metadata (corner vs edge, layer, base color). */
export function pieceInfo(id: number): {
  isCorner: boolean;
  layer: 'top' | 'bottom';
  /** Span in 30° units (corner=2, edge=1). */
  span: number;
} {
  // Top: id 0..7 (4 corners 0,2,4,6 + 4 edges 1,3,5,7)
  // Bottom: id 8..15 (4 corners 9,11,13,15 + 4 edges 8,10,12,14)
  const isCorner = ((id + (id <= 7 ? 0 : 1)) % 2) === 0;
  const layer = id <= 7 ? 'top' : 'bottom';
  return { isCorner, layer, span: isCorner ? 2 : 1 };
}

/** Get the 2-3 sticker colors for a piece (matching tnoodle's getPieceColors).
 * Returns:
 *   - corner: [top/bottom face color, side A, side B]
 *   - edge: [top/bottom face color, side]
 * The face keys are L=0 / B=1 / R=2 / F=3 / U=4 / D=5 (SQ1_FACE_KEYS order). */
export function pieceColors(id: number, scheme: string[]): {
  top: string;
  sides: string[];
} {
  const up = id <= 7;
  const top = up ? scheme[4] : scheme[5];
  const { isCorner } = pieceInfo(id);
  if (isCorner) {
    let p = up ? id : 15 - id;
    let a = scheme[(Math.floor(p / 2) + 3) % 4];
    let b = scheme[Math.floor(p / 2)];
    if (!up) { const tmp = a; a = b; b = tmp; }
    return { top, sides: [a, b] };
  }
  const p = up ? id : 14 - id;
  return { top, sides: [scheme[Math.floor(p / 2)]] };
}
