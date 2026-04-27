/**
 * Translate a CubeFaces state (from ../cube/state) into the colour each
 * cubie's 6 faces should display.
 *
 * Axis convention used by the 3D scene (matches `state.ts` notation):
 *   +X = R, -X = L
 *   +Y = U, -Y = D
 *   +Z = F, -Z = B
 *
 * Cubie indices i,j,k are 0..N-1 along x/y/z respectively. A cubie's face
 * is "outward" only on the side where its index hits the border; otherwise
 * the face is internal and we paint it dark.
 *
 * Material slot order for `BoxGeometry` is [+X, -X, +Y, -Y, +Z, -Z].
 */

import type { CubeFaces } from '../cube/state.ts';
import type { Face } from '../cube/moves.ts';
import { WCA_COLORS } from '../cube/colors.ts';

export const INTERNAL_COLOR = '#1a1a1a';

export type FaceColors = Partial<Record<Face, string>>;

/** Material slot indices on `BoxGeometry`. */
export const MAT_PX = 0;
export const MAT_NX = 1;
export const MAT_PY = 2;
export const MAT_NY = 3;
export const MAT_PZ = 4;
export const MAT_NZ = 5;

/**
 * For one cubie at (i, j, k), return the 6-tuple of sticker colours.
 *
 * Faces array indexing is row-major (r * n + c) following `state.ts`:
 *  - U: row 0 = back, col 0 = left
 *  - D: row 0 = front, col 0 = left
 *  - F: row 0 = top, col 0 = left
 *  - B: row 0 = top, col 0 = side touching R
 *  - L: row 0 = top, col 0 = side touching B
 *  - R: row 0 = top, col 0 = side touching F
 */
export function colorsForCubie(
  state: CubeFaces,
  n: number,
  i: number,
  j: number,
  k: number,
  palette: Record<Face, string>,
): string[] {
  const out = [
    INTERNAL_COLOR, INTERNAL_COLOR, INTERNAL_COLOR,
    INTERNAL_COLOR, INTERNAL_COLOR, INTERNAL_COLOR,
  ];

  // +X = R face
  if (i === n - 1) {
    const r = (n - 1) - j;
    const c = (n - 1) - k;
    out[MAT_PX] = palette[state.R[r * n + c]];
  }
  // -X = L face
  if (i === 0) {
    const r = (n - 1) - j;
    const c = k;
    out[MAT_NX] = palette[state.L[r * n + c]];
  }
  // +Y = U face
  if (j === n - 1) {
    const r = k;
    const c = i;
    out[MAT_PY] = palette[state.U[r * n + c]];
  }
  // -Y = D face
  if (j === 0) {
    const r = (n - 1) - k;
    const c = i;
    out[MAT_NY] = palette[state.D[r * n + c]];
  }
  // +Z = F face
  if (k === n - 1) {
    const r = (n - 1) - j;
    const c = i;
    out[MAT_PZ] = palette[state.F[r * n + c]];
  }
  // -Z = B face
  if (k === 0) {
    const r = (n - 1) - j;
    const c = (n - 1) - i;
    out[MAT_NZ] = palette[state.B[r * n + c]];
  }

  return out;
}

/** Build the full N^3 × 6 colour matrix for a state. Mainly for tests. */
export function colorsForState(
  state: CubeFaces,
  n: number,
  palette: Record<Face, string> = WCA_COLORS,
): string[][] {
  const out: string[][] = [];
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        out.push(colorsForCubie(state, n, i, j, k, palette));
      }
    }
  }
  return out;
}
