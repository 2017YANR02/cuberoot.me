/*
 * cross-trainer/rotate — the 24 whole-cube rotations, acting on a cubie state.
 *
 * Why this exists: every deep sub-step (XCross, XXCross, pair, …) needs exact distance
 * tables that are specific to a FRAME — which face the cross is on and which F2L slot is
 * being paired. There are 24 such frames, and each table pair costs ~1.7 s / 9 MB to build.
 * Building 24 of them (41 s, 219 MB) to answer "the best XCross over all six colours" would
 * be worse than the upstream trainer we are replacing.
 *
 * The rotations collapse that: the 24 frames form one orbit, so ONE canonical table set
 * (cross on D, slot DFR) answers every frame — rotate the state into the canonical frame and
 * read the same table. Cost per frame: one 20-element relabel, ~1 µs.
 *
 * Everything here is derived, nothing hand-written: face permutations come from composing the
 * x/y generators, and the piece maps come from matching face SETS against the canonical
 * sticker order in lib/cube-facelet (URFDLB, so face ids match ./model exactly).
 *
 * Orientation under a relabel ρ, for a piece with k stickers: writing ori as "how far the
 * piece's reference sticker sits from the slot's reference position",
 *     ori' = ori + δ(slot) − δ(piece)   (mod k)
 * where δ(x) is how far ρ shifts x's own reference sticker. Both terms are needed: relabelling
 * moves the piece's reference AND the slot's.
 */

import { CORNER_FACELET, EDGE_FACELET, type CubieCube } from '@/lib/cube-facelet';
import { D, FACE_CORNERS, f2lSlots, type FaceIdx } from './model';

/** Canonical face order of each edge's stickers (primary first) — U/R/F/D/L/B = 0..5. */
const EDGE_CANON: number[][] = EDGE_FACELET.map(([a, b]) => [(a / 9) | 0, (b / 9) | 0]);
/** Canonical face order of each corner's stickers (U/D sticker first, then clockwise). */
const CORNER_CANON: number[][] = CORNER_FACELET.map(([a, b, c]) => [(a / 9) | 0, (b / 9) | 0, (c / 9) | 0]);

/** A face permutation: PI[f] = the face that f becomes. */
type FacePerm = number[];

// x = rotate on the R axis (front goes up); y = rotate on the U axis (front goes left).
const X: FacePerm = [5, 1, 0, 2, 4, 3]; // U→B R→R F→U D→F L→L B→D
const Y: FacePerm = [0, 2, 4, 3, 5, 1]; // U→U R→F F→L D→D L→B B→R

const compose = (a: FacePerm, b: FacePerm): FacePerm => a.map((f) => b[f]); // apply a, then b

/** The 24 rotations as face permutations, identity first (BFS closure over {x, y}). */
const FACE_PERMS: FacePerm[] = (() => {
  const id: FacePerm = [0, 1, 2, 3, 4, 5];
  const seen = new Map<string, FacePerm>([[id.join(''), id]]);
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const g of [X, Y]) {
      const nxt = compose(cur, g);
      const key = nxt.join('');
      if (!seen.has(key)) { seen.set(key, nxt); queue.push(nxt); }
    }
  }
  return [...seen.values()];
})();

export const N_ROTATIONS = FACE_PERMS.length; // 24

export interface Rotation {
  /** PI[f] = image face. */
  face: FacePerm;
  /** Edge piece/slot i becomes eMap[i]. */
  eMap: Int8Array;
  /** Reference-sticker shift of edge i (0/1). */
  eDelta: Int8Array;
  cMap: Int8Array;
  /** Reference-sticker shift of corner i (0/1/2). */
  cDelta: Int8Array;
}

function derive(face: FacePerm): Rotation {
  const eMap = new Int8Array(12), eDelta = new Int8Array(12);
  for (let e = 0; e < 12; e++) {
    const img = EDGE_CANON[e].map((f) => face[f]);
    const t = EDGE_CANON.findIndex((c) => c.length === img.length && img.every((f) => c.includes(f)));
    eMap[e] = t;
    eDelta[e] = EDGE_CANON[t][0] === img[0] ? 0 : 1;
  }
  const cMap = new Int8Array(8), cDelta = new Int8Array(8);
  for (let c = 0; c < 8; c++) {
    const img = CORNER_CANON[c].map((f) => face[f]);
    const t = CORNER_CANON.findIndex((x) => img.every((f) => x.includes(f)));
    cMap[c] = t;
    cDelta[c] = CORNER_CANON[t].indexOf(img[0]);
  }
  return { face, eMap, eDelta, cMap, cDelta };
}

export const ROTATIONS: readonly Rotation[] = FACE_PERMS.map(derive);

