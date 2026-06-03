/**
 * Sticker-color tables for cubing.js's `cube3x3x3` KPuzzle.
 *
 * Indexing convention (KPattern CENTERS slot order, also used as "face index"):
 *   0=U, 1=R, 2=F, 3=L, 4=B, 5=D
 *
 * Color codes are these same indices: piece N (in CENTERS) is the piece whose
 * default home is slot N, hence its color = the face at slot N. So the same
 * 0..5 numbers serve as both face indices AND color codes.
 *
 * `EDGE_STICKERS[piece] = [face0, face1]`
 *   Where piece's sticker label 0 lands on face0, sticker label 1 lands on
 *   face1, when the piece is at its home slot with orientation 0.
 *   For an edge piece this also describes the slot's two adjacent faces in the
 *   canonical [primary, secondary] order. For U/D-layer edges the primary face
 *   is U/D; for E-slice edges (8..11) the primary face is F/B.
 *
 * `CORNER_STICKERS[piece] = [face0, face1, face2]`
 *   Same meaning, with three sticker labels and three slot-adjacent faces.
 *   Face order is [U/D, then the two side faces in CW order from outside].
 *
 * These tables were derived empirically by `scripts/verify_sticker_tables.mjs`
 * which applies every face move and rotation to a solved cube and confirms the
 * predicted (piece, ori) → face mapping holds. If cubing.js ever changes its
 * piece numbering, the verifier will fail loudly.
 */

export const EDGE_STICKERS: ReadonlyArray<readonly [number, number]> = [
  [0, 2], // 0: UF cubie — U sticker, F sticker
  [0, 1], // 1: UR cubie — U, R
  [0, 4], // 2: UB cubie — U, B
  [0, 3], // 3: UL cubie — U, L
  [5, 2], // 4: DF cubie — D, F
  [5, 1], // 5: DR cubie — D, R
  [5, 4], // 6: DB cubie — D, B
  [5, 3], // 7: DL cubie — D, L
  [2, 1], // 8: FR cubie — F, R
  [2, 3], // 9: FL cubie — F, L
  [4, 1], // 10: BR cubie — B, R
  [4, 3], // 11: BL cubie — B, L
];

export const CORNER_STICKERS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], // 0: UFR cubie — U, R, F
  [0, 4, 1], // 1: UBR cubie — U, B, R
  [0, 3, 4], // 2: UBL cubie — U, L, B
  [0, 2, 3], // 3: UFL cubie — U, F, L
  [5, 2, 1], // 4: DFR cubie — D, F, R
  [5, 3, 2], // 5: DFL cubie — D, L, F
  [5, 4, 3], // 6: DBL cubie — D, B, L
  [5, 1, 4], // 7: DBR cubie — D, R, B
];

import type { KPattern } from 'cubing/kpuzzle';

/**
 * Sticker color (= KPattern face index) at a given face of a given edge slot
 * in the supplied pattern. Returns null if `face` isn't adjacent to the slot.
 *
 * Logic: edge slot S has face order `[fA, fB] = EDGE_STICKERS[S]` (since the
 * edge orbit numbers slots and pieces identically — slot S's home piece is S).
 * When piece P is at slot S with orientation O:
 *   - O=0: P's sticker[0] is at fA, sticker[1] at fB.
 *   - O=1: stickers are swapped.
 * P's sticker[k] color = `EDGE_STICKERS[P][k]`.
 */
export function edgeStickerOnFace(p: KPattern, slot: number, face: number): number | null {
  const piece = p.patternData.EDGES.pieces[slot];
  const ori = p.patternData.EDGES.orientation[slot] ?? 0;
  const [sFa, sFb] = EDGE_STICKERS[slot];
  const [pSa, pSb] = EDGE_STICKERS[piece];
  if (face === sFa) return ori === 0 ? pSa : pSb;
  if (face === sFb) return ori === 0 ? pSb : pSa;
  return null;
}

/**
 * Same as `edgeStickerOnFace` but for corners (3 stickers per piece, ori in 0..2).
 *
 * Convention: at corner slot S with face order `[fA, fB, fC]`, piece P sticker
 * label `i` shows on slot face `(i + O) % 3` where O = orientation. Therefore
 * the sticker label visible at slot face index `j` is `(j - O + 3) % 3`.
 */
export function cornerStickerOnFace(p: KPattern, slot: number, face: number): number | null {
  const piece = p.patternData.CORNERS.pieces[slot];
  const ori = p.patternData.CORNERS.orientation[slot] ?? 0;
  const slotFaces = CORNER_STICKERS[slot];
  const j = slotFaces.indexOf(face);
  if (j < 0) return null;
  const i = (j + 3 - ori) % 3;
  return CORNER_STICKERS[piece][i];
}
