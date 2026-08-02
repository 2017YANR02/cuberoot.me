/*
 * cross-trainer/model — the cubie model the sub-step scramble generator runs on.
 *
 * Everything here is expressed in the timer's kociemba model (`_lib/scramble/kociemba/cube.ts`)
 * so a generated state can go straight to facelets → min2phase without a second convention:
 *   edges   0..11 = UR UF UL UB DR DF DL DB FR FL BL BR
 *   corners 0..7  = URF UFL ULB UBR DFR DLF DBL DRB
 *   moves   0..17 = U U2 U' R R2 R' F F2 F' D D2 D' L L2 L' B B2 B'   (face*3 + power-1)
 *
 * A tracked piece is carried as a single integer coord: edges `slot*2 + ori`, corners
 * `slot*3 + ori` — the same encoding or18's trainers use, so our depth histograms are
 * directly comparable with the published ones (see cross-trainer/dist.ts).
 *
 * "Frame" = which face the cross goes on (its 4 edges) plus that face's four F2L slots.
 * Both are derived from face membership rather than hand-written, so there is no table to
 * get wrong: a piece belongs to face f iff move f moves it.
 */

import { ALL_MOVES, MOVE_NAMES, type CubieCube } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';

export const N_MOVES = 18;
export { MOVE_NAMES };

/** Face indices, matching kociemba's move order. */
export const U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;
export const FACE_LETTERS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type FaceIdx = 0 | 1 | 2 | 3 | 4 | 5;

/** Home colour of each face in the site's scheme (U=White D=Yellow F=Green B=Blue R=Red L=Orange). */
export const FACE_COLOR = ['White', 'Red', 'Green', 'Yellow', 'Orange', 'Blue'] as const;
export type CrossColorName = typeof FACE_COLOR[number];
export const COLOR_FACE: Record<CrossColorName, FaceIdx> = {
  White: 0, Red: 1, Green: 2, Yellow: 3, Orange: 4, Blue: 5,
};

// ── per-piece move transitions ───────────────────────────────────────────────────────────────
// A piece sitting at slot j with orientation o moves, under `m`, to the slot i with
// ALL_MOVES[m].ep[i] === j, picking up that slot's orientation delta. (Same reading as
// `multiply`: cp[i]/ep[i] name where the cubie at i came from.)

function buildEdgeStep(): Int8Array[] {
  return ALL_MOVES.map((mv) => {
    const t = new Int8Array(24);
    for (let j = 0; j < 12; j++) {
      const i = mv.ep.indexOf(j);
      for (let o = 0; o < 2; o++) t[j * 2 + o] = i * 2 + ((o + mv.eo[i]) & 1);
    }
    return t;
  });
}

function buildCornerStep(): Int8Array[] {
  return ALL_MOVES.map((mv) => {
    const t = new Int8Array(24);
    for (let j = 0; j < 8; j++) {
      const i = mv.cp.indexOf(j);
      for (let o = 0; o < 3; o++) t[j * 3 + o] = i * 3 + ((o + mv.co[i]) % 3);
    }
    return t;
  });
}

/** EDGE_STEP[m][slot*2+ori] → new slot*2+ori. */
export const EDGE_STEP: readonly Int8Array[] = buildEdgeStep();
/** CORNER_STEP[m][slot*3+ori] → new slot*3+ori. */
export const CORNER_STEP: readonly Int8Array[] = buildCornerStep();

/** Face of each move index. */
export const MOVE_FACE: readonly number[] = Array.from({ length: N_MOVES }, (_, m) => (m / 3) | 0);
/** Opposite-face pairs share an axis; used for the canonical-sequence pruning below. */
const OPPOSITE = [D, L, B, U, R, F];
/**
 * canSkip[prev+1][m] — true when `m` may not follow `prev` on a canonical optimal path:
 * same face twice, or the second face of an opposite pair in the wrong order (we keep only
 * U-before-D, R-before-L, F-before-B). prev = -1 means "first move".
 */
