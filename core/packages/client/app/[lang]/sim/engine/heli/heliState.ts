/**
 * Helicopter Cube (heli) state model + notation for /sim.
 *
 * The Helicopter Cube is an EDGE-turning puzzle: a 3×3-shaped cube cut along its 12
 * edge-midpoint axes (the √0.5 planar cut). Each of the 12 turns is a 180° rotation
 * about an edge axis — an INVOLUTION (its own inverse), so there is NO clockwise /
 * counter-clockwise distinction and NO prime: a token is just the bare edge name.
 * One turn exchanges the 2 CORNER pieces at the edge's ends (with a Z3 orientation
 * twist) and the 4 WING pieces (face triangles, no orientation) adjacent to it.
 *
 * Pieces: 8 corners (cp/co, orientation ∈ Z3) + 24 wings (wp, single sticker). The
 * 12 piece-level GENERATORS below are the EXACT move model — they are the verified
 * generators from lib/heli-solver (derived from cstimer poly3dlib, bit-exact vs its
 * moveTable). They are embedded here (not imported) so /sim is self-contained and the
 * discrete state advances incrementally; tests/heli_state.test.ts cross-checks them
 * against heli-solver's heliApply over random sequences so they can never drift.
 *
 * The 12 edge names + order match lib/heli-solver exactly (UF UR UB UL FR BR BL FL DF
 * DR DB DL), so a /sim move string round-trips through the solver's renderer / solver.
 */
import { randomHeliScramble } from '@/lib/heli-solver';

/** The 12 edge tokens, in generator order (matches lib/heli-solver HELI_MOVE_NAMES). */
export const HELI_EDGE_NAMES = [
  'UF', 'UR', 'UB', 'UL', 'FR', 'BR', 'BL', 'FL', 'DF', 'DR', 'DB', 'DL',
] as const;
export type HeliEdgeName = typeof HELI_EDGE_NAMES[number];

const NAME_TO_IDX = new Map<string, number>(HELI_EDGE_NAMES.map((n, i) => [n, i] as [string, number]));

/** A move is an edge index 0..11. Every turn is a 180° involution, so direction does NOT
 *  change the end state or the notation — `dir` is an OPTIONAL cosmetic hint orienting the
 *  mid-turn animation sweep (a drag bakes its sign in so the flap follows the finger; ±π
 *  land on the same pose). State (`applyHeliMove`) and notation (`heliMoveToString`) ignore it. */
export interface HeliMove {
  edge: number;
  dir?: 1 | -1;
}

/** Piece-level generator for one edge twist: cp[dest]=src corner, co[dest]=Z3 twist
 *  added, wp[dest]=src wing. Verified bit-exact vs cstimer poly3dlib (see header). */
interface HeliGen {
  cp: number[];
  co: number[];
  wp: number[];
}
const GENERATORS: ReadonlyArray<HeliGen> = [
  { cp: [0, 3, 2, 1, 4, 5, 6, 7], co: [0, 2, 0, 1, 0, 0, 0, 0], wp: [0, 9, 8, 3, 4, 5, 6, 7, 2, 1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 3, 2, 4, 5, 6, 7], co: [0, 0, 1, 2, 0, 0, 0, 0], wp: [5, 4, 2, 3, 1, 0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [2, 1, 0, 3, 4, 5, 6, 7], co: [1, 0, 2, 0, 0, 0, 0, 0], wp: [21, 1, 2, 20, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 3, 0, 22, 23] },
  { cp: [1, 0, 2, 3, 4, 5, 6, 7], co: [2, 1, 0, 0, 0, 0, 0, 0], wp: [0, 1, 17, 16, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 3, 2, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 5, 4, 3, 6, 7], co: [0, 0, 0, 1, 0, 2, 0, 0], wp: [0, 1, 2, 3, 4, 10, 8, 7, 6, 9, 5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 4, 3, 2, 5, 6, 7], co: [0, 0, 2, 0, 1, 0, 0, 0], wp: [0, 1, 2, 3, 22, 5, 6, 20, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 7, 21, 4, 23] },
  { cp: [7, 1, 2, 3, 4, 5, 6, 0], co: [0, 0, 0, 0, 0, 0, 0, 0], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 18, 21, 20, 19, 22, 17] },
  { cp: [0, 6, 2, 3, 4, 5, 1, 7], co: [0, 1, 0, 0, 0, 0, 2, 0], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 18, 10, 16, 12, 13, 14, 15, 11, 17, 9, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 3, 4, 6, 5, 7], co: [0, 0, 0, 0, 0, 2, 1, 0], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 12, 11, 10, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 3, 5, 4, 6, 7], co: [0, 0, 0, 0, 1, 2, 0, 0], wp: [0, 1, 2, 3, 4, 5, 14, 12, 8, 9, 10, 11, 7, 13, 6, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { cp: [0, 1, 2, 3, 7, 5, 6, 4], co: [0, 0, 0, 0, 2, 0, 0, 1], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 23, 22, 16, 17, 18, 19, 20, 21, 15, 14] },
  { cp: [0, 1, 2, 3, 4, 5, 7, 6], co: [0, 0, 0, 0, 0, 0, 1, 2], wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 19, 14, 18, 16, 17, 15, 13, 20, 21, 22, 23] },
];

