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
 * The `cp/co/ep/eo` model the solver speaks lives elsewhere
 * (`lib/cube-facelet.ts`); this one stays separate because the wire encoding is
 * the packed `ca`/`ea` above plus the checksum completion, neither of which the
 * solver has any use for. The sticker numbering IS shared — imported below
 * rather than copied.
 */

/** Kociemba/csTimer sticker tables in URFDLB face order. */
export const CORNER_FACELET: ReadonlyArray<readonly [number, number, number]> = [
  [8, 9, 20],
  [6, 18, 38],
  [0, 36, 47],
  [2, 45, 11],
  [29, 26, 15],
  [27, 44, 24],
  [33, 53, 42],
  [35, 17, 51],
];

export const EDGE_FACELET: ReadonlyArray<readonly [number, number]> = [
  [5, 10],
  [7, 19],
  [3, 37],
  [1, 46],
  [32, 16],
  [28, 25],
  [30, 43],
  [34, 52],
  [23, 12],
  [21, 41],
  [50, 39],
  [48, 14],
];

/**
 * Which facelets belong to which piece, and in what orientation order.
 *
 * A protocol that sends cubies has to agree with us on how its piece indices
 * and orientation zero map onto stickers, and not all of them use csTimer's
 * default numbering — the Giiker frames index the same cube with the corners
 * permuted and each triple rotated. csTimer handles that by letting
 * `toFaceCube(cFacelet, eFacelet)` take the tables as arguments
 * (`mathlib.js:495`), so we do the same rather than hard-coding one brand's
 * view of the cube.
 */
export interface FaceletTables {
  /** Facelet indices of each corner's three stickers, in orientation order. */
  readonly corners: readonly (readonly [number, number, number])[];
  /** Facelet indices of each edge's two stickers, in orientation order. */
  readonly edges: readonly (readonly [number, number])[];
}

/** csTimer's `CubieCube.cFacelet` / `eFacelet` — the default for every brand
 *  that speaks Kociemba numbering. Same tables the solver side reads facelets
 *  with, so they come from one place. */
export const DEFAULT_FACELET_TABLES: FaceletTables = {
  corners: CORNER_FACELET,
  edges: EDGE_FACELET,
};

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
 *
 * `tables` is the sticker numbering the *source* of the state uses; pass the
 * brand's tables when decoding a frame, and nothing at all when the state came
 * from our own model.
 */
