/**
 * Piece-level (cubie) 3x3 model — just enough of it to read the state a smart
 * cube reports about itself.
 *
 * GAN v2/v3/v4 (and MoYu32, and QiYi) do not send facelets on the wire. They
 * send permutation + orientation for 7 corners and 11 edges; the last of each
 * is recovered by checksum. This module turns that into the 54-character
 * facelet string the rest of the timer speaks, and refuses states that are not
 * physically reachable — a wrong AES key decodes to garbage that would
 * otherwise be adopted as "the cube's real state".
 *
 * Ported from csTimer's `mathlib.CubieCube` (`D:\cube\cstimer\src\js\lib\
 * mathlib.js`), which is the same model every one of these protocols was
 * written against. Encoding, verbatim from there:
 *
 *   ca[i] = orientation << 3 | permutation      (corners, ori 0..2)
 *   ea[i] = permutation  << 1 | orientation     (edges,   ori 0..1)
 *
 * Deliberately NOT reusing `scramble/solver/facelet.ts`: that module pulls in
 * the Kociemba move tables, which is a large dependency to drag into the
 * Bluetooth path for what amounts to two lookup tables.
 */

/** Facelet indices of each corner's three stickers, in orientation order. */
const CORNER_FACELET: readonly (readonly [number, number, number])[] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];

/** Facelet indices of each edge's two stickers, in orientation order. */
const EDGE_FACELET: readonly (readonly [number, number])[] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];

export interface CubieState {
  /** 8 corners, `ori << 3 | perm`. */
  ca: number[];
  /** 12 edges, `perm << 1 | ori`. */
  ea: number[];
}

/**
 * Rebuild the 8th corner and 12th edge from the 7 + 11 the wire carries.
 * The checksum arithmetic is csTimer's, shared by the v2 / v3 / v4 parsers.
 *
 * `corners` / `edges` must already be in the packed `ca` / `ea` encoding.
 */
export function completeCubieState(corners: number[], edges: number[]): CubieState {
  const ca = corners.slice(0, 7);
  const ea = edges.slice(0, 11);

  let cchk = 0xf00;
  for (let i = 0; i < 7; i++) {
    cchk -= (ca[i] >> 3) << 3;
    cchk ^= ca[i] & 7;
  }
  ca[7] = ((cchk & 0xff8) % 24) | (cchk & 0x7);

  let echk = 0;
  for (let i = 0; i < 11; i++) echk ^= ea[i];
  ea[11] = echk;

  return { ca, ea };
}

/* ------------------------------------------------------------------ */
/*  Validity                                                          */
/* ------------------------------------------------------------------ */

/** Lehmer rank of a permutation — csTimer's `getNPerm`, small-n branch. */
function getNPerm(arr: number[], n: number): number {
  let idx = 0;
  let vall = 0x76543210;
  let valh = 0xfedcba98;
  for (let i = 0; i < n - 1; i++) {
    const v = arr[i] << 2;
    idx *= n - i;
    if (v >= 32) {
      idx += (valh >>> (v - 32)) & 0xf;
      valh -= 0x11111110 << (v - 32);
    } else {
      idx += (vall >>> v) & 0xf;
      valh -= 0x11111111;
      vall -= 0x11111110 << v;
    }
  }
  return idx;
}

/** Parity of the permutation with the given Lehmer rank. */
function getNParity(idx: number, n: number): number {
  let p = 0;
  for (let i = n - 2; i >= 0; i--) {
    p ^= idx % (n - i);
    idx = Math.trunc(idx / (n - i));
  }
  return p & 1;
}

/**
 * True when this state is reachable on a real cube: every piece present
 * exactly once, corner twists summing to 0 mod 3, edge flips even, and corner
 * permutation parity matching edge permutation parity.
 *
 * csTimer's `verify()` folds all of that into one modulo — the edge-flip xor
 * and the doubled corner-twist sum share `sum`, so `sum % 6 == 0` means "flips
 * even AND twists ≡ 0 (mod 3)" at once.
 */
export function isValidCubieState(st: CubieState): boolean {
  const { ca, ea } = st;
  if (ca.length !== 8 || ea.length !== 12) return false;

  let mask = 0;
  let sum = 0;
  const ep: number[] = [];
  for (let e = 0; e < 12; e++) {
    mask |= 1 << 8 << (ea[e] >> 1);
    sum ^= ea[e] & 1;
    ep.push(ea[e] >> 1);
  }
  const cp: number[] = [];
  for (let c = 0; c < 8; c++) {
    mask |= 1 << (ca[c] & 7);
    sum += (ca[c] >> 3) << 1;
    cp.push(ca[c] & 7);
  }
  if (mask !== 0xfffff) return false;
  if (sum % 6 !== 0) return false;
  return getNParity(getNPerm(ep, 12), 12) === getNParity(getNPerm(cp, 8), 8);
}

/* ------------------------------------------------------------------ */
/*  Serialisation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Cubie state -> the 54-character facelet string in `URFDLB` face order
 * (csTimer's `toFaceCube()`).
 */
export function cubieToFacelets(st: CubieState): string {
  const perm = new Array<number>(54);
  for (let i = 0; i < 54; i++) perm[i] = i;

  for (let c = 0; c < 8; c++) {
    const j = st.ca[c] & 0x7;
    const ori = st.ca[c] >> 3;
    for (let n = 0; n < 3; n++) perm[CORNER_FACELET[c][(n + ori) % 3]] = CORNER_FACELET[j][n];
  }
  for (let e = 0; e < 12; e++) {
    const j = st.ea[e] >> 1;
    const ori = st.ea[e] & 1;
    for (let n = 0; n < 2; n++) perm[EDGE_FACELET[e][(n + ori) % 2]] = EDGE_FACELET[j][n];
  }

  let out = '';
  for (let i = 0; i < 54; i++) out += 'URFDLB'.charAt(Math.trunc(perm[i] / 9));
  return out;
}

/**
 * The whole wire -> facelets path in one call: complete the missing pieces,
 * reject the state if it is not a real cube, otherwise serialise.
 *
 * Returns null on an invalid state, which is the signal for "this frame was
 * decrypted with the wrong key — do not trust it".
 */
export function decodeCubieFacelets(corners: number[], edges: number[]): string | null {
  const st = completeCubieState(corners, edges);
  if (!isValidCubieState(st)) return null;
  return cubieToFacelets(st);
}
