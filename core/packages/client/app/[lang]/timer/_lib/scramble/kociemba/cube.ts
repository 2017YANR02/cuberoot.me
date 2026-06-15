/**
 * Cubie-level model of a 3x3 Rubik's cube and basic moves.
 *
 * This is a from-scratch TypeScript implementation of the data structures
 * used by Herbert Kociemba's two-phase algorithm. The structure (cubie
 * permutations + orientations, URFDLB facelet order, corner / edge naming)
 * is canonical to the algorithm and is not original to this codebase; the
 * code, however, is fresh.
 *
 * Cubie indexing (canonical Kociemba ordering):
 *   Corners: URF=0, UFL=1, ULB=2, UBR=3, DFR=4, DLF=5, DBL=6, DRB=7
 *   Edges:   UR=0, UF=1, UL=2, UB=3, DR=4, DF=5, DL=6, DB=7,
 *            FR=8, FL=9, BL=10, BR=11
 *
 * Corner orientation: 0 = good, 1 = clockwise twist, 2 = counter-clockwise.
 * Edge orientation: 0 = good, 1 = bad (flipped).
 *
 * Facelet array (length 54) follows WCA scramble convention URFDLB:
 *   indices 0..8 = U face, 9..17 = R, 18..26 = F, 27..35 = D, 36..44 = L,
 *   45..53 = B. Inside each face: row-major from the orientation given in the
 *   diagram below (U seen with B behind, F in front; D seen with F behind).
 */

export type Color = 0 | 1 | 2 | 3 | 4 | 5; // U R F D L B

export const N_CORNERS = 8;
export const N_EDGES = 12;

/** Cubie-level cube state. */
export interface CubieCube {
  cp: number[]; // corner permutation, length 8
  co: number[]; // corner orientation, length 8 (mod 3)
  ep: number[]; // edge permutation, length 12
  eo: number[]; // edge orientation, length 12 (mod 2)
}