// ── discrete state ───────────────────────────────────────────────────────────────
export interface HeliPieceState {
  /** cp[slot] = corner pieceId currently in that slot. */
  cp: number[];
  /** co[slot] = Z3 orientation of the corner in that slot. */
  co: number[];
  /** wp[slot] = wing pieceId currently in that slot. */
  wp: number[];
}

export function solvedHeli(): HeliPieceState {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    wp: Array.from({ length: 24 }, (_, i) => i),
  };
}

/** Apply one edge twist to a state, returning a new state (cp[d]=src, co adds, wp[d]=src). */
export function applyHeliMove(st: HeliPieceState, move: HeliMove): HeliPieceState {
  const g = GENERATORS[move.edge];
  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  const wp = new Array<number>(24);
  for (let d = 0; d < 8; d++) {
    cp[d] = st.cp[g.cp[d]];
    co[d] = (st.co[g.cp[d]] + g.co[d]) % 3;
  }
  for (let d = 0; d < 24; d++) wp[d] = st.wp[g.wp[d]];
  return { cp, co, wp };
}

/** True iff every corner is home + correctly oriented and every wing is home. */
export function isSolvedHeli(st: HeliPieceState): boolean {
  for (let i = 0; i < 8; i++) if (st.cp[i] !== i || st.co[i] !== 0) return false;
  for (let i = 0; i < 24; i++) if (st.wp[i] !== i) return false;
  return true;
}

// ── which slots each edge twist permutes (derived from the generators) ─────────────
/** CORNER_SLOTS[edge] = the 2 corner slots that edge twist moves (cp[i] !== i). */
export const CORNER_SLOTS: ReadonlyArray<number[]> = GENERATORS.map((g) =>
  g.cp.map((_, i) => i).filter((i) => g.cp[i] !== i),
);
/** WING_SLOTS[edge] = the 4 wing slots that edge twist moves (wp[i] !== i). */
export const WING_SLOTS: ReadonlyArray<number[]> = GENERATORS.map((g) =>
  g.wp.map((_, i) => i).filter((i) => g.wp[i] !== i),
);

/** EDGES_AT_CORNER_SLOT[slot] = the 3 edges whose twist moves that corner slot (the 3
 *  edges meeting at that corner). Inverse of CORNER_SLOTS — for drag candidate lookup. */
export const EDGES_AT_CORNER_SLOT: ReadonlyArray<number[]> = invertSlots(CORNER_SLOTS, 8);
/** EDGES_AT_WING_SLOT[slot] = the 2 edges whose twist moves that wing slot. */
export const EDGES_AT_WING_SLOT: ReadonlyArray<number[]> = invertSlots(WING_SLOTS, 24);

function invertSlots(perEdge: ReadonlyArray<number[]>, nSlots: number): number[][] {
  const out: number[][] = Array.from({ length: nSlots }, () => []);
  perEdge.forEach((slots, e) => { for (const s of slots) out[s].push(e); });
  return out;
}

// ── edge axes (unit rotation axis per edge = sum of its two face normals) ───────────
const FACE_UNIT: Record<string, [number, number, number]> = {
  U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
};
/** EDGE_AXIS[edge] = unit twist axis (the 180° rotation axis). Sign is irrelevant to
 *  a 180° turn, but fixed here for the drag tangent + animation. */
export const EDGE_AXIS: ReadonlyArray<readonly [number, number, number]> = HELI_EDGE_NAMES.map((name) => {
  let x = 0, y = 0, z = 0;
  for (const ch of name) { const n = FACE_UNIT[ch]; x += n[0]; y += n[1]; z += n[2]; }
  const m = Math.hypot(x, y, z);
  return [x / m, y / m, z / m] as const;
});

/** EDGE_MID[edge] = the edge's midpoint direction (unnormalized, on the unit cube). */
export const EDGE_MID: ReadonlyArray<readonly [number, number, number]> = HELI_EDGE_NAMES.map((name) => {
  let x = 0, y = 0, z = 0;
  for (const ch of name) { const n = FACE_UNIT[ch]; x += n[0]; y += n[1]; z += n[2]; }
  return [x, y, z] as const;
});

// ── notation: parse / render (bare edge name, no prime) ─────────────────────────────
/** Parse a scramble/alg string into moves; unknown tokens are skipped (no throw —
 *  the /sim input box must never crash on a stray token). */
export function parseHeliMoves(text: string): HeliMove[] {
  const out: HeliMove[] = [];
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok) continue;
    const idx = NAME_TO_IDX.get(tok);
    if (idx !== undefined) out.push({ edge: idx });
  }
  return out;
}

/** Canonical token for one move = the bare edge name (every turn is a 180° involution). */
export function heliMoveToString(move: HeliMove): string {
  return HELI_EDGE_NAMES[move.edge];
}

export function heliMovesToString(moves: HeliMove[]): string {
  return moves.map(heliMoveToString).join(' ');
}

/** A cstimer-faithful random scramble of `n` edge twists (reuses the solver's
 *  adjacency-aware generator, then parses it into moves). */
export function randomHeliScrambleMoves(n = 20): HeliMove[] {
  return parseHeliMoves(randomHeliScramble(n));
}
