/*
 * Dino Cube (恐龙魔方 / dinoso) NEAR-OPTIMAL solver — TIER D.
 *
 * The Dino Cube is a random-STATE puzzle: cstimer ships its own dino solver
 * (tools/cstimer-scramble/scramble/redi.js → `redi.solveScramble`, an IDA* over
 * 3 edge-comb prune tables). Its reachable state space is A12 = 12!/2 =
 * 239,500,800 (cstimer treats all 12 edges as distinct; the 8 corner moves are
 * even 3-cycles generating the alternating group A12) — beyond TIER A (~2×10⁶
 * full BFS) and TIER B (~5×10⁷ packed table). So — unlike the TIER A/B puzzles
 * in this loop — we DO NOT build a distance table; we WRAP cstimer's own dino
 * solver as a near-optimal engine: `solveDino(scramble)` drives the worker
 * (lib/cstimer-scramble → cstimerSolve('dino', scramble)), which loads the
 * cstimer engine once and runs `redi.solveScramble`. Validity
 * (scramble∘solution = solved) is the contract, cross-checked against the real
 * cstimer engine in tests/dino_solver.test.ts.
 *
 * METRIC: each token = 1 move (cstimer face-turn count). The Dino Cube is
 * edge-only — its state is the 12-edge permutation (no orientation). Moves are
 * F L B R f l b r (the 8 corners), each an order-3 3-cycle, with an optional
 * prime ("'" = the inverse = its square). NOT provably optimal — the recorded
 * "length" is cstimer's near-optimal solution length (typically ~7–11; the dino
 * God's number is 10 in the face-turn metric).
 *
 * The cube-net preview (dino_svg) reuses the 24-sticker model ported faithfully
 * below from cstimer's edge model (cross-checked move-for-move against cstimer's
 * own `acycle` on the 12-edge permutation), so the preview is derived from the
 * true state (solved = each face a single color, self-certifying). The SOLVE
 * itself stays in the worker (cstimer's prune tables).
 */

import { cstimerSolve } from './cstimer-scramble';

/**
 * The Dino Cube's God's number is 10 (face-turn metric); cstimer's IDA* searcher
 * caps depth at 15. We assert solution length ≤ this loose bound in tests (a
 * sanity ceiling on the near-optimal length, NOT an optimality claim).
 */
export const DINO_SOLUTION_LENGTH_BOUND = 15;

/** The 8 corner move axes — the exact cstimer dinoso token alphabet (+ optional prime). */
export const DINO_MOVE_NAMES: ReadonlyArray<string> = [
  'F', "F'", 'L', "L'", 'B', "B'", 'R', "R'",
  'f', "f'", 'l', "l'", 'b', "b'", 'r', "r'",
];

/** Single move token: a corner letter F L B R f l b r + an optional prime. */
export const DINO_TOKEN_RE = /^[FLBRflbr]'?$/;

export interface DinoSolution {
  /** Near-optimal solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count (cstimer near-optimal length, face-turn metric). */
  length: number;
}

const MOVE_COUNT_RE = /\S+/g;

/**
 * Near-optimally solve a Dino Cube scramble by driving cstimer's own solver in
 * the worker. Async (worker round-trip + lazy prune-table build on first call).
 * Throws on an unknown token / worker error.
 */
export async function solveDino(scramble: string): Promise<DinoSolution> {
  const trimmed = scramble.trim();
  const solution = (await cstimerSolve('dino', trimmed)).trim();
  const length = solution ? (solution.match(MOVE_COUNT_RE)?.length ?? 0) : 0;
  return { solution, length };
}

// ──────────────────────────────────────────────────────────────────────────────
// Edge model ported faithfully from cstimer redi.js (the dino IIFE). The dino
// state is the 12-edge permutation; the 8 moves are 3-cycles via mathlib.acycle.
// Used ONLY to compute the 24-facelet cube net for the preview SVG — NOT for
// solving (the solve stays in the worker via the real cstimer engine).
//
// Move order = AXIS_LETTERS 'FLBRflbr'. edgeMoveSwaps[axis] is cstimer's 3-cycle.
// A move's prime is its square (these moves have order 3): pow 1 = "", pow 2 = "'".
// ──────────────────────────────────────────────────────────────────────────────

const AXIS_LETTERS = 'FLBRflbr';

// cstimer redi.js edgeMoveSwaps — the 3-cycle of edges around each corner.
const EDGE_MOVE_SWAPS: ReadonlyArray<ReadonlyArray<number>> = [
  [1, 0, 8], // F
  [2, 1, 9], // L
  [3, 2, 10], // B
  [0, 3, 11], // R
  [4, 5, 8], // f
  [5, 6, 9], // l
  [6, 7, 10], // b
  [7, 4, 11], // r
];

// cstimer mathlib.acycle(arr, perm, pow): arr[perm[(i+pow)%n]] = old arr[perm[i]].
function acycle(arr: number[], perm: ReadonlyArray<number>, pow: number) {
  const n = perm.length;
  const tmp: number[] = [];
  for (let i = 0; i < n; i++) tmp[i] = arr[perm[i]];
  for (let i = 0; i < n; i++) arr[perm[(i + pow) % n]] = tmp[i];
}

