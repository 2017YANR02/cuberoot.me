/**
 * CFOP step detector — given a 3x3 facelet state, classify how far along the
 * CFOP method the cube is.
 *
 * Conventions match `./state.ts`:
 *   - D face indices: row 0 = front. So D[0]=DFL, D[2]=DFR, D[6]=DBL, D[8]=DBR;
 *     edges D[1]=DF, D[3]=DL, D[5]=DR, D[7]=DB; center D[4].
 *   - F R B L face indices: row 0 = top (touching U), col 0 = left of face.
 *     So F[6,7,8] is the bottom row of F (touching D), F[0,1,2] is the top row.
 *   - U: row 0 = back. U[1]=back-edge, U[3]=left-edge, U[5]=right-edge, U[7]=front-edge.
 */

import type { CubeFaces, FaceArr } from './state';

/**
 * One of:
 *   'scrambled' — none of the stages are complete
 *   'cross'     — cross on D done, F2L not
 *   'f2l'       — F2L done (cross + 4 pairs), OLL not
 *   'oll'       — OLL done (U face fully oriented), PLL not
 *   'pll'       — fully solved
 */
export type CfopStage = 'scrambled' | 'cross' | 'f2l' | 'oll' | 'pll';

export const CFOP_STAGES: readonly CfopStage[] = ['scrambled', 'cross', 'f2l', 'oll', 'pll'];

/**
 * Highest stage reached (in CFOP_STAGES order, returns the latest one true).
 */
export function detectCfopStage(faces: CubeFaces): CfopStage {
  if (isSolved(faces)) return 'pll';
  if (isOll(faces)) return 'oll';
  if (isF2l(faces)) return 'f2l';
  if (isCross(faces)) return 'cross';
  return 'scrambled';
}

/**
 * Cross on D: D-face edge stickers are D-colored AND the side sticker on each
 * D-edge matches that side's center color.
 */
export function isCross(faces: CubeFaces): boolean {
  const { D, F, R, B, L } = faces;
  // Center color check (in case of rotated cube — center is reference).
  const cD = D[4], cF = F[4], cR = R[4], cB = B[4], cL = L[4];
  // 4 D-edges: D side, side face side.
  return (
    D[1] === cD && F[7] === cF &&  // DF edge
    D[5] === cD && R[7] === cR &&  // DR edge
    D[7] === cD && B[7] === cB &&  // DB edge
    D[3] === cD && L[7] === cL     // DL edge
  );
}

/**
 * F2L done — cross + 4 corner-edge pairs solved on D layer + E-slice.
 */
export function isF2l(faces: CubeFaces): boolean {
  if (!isCross(faces)) return false;
  const { D, F, R, B, L } = faces;
  const cD = D[4], cF = F[4], cR = R[4], cB = B[4], cL = L[4];

  // Four D-corners: each corner has 3 stickers; check D side and the two adj sides.
  // DFL corner: D[0]=D, F[6]=F, L[8]=L
  // DFR corner: D[2]=D, F[8]=F, R[6]=R
  // DBR corner: D[8]=D, B[6]=B, R[8]=R
  // DBL corner: D[6]=D, B[8]=B, L[6]=L
  const cornersOk =
    D[0] === cD && F[6] === cF && L[8] === cL &&
    D[2] === cD && F[8] === cF && R[6] === cR &&
    D[8] === cD && B[6] === cB && R[8] === cR &&
    D[6] === cD && B[8] === cB && L[6] === cL;
  if (!cornersOk) return false;

  // Four E-slice edges (FR, BR, BL, FL):
  //   FR edge: F[5] = F, R[3] = R
  //   BR edge: R[5] = R, B[3] = B
  //   BL edge: B[5] = B, L[3] = L
  //   FL edge: L[5] = L, F[3] = F
  return (
    F[5] === cF && R[3] === cR &&
    R[5] === cR && B[3] === cB &&
    B[5] === cB && L[3] === cL &&
    L[5] === cL && F[3] === cF
  );
}

/** OLL done = U face fully oriented (all 9 U stickers are U color). */
export function isOll(faces: CubeFaces): boolean {
  if (!isF2l(faces)) return false;
  const { U } = faces;
  const cU = U[4];
  for (let i = 0; i < 9; i++) if (U[i] !== cU) return false;
  return true;
}

/** Fully solved: every face is uniform. */
export function isSolved(faces: CubeFaces): boolean {
  return (
    facesUniform(faces.U) &&
    facesUniform(faces.D) &&
    facesUniform(faces.F) &&
    facesUniform(faces.R) &&
    facesUniform(faces.B) &&
    facesUniform(faces.L)
  );
}

function facesUniform(arr: FaceArr): boolean {
  const c = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] !== c) return false;
  return true;
}

/**
 * Convenience: stage rank for ordering / comparison.
 *   scrambled=0, cross=1, f2l=2, oll=3, pll=4
 */
export function stageRank(s: CfopStage): number {
  return CFOP_STAGES.indexOf(s);
}

/**
 * Pretty label for UI.
 */
export function stageLabel(s: CfopStage, isZh: boolean): string {
  const map: Record<CfopStage, [string, string]> = {
    scrambled: ['Scrambled', '未开始'],
    cross:     ['Cross',     '十字'],
    f2l:       ['F2L',       'F2L'],
    oll:       ['OLL',       'OLL'],
    pll:       ['PLL',       'PLL'],
  };
  return isZh ? map[s][1] : map[s][0];
}
