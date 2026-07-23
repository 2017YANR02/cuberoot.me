/**
 * NxN cube state simulator — TS port of cstimer `nnnImage` (src/js/tools/image.js).
 *
 * In-place `Uint8Array` posit: posit[face*N² + i*N + j] = current face id of the
 * sticker at (face, row=i, col=j). 6 face ids 0..5 in cstimer order D L B U R F
 * (NOT WCA URFDLB — neighbor table + doslice formulas hard-coded to this order).
 *
 * Used by:
 *   - `mirror_blocks_svg.ts` (3-cube shape mod, displays cubie-size displacement)
 *   - `cube_unfolded_svg.ts` (standard WCA unfolded net, all NxN events + nxnN)
 *
 * Why cstimer over visualcube `CubeData`: cstimer mutates `posit` in place,
 * cstimer's `.map()` per face turn allocates a 90000-element Array at N=300
 * for each face rotation → slow + GC pressure. cstimer is ~5× faster at high N.
 *
 * Supports any WCA scramble token the regex below accepts:
 *   - `R` `R2` `R'`                 single outer-slice
 *   - `Rw` `Rw2` `Rw'`              2-layer wide (default)
 *   - `2Rw`..`<N>Rw` + 2/' mods     N-layer wide (any width, no [2-9] limit)
 * Unknown tokens silently skipped.
 */

/** cstimer face indexing — DON'T rearrange, doslice + neighbor formulas depend on it. */
export const FACE_D = 0;
export const FACE_L = 1;
export const FACE_B = 2;
export const FACE_U = 3;
export const FACE_R = 4;
export const FACE_F = 5;

const MOVE_TO_FACE: Record<string, number> = {
  D: FACE_D, L: FACE_L, B: FACE_B, U: FACE_U, R: FACE_R, F: FACE_F,
};

/** Layer-prefix + face + optional w + optional 2/' mod. Layer is `\d+` so
 *  `10Rw` parses correctly (visualcube's old `[2-9]+` only matched 2..9). */
const TOKEN_RE = /^(\d+)?([URFDLB])(w)?([2'])?$/;

/** Any array the sim can permute: `Uint8Array` for the color model, `Int32Array`
 *  for the sticker-id model (ids exceed 255 from N=7 up). */
export type PositArray = Uint8Array | Int32Array;

/** One quarter-turn on slice `d` of face `f` (d=0 = outer face slice). Verbatim
 *  cstimer formulas (size parameterized). Mutates posit in place. */
export function doslice(f: number, d: number, q: number, size: number, posit: PositArray): void {
  const s2 = size * size;
  for (let k = 0; k < q; k++) {
    let f1 = 0, f2 = 0, f3 = 0, f4 = 0;
    for (let i = 0; i < size; i++) {
      if (f === 0) {
        f1 = 6 * s2 - size * d - size + i;
        f2 = 2 * s2 - size * d - 1 - i;
        f3 = 3 * s2 - size * d - 1 - i;
        f4 = 5 * s2 - size * d - size + i;
      } else if (f === 1) {
        f1 = 3 * s2 + d + size * i;
        f2 = 3 * s2 + d - size * (i + 1);
        f3 = s2 + d - size * (i + 1);
        f4 = 5 * s2 + d + size * i;
      } else if (f === 2) {
        f1 = 3 * s2 + d * size + i;
        f2 = 4 * s2 + size - 1 - d + size * i;
        f3 = d * size + size - 1 - i;
        f4 = 2 * s2 - 1 - d - size * i;
      } else if (f === 3) {
        f1 = 4 * s2 + d * size + size - 1 - i;
        f2 = 2 * s2 + d * size + i;
        f3 = s2 + d * size + i;
        f4 = 5 * s2 + d * size + size - 1 - i;
      } else if (f === 4) {
        f1 = 6 * s2 - 1 - d - size * i;
        f2 = size - 1 - d + size * i;
        f3 = 2 * s2 + size - 1 - d + size * i;
        f4 = 4 * s2 - 1 - d - size * i;
      } else if (f === 5) {
        f1 = 4 * s2 - size - d * size + i;
        f2 = 2 * s2 - size + d - size * i;
        f3 = s2 - 1 - d * size - i;
        f4 = 4 * s2 + d + size * i;
      }
      const c = posit[f1];
      posit[f1] = posit[f2];
      posit[f2] = posit[f3];
      posit[f3] = posit[f4];
      posit[f4] = c;
    }
    if (d === 0) {
      // Rotate the face itself (the d==0 outer-slice quarter also spins the face).
      for (let i = 0; i + i < size; i++) {
        for (let j = 0; j + j < size - 1; j++) {
          const a1 = f * s2 + i + j * size;
          const a3 = f * s2 + (size - 1 - i) + (size - 1 - j) * size;
          let a2: number, a4: number;
          if (f < 3) {
            a2 = f * s2 + (size - 1 - j) + i * size;
            a4 = f * s2 + j + (size - 1 - i) * size;
          } else {
            a4 = f * s2 + (size - 1 - j) + i * size;
            a2 = f * s2 + j + (size - 1 - i) * size;
          }
          const c = posit[a1];
          posit[a1] = posit[a2];
          posit[a2] = posit[a3];
          posit[a3] = posit[a4];
          posit[a4] = c;
        }
      }
    }
  }
}

/** Apply a scramble to an already-seeded posit array, in place. */
export function applyScrambleTo(size: number, scramble: string, posit: PositArray): void {
  const tokens = scramble.trim().split(/\s+/);
  for (const tok of tokens) {
    if (!tok) continue;
    const m = TOKEN_RE.exec(tok);
    if (!m) continue;
    const face = MOVE_TO_FACE[m[2]];
    const widthPrefix = m[1] ? parseInt(m[1], 10) : 0;
    const isWide = !!m[3];
    const q = m[4] === '2' ? 2 : m[4] === "'" ? 3 : 1;
    // Width: explicit prefix takes precedence; `Rw` defaults to 2-layer; `R` = 1.
    // Cap at size — `10Rw` on a N=5 cube means whole cube, no-op for the puzzle
    // but cycling still happens cleanly thanks to the cap.
    let width: number;
    if (widthPrefix > 0) width = Math.min(widthPrefix, size);
    else if (isWide) width = Math.min(2, size);
    else width = 1;
    for (let d = 0; d < width; d++) doslice(face, d, q, size, posit);
  }
}

/** Apply a scramble to a fresh solved cube, return the resulting posit array.
 *  Tokens that don't parse are silently skipped (logs nothing — caller doesn't
 *  need a strict parser, only "render whatever I gave you sensibly"). */
export function simulateNxN(size: number, scramble: string): Uint8Array {
  const s2 = size * size;
  const posit = new Uint8Array(6 * s2);
  // Solved state: each face filled with its own face id.
  for (let f = 0; f < 6; f++) posit.fill(f, f * s2, (f + 1) * s2);
  applyScrambleTo(size, scramble, posit);
  return posit;
}

/** Same permutation, but seeded with sticker IDS (= the solved-frame posit index)
 *  instead of face ids, so each slot reports which sticker ORIGINALLY lived there.
 *  Face id of a value `v` is `v / size²` — i.e. `simulateNxN` colors are recoverable. */
export function simulateNxNIds(size: number, scramble: string): Int32Array {
  const posit = new Int32Array(6 * size * size);
  for (let i = 0; i < posit.length; i++) posit[i] = i;
  applyScrambleTo(size, scramble, posit);
  return posit;
}