export const MOVE_SKIP: readonly Uint8Array[] = (() => {
  const out: Uint8Array[] = [];
  for (let p = -1; p < N_MOVES; p++) {
    const row = new Uint8Array(N_MOVES);
    if (p >= 0) {
      const pf = MOVE_FACE[p];
      for (let m = 0; m < N_MOVES; m++) {
        const mf = MOVE_FACE[m];
        row[m] = mf === pf || (OPPOSITE[pf] === mf && pf > mf) ? 1 : 0;
      }
    }
    out.push(row);
  }
  return out;
})();
/** MOVE_SKIP is indexed by prev+1 so the "no previous move" row lives at 0. */
export const skipRow = (prev: number): Uint8Array => MOVE_SKIP[prev + 1];

// ── face membership → cross edges + F2L slots ────────────────────────────────────────────────

function movedByFace(): { edges: number[][]; corners: number[][] } {
  const edges: number[][] = [], corners: number[][] = [];
  for (let f = 0; f < 6; f++) {
    const mv = ALL_MOVES[f * 3];
    edges.push(Array.from({ length: 12 }, (_, i) => i).filter((i) => mv.ep[i] !== i));
    corners.push(Array.from({ length: 8 }, (_, i) => i).filter((i) => mv.cp[i] !== i));
  }
  return { edges, corners };
}
const MOVED = movedByFace();

/** The 4 edge pieces of face f (its cross edges), ascending. */
export const FACE_EDGES: readonly number[][] = MOVED.edges;
/** The 4 corner pieces of face f, ascending. */
export const FACE_CORNERS: readonly number[][] = MOVED.corners;
/** Faces each piece belongs to. */
const EDGE_FACES: number[][] = Array.from({ length: 12 }, (_, e) => [0, 1, 2, 3, 4, 5].filter((f) => MOVED.edges[f].includes(e)));
const CORNER_FACES: number[][] = Array.from({ length: 8 }, (_, c) => [0, 1, 2, 3, 4, 5].filter((f) => MOVED.corners[f].includes(c)));

export interface F2lSlot {
  /** Corner piece of the slot (one of face f's corners). */
  corner: number;
  /** Edge piece of the slot — the edge on the two faces of that corner other than f. */
  edge: number;
  /** Slot name in the frame's own letters, e.g. 'FR' when the cross is on D. */
  name: string;
}

/**
 * The four F2L slots of a cross on face `f`, in a stable order (sorted by corner id).
 * Slot = one of f's corners + the edge shared by that corner's two other faces.
 */
export function f2lSlots(f: FaceIdx): F2lSlot[] {
  // Name the slot the way cubers write it: the F/B letter first, then R/L (FR, FL, BL, BR),
  // and for a cross on F/B use the U/D letter first (UR, UL, DL, DR).
  const rank = (x: number) => (x === F || x === B ? 0 : x === U || x === D ? 1 : 2);
  return FACE_CORNERS[f].map((corner) => {
    const side = CORNER_FACES[corner].filter((x) => x !== f);
    const edge = EDGE_FACES.findIndex((fs) => fs.length === 2 && side.every((x) => fs.includes(x)));
    const name = [...side].sort((a, b) => rank(a) - rank(b)).map((x) => FACE_LETTERS[x]).join('');
    return { corner, edge, name };
  });
}

// ── coordinate helpers ───────────────────────────────────────────────────────────────────────

/** Ordered-slot rank of k distinct slots out of `n` (k ≤ 5): 0 .. n·(n-1)·…·(n-k+1) - 1. */
export function slotRank(slots: ArrayLike<number>, k: number, n = 12): number {
  let rank = 0;
  // digits are "index among the still-available slots", most significant first
  let avail = 0; // bitmask of used slots
  for (let i = 0; i < k; i++) {
    let pos = slots[i];
    let used = 0;
    for (let j = 0; j < slots[i]; j++) if (avail & (1 << j)) used++;
    pos -= used;
    rank = rank * (n - i) + pos;
    avail |= 1 << slots[i];
  }
  return rank;
}

/** Inverse of `slotRank`, writing k slots into `out`. */
export function slotUnrank(rank: number, k: number, out: Int8Array, n = 12): void {
  const digits = new Int8Array(k);
  let r = rank;
  for (let i = k - 1; i >= 0; i--) { const base = n - i; digits[i] = r % base; r = (r - digits[i]) / base; }
  const avail: number[] = [];
  for (let i = 0; i < n; i++) avail.push(i);
  for (let i = 0; i < k; i++) { out[i] = avail[digits[i]]; avail.splice(digits[i], 1); }
}

/** A solved cube in the kociemba model. */
export function solved(): CubieCube {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}