export function cubieToFacelets(st: CubieState, tables: FaceletTables = DEFAULT_FACELET_TABLES): string {
  const { corners, edges } = tables;
  const perm = new Array<number>(54);
  for (let i = 0; i < 54; i++) perm[i] = i;

  for (let c = 0; c < 8; c++) {
    const j = st.ca[c] & 0x7;
    const ori = st.ca[c] >> 3;
    for (let n = 0; n < 3; n++) perm[corners[c][(n + ori) % 3]] = corners[j][n];
  }
  for (let e = 0; e < 12; e++) {
    const j = st.ea[e] >> 1;
    const ori = st.ea[e] & 1;
    for (let n = 0; n < 2; n++) perm[edges[e][(n + ori) % 2]] = edges[j][n];
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

/* ------------------------------------------------------------------ */
/*  Moves                                                             */
/* ------------------------------------------------------------------ */

/**
 * The piece-level move model. `_lib/cube/state.ts` already turns cubes at the
 * FACELET level and is what the app uses; this exists because the smart-cube
 * protocols speak cubies, so anything that has to produce a wire-format state
 * (the dev fake cube) needs to turn one. The two models are independent
 * implementations of the same group and `tests/smart_cube_state_parity.test.ts`
 * holds them to the same answer.
 */
export function solvedCubie(): CubieState {
  return {
    ca: [0, 1, 2, 3, 4, 5, 6, 7],
    ea: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
  };
}

/** Group operation: apply `b` to `a` (csTimer's `CubeMult`). */
export function cubieMultiply(a: CubieState, b: CubieState): CubieState {
  const ca = new Array<number>(8);
  for (let c = 0; c < 8; c++) {
    const src = a.ca[b.ca[c] & 7];
    ca[c] = (src & 7) | ((((src >> 3) + (b.ca[c] >> 3)) % 3) << 3);
  }
  const ea = new Array<number>(12);
  for (let e = 0; e < 12; e++) ea[e] = a.ea[b.ea[e] >> 1] ^ (b.ea[e] & 1);
  return { ca, ea };
}

/**
 * The 18 face turns, indexed `face * 3 + power` over `URFDLB` with power
 * 0 = CW, 1 = 180, 2 = CCW. The six quarter turns are csTimer's tables
 * verbatim; the rest are composed, which is also how csTimer builds them.
 */
const MOVE_CUBIES: CubieState[] = (() => {
  const base: Record<number, CubieState> = {
    0: { ca: [3, 0, 1, 2, 4, 5, 6, 7], ea: [6, 0, 2, 4, 8, 10, 12, 14, 16, 18, 20, 22] },
    3: { ca: [20, 1, 2, 8, 15, 5, 6, 19], ea: [16, 2, 4, 6, 22, 10, 12, 14, 8, 18, 20, 0] },
    6: { ca: [9, 21, 2, 3, 16, 12, 6, 7], ea: [0, 19, 4, 6, 8, 17, 12, 14, 3, 11, 20, 22] },
    9: { ca: [0, 1, 2, 3, 5, 6, 7, 4], ea: [0, 2, 4, 6, 10, 12, 14, 8, 16, 18, 20, 22] },
    12: { ca: [0, 10, 22, 3, 4, 17, 13, 7], ea: [0, 2, 20, 6, 8, 10, 18, 14, 16, 4, 12, 22] },
    15: { ca: [0, 1, 11, 23, 4, 5, 18, 14], ea: [0, 2, 4, 23, 8, 10, 12, 21, 16, 18, 7, 15] },
  };
  const out: CubieState[] = [];
  for (let axis = 0; axis < 18; axis += 3) {
    out[axis] = base[axis];
    out[axis + 1] = cubieMultiply(out[axis], base[axis]);
    out[axis + 2] = cubieMultiply(out[axis + 1], base[axis]);
  }
  return out;
})();

/**
 * Apply WCA face notation (`R`, `R'`, `R2`, space separated) to a cubie state.
 * Quarter and half turns of the six outer faces only — that is the whole of
 * what a smart cube can report. Unknown tokens throw rather than being
 * skipped: a fake cube that silently ignored a move would be worse than no
 * fake cube at all.
 */
export function applyCubieAlg(state: CubieState, alg: string): CubieState {
  let cur = state;
  for (const token of alg.trim().split(/\s+/)) {
    if (!token) continue;
    const face = 'URFDLB'.indexOf(token[0]);
    if (face < 0) throw new Error(`applyCubieAlg: unsupported move "${token}"`);
    const suffix = token.slice(1);
    const power = suffix === '' ? 0 : suffix === '2' ? 1 : suffix === "'" ? 2 : -1;
    if (power < 0) throw new Error(`applyCubieAlg: unsupported move "${token}"`);
    cur = cubieMultiply(cur, MOVE_CUBIES[face * 3 + power]);
  }
  return cur;
}

export const SOLVED_SMART_CUBE_FACELETS =
  'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/**
 * Parse canonical URFDLB facelets into the packed cubie model used by every
 * smart-cube protocol. Returns null for malformed or physically unreachable
 * states, so a transport never has to maintain its own state parser.
 */
export function cubieStateFromFacelets(facelets: string): CubieState | null {
  if (facelets.length !== 54) return null;
  const colors = new Array<number>(54);
  const counts = new Array<number>(6).fill(0);
  for (let index = 0; index < facelets.length; index++) {
    const color = 'URFDLB'.indexOf(facelets[index]);
    if (color < 0) return null;
    colors[index] = color;
    counts[color]++;
  }
  if (counts.some((count) => count !== 9)) return null;

  const ca = new Array<number>(8);
  for (let position = 0; position < 8; position++) {
    let orientation = 0;
    for (; orientation < 3; orientation++) {
      const color = colors[CORNER_FACELET[position][orientation]];
      if (color === 0 || color === 3) break;
    }
    if (orientation === 3) return null;
    const color1 = colors[CORNER_FACELET[position][(orientation + 1) % 3]];
    const color2 = colors[CORNER_FACELET[position][(orientation + 2) % 3]];
    let piece = -1;
    for (let candidate = 0; candidate < 8; candidate++) {
      if (color1 === Math.trunc(CORNER_FACELET[candidate][1] / 9)
        && color2 === Math.trunc(CORNER_FACELET[candidate][2] / 9)) {
        piece = candidate;
        break;
      }
    }
    if (piece < 0) return null;
    ca[position] = (orientation << 3) | piece;
  }

  const ea = new Array<number>(12);
  for (let position = 0; position < 12; position++) {
    const color0 = colors[EDGE_FACELET[position][0]];
    const color1 = colors[EDGE_FACELET[position][1]];
    let packed = -1;
    for (let candidate = 0; candidate < 12; candidate++) {
      const candidate0 = Math.trunc(EDGE_FACELET[candidate][0] / 9);
      const candidate1 = Math.trunc(EDGE_FACELET[candidate][1] / 9);
      if (color0 === candidate0 && color1 === candidate1) {
        packed = candidate << 1;
        break;
      }
      if (color0 === candidate1 && color1 === candidate0) {
        packed = (candidate << 1) | 1;
        break;
      }
    }
    if (packed < 0) return null;
    ea[position] = packed;
  }

  const state = { ca, ea };
  if (!isValidCubieState(state)) return null;
  return cubieToFacelets(state) === facelets ? state : null;
}

/**
 * Transport-neutral move-stream tracker shared by Web and native apps. The
 * tracker advances before hosts are notified, can adopt a cube-reported state,
 * and uses the same cubie model as the GAN/MoYu/QiYi protocol decoders.
 */
export class SmartCubeStateTracker {
  private state = solvedCubie();

  reset(): void {
    this.state = solvedCubie();
  }

  adoptFacelets(facelets: string): boolean {
    const state = cubieStateFromFacelets(facelets);
    if (!state) return false;
    this.state = state;
    return true;
  }

  applyMove(move: string): boolean {
    try {
      this.state = applyCubieAlg(this.state, move);
    } catch {
      // Drivers are expected to emit one outer-face token. Ignore an unknown
      // token rather than corrupting the last trusted state.
    }
    return this.isSolved();
  }

  isSolved(): boolean {
    return cubieToFacelets(this.state) === SOLVED_SMART_CUBE_FACELETS;
  }

  getFacelets(): string {
    return cubieToFacelets(this.state);
  }
}

/**
 * Split a cubie state back into the 7 corners + 11 edges the wire carries.
 * Inverse of `completeCubieState`, for building protocol frames.
 */
export function cubieStateToWire(st: CubieState): { corners: number[]; edges: number[] } {
  return { corners: st.ca.slice(0, 7), edges: st.ea.slice(0, 11) };
}
