/**
 * Minimal 3x3 cube state model (cp, co, ep, eo) for the group-theory page.
 *
 * Single source of truth for:
 *   - face-turn permutations of the 8 corners and 12 edges
 *   - corner twist (mod 3) and edge flip (mod 2) deltas
 *   - the three sliceable invariants:
 *       Σ co ≡ 0 (mod 3)
 *       Σ eo ≡ 0 (mod 2)
 *       sgn(cp) = sgn(ep)
 *   - element order — repeatedly compose move sequence until identity
 *
 * Corner indexing (standard Singmaster):
 *   0:URF 1:UFL 2:ULB 3:UBR 4:DFR 5:DLF 6:DBL 7:DRB
 * Edge indexing:
 *   0:UR 1:UF 2:UL 3:UB 4:DR 5:DF 6:DL 7:DB 8:FR 9:FL 10:BL 11:BR
 *
 * CO convention: the U/D sticker of each corner. 0 = correct facelet, +1 = CW twist
 * seen from U (or D), +2 = CCW twist.
 * EO convention: flip flag relative to the F/B + U/D "good edge" predicate
 * used by Thistlethwaite — 0 = good, 1 = bad. A face turn of F or B flips the 4
 * edges in that layer; other face turns preserve EO.
 */

export type CubieState = {
  cp: number[];  // length 8, permutation of 0..7
  co: number[];  // length 8, twists in {0, 1, 2}
  ep: number[];  // length 12, permutation of 0..11
  eo: number[];  // length 12, flips in {0, 1}
};

