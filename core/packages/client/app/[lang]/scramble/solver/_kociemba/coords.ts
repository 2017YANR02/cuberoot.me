/**
 * Coordinate encoders / decoders for the two-phase algorithm.
 *
 * Each "coord" is a small integer that captures one aspect of cube state.
 * The size of each coord determines the move-table size; pruning tables are
 * keyed on combinations of coords. All coords here are canonical Kociemba.
 *
 *   Phase-1 coords:
 *     twist  ∈ [0, 3^7)        = 2187    corner orientation
 *     flip   ∈ [0, 2^11)       = 2048    edge orientation
 *     slice  ∈ [0, C(12,4))    = 495     UD-slice edges presence (unsorted)
 *     sliceSorted ∈ [0, 11880) = 12*11*10*9   slice presence + 4-perm
 *
 *   Phase-2 coords:
 *     cperm  ∈ [0, 8!)         = 40320   corner permutation
 *     eperm  ∈ [0, 8!)         = 40320   permutation of UD-face edges
 *     sperm  ∈ [0, 4!)         = 24      permutation of slice edges
 */

import type { CubieCube } from './cube';

/* ────────────────────────── helpers ────────────────────────── */

/** n choose k for small n. */
function nck(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let num = 1;
  let den = 1;
  for (let i = 1; i <= k; i++) {
    num *= n - k + i;
    den *= i;
  }
  return Math.round(num / den);
}

/**
 * Encode permutation p (of {0..n-1}) → integer in [0, n!).
 * Uses Lehmer code: digit i = rank of p[i] among values still present
 * (i.e. # of j>i with p[j]<p[i]).
 */
function permToIndex(p: readonly number[]): number {
  const n = p.length;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    idx *= n - i;
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) idx++;
  }
  return idx;
}

/** Inverse of permToIndex. */
function indexToPerm(idx: number, n: number): number[] {
  // Decode digits d_0..d_{n-1}, where d_i ∈ [0, n-i).
  // From the encoder: idx = ((d_0 * (n-1) + d_1) * (n-2) + d_2) * ... + d_{n-1}.
  // So d_{n-1} = idx % 1 (=0), d_{n-2} = (idx)/1 % 2, etc.
  const digits = new Array<number>(n);
  let x = idx;
  for (let i = n - 1; i >= 0; i--) {
    digits[i] = x % (n - i);
    x = Math.floor(x / (n - i));
  }
  // digits[i] = rank of p[i] among values not yet placed.
  const remaining: number[] = [];
  for (let i = 0; i < n; i++) remaining.push(i);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    out[i] = remaining[digits[i]];
    remaining.splice(digits[i], 1);
  }
  return out;
}

/* ────────────────────────── corner orientation (twist) ────────────────────────── */

export const N_TWIST = 2187; // 3^7

export function coTwistOf(c: CubieCube): number {
  let t = 0;
  for (let i = 0; i < 7; i++) t = t * 3 + c.co[i];
  return t;
}

export function coTwistSet(c: CubieCube, twist: number): void {
  let parity = 0;
  for (let i = 6; i >= 0; i--) {
    const x = twist % 3;
    twist = Math.floor(twist / 3);
    c.co[i] = x;
    parity = (parity + x) % 3;
  }
  c.co[7] = (3 - parity) % 3;
}

/* ────────────────────────── edge orientation (flip) ────────────────────────── */

export const N_FLIP = 2048; // 2^11

export function eoFlipOf(c: CubieCube): number {
  let f = 0;
  for (let i = 0; i < 11; i++) f = f * 2 + c.eo[i];
  return f;
}

export function eoFlipSet(c: CubieCube, flip: number): void {
  let parity = 0;
  for (let i = 10; i >= 0; i--) {
    const x = flip & 1;
    flip >>= 1;
    c.eo[i] = x;
    parity ^= x;
  }
  c.eo[11] = parity;
}

/* ────────────────────────── UD-slice presence (raw) ────────────────────────── */

export const N_SLICE_RAW = 495; // C(12,4)

export function sliceRawOf(c: CubieCube): number {
  let rank = 0;
  let k = 3;
  for (let i = 11; i >= 0 && k >= 0; i--) {
    if (c.ep[i] >= 8) {
      rank += nck(i, k + 1);
      k--;
    }
  }
  return rank;
}

/* ────────────────────────── slice-sorted ────────────────────────── */

export const N_SLICE_SORTED = 11880; // C(12,4) * 4! = 495 * 24

export function sliceSortedOf(c: CubieCube): number {
  let a = 0;
  const edge4 = new Array<number>(4);
  let k = 3;
  for (let j = 11; j >= 0; j--) {
    if (c.ep[j] >= 8) {
      a += nck(j, k + 1);
      edge4[3 - k] = c.ep[j] - 8;
      k--;
    }
  }
  let x = 0;
  for (let j = 0; j < 4; j++) {
    x *= 4 - j;
    for (let l = j + 1; l < 4; l++) if (edge4[l] < edge4[j]) x++;
  }
  return a * 24 + x;
}

export function sliceSortedSet(c: CubieCube, idx: number): void {
  const x = idx % 24;
  const a = Math.floor(idx / 24);

  // Decode 4-perm
  const edge4 = indexToPerm(x, 4);

  // Decode combination
  let aa = a;
  let k = 3;
  const slicePositions: number[] = []; // descending order
  for (let i = 11; i >= 0 && k >= 0; i--) {
    const v = nck(i, k + 1);
    if (aa >= v) {
      aa -= v;
      slicePositions.push(i);
      k--;
    }
  }
  // slicePositions[i] holds edge value (8 + edge4[i])
  for (let i = 0; i < 12; i++) c.ep[i] = -1;
  for (let i = 0; i < 4; i++) c.ep[slicePositions[i]] = 8 + edge4[i];
  let counter = 0;
  for (let i = 0; i < 12; i++) {
    if (c.ep[i] === -1) c.ep[i] = counter++;
  }
}

/* ────────────────────────── corner perm (phase-2) ────────────────────────── */

export const N_CPERM = 40320; // 8!

export function cpermOf(c: CubieCube): number {
  return permToIndex(c.cp);
}

export function cpermSet(c: CubieCube, idx: number): void {
  const p = indexToPerm(idx, 8);
  for (let i = 0; i < 8; i++) c.cp[i] = p[i];
}

/* ────────────────────────── U/D edge perm (phase-2) ────────────────────────── */

export const N_EPERM = 40320;

export function epermOf(c: CubieCube): number {
  return permToIndex(c.ep.slice(0, 8));
}

export function epermSet(c: CubieCube, idx: number): void {
  const p = indexToPerm(idx, 8);
  for (let i = 0; i < 8; i++) c.ep[i] = p[i];
}

/* ────────────────────────── slice perm (phase-2) ────────────────────────── */

export const N_SPERM = 24; // 4!

export function spermOf(c: CubieCube): number {
  const p = new Array<number>(4);
  for (let i = 0; i < 4; i++) p[i] = c.ep[8 + i] - 8;
  return permToIndex(p);
}

export function spermSet(c: CubieCube, idx: number): void {
  const p = indexToPerm(idx, 4);
  for (let i = 0; i < 4; i++) c.ep[8 + i] = 8 + p[i];
}

export { permToIndex, indexToPerm, nck };
