/**
 * Tiny 3x3 cube simulator — sticker-array model, supports the WCA notation we
 * need for sticker previews + alg matching:
 *
 *   - Face turns: U D L R F B (with ' and 2)
 *   - Wide turns: Uw Dw Lw Rw Fw Bw (and lowercase shorthand: u d l r f b)
 *   - Slice turns: M E S
 *   - Rotations: x y z
 *
 * State is six 9-tuples (U R F D L B). Each sticker is one of the six face
 * letters U/R/F/D/L/B representing its current colour. Sticker indices follow
 * the standard layout (row-major from each face's "natural" top-left).
 *
 *   U:        L:        F:        R:        B:        D:
 *   0 1 2     0 1 2     0 1 2     0 1 2     0 1 2     0 1 2
 *   3 4 5     3 4 5     3 4 5     3 4 5     3 4 5     3 4 5
 *   6 7 8     6 7 8     6 7 8     6 7 8     6 7 8     6 7 8
 *
 * Self-contained, no deps. Ships in the client bundle.
 */

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type CubeState = Record<Face, Face[]>;

export const FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

export function solvedCube(): CubeState {
  const s: Partial<CubeState> = {};
  for (const f of FACES) s[f] = Array<Face>(9).fill(f);
  return s as CubeState;
}

export function cloneCube(c: CubeState): CubeState {
  const out: Partial<CubeState> = {};
  for (const f of FACES) out[f] = c[f].slice();
  return out as CubeState;
}

export function cubeEquals(a: CubeState, b: CubeState): boolean {
  for (const f of FACES) {
    for (let i = 0; i < 9; i++) if (a[f][i] !== b[f][i]) return false;
  }
  return true;
}

/** Rotate one face's stickers 90° clockwise (in-place index permutation). */
function rotFaceCW(face: Face[]): void {
  const t = face.slice();
  // After 90° CW: new[r][c] = old[2-c][r]. In flat indices:
  // 0<-6, 1<-3, 2<-0, 3<-7, 4<-4, 5<-1, 6<-8, 7<-5, 8<-2
  const map = [6, 3, 0, 7, 4, 1, 8, 5, 2];
  for (let i = 0; i < 9; i++) face[i] = t[map[i]];
}
function rotFaceCCW(face: Face[]): void {
  rotFaceCW(face); rotFaceCW(face); rotFaceCW(face);
}

/**
 * Side-cycle for each face turn. Each entry is a 4-tuple of 3 sticker indices
 * on adjacent faces, ordered so a single CW rotation cycles
 * tuple[0] → tuple[1] → tuple[2] → tuple[3] → tuple[0].
 *
 * Looking at the cube from the turning face's centre.
 */
const SIDE_CYCLES: Record<Face, [Face, number[]][]> = {
  // U: top face, CW from above. F-top → L-top → B-top → R-top → F-top.
  U: [['F', [0, 1, 2]], ['L', [0, 1, 2]], ['B', [0, 1, 2]], ['R', [0, 1, 2]]],
  // D: bottom face, CW from below (so visually CCW from above).
  // F-bot → R-bot → B-bot → L-bot → F-bot.
  D: [['F', [6, 7, 8]], ['R', [6, 7, 8]], ['B', [6, 7, 8]], ['L', [6, 7, 8]]],
  // R: right face, CW seen from right. U-right-col → B-left-col(reversed) → D-right-col → F-right-col → U-right-col.
  // Note: B's left column from R's perspective reads bottom→top.
  R: [['U', [2, 5, 8]], ['B', [6, 3, 0]], ['D', [2, 5, 8]], ['F', [2, 5, 8]]],
  // L: left face, CW seen from left. U-left-col → F-left-col → D-left-col → B-right-col(reversed) → U-left-col.
  L: [['U', [0, 3, 6]], ['F', [0, 3, 6]], ['D', [0, 3, 6]], ['B', [8, 5, 2]]],
  // F: front face, CW seen from front. U-bottom-row → R-left-col → D-top-row(reversed) → L-right-col(reversed) → U-bottom-row.
  F: [['U', [6, 7, 8]], ['R', [0, 3, 6]], ['D', [2, 1, 0]], ['L', [8, 5, 2]]],
  // B: back face, CW seen from back. U-top-row(reversed) → L-left-col → D-bottom-row → R-right-col(reversed) → U-top-row(reversed).
  B: [['U', [2, 1, 0]], ['L', [0, 3, 6]], ['D', [6, 7, 8]], ['R', [8, 5, 2]]],
};