export function solvedCubie(): CubieCube {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

export function cloneCubie(c: CubieCube): CubieCube {
  return {
    cp: c.cp.slice(),
    co: c.co.slice(),
    ep: c.ep.slice(),
    eo: c.eo.slice(),
  };
}

export function cubieEquals(a: CubieCube, b: CubieCube): boolean {
  for (let i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 0; i < 12; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}

/**
 * Compose cubies: result = a * b (apply b after a, in cubie convention where
 * `cp[i] = j` means "the cubie at position i comes from position j").
 */
export function multiply(a: CubieCube, b: CubieCube): CubieCube {
  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  const ep = new Array<number>(12);
  const eo = new Array<number>(12);
  for (let i = 0; i < 8; i++) {
    cp[i] = a.cp[b.cp[i]];
    co[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
  }
  for (let i = 0; i < 12; i++) {
    ep[i] = a.ep[b.ep[i]];
    eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2;
  }
  return { cp, co, ep, eo };
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Move definitions (cubie level).
 *  Convention follows Kociemba's coords/moves; the URF-corner permutation
 *  cycles below describe what the FACE TURN does to a solved cube.
 * ────────────────────────────────────────────────────────────────────── */

// U turn: corners URF→UFL→ULB→UBR→URF (cycle 0→1→2→3→0)
const MOVE_U: CubieCube = {
  cp: [3, 0, 1, 2, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// R turn: corners UBR→URF→DFR→DRB→UBR (3→0→4→7→3)
//         edges   UR→FR→DR→BR→UR (0→8→4→11→0); FR/BR orientation unchanged
const MOVE_R: CubieCube = {
  cp: [4, 1, 2, 0, 7, 5, 6, 3],
  co: [2, 0, 0, 1, 1, 0, 0, 2],
  ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// F turn: corners URF→UFL→DLF→DFR→URF (0→1→5→4→0)
//         edges   UF→FL→DF→FR→UF (1→9→5→8→1); all 4 flip
const MOVE_F: CubieCube = {
  cp: [1, 5, 2, 3, 0, 4, 6, 7],
  co: [1, 2, 0, 0, 2, 1, 0, 0],
  ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
  eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
};

// D turn: corners DFR→DLF→DBL→DRB→DFR (4→5→6→7→4)
const MOVE_D: CubieCube = {
  cp: [0, 1, 2, 3, 5, 6, 7, 4],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// L turn: corners UFL→ULB→DBL→DLF→UFL (1→2→6→5→1)
//         edges   UL→BL→DL→FL→UL (2→10→6→9→2)
const MOVE_L: CubieCube = {
  cp: [0, 2, 6, 3, 4, 1, 5, 7],
  co: [0, 1, 2, 0, 0, 2, 1, 0],
  ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// B turn: corners UBR→ULB→DBL→DRB→UBR (3→2→6→7→3)
//         edges   UB→BR→DB→BL→UB (3→11→7→10→3); all 4 flip
const MOVE_B: CubieCube = {
  cp: [0, 1, 3, 7, 4, 5, 2, 6],
  co: [0, 0, 1, 2, 0, 0, 2, 1],
  ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
  eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
};

/** Move table indexed by face: 0=U, 1=R, 2=F, 3=D, 4=L, 5=B. */
export const BASIC_MOVES: CubieCube[] = [MOVE_U, MOVE_R, MOVE_F, MOVE_D, MOVE_L, MOVE_B];
export const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/**
 * 18 face moves (face × {1,2,3} where 3 = inverse). Order follows Kociemba's
 * convention which we'll reuse for coord-level move tables:
 *   index = face * 3 + (power - 1)
 *     U=0,U2=1,U'=2, R=3,R2=4,R'=5, F=6,F2=7,F'=8,
 *     D=9,D2=10,D'=11, L=12,L2=13,L'=14, B=15,B2=16,B'=17
 */
export const ALL_MOVES: CubieCube[] = (() => {
  const out: CubieCube[] = [];
  for (let f = 0; f < 6; f++) {
    let cur = solvedCubie();
    for (let p = 0; p < 3; p++) {
      cur = multiply(cur, BASIC_MOVES[f]);
      out.push(cloneCubie(cur));
    }
  }
  return out;
})();

export const MOVE_NAMES: string[] = (() => {
  const suffix = ['', '2', "'"];
  const out: string[] = [];
  for (let f = 0; f < 6; f++) for (let p = 0; p < 3; p++) out.push(FACE_NAMES[f] + suffix[p]);
  return out;
})();

/** Inverse of a move index in ALL_MOVES (X → X', X2 → X2, X' → X). */
export const INV_MOVE: number[] = (() => {
  const out = new Array<number>(18);
  for (let f = 0; f < 6; f++) {
    out[f * 3 + 0] = f * 3 + 2; // X -> X'
    out[f * 3 + 1] = f * 3 + 1; // X2 -> X2
    out[f * 3 + 2] = f * 3 + 0; // X' -> X
  }
  return out;
})();

/** Phase-2 allowed move indices (U, U2, U', D, D2, D', R2, F2, L2, B2). */
export const PHASE2_MOVES: number[] = [0, 1, 2, 9, 10, 11, 4, 7, 13, 16];

/** Apply a move index in ALL_MOVES to a cubie cube and return new state. */
export function applyMove(c: CubieCube, idx: number): CubieCube {
  return multiply(c, ALL_MOVES[idx]);
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Move-string parsing / formatting
 * ────────────────────────────────────────────────────────────────────── */

export function parseMoves(scramble: string): number[] {
  const parts = scramble.trim().split(/\s+/).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const m = p.match(/^([URFDLB])(['2]?)$/);
    if (!m) throw new Error(`Bad move token: ${p}`);
    const face = FACE_NAMES.indexOf(m[1] as typeof FACE_NAMES[number]);
    let power = 0;
    if (m[2] === '') power = 0;
    else if (m[2] === '2') power = 1;
    else if (m[2] === "'") power = 2;
    out.push(face * 3 + power);
  }
  return out;
}

export function formatMoves(idxs: number[]): string {
  return idxs.map(i => MOVE_NAMES[i]).join(' ');
}

/** Inverse of a sequence (so the scramble = inverse of the solution). */
export function invertSequence(idxs: number[]): number[] {
  const out: number[] = [];
  for (let i = idxs.length - 1; i >= 0; i--) out.push(INV_MOVE[idxs[i]]);
  return out;
}

/** Apply a sequence of move indices to a state. */
export function applySequence(c: CubieCube, idxs: number[]): CubieCube {
  let cur = c;
  for (const i of idxs) cur = applyMove(cur, i);
  return cur;
}

export function isSolvedCubie(c: CubieCube): boolean {
  for (let i = 0; i < 8; i++) if (c.cp[i] !== i || c.co[i] !== 0) return false;
  for (let i = 0; i < 12; i++) if (c.ep[i] !== i || c.eo[i] !== 0) return false;
  return true;
}
