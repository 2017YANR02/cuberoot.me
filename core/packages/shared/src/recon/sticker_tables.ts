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

import type { KPattern, KTransformation } from 'cubing/kpuzzle';

/**
 * Frame-invariant sticker reading — the crux of cross-color-neutral recon.
 *
 * cube3x3x3 KPattern uses MIXED orbit conventions plus a space-fixed orientation
 * reference, so a naive `pieces[slot]`/`orientation[slot]` decode is correct ONLY
 * in the native (centers-home) frame. Verified directly against the puzzle's own
 * move definitions:
 *   - CENTERS are SOURCE-indexed: `pieces[face]` is the colour shown ON `face`.
 *   - EDGES/CORNERS are DESTINATION-indexed: `pieces[i]` is the SLOT where home
 *     piece `i` now sits, and `orientation[i]` is THAT piece's orientation.
 *   - Edge/corner orientation is measured against the space-fixed U/D axis, so its
 *     value only decodes to stickers correctly in the centers-home frame.
 *
 * To read correctly in EVERY orientation (the L/R-colour cross a z/z' inspection
 * produces, the blue cross an x produces, etc.): normalise the pattern to the
 * centers-home frame, translate the requested (slot, face) through the SAME
 * geometric rotation — with the slot image DERIVED FROM the face permutation so
 * slot↔face adjacency is preserved — then decode there. Validated: 0 errors over
 * all 24 orientations of a solved cube, full rotation-invariance on random
 * scrambles, and balanced colour histograms in tilted frames.
 *
 * In the centers-home frame the normalisation is the identity rotation, so the
 * DB-build path (always centers-home) is unaffected.
 */

const ORIENTATION_ALGS: string[] = (() => {
  const out: string[] = [];
  for (const t of ['', 'x', 'x2', "x'", 'z', "z'"]) {
    for (const y of ['', 'y', 'y2', "y'"]) out.push([t, y].filter(Boolean).join(' '));
  }
  return out;
})();

const invPerm = (a: readonly number[]): number[] => {
  const r = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) r[a[i]] = i;
  return r;
};

// Face-set → slot index, so a rotated slot can be located by the faces it touches.
const edgeFaceKey = (a: number, b: number): number => (a < b ? a * 10 + b : b * 10 + a);
const EDGE_BY_FACES: Record<number, number> = {};
EDGE_STICKERS.forEach((fs, i) => { EDGE_BY_FACES[edgeFaceKey(fs[0], fs[1])] = i; });
const CORNER_BY_FACES: Record<string, number> = {};
CORNER_STICKERS.forEach((fs, i) => { CORNER_BY_FACES[[...fs].sort((x, y) => x - y).join(',')] = i; });

interface RotInfo {
  transform: KTransformation;
  /** Face content image: spatial face f → spatial face `sigma[f]` after this rotation. */
  sigma: number[];
  /** Edge slot image, derived from `sigma` so (slot, face) adjacency is preserved. */
  edgeImg: number[];
  /** Corner slot image, derived from `sigma`. */
  cornerImg: number[];
}
let _rotInfos: RotInfo[] | null = null;
function rotInfos(kp: KPattern['kpuzzle']): RotInfo[] {
  if (_rotInfos) return _rotInfos;
  const solved = kp.defaultPattern();
  _rotInfos = ORIENTATION_ALGS.map((g) => {
    const transform = kp.algToTransformation(g);
    const sp = solved.applyTransformation(transform).patternData;
    const sigma = invPerm(sp.CENTERS.pieces);
    return {
      transform,
      sigma,
      edgeImg: EDGE_STICKERS.map(([a, b]) => EDGE_BY_FACES[edgeFaceKey(sigma[a], sigma[b])]),
      cornerImg: CORNER_STICKERS.map((fs) => CORNER_BY_FACES[fs.map((x) => sigma[x]).sort((x, y) => x - y).join(',')]),
    };
  });
  return _rotInfos;
}

interface NormCtx {
  ph: KPattern;
  info: RotInfo;
  /** edgeAt[s] = home id of the edge piece sitting at slot s (in the home frame). */
  edgeAt: number[];
  cornerAt: number[];
}
const _normCache = new WeakMap<KPattern, NormCtx | null>();
/** Rotate `p` into the centers-home frame; cache per pattern. null = invalid cube. */
function normCtx(p: KPattern): NormCtx | null {
  const hit = _normCache.get(p);
  if (hit !== undefined) return hit;
  let ctx: NormCtx | null = null;
  for (const info of rotInfos(p.kpuzzle)) {
    const ph = p.applyTransformation(info.transform);
    const c = ph.patternData.CENTERS.pieces;
    if (c[0] === 0 && c[1] === 1 && c[2] === 2 && c[3] === 3 && c[4] === 4 && c[5] === 5) {
      ctx = {
        ph,
        info,
        edgeAt: invPerm(ph.patternData.EDGES.pieces),
        cornerAt: invPerm(ph.patternData.CORNERS.pieces),
      };
      break;
    }
  }
  _normCache.set(p, ctx);
  return ctx;
}

/**
 * Sticker color (= KPattern face index) shown on face `face` of the edge sitting
 * at slot `slot`. Returns null if `face` isn't adjacent to the slot. Frame-
 * invariant: correct for every cube orientation including L/R-colour (z/z')
 * crosses.
 */
export function edgeStickerOnFace(p: KPattern, slot: number, face: number): number | null {
  const n = normCtx(p);
  if (!n) return null;
  const s = n.info.edgeImg[slot];
  const f = n.info.sigma[face];
  const piece = n.edgeAt[s];                                  // destination: piece now at slot s
  const ori = n.ph.patternData.EDGES.orientation?.[piece] ?? 0; // orientation indexed by piece
  const [sFa, sFb] = EDGE_STICKERS[s];
  const [pSa, pSb] = EDGE_STICKERS[piece];
  if (f === sFa) return ori === 0 ? pSa : pSb;
  if (f === sFb) return ori === 0 ? pSb : pSa;
  return null;
}

/**
 * Same as `edgeStickerOnFace` but for corners (3 stickers per piece, ori in 0..2).
 * The sticker visible on slot-face index `j` is the piece label `(j + ori) % 3`.
 * Frame-invariant.
 */
export function cornerStickerOnFace(p: KPattern, slot: number, face: number): number | null {
  const n = normCtx(p);
  if (!n) return null;
  const s = n.info.cornerImg[slot];
  const f = n.info.sigma[face];
  const slotFaces = CORNER_STICKERS[s];
  const j = slotFaces.indexOf(f);
  if (j < 0) return null;
  const piece = n.cornerAt[s];
  const ori = n.ph.patternData.CORNERS.orientation?.[piece] ?? 0;
  const i = (j + ori) % 3;
  return CORNER_STICKERS[piece][i];
}