export function identity(): CubieState {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

// ─── Face-turn tables (Kociemba notation) ───────────────────────────────────
// Each table gives the *new* position values for indices 0..n-1 after the move.
// I.e. newCp[i] = oldCp[mvCp[i]]. CO/EO offsets are added (mod 3 / mod 2).

type MoveTable = {
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
};

const U: MoveTable = {
  cp: [3, 0, 1, 2, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const D: MoveTable = {
  cp: [0, 1, 2, 3, 5, 6, 7, 4],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const R: MoveTable = {
  cp: [4, 1, 2, 0, 7, 5, 6, 3],
  co: [2, 0, 0, 1, 1, 0, 0, 2],
  ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const L: MoveTable = {
  cp: [0, 2, 6, 3, 4, 1, 5, 7],
  co: [0, 1, 2, 0, 0, 2, 1, 0],
  ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const F: MoveTable = {
  cp: [1, 5, 2, 3, 0, 4, 6, 7],
  co: [1, 2, 0, 0, 2, 1, 0, 0],
  ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
  eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
};
const B: MoveTable = {
  cp: [0, 1, 3, 7, 4, 5, 2, 6],
  co: [0, 0, 1, 2, 0, 0, 2, 1],
  ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
  eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
};

function compose(state: CubieState, mv: MoveTable): CubieState {
  const ncp = new Array(8);
  const nco = new Array(8);
  for (let i = 0; i < 8; i++) {
    ncp[i] = state.cp[mv.cp[i]];
    nco[i] = (state.co[mv.cp[i]] + mv.co[i]) % 3;
  }
  const nep = new Array(12);
  const neo = new Array(12);
  for (let i = 0; i < 12; i++) {
    nep[i] = state.ep[mv.ep[i]];
    neo[i] = (state.eo[mv.ep[i]] + mv.eo[i]) % 2;
  }
  return { cp: ncp, co: nco, ep: nep, eo: neo };
}

export const BASE_MOVES = { U, D, R, L, F, B } as const;
export type FaceLetter = keyof typeof BASE_MOVES;

function powerOf(mv: MoveTable, n: number): MoveTable {
  let s: CubieState = { ...identity() };
  // apply mv n times
  for (let i = 0; i < n; i++) s = compose(s, mv);
  // convert back to MoveTable form (which is essentially a permutation +
  // orientation delta starting from identity)
  return {
    cp: s.cp,
    co: s.co,
    ep: s.ep,
    eo: s.eo,
  };
}

const MOVE_INDEX: Record<string, MoveTable> = {};
for (const f of ['U', 'D', 'R', 'L', 'F', 'B'] as const) {
  const m1 = BASE_MOVES[f];
  MOVE_INDEX[f] = m1;
  MOVE_INDEX[`${f}2`] = powerOf(m1, 2);
  MOVE_INDEX[`${f}'`] = powerOf(m1, 3);
  MOVE_INDEX[`${f}3`] = powerOf(m1, 3);
}

/** Tokenize WCA move notation. Strips brackets and accepts unknown tokens
 *  (slice moves M/E/S, rotations x/y/z, wide moves r/l/f/b/u/d) — these are
 *  preserved as strings so that invertAlg() and the alg-string round-trip
 *  through to cubing.js's parser, but are NOT applied to the local state. */
export function tokenize(alg: string): string[] {
  const tokens: string[] = [];
  for (const raw of alg.trim().split(/\s+/)) {
    if (!raw) continue;
    const t = raw.replace(/[()[\],/]/g, '').trim();
    if (!t) continue;
    tokens.push(t);
  }
  return tokens;
}

export function applyAlg(state: CubieState, alg: string): CubieState {
  let s = state;
  for (const t of tokenize(alg)) {
    const mv = MOVE_INDEX[t];
    if (mv) s = compose(s, mv);
    // Unknown moves (slices, rotations, wides) are no-ops in this minimal
    // state model. The page still computes invariants/cycle types correctly
    // for the 18 outer-face turns that constitute G's generating set.
  }
  return s;
}

export function isSolved(s: CubieState): boolean {
  for (let i = 0; i < 8; i++) {
    if (s.cp[i] !== i || s.co[i] !== 0) return false;
  }
  for (let i = 0; i < 12; i++) {
    if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  }
  return true;
}

/** Order of an element: smallest n >= 1 s.t. alg^n = identity. Capped at 1260. */
export function orderOf(alg: string, max = 1260): number {
  const move = applyAlg(identity(), alg);
  if (isSolved(move)) return 1;
  let s = move;
  for (let n = 2; n <= max; n++) {
    s = composeStates(s, move);
    if (isSolved(s)) return n;
  }
  return -1;
}

function composeStates(a: CubieState, b: CubieState): CubieState {
  // Apply b after a: new[i] = a[b[i]] for perm, sum orientations.
  const ncp = new Array(8);
  const nco = new Array(8);
  for (let i = 0; i < 8; i++) {
    ncp[i] = a.cp[b.cp[i]];
    nco[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
  }
  const nep = new Array(12);
  const neo = new Array(12);
  for (let i = 0; i < 12; i++) {
    nep[i] = a.ep[b.ep[i]];
    neo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2;
  }
  return { cp: ncp, co: nco, ep: nep, eo: neo };
}

// ─── Parity ─────────────────────────────────────────────────────────────────

export function permSign(perm: number[]): 1 | -1 {
  const n = perm.length;
  const seen = new Array(n).fill(false);
  let cycles = 0;
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    let j = i;
    let len = 0;
    while (!seen[j]) {
      seen[j] = true;
      j = perm[j];
      len++;
    }
    cycles += len - 1;
  }
  return cycles % 2 === 0 ? 1 : -1;
}

export function cycleStructure(perm: number[]): number[] {
  const n = perm.length;
  const seen = new Array(n).fill(false);
  const cycles: number[] = [];
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    let j = i;
    let len = 0;
    while (!seen[j]) {
      seen[j] = true;
      j = perm[j];
      len++;
    }
    if (len > 1) cycles.push(len);
  }
  return cycles.sort((a, b) => b - a);
}

// ─── Invariants ─────────────────────────────────────────────────────────────

export type Invariants = {
  coSum: number;     // mod 3
  eoSum: number;     // mod 2
  cpSign: 1 | -1;
  epSign: 1 | -1;
  reachable: boolean;
};

export function invariants(s: CubieState): Invariants {
  const coSum = s.co.reduce((a, b) => a + b, 0) % 3;
  const eoSum = s.eo.reduce((a, b) => a + b, 0) % 2;
  const cpSign = permSign(s.cp);
  const epSign = permSign(s.ep);
  return {
    coSum,
    eoSum,
    cpSign,
    epSign,
    reachable: coSum === 0 && eoSum === 0 && cpSign === epSign,
  };
}

// ─── Inversion ──────────────────────────────────────────────────────────────

/** Invert a WCA alg string. */
export function invertAlg(alg: string): string {
  const toks = tokenize(alg);
  const out: string[] = [];
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    const f = t[0];
    if (t.endsWith("'")) out.push(f);
    else if (t.endsWith('2')) out.push(t);
    else out.push(`${f}'`);
  }
  return out.join(' ');
}

/** Compose A B A' as a string. */
export function conjugate(a: string, b: string): string {
  const left = a.trim();
  const mid = b.trim();
  const right = invertAlg(a);
  return [left, mid, right].filter(Boolean).join(' ');
}

/** Commutator [A, B] = A B A' B'. */
export function commutator(a: string, b: string): string {
  return [a.trim(), b.trim(), invertAlg(a), invertAlg(b)].filter(Boolean).join(' ');
}

// ─── Thistlethwaite subgroup membership ─────────────────────────────────────
// G0 = ⟨U,D,L,R,F,B⟩ = all
// G1 = ⟨U,D,L,R,F2,B2⟩ — all edges good (EO = 0)
// G2 = ⟨U,D,L2,R2,F2,B2⟩ — EO = 0, CO = 0, and the 4 UD-slice edges are
//      in the UD slice (positions 8..11)
// G3 = ⟨U2,D2,L2,R2,F2,B2⟩ — G2 + corners and edges in their natural orbits
//      with even parity in each. (Domino group ≅ 663552 / 6 = ... has 663552
//      elements actually = 8C4 * 8! / 4 sort of thing — we just test the cube
//      conditions.)

export function inG1(s: CubieState): boolean {
  return s.eo.every(x => x === 0);
}

export function inG2(s: CubieState): boolean {
  if (!inG1(s)) return false;
  if (s.co.some(x => x !== 0)) return false;
  // UD slice edges (positions 8..11 are FR, FL, BL, BR) must be in UD slice.
  for (let pos = 8; pos < 12; pos++) {
    if (s.ep[pos] < 8) return false;
  }
  return true;
}

export function inG3(s: CubieState): boolean {
  if (!inG2(s)) return false;
  // In G3 every quarter-turn from G2 (U, D) doubles up. Equivalent test:
  // - corners are in two 4-orbits {0,2,5,7} and {1,3,4,6}
  // - edges {0,2,4,6} and {1,3,5,7} and {8,9,10,11} are 3 orbits (preserved)
  const cornerOrbitA = new Set([0, 2, 5, 7]);
  for (let i = 0; i < 8; i++) {
    const inA_pos = cornerOrbitA.has(i);
    const inA_pc = cornerOrbitA.has(s.cp[i]);
    if (inA_pos !== inA_pc) return false;
  }
  const edgeOrbitA = new Set([0, 2, 4, 6]);
  const edgeOrbitB = new Set([1, 3, 5, 7]);
  for (let i = 0; i < 8; i++) {
    const inA_pos = edgeOrbitA.has(i);
    const inA_pc = edgeOrbitA.has(s.ep[i]);
    const inB_pos = edgeOrbitB.has(i);
    const inB_pc = edgeOrbitB.has(s.ep[i]);
    if (inA_pos !== inA_pc) return false;
    if (inB_pos !== inB_pc) return false;
  }
  return true;
}

export function thistlethwaiteStage(s: CubieState): 0 | 1 | 2 | 3 | 4 {
  if (isSolved(s)) return 4;
  if (inG3(s)) return 3;
  if (inG2(s)) return 2;
  if (inG1(s)) return 1;
  return 0;
}