/**
 * Apply a dino scramble string to the solved edge perm and return the 12-entry
 * permutation `ep` (ep[slot] = which edge piece sits at slot). Faithful to
 * cstimer's own model. Unknown tokens throw; callers that need render robustness
 * can pass '' to get the solved perm. Solved → identity [0..11].
 */
export function dinoEpFromScramble(scramble: string): number[] {
  const ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const ax = AXIS_LETTERS.indexOf(tok[0]);
    const rest = tok.slice(1);
    if (ax < 0 || (rest !== '' && rest !== "'")) {
      throw new Error('unknown dino token: ' + tok);
    }
    acycle(ep, EDGE_MOVE_SWAPS[ax], rest === "'" ? 2 : 1);
  }
  return ep;
}

// ── 24-sticker cube-net model (12 edges × 2 stickers). ──
//
// Each edge has 2 stickers on 2 faces; sticker id = edge*2 + slotIdx where
// slotIdx indexes DINO_EDGE_FACES[edge]. The solved color of a sticker = the
// face index it sits on. Edge slot → faces (derived from the corner-move cycles,
// cross-checked move-for-move against cstimer's acycle on ep):
//   face order = U D F R B L; each face touches exactly 4 edges.
export const DINO_FACES: ReadonlyArray<string> = ['U', 'D', 'F', 'R', 'B', 'L'];
const DINO_EDGE_FACES: ReadonlyArray<[number, number]> = [
  [0, 3], [0, 2], [0, 5], [0, 4], // 0 UR, 1 UF, 2 UL, 3 UB
  [1, 3], [1, 2], [1, 5], [1, 4], // 4 DR, 5 DF, 6 DL, 7 DB
  [2, 3], [5, 2], [4, 5], [3, 4], // 8 FR, 9 LF, 10 BL, 11 RB
];

/** Solved 24-sticker color array: color of sticker i = its face index. */
const DINO_SOLVED_STICKERS: number[] = (() => {
  const s: number[] = [];
  for (let e = 0; e < 12; e++) { s.push(DINO_EDGE_FACES[e][0]); s.push(DINO_EDGE_FACES[e][1]); }
  return s;
})();

// 24-sticker move permutations (newState[dest] = oldState[perm[dest]]), one per
// corner move axis (F L B R f l b r, applied once = "" turn, twice = "'" turn).
// Derived geometrically (120° corner rotation: cycle the 3 adjacent edges AND
// rotate their stickers among the corner's 3 faces) and cross-checked move-for-
// move against cstimer's own `acycle` on the 12-edge permutation — so the net is
// a faithful sticker model of cstimer's dino, including edge ORIENTATION (a dino
// edge's two stickers swap which face they show as it cycles around a corner; a
// naive face1↔face1 mapping is WRONG, hence the explicit perms below).
const DINO_STICKER_PERMS: ReadonlyArray<ReadonlyArray<number>> = [
  /* F */ [3, 2, 16, 17, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 1, 0, 18, 19, 20, 21, 22, 23],
  /* L */ [0, 1, 5, 4, 18, 19, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 3, 2, 20, 21, 22, 23],
  /* B */ [0, 1, 2, 3, 7, 6, 20, 21, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 5, 4, 22, 23],
  /* R */ [22, 23, 2, 3, 4, 5, 1, 0, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 7, 6],
  /* f */ [0, 1, 2, 3, 4, 5, 6, 7, 17, 16, 9, 8, 12, 13, 14, 15, 10, 11, 18, 19, 20, 21, 22, 23],
  /* l */ [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 19, 18, 11, 10, 14, 15, 16, 17, 12, 13, 20, 21, 22, 23],
  /* b */ [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 21, 20, 13, 12, 16, 17, 18, 19, 14, 15, 22, 23],
  /* r */ [0, 1, 2, 3, 4, 5, 6, 7, 15, 14, 10, 11, 12, 13, 23, 22, 16, 17, 18, 19, 20, 21, 8, 9],
];

function applyStickerPerm(state: number[], perm: ReadonlyArray<number>): number[] {
  const out: number[] = new Array(24);
  for (let d = 0; d < 24; d++) out[d] = state[perm[d]];
  return out;
}

/**
 * 24-sticker colors (0..5 = face index U D F R B L) for a scramble, by applying
 * the verified 24-sticker move permutations from the solved state. Unknown tokens
 * are ignored for render robustness (the solver path validates strictly).
 *
 * Solved → each of the 6 faces is a single color (self-certifying).
 */
export function dinoStickers(scramble: string): number[] {
  let state = DINO_SOLVED_STICKERS.slice();
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const ax = AXIS_LETTERS.indexOf(tok[0]);
    const rest = tok.slice(1);
    if (ax < 0 || (rest !== '' && rest !== "'")) continue; // ignore unknown for rendering
    const pow = rest === "'" ? 2 : 1;
    for (let k = 0; k < pow; k++) state = applyStickerPerm(state, DINO_STICKER_PERMS[ax]);
  }
  return state;
}

/** Solved 24-sticker array (for tests / rendering the solved net). */
export function dinoSolvedStickers(): number[] {
  return DINO_SOLVED_STICKERS.slice();
}

export { DINO_EDGE_FACES };
