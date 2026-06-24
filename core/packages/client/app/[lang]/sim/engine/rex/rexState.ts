/**
 * Rex Cube (Rex 魔方 / cubic Face-Turning-Octahedron) state model + notation.
 *
 * The Rex Cube is a deep-cut corner-turning puzzle — mechanically the Master Skewb
 * WITHOUT its corner pieces, and isomorphic to the Face-Turning Octahedron. It has
 * 8 turning axes (the cube's body diagonals); one twist is a ±120° rotation about a
 * corner that moves a "cap" of 3 + 3 + 9 = 15 visible pieces. There are 3 piece
 * types, ALL permutation-only (no flips / in-place twists):
 *   - 6 face CENTRES (one per face — a 45°-rotated diamond);
 *   - 24 PETALS (curved corner-triangles, 4 per face, in two orbits of 12);
 *   - 12 EDGES (lens slivers on the cube edges, Dino-style, cannot flip).
 * A corner turn 3-cycles its 3 adjacent centres, 3-cycles its 3 incident edges, and
 * cycles 9 petals as THREE 3-cycles. (Verified against Jaap's Puzzle Page: 42 pieces,
 * 8 corner axes, 120°, 11!·6!·12!²/2¹⁴ reachable states.)
 *
 * The cycle/membership tables below were derived offline from the exact geometry
 * (8 spheres centred on the corner axes, through each corner's 3 adjacent vertices)
 * in .tmp/rex/emit.mjs and LOCKED here so the runtime needs no rotation math.
 *
 * Notation (self-contained /sim world, like Dino): a corner is named by its 3 face
 * letters in fixed order U/D, F/B, L/R (e.g. UFR, DBL). A bare token = a CLOCKWISE
 * 120° twist viewed from outside (−120° about its outward body diagonal, dir −1); a
 * primed token (UFR') = the CCW inverse (dir +1). Bare = clockwise matches standard
 * cube intuition. Never fed to an external solver, so it only has to be internally
 * consistent (bare and primed are exact inverses).
 */
import {
  parseCornerMoves, cornerMoveToString, cornerMovesToString, randomCornerScramble,
} from '../cornerNotation';

// ---- face indexing (0..5) used by centres + petals (letter → colour at render) ----
export const FACE_LETTERS = ['U', 'D', 'F', 'B', 'L', 'R'] as const;

// ---- 8 corners (turning axes), named U/D, F/B, L/R ----
export const CORNER_NAMES = ['DBL', 'DFL', 'UBL', 'UFL', 'DBR', 'DFR', 'UBR', 'UFR'] as const;
export type CornerName = typeof CORNER_NAMES[number];

/** Outward body-diagonal axis (sign of x,y,z) per corner, same index as CORNER_NAMES. */
export const CORNER_AXIS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
  [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
];

// ---- 12 EDGES: id → its two face letters + midpoint sign vector (one 0 coord) ----
export const EDGE_NAMES = ['DB', 'DF', 'UB', 'UF', 'BL', 'BR', 'FL', 'FR', 'LD', 'LU', 'RD', 'RU'] as const;
export const EDGE_MID: ReadonlyArray<readonly [number, number, number]> = [
  [0, -1, -1], [0, -1, 1], [0, 1, -1], [0, 1, 1], [-1, 0, -1], [1, 0, -1],
  [-1, 0, 1], [1, 0, 1], [-1, -1, 0], [-1, 1, 0], [1, -1, 0], [1, 1, 0],
];

// ---- 24 PETALS: id → its home face (0..5) + its corner (0..7) ----
export const PETAL_FACE: ReadonlyArray<number> = [
  0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5,
];
export const PETAL_CORNER: ReadonlyArray<number> = [
  2, 3, 6, 7, 0, 1, 4, 5, 1, 3, 5, 7, 0, 2, 4, 6, 0, 1, 2, 3, 4, 5, 6, 7,
];