/** The state as seen from the rotated frame. */
export function rotateState(c: CubieCube, r: number): CubieCube {
  const R = ROTATIONS[r];
  const ep = new Array<number>(12), eo = new Array<number>(12);
  const cp = new Array<number>(8), co = new Array<number>(8);
  for (let i = 0; i < 12; i++) {
    const piece = c.ep[i];
    const slot = R.eMap[i];
    ep[slot] = R.eMap[piece];
    eo[slot] = (c.eo[i] + R.eDelta[i] + R.eDelta[piece]) & 1;
  }
  for (let i = 0; i < 8; i++) {
    const piece = c.cp[i];
    const slot = R.cMap[i];
    cp[slot] = R.cMap[piece];
    co[slot] = (c.co[i] + R.cDelta[i] - R.cDelta[piece] + 6) % 3;
  }
  return { cp, co, ep, eo };
}

/**
 * The M-plane mirror (L↔R), as the same kind of relabelling — the other half of the 48-element
 * symmetry group the site's "essentially different" counts are quoted in (see
 * app/[lang]/scramble/hardest, whose 438 states are 23 representatives × that group).
 *
 * A reflection is not a cube move, but it is still just a face permutation, so `derive` builds its
 * piece maps exactly as it does a rotation's. One difference: a reflection reverses the clockwise
 * sense corner twists are counted in, so the corner term is negated. Edges have two stickers and
 * no handedness, so theirs is the plain relabel.
 *
 * tests/scramble_exact_cases.test.ts pins this against the site's own single source for mirroring
 * — `mirrorFamily` on the move sequence — over random scrambles, pieces and orientations both.
 */
export const MIRROR_FACE: readonly number[] = [0, 4, 2, 3, 1, 5]; // U→U R→L F→F D→D L→R B→B
const MIRROR: Rotation = derive([...MIRROR_FACE]);

/** The state seen in an M-plane mirror. */
export function mirrorState(c: CubieCube): CubieCube {
  const ep = new Array<number>(12), eo = new Array<number>(12);
  const cp = new Array<number>(8), co = new Array<number>(8);
  for (let i = 0; i < 12; i++) {
    const piece = c.ep[i];
    const slot = MIRROR.eMap[i];
    ep[slot] = MIRROR.eMap[piece];
    eo[slot] = (c.eo[i] + MIRROR.eDelta[i] + MIRROR.eDelta[piece]) & 1;
  }
  for (let i = 0; i < 8; i++) {
    const piece = c.cp[i];
    const slot = MIRROR.cMap[i];
    cp[slot] = MIRROR.cMap[piece];
    co[slot] = ((-c.co[i] + MIRROR.cDelta[i] - MIRROR.cDelta[piece]) % 3 + 3) % 3;
  }
  return { cp, co, ep, eo };
}

/** Index of the rotation undoing `r`. */
export const inverseRotation = (r: number): number => {
  const pi = ROTATIONS[r].face;
  const inv: FacePerm = [0, 0, 0, 0, 0, 0];
  for (let f = 0; f < 6; f++) inv[pi[f]] = f;
  const key = inv.join('');
  return FACE_PERMS.findIndex((p) => p.join('') === key);
};

// ── frames ───────────────────────────────────────────────────────────────────────────────────

/** The one frame every table in this directory is built for: cross on D, slot DFR. */
export const CANON_FACE: FaceIdx = D;
export const CANON_SLOT = 0;
const CANON_CORNER = FACE_CORNERS[D][CANON_SLOT];

/**
 * ROT_FOR_FRAME[face][slot] — the rotation carrying that frame onto the canonical one.
 * The 24 rotations act simply transitively on the 24 (face, slot) frames, so it is unique.
 */
export const ROT_FOR_FRAME: number[][] = (() => {
  const out: number[][] = [];
  for (let f = 0; f < 6; f++) {
    const slots = f2lSlots(f as FaceIdx);
    out.push(slots.map((s) => ROTATIONS.findIndex(
      (R) => R.face[f] === D && R.cMap[s.corner] === CANON_CORNER,
    )));
  }
  return out;
})();

/** ROT_FOR_CROSS[face] — any rotation carrying `face` onto D (slot 0's image is unconstrained). */
export const ROT_FOR_CROSS: number[] = Array.from(
  { length: 6 },
  (_, f) => ROTATIONS.findIndex((R) => R.face[f] === D),
);

/**
 * A rotation carrying `face` onto D **and** the axis of `axisFace` onto F/B — the canonical
 * frame for the EO stages, whose orientation is only defined relative to an axis.
 * (Opposite faces stay opposite under a rotation, so a face id names its axis unambiguously.)
 */
export const rotForFaceAxis = (face: FaceIdx, axisFace: number): number =>
  ROTATIONS.findIndex((R) => R.face[face] === D && R.face[axisFace] % 3 === 2);
