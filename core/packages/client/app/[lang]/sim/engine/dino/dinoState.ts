/**
 * Dino Cube (恐龙魔方) state model + notation.
 *
 * The Dino Cube is a corner-turning puzzle: a cube shell with 12 movable EDGE
 * pieces (one per cube edge) and 8 fixed corner pieces (hubs, revealed mid-move).
 * It has 8 turning axes (the body diagonals through each corner); one twist is a
 * ±120° rotation that 3-cycles the three edge pieces around that corner. There is
 * no piece-flip freedom — an edge's orientation is fully determined by its slot —
 * so the state is just a permutation of the 12 edge pieces. (Verified against
 * Jaap's Puzzle Page + Wikipedia: 12 edge pieces, 8 corner axes, 120° 3-cycles,
 * 11!/2 = 19,958,400 reachable states, even-permutation parity.)
 *
 * Notation (self-contained /sim world, like Ivy): a corner is named by its 3 face
 * letters in fixed order U/D, F/B, L/R (e.g. UFR, DBL). A bare token = a CLOCKWISE
 * 120° twist of that corner viewed from outside (−120° about its outward body
 * diagonal); a primed token (UFR') = the CCW inverse (+120°). Bare = clockwise
 * matches standard cube notation (R is clockwise), so a single clockwise drag
 * records the bare letter — not a prime. We never feed this to an external solver,
 * so the convention only has to be internally consistent (bare and primed are
 * inverses).
 */
import {
  parseCornerMoves, cornerMoveToString, cornerMovesToString, randomCornerScramble,
} from '../cornerNotation';

/** Edge slot order (index 0..11). Each name is the two faces the edge touches. */
export const EDGE_NAMES = [
  'DB', 'LB', 'DL', 'DF', 'LF', 'UL', 'UB', 'RB', 'DR', 'UF', 'RF', 'UR',
] as const;
export type EdgeName = typeof EDGE_NAMES[number];

/** Corner names (the 8 turning axes), in face order U/D, F/B, L/R. */
export const CORNER_NAMES = [
  'DBL', 'DFL', 'UBL', 'UFL', 'DBR', 'DFR', 'UBR', 'UFR',
] as const;
export type CornerName = typeof CORNER_NAMES[number];

/** Body-diagonal axis (sign of x,y,z) for each corner, same index as CORNER_NAMES. */
export const CORNER_AXIS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, -1], // DBL
  [-1, -1, 1],  // DFL
  [-1, 1, -1],  // UBL
  [-1, 1, 1],   // UFL
  [1, -1, -1],  // DBR
  [1, -1, 1],   // DFR
  [1, 1, -1],   // UBR
  [1, 1, 1],    // UFR
];

/**
 * For each corner, the 3 edge slots it cycles, in +120° order
 * (slot a → slot b → slot c → a). Computed offline from the geometry
 * (rot(axis, +120°) maps each edge center to the next); see
 * .tmp/dino/state_design.mjs. Locked here so the runtime needs no rotation math
 * to apply a discrete move.
 */
export const CORNER_CYCLE: ReadonlyArray<readonly [number, number, number]> = [
  [0, 2, 1],   // DBL: DB → DL → LB
  [2, 3, 4],   // DFL: DL → DF → LF
  [1, 5, 6],   // UBL: LB → UL → UB
  [4, 9, 5],   // UFL: LF → UF → UL
  [0, 7, 8],   // DBR: DB → RB → DR
  [3, 8, 10],  // DFR: DF → DR → RF
  [6, 11, 7],  // UBR: UB → UR → RB
  [9, 10, 11], // UFR: UF → RF → UR
];

export interface DinoMove {
  /** Corner index 0..7 (CORNER_NAMES / CORNER_AXIS / CORNER_CYCLE). */
  corner: number;
  /** Physical twist: +1 = +120° about the corner's outward body diagonal (CCW
   *  viewed from outside → the PRIMED token); -1 = −120° (clockwise → the BARE
   *  token). The dir↔token mapping lives in dinoMoveToString / parseDinoMoves. */
  dir: 1 | -1;
}

/** Solved permutation: slot i holds piece i. */
export function solvedDino(): number[] {
  return Array.from({ length: 12 }, (_, i) => i);
}

/**
 * Apply one move to a 12-slot permutation (perm[slot] = pieceId), returning a new
 * array. A move 3-cycles the corner's three slots; dir flips the cycle direction.
 */
export function applyDinoMove(perm: number[], move: DinoMove): number[] {
  const [a, b, c] = CORNER_CYCLE[move.corner];
  const out = perm.slice();
  if (move.dir === 1) {
    // +120: content of a→b, b→c, c→a
    out[b] = perm[a];
    out[c] = perm[b];
    out[a] = perm[c];
  } else {
    out[a] = perm[b];
    out[b] = perm[c];
    out[c] = perm[a];
  }
  return out;
}

const TOKEN_RE = /^(UFR|UFL|UBR|UBL|DFR|DFL|DBR|DBL)('?)$/;

/** Parse a scramble/alg string into moves. Unknown tokens are skipped. */
export function parseDinoMoves(text: string): DinoMove[] {
  return parseCornerMoves(text, TOKEN_RE, CORNER_NAMES);
}

/** Render one move back to its canonical token. Bare = the clockwise twist
 *  (dir -1, −120°); primed = its CCW inverse (dir +1). Chosen so a single clockwise
 *  drag records the bare letter (R-is-clockwise intuition). Must stay the exact
 *  inverse of parseDinoMoves. */
export function dinoMoveToString(move: DinoMove): string {
  return cornerMoveToString(move, CORNER_NAMES);
}

export function dinoMovesToString(moves: DinoMove[]): string {
  return cornerMovesToString(moves, CORNER_NAMES);
}

/** True iff every slot holds its home piece. */
export function isSolved(perm: number[]): boolean {
  for (let i = 0; i < 12; i++) if (perm[i] !== i) return false;
  return true;
}

/**
 * Random legal scramble: `n` twists, never the same corner twice in a row (a
 * second twist of the same corner just composes into one move, wasting length).
 * Returns the move list; the caller animates / applies them.
 */
export function randomDinoScramble(n = 15): DinoMove[] {
  return randomCornerScramble(n);
}

/** Apply a whole scramble to solved and return the resulting permutation. */
export function applyDinoScramble(moves: DinoMove[]): number[] {
  let perm = solvedDino();
  for (const m of moves) perm = applyDinoMove(perm, m);
  return perm;
}