/** Apply one face quarter-turn CW (e.g. R → R, R' = three of these, R2 = two). */
function applyFaceQuarterCW(c: CubeState, face: Face): void {
  rotFaceCW(c[face]);
  const cyc = SIDE_CYCLES[face];
  // Cycle is forward: tuple[0] → tuple[1] → tuple[2] → tuple[3] → tuple[0].
  // So new tuple[k+1] = old tuple[k]. Save tuple[3] first, then shift down.
  const last = cyc[3][1].map(i => c[cyc[3][0]][i]);
  for (let k = 3; k > 0; k--) {
    const [fSrc, iSrc] = cyc[k - 1];
    const [fDst, iDst] = cyc[k];
    for (let j = 0; j < 3; j++) c[fDst][iDst[j]] = c[fSrc][iSrc[j]];
  }
  const [fFirst, iFirst] = cyc[0];
  for (let j = 0; j < 3; j++) c[fFirst][iFirst[j]] = last[j];
}

function applyFace(c: CubeState, face: Face, amt: 1 | 2 | 3): void {
  for (let k = 0; k < amt; k++) applyFaceQuarterCW(c, face);
}

/**
 * Apply a slice move. M follows L direction, E follows D direction, S follows F direction
 * (WCA convention).
 */
function applySliceQuarter(c: CubeState, slice: 'M' | 'E' | 'S'): void {
  // Implemented as wide(opposite) + face(same) inverse — but easier: hand-code the cycle.
  if (slice === 'M') {
    // M = L direction on the middle slice. U-mid-col → F-mid-col → D-mid-col → B-mid-col(rev) → U
    const tmp = [c.U[1], c.U[4], c.U[7]];
    c.U[1] = c.B[7]; c.U[4] = c.B[4]; c.U[7] = c.B[1];
    c.B[7] = c.D[1]; c.B[4] = c.D[4]; c.B[1] = c.D[7];
    c.D[1] = c.F[1]; c.D[4] = c.F[4]; c.D[7] = c.F[7];
    c.F[1] = tmp[0]; c.F[4] = tmp[1]; c.F[7] = tmp[2];
  } else if (slice === 'E') {
    // E = D direction on the middle horizontal slice. F-mid-row → R-mid-row → B-mid-row → L-mid-row → F
    const tmp = [c.F[3], c.F[4], c.F[5]];
    c.F[3] = c.L[3]; c.F[4] = c.L[4]; c.F[5] = c.L[5];
    c.L[3] = c.B[3]; c.L[4] = c.B[4]; c.L[5] = c.B[5];
    c.B[3] = c.R[3]; c.B[4] = c.R[4]; c.B[5] = c.R[5];
    c.R[3] = tmp[0]; c.R[4] = tmp[1]; c.R[5] = tmp[2];
  } else { // S
    // S = F direction on the middle slice between U/D. U-mid-row → R-mid-col → D-mid-row(rev) → L-mid-col(rev) → U
    const tmp = [c.U[3], c.U[4], c.U[5]];
    c.U[3] = c.L[7]; c.U[4] = c.L[4]; c.U[5] = c.L[1];
    c.L[1] = c.D[3]; c.L[4] = c.D[4]; c.L[7] = c.D[5];
    c.D[3] = c.R[7]; c.D[4] = c.R[4]; c.D[5] = c.R[1];
    c.R[1] = tmp[0]; c.R[4] = tmp[1]; c.R[7] = tmp[2];
  }
}

function applySlice(c: CubeState, slice: 'M' | 'E' | 'S', amt: 1 | 2 | 3): void {
  for (let k = 0; k < amt; k++) applySliceQuarter(c, slice);
}

/** Whole-cube rotations. x = R direction, y = U direction, z = F direction. */
function applyRotationQuarter(c: CubeState, axis: 'x' | 'y' | 'z'): void {
  if (axis === 'y') {
    // F→L→B→R→F (top view) and rotate U CW, D CCW
    const F = c.F.slice(), L = c.L.slice(), B = c.B.slice(), R = c.R.slice();
    c.L = F; c.B = L; c.R = B; c.F = R;
    rotFaceCW(c.U); rotFaceCCW(c.D);
  } else if (axis === 'x') {
    // F→U→B(rev)→D(rev)→F and rotate R CW, L CCW
    const F = c.F.slice(), U = c.U.slice(), B = c.B.slice(), D = c.D.slice();
    c.U = F; c.B = U.reverse(); c.D = B.reverse(); c.F = D;
    rotFaceCW(c.R); rotFaceCCW(c.L);
  } else { // z
    // U→R→D→L→U and rotate F CW, B CCW
    const U = c.U.slice(), R = c.R.slice(), D = c.D.slice(), L = c.L.slice();
    rotFaceCW(c.F); rotFaceCCW(c.B);
    // Each side-face is also rotated 90° CW around z
    rotFaceCW(U); rotFaceCW(R); rotFaceCW(D); rotFaceCW(L);
    c.R = U; c.D = R; c.L = D; c.U = L;
  }
}

function applyRotation(c: CubeState, axis: 'x' | 'y' | 'z', amt: 1 | 2 | 3): void {
  for (let k = 0; k < amt; k++) applyRotationQuarter(c, axis);
}

