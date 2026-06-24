/**
 * Redi Cube (Redi 魔方) state model + notation.
 *
 * The Redi Cube is a corner-turning puzzle whose mechanism is the Dino Cube's:
 * a cube shell with 12 movable EDGE pieces (one per cube edge) cycled in ±120°
 * 3-cycles about the 8 body-diagonal corner axes. Redi ADDS 8 visible CORNER
 * pieces (one per vertex) that twist IN PLACE with each corner turn — they never
 * change vertex, only their orientation (0/1/2) cycles. There are NO centers and
 * no fixed reference frame. (Verified against cstimer's redi.js scrambler, the
 * cubing.js redi_cube kpuzzle, and grubiks: 12 edges + 8 corners, corner turn =
 * 120° rotating that corner cap + its 3 adjacent edges, ~1.57e12 = 12!/2 · 3^8
 * reachable states.)
 *
 * Coordinate frame: +x = R(ight), +y = U(p), +z = F(ront). A corner axis is the
 * outward unit body diagonal through that vertex.
 *
 * Notation (real Redi, self-contained /sim world): the 8 corner twists are named
 * F L B R (the 4 TOP corners) + f l b r (the 4 BOTTOM corners), in cyclic order
 * around each layer. A bare token = a CLOCKWISE 120° twist of that corner viewed
 * from outside (−120° about its outward body diagonal, dir −1); a primed token
 * (F') = the CCW inverse (dir +1). Bare = clockwise matches standard speedcube
 * intuition, so a single clockwise drag records the bare letter. We never feed
 * this to an external solver, so the convention only has to be internally
 * consistent (bare and primed are exact inverses).
 */
import {
  parseCornerMoves, cornerMoveToString, cornerMovesToString, randomCornerScramble,
} from '../cornerNotation';

/** Edge slot order (index 0..11). Each name is the two faces the edge touches.
 *  Identical to the Dino model (same 12 cube edges). */
export const EDGE_NAMES = [
  'DB', 'LB', 'DL', 'DF', 'LF', 'UL', 'UB', 'RB', 'DR', 'UF', 'RF', 'UR',
] as const;
export type EdgeName = typeof EDGE_NAMES[number];

/** Corner move letters = the 8 turning axes, in real Redi order:
 *  F L B R = the 4 top corners (cyclic), f l b r = the 4 bottom corners. */
export const CORNER_NAMES = ['F', 'L', 'B', 'R', 'f', 'l', 'b', 'r'] as const;
export type CornerName = typeof CORNER_NAMES[number];

/** Outward body-diagonal axis (sign of x,y,z) per corner, same index as
 *  CORNER_NAMES. Top corners (uppercase) have y=+1, bottom (lowercase) y=−1; the
 *  four go counter-clockwise from front-right viewed from above:
 *  F=UFR, L=UFL, B=UBL, R=UBR ; f=DFR, l=DFL, b=DBL, r=DBR. */
export const CORNER_AXIS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1],    // F = UFR
  [-1, 1, 1],   // L = UFL
  [-1, 1, -1],  // B = UBL
  [1, 1, -1],   // R = UBR
  [1, -1, 1],   // f = DFR
  [-1, -1, 1],  // l = DFL
  [-1, -1, -1], // b = DBL
  [1, -1, -1],  // r = DBR
];

/**
 * For each corner, the 3 edge slots it 3-cycles, in +120° order
 * (slot a → slot b → slot c → a, content-wise). Derived from the geometry
 * (rot(axis, +120°) maps each edge midpoint to the next) — these are the Dino
 * cycles re-indexed into FLBRflbr corner order. Locked here so the runtime needs
 * no rotation math to apply a discrete move.
 */
export const CORNER_CYCLE: ReadonlyArray<readonly [number, number, number]> = [
  [9, 10, 11], // F = UFR: UF → RF → UR
  [4, 9, 5],   // L = UFL: LF → UF → UL
  [1, 5, 6],   // B = UBL: LB → UL → UB
  [6, 11, 7],  // R = UBR: UB → UR → RB
  [3, 8, 10],  // f = DFR: DF → DR → RF
  [2, 3, 4],   // l = DFL: DL → DF → LF
  [0, 2, 1],   // b = DBL: DB → DL → LB
  [0, 7, 8],   // r = DBR: DB → RB → DR
];

export interface RediMove {
  /** Corner index 0..7 (CORNER_NAMES / CORNER_AXIS / CORNER_CYCLE). */
  corner: number;
  /** Physical twist: +1 = +120° about the corner's outward body diagonal (CCW
   *  viewed from outside → the PRIMED token); -1 = −120° (clockwise → the BARE
   *  token). The dir↔token mapping lives in rediMoveToString / parseRediMoves. */
  dir: 1 | -1;
}

/** Full Redi state: edge permutation (perm[slot]=pieceId) + corner orientations
 *  (co[corner] ∈ {0,1,2}, the net number of +120° twists mod 3). Corners never
 *  permute, so only their orientation is tracked. */
export interface RediState {
  edges: number[];
  corners: number[];
}

export function solvedRedi(): RediState {
  return {
    edges: Array.from({ length: 12 }, (_, i) => i),
    corners: Array.from({ length: 8 }, () => 0),
  };
}

/**
 * Apply one move to a state, returning a NEW state. A move 3-cycles the corner's
 * three edge slots and twists that corner in place; dir flips both directions.
 */
export function applyRediMove(state: RediState, move: RediMove): RediState {
  const [a, b, c] = CORNER_CYCLE[move.corner];
  const edges = state.edges.slice();
  if (move.dir === 1) {
    // +120°: content of a→b, b→c, c→a
    edges[b] = state.edges[a];
    edges[c] = state.edges[b];
    edges[a] = state.edges[c];
  } else {
    edges[a] = state.edges[b];
    edges[b] = state.edges[c];
    edges[c] = state.edges[a];
  }
  const corners = state.corners.slice();
  corners[move.corner] = ((corners[move.corner] + move.dir) % 3 + 3) % 3;
  return { edges, corners };
}

const TOKEN_RE = /^([FLBRflbr])('?)$/;

/** Parse a scramble/alg string into moves. Unknown tokens are skipped. */
export function parseRediMoves(text: string): RediMove[] {
  return parseCornerMoves(text, TOKEN_RE, CORNER_NAMES);
}

/** Render one move back to its canonical token. Bare = the clockwise twist
 *  (dir -1, −120°); primed = its CCW inverse (dir +1). Chosen so a single
 *  clockwise drag records the bare letter. Must stay the exact inverse of
 *  parseRediMoves. */
export function rediMoveToString(move: RediMove): string {
  return cornerMoveToString(move, CORNER_NAMES);
}

export function rediMovesToString(moves: RediMove[]): string {
  return cornerMovesToString(moves, CORNER_NAMES);
}

/** True iff every edge is home AND every corner orientation is 0. */
export function isSolved(state: RediState): boolean {
  for (let i = 0; i < 12; i++) if (state.edges[i] !== i) return false;
  for (let i = 0; i < 8; i++) if (state.corners[i] !== 0) return false;
  return true;
}

/**
 * Random legal scramble: `n` twists, never the same corner twice in a row (a
 * second twist of the same corner just composes, wasting length).
 */
export function randomRediScramble(n = 20): RediMove[] {
  return randomCornerScramble(n);
}

/** Apply a whole scramble to solved and return the resulting state. */
export function applyRediScramble(moves: RediMove[]): RediState {
  let s = solvedRedi();
  for (const m of moves) s = applyRediMove(s, m);
  return s;
}
