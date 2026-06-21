/*
 * Master Pyraminx (大金字塔 / mpyrso) NEAR-OPTIMAL solver — TIER D.
 *
 * The Master Pyraminx is a random-STATE puzzle: cstimer ships its own two-phase
 * solver (tools/cstimer-scramble/scramble/pyraminx.js → `mpyr.solveScramble`).
 * Its reachable state space (~4.6×10¹¹: 6 edges × 12 wings × 4 corners × oris)
 * is far too large for full BFS / a distance table, so — unlike the TIER A/B
 * puzzles in this loop — we DO NOT solve optimally. Instead we WRAP cstimer's
 * own two-phase solver as a near-optimal engine: `solveMpyr(scramble)` drives the
 * worker (lib/cstimer-scramble → cstimerSolve('mpyrso', scramble)), which loads
 * the cstimer engine once and runs `mpyr.solveScramble`. The solution is the
 * cstimer near-optimal two-phase output (phase-1 to a coset, phase-2 to solved),
 * plus trivial tip fixes. Validity (scramble∘solution = solved) is the contract,
 * and is cross-checked against the real cstimer engine in tests/mpyr_solver.test.ts.
 *
 * METRIC: each token = 1 move (cstimer face-turn count for the body moves
 * U/Uw/B/Bw/R/Rw/L/Lw plus the 4 trivial corner tips u/r/l/b). NOT provably
 * optimal — the recorded "length" is cstimer's near-optimal solution length.
 *
 * The 52-facelet net rendering (mpyr_svg) reuses the cubie model ported faithfully
 * below from cstimer's MpyrCubie, so the preview is derived from the true state
 * (solved = each face a single color, self-certifying). The SOLVE itself stays in
 * the worker (cstimer's prune tables) — we don't re-implement the search in TS.
 */

import { cstimerSolve } from './cstimer-scramble';

/**
 * cstimer's near-optimal two-phase solver caps phase-1 at depth 14 and phase-2 at
 * depth 20; with the 4 tips, a near-optimal solution is comfortably under ~25
 * face-turns in practice (typical ~12–17). We assert ≤ this loose bound in tests
 * (a sanity ceiling on the near-optimal length, NOT an optimality claim).
 */
export const MPYR_SOLUTION_LENGTH_BOUND = 38; // 14 (p1) + 20 (p2) + 4 tips, loose

/** The 8 body move axes + 4 tips — the exact cstimer mpyrso token alphabet. */
export const MPYR_MOVE_NAMES: ReadonlyArray<string> = [
  'U', "U'", 'Uw', "Uw'", 'B', "B'", 'Bw', "Bw'",
  'R', "R'", 'Rw', "Rw'", 'L', "L'", 'Lw', "Lw'",
  'u', "u'", 'r', "r'", 'l', "l'", 'b', "b'",
];

export interface MpyrSolution {
  /** Near-optimal solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count (cstimer near-optimal length, face-turn metric incl. tips). */
  length: number;
}

const MOVE_COUNT_RE = /\S+/g;

/**
 * Near-optimally solve a Master Pyraminx scramble by driving cstimer's own
 * two-phase solver in the worker. Async (worker round-trip + lazy prune-table
 * build on first call). Throws on an unknown token / worker error.
 */
export async function solveMpyr(scramble: string): Promise<MpyrSolution> {
  const trimmed = scramble.trim();
  const solution = (await cstimerSolve('mpyrso', trimmed)).trim();
  const length = solution ? (solution.match(MOVE_COUNT_RE)?.length ?? 0) : 0;
  return { solution, length };
}

// ──────────────────────────────────────────────────────────────────────────────
// Cubie model ported faithfully from cstimer pyraminx.js `MpyrCubie` (the mpyr
// IIFE). Used ONLY to compute the 52-facelet net for the preview SVG — NOT for
// solving (the solve stays in the worker via the real cstimer engine).
// ──────────────────────────────────────────────────────────────────────────────

interface Cubie {
  ep: number[]; // edge perm (6)
  eo: number[]; // edge ori (6)
  wp: number[]; // wing perm (12)
  ct: number[]; // center perm (4)
  co: number[]; // corner ori (4)
  cp: number[]; // corner perm (4)
}