const FACE_LETTERS: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const SLICE_LETTERS = ['M', 'E', 'S'] as const;
const ROT_LETTERS = ['x', 'y', 'z'] as const;

/** Token regex: allows R, R', R2, R2', Rw, Rw', Rw2, lowercase wide (r), slices, rotations. */
const TOKEN_RE = /([UDLRFBudlrfbMESxyz])(w)?(2)?('?)/g;

/**
 * Apply a sequence of moves to a cube state (mutates in place).
 * Returns the same state for chaining.
 *
 * Anything we can't parse (e.g. parenthesised groups, comments, unknown letters)
 * is silently ignored. Caller should pre-clean comments.
 */
export function applyAlg(c: CubeState, alg: string): CubeState {
  if (!alg) return c;
  // Strip parens but keep contents (we don't expand (..)2 here — rely on caller for pure linear algs)
  const cleaned = alg.replace(/[()]/g, ' ');
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(cleaned)) !== null) {
    const letter = m[1];
    const wide = !!m[2];
    const isDouble = !!m[3];
    const isPrime = m[4] === "'";
    const baseAmt: 1 | 2 = isDouble ? 2 : 1;
    const amt = (isPrime ? 4 - baseAmt : baseAmt) as 1 | 2 | 3;

    const upper = letter.toUpperCase();
    const isLowerFace = letter !== upper && (FACE_LETTERS as string[]).includes(upper);
    const wideEffective = wide || isLowerFace;

    if ((FACE_LETTERS as string[]).includes(upper)) {
      const face = upper as Face;
      if (wideEffective) {
        // Wide turn = face turn + same-direction slice on adjacent middle layer
        applyFace(c, face, amt);
        const sliceDir = wideSliceFor(face);
        const sliceAmt = wideSliceAmtFor(face, amt);
        applySlice(c, sliceDir, sliceAmt);
      } else {
        applyFace(c, face, amt);
      }
    } else if ((SLICE_LETTERS as readonly string[]).includes(upper)) {
      applySlice(c, upper as 'M' | 'E' | 'S', amt);
    } else if ((ROT_LETTERS as readonly string[]).includes(letter)) {
      applyRotation(c, letter as 'x' | 'y' | 'z', amt);
    }
  }
  return c;
}

/** Which slice direction a wide face turn uses. Rw = R + M' (M opposite of R direction). */
function wideSliceFor(face: Face): 'M' | 'E' | 'S' {
  if (face === 'R' || face === 'L') return 'M';
  if (face === 'U' || face === 'D') return 'E';
  return 'S'; // F or B
}

/**
 * Wide-turn slice amount.
 * Rw = R + M' (slice goes in opposite direction to face), Lw = L + M (same direction), etc.
 * Convention: M follows L, E follows D, S follows F.
 */
function wideSliceAmtFor(face: Face, faceAmt: 1 | 2 | 3): 1 | 2 | 3 {
  // Wide face turn rotates the WHOLE cube minus the opposite face — equivalent to:
  //   Rw  = R + (M layer turned R-direction) = R + M'
  //   Lw  = L + M
  //   Uw  = U + E'
  //   Dw  = D + E
  //   Fw  = F + S
  //   Bw  = B + S'
  const sliceMatchesFace: Record<Face, boolean> = {
    R: false, L: true, U: false, D: true, F: true, B: false,
  };
  if (faceAmt === 2) return 2;
  return sliceMatchesFace[face] ? faceAmt : (4 - faceAmt) as 1 | 3;
}

/**
 * Apply algorithm to a fresh solved cube. Convenience wrapper used by sticker
 * previews and the alg matcher.
 */
export function cubeFromAlg(alg: string): CubeState {
  return applyAlg(solvedCube(), alg);
}

/** Convert state to the standard 54-char facelet string in URFDLB order. */
export function toFacelets(c: CubeState): string {
  return [...c.U, ...c.R, ...c.F, ...c.D, ...c.L, ...c.B].join('');
}

/**
 * Invert an algorithm string. Reverses move order and inverts each move:
 *   "R U R' U'" → "U R U' R'"
 * Tokens we don't recognise are dropped (matches our simulator's apply behaviour).
 */
export function invertAlg(alg: string): string {
  if (!alg) return '';
  const cleaned = alg.replace(/[()]/g, ' ');
  const tokens: string[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(cleaned)) !== null) {
    const letter = m[1];
    const wide = m[2] ?? '';
    const isDouble = !!m[3];
    const isPrime = m[4] === "'";
    if (isDouble) {
      // X2 is self-inverse (X2 = X2' both quarter-twice)
      tokens.push(`${letter}${wide}2`);
    } else {
      tokens.push(`${letter}${wide}${isPrime ? '' : "'"}`);
    }
  }
  return tokens.reverse().join(' ');
}