// ---- per-corner +120° cycles (each inner array = a 3-cycle: a→b→c→a content-wise) ----
export const CENTER_CYCLE: ReadonlyArray<ReadonlyArray<readonly number[]>> = [
  [[1, 4, 3]], [[1, 2, 4]], [[0, 3, 4]], [[0, 4, 2]],
  [[1, 3, 5]], [[1, 5, 2]], [[0, 5, 3]], [[0, 2, 5]],
];
export const EDGE_CYCLE: ReadonlyArray<ReadonlyArray<readonly number[]>> = [
  [[0, 8, 4]], [[1, 6, 8]], [[2, 4, 9]], [[3, 9, 6]],
  [[0, 5, 10]], [[1, 10, 7]], [[2, 11, 5]], [[3, 7, 11]],
];
export const PETAL_CYCLE: ReadonlyArray<ReadonlyArray<readonly number[]>> = [
  [[4, 16, 12], [5, 18, 14], [6, 17, 13]],
  [[4, 10, 19], [5, 8, 17], [7, 9, 16]],
  [[0, 13, 18], [1, 15, 16], [2, 12, 19]],
  [[0, 17, 11], [1, 19, 9], [3, 18, 8]],
  [[4, 15, 21], [6, 14, 20], [7, 12, 22]],
  [[5, 20, 11], [6, 23, 8], [7, 21, 10]],
  [[0, 23, 14], [2, 22, 15], [3, 20, 13]],
  [[1, 10, 22], [2, 9, 21], [3, 11, 23]],
];

export interface RexMove {
  /** Corner index 0..7 (CORNER_NAMES / CORNER_AXIS / *_CYCLE). */
  corner: number;
  /** Physical twist: +1 = +120° about the corner's outward body diagonal (CCW from
   *  outside → the PRIMED token); -1 = −120° (clockwise → the BARE token). */
  dir: 1 | -1;
}

/** Full Rex state: independent permutations of centres / petals / edges
 *  (perm[slot] = pieceId currently there). All permutation-only (no orientation). */
export interface RexState {
  centers: number[]; // length 6
  petals: number[];  // length 24
  edges: number[];   // length 12
}

export function solvedRex(): RexState {
  return {
    centers: Array.from({ length: 6 }, (_, i) => i),
    petals: Array.from({ length: 24 }, (_, i) => i),
    edges: Array.from({ length: 12 }, (_, i) => i),
  };
}

/** Apply one set of 3-cycles to a permutation array in place. dir +1 = forward
 *  (content a→b→c→a, i.e. out[b]=in[a] …); dir −1 = reverse. */
function applyCycles(perm: number[], cycles: ReadonlyArray<readonly number[]>, dir: 1 | -1): void {
  for (const cyc of cycles) {
    const [a, b, c] = cyc;
    const va = perm[a], vb = perm[b], vc = perm[c];
    if (dir === 1) { perm[b] = va; perm[c] = vb; perm[a] = vc; }
    else { perm[a] = vb; perm[b] = vc; perm[c] = va; }
  }
}

/** Apply one move to a state, returning a NEW state. */
export function applyRexMove(state: RexState, move: RexMove): RexState {
  const centers = state.centers.slice();
  const petals = state.petals.slice();
  const edges = state.edges.slice();
  applyCycles(centers, CENTER_CYCLE[move.corner], move.dir);
  applyCycles(edges, EDGE_CYCLE[move.corner], move.dir);
  applyCycles(petals, PETAL_CYCLE[move.corner], move.dir);
  return { centers, petals, edges };
}

/** True iff every slot shows its correct face colour. Centres + edges are uniquely
 *  coloured so this means piece===slot; the 4 petals of a face share a colour, so a
 *  petal slot is solved when it holds ANY petal of its own face (PETAL_FACE match). */
export function isSolved(state: RexState): boolean {
  for (let i = 0; i < 6; i++) if (state.centers[i] !== i) return false;
  for (let i = 0; i < 12; i++) if (state.edges[i] !== i) return false;
  for (let i = 0; i < 24; i++) if (PETAL_FACE[state.petals[i]] !== PETAL_FACE[i]) return false;
  return true;
}

const TOKEN_RE = /^(UFR|UFL|UBR|UBL|DFR|DFL|DBR|DBL)('?)$/;

/** Parse a scramble/alg string into moves. Unknown tokens are skipped. */
export function parseRexMoves(text: string): RexMove[] {
  return parseCornerMoves(text, TOKEN_RE, CORNER_NAMES);
}

/** Render one move to its canonical token. Bare = clockwise (dir −1); primed = CCW
 *  inverse (dir +1). Exact inverse of parseRexMoves. */
export function rexMoveToString(move: RexMove): string {
  return cornerMoveToString(move, CORNER_NAMES);
}

export function rexMovesToString(moves: RexMove[]): string {
  return cornerMovesToString(moves, CORNER_NAMES);
}

/** Random legal scramble: `n` twists, never the same corner twice in a row. */
export function randomRexScramble(n = 25): RexMove[] {
  return randomCornerScramble(n);
}

/** Apply a whole scramble to solved and return the resulting state. */
export function applyRexScramble(moves: RexMove[]): RexState {
  let s = solvedRex();
  for (const m of moves) s = applyRexMove(s, m);
  return s;
}