function solvedCubie(): Cubie {
  return {
    ep: [0, 1, 2, 3, 4, 5],
    eo: [0, 0, 0, 0, 0, 0],
    wp: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    ct: [0, 1, 2, 3],
    co: [0, 0, 0, 0],
    cp: [0, 1, 2, 3],
  };
}

// MpyrMult(a, b): apply b then a, exactly as cstimer's MpyrCubie.MpyrMult.
function mult(a: Cubie, b: Cubie): Cubie {
  const prod: Cubie = solvedCubie();
  for (let i = 0; i < 4; i++) {
    prod.ct[i] = a.ct[b.ct[i]];
    prod.co[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
    prod.cp[i] = a.cp[b.cp[i]];
  }
  for (let i = 0; i < 6; i++) {
    prod.eo[i] = a.eo[b.ep[i]] ^ b.eo[i];
    prod.ep[i] = a.ep[b.ep[i]];
  }
  for (let i = 0; i < 12; i++) {
    prod.wp[i] = a.wp[b.wp[i]];
  }
  return prod;
}

// The 8 base move cubies (U Uw B Bw R Rw L Lw), verbatim from cstimer initMoveCube.
// Constructor order is MpyrCubie(ep, eo, wp, ct, co, cp); cstimer passes cp=null for
// EVERY move → cp defaults to [0,1,2,3] (corner perm is identity for all moves; the
// 4 corners only ORIENT (co), they never swap; ct is the CENTER permutation). Index =
// move2str position / 2; the prime of each = its square (these moves have order 3).
const IDC: number[] = [0, 1, 2, 3]; // cp identity for all moves
const BASE_MOVES: Cubie[] = [
  { ep: [0, 1, 2, 3, 4, 5], eo: [0, 0, 0, 0, 0, 0], wp: [0, 4, 2, 3, 10, 5, 6, 7, 8, 9, 1, 11], ct: [0, 1, 2, 3], co: [0, 0, 1, 0], cp: [...IDC] }, // U
  { ep: [2, 1, 5, 3, 4, 0], eo: [1, 0, 0, 0, 0, 1], wp: [5, 4, 2, 3, 10, 11, 6, 7, 8, 9, 1, 0], ct: [2, 1, 3, 0], co: [0, 0, 1, 0], cp: [...IDC] }, // Uw
  { ep: [0, 1, 2, 3, 4, 5], eo: [0, 0, 0, 0, 0, 0], wp: [0, 1, 2, 6, 4, 5, 11, 7, 8, 9, 10, 3], ct: [0, 1, 2, 3], co: [0, 0, 0, 1], cp: [...IDC] }, // B
  { ep: [0, 3, 2, 5, 4, 1], eo: [0, 1, 0, 1, 0, 0], wp: [0, 1, 7, 6, 4, 5, 11, 10, 8, 9, 2, 3], ct: [0, 3, 1, 2], co: [0, 0, 0, 1], cp: [...IDC] }, // Bw
  { ep: [0, 1, 2, 3, 4, 5], eo: [0, 0, 0, 0, 0, 0], wp: [0, 1, 5, 3, 4, 8, 6, 7, 2, 9, 10, 11], ct: [0, 1, 2, 3], co: [1, 0, 0, 0], cp: [...IDC] }, // R
  { ep: [0, 2, 4, 3, 1, 5], eo: [0, 1, 1, 0, 0, 0], wp: [0, 1, 5, 4, 9, 8, 6, 7, 2, 3, 10, 11], ct: [1, 2, 0, 3], co: [1, 0, 0, 0], cp: [...IDC] }, // Rw
  { ep: [0, 1, 2, 3, 4, 5], eo: [0, 0, 0, 0, 0, 0], wp: [7, 1, 2, 3, 4, 5, 6, 9, 8, 0, 10, 11], ct: [0, 1, 2, 3], co: [0, 1, 0, 0], cp: [...IDC] }, // L
  { ep: [3, 1, 2, 4, 0, 5], eo: [1, 0, 0, 0, 1, 0], wp: [7, 6, 2, 3, 4, 5, 8, 9, 1, 0, 10, 11], ct: [3, 0, 2, 1], co: [0, 1, 0, 0], cp: [...IDC] }, // Lw
];

// move2str index → cubie (16 entries: each axis base + its square for the prime).
let MOVE_CUBES: Cubie[] | null = null;
function moveCubes(): Cubie[] {
  if (MOVE_CUBES) return MOVE_CUBES;
  const m: Cubie[] = [];
  for (let i = 0; i < 8; i++) {
    m[i * 2] = BASE_MOVES[i];
    m[i * 2 + 1] = mult(BASE_MOVES[i], BASE_MOVES[i]); // X' = X²
  }
  MOVE_CUBES = m;
  return m;
}

const MOVE2STR = ['U', "U'", 'Uw', "Uw'", 'B', "B'", 'Bw', "Bw'", 'R', "R'", 'Rw', "Rw'", 'L', "L'", 'Lw', "Lw'"];
const MOVE_IDX = new Map(MOVE2STR.map((s, i) => [s, i] as const));
const TIP_RE = /^[urlb](2?'?)$/;

/** Facelet layout (== cstimer MpyrCubie facelet tables, toFaceCube(13)). */
const F = 0, R = 13, D = 26, L = 39, a = 10, b = 11, c = 12;
const EDGE_FACELETS = [
  [F + 8, L + 8], [D + 8, R + 8], [F + 6, R + 6], [D + 6, L + 6], [F + 2, D + 2], [R + 2, L + 2],
];
const WING_FACELETS = [
  [F + 9, L + c], [L + 9, F + c], [D + 9, R + c], [R + 9, D + c],
  [F + a, R + 5], [R + a, F + 5], [D + a, L + 5], [L + a, D + 5],
  [F + 1, D + 3], [D + 1, F + 3], [R + 1, L + 3], [L + 1, R + 3],
];
const CORN_FACELETS = [
  [F + 0, R + b, D + 4], [D + 0, L + b, F + 4], [R + 0, F + b, L + 4], [L + 0, D + b, R + 4],
];
const CENT_FACELETS = [F + 7, D + 7, R + 7, L + 7];

// Multi-facelet fill (edges/wings/corners) — == mathlib.fillFacelet for array pieces.
function fillFacelet(facelets: number[][], f: number[], perm: number[], ori: number[] | null, div: number) {
  for (let i = 0; i < facelets.length; i++) {
    const o = ori ? (ori[i] || 0) : 0;
    const p = perm[i] === undefined ? i : perm[i];
    for (let j = 0; j < facelets[i].length; j++) {
      f[facelets[i][(j + o) % facelets[i].length]] = ~~(facelets[p][j] / div);
    }
  }
}

/** Compute the 52-facelet array (values 0..3 = face color) for a cubie. */
function toFaceCube(mc: Cubie): number[] {
  const f: number[] = new Array(52).fill(0);
  fillFacelet(EDGE_FACELETS, f, mc.ep, mc.eo, 13);
  fillFacelet(WING_FACELETS, f, mc.wp, null, 13);
  fillFacelet(CORN_FACELETS, f, mc.cp, mc.co, 13);
  // centers (single facelet, no ori) — == mathlib.fillFacelet(centFacelets, f, ct, null, 13):
  // f[cent[i]] = floor(cent[ct[i]] / 13) = face index of the center piece sitting at slot i.
  for (let i = 0; i < 4; i++) f[CENT_FACELETS[i]] = ~~(CENT_FACELETS[mc.ct[i]] / 13);
  return f;
}

/**
 * Apply a scramble (body moves only; tips are trivial and don't affect the net's
 * 52 facelets) to the solved cubie and return its 52-facelet color array. Tips
 * and unknown tokens are tolerated/ignored for rendering robustness. Solved → each
 * of the 4 faces is a single color (self-certifying).
 */
export function mpyrFacelets(scramble: string): number[] {
  const cubes = moveCubes();
  let mc = solvedCubie();
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const idx = MOVE_IDX.get(tok);
    if (idx !== undefined) { mc = mult(mc, cubes[idx]); continue; }
    if (TIP_RE.test(tok)) continue; // tips don't touch the 52 body facelets
    // unknown token: ignore for rendering (solver path validates strictly)
  }
  return toFaceCube(mc);
}

/** Solved 52-facelet array (for tests / rendering the solved net). */
export function mpyrSolvedFacelets(): number[] {
  return toFaceCube(solvedCubie());
}
