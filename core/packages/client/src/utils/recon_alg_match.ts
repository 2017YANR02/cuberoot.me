/**
 * Alg matching — given a 3x3 cube state, suggest algs from the algdb library
 * that "make progress" on the next CFOP stage.
 *
 * State + setup-scramble assumption: the user typed `// 1st pair` (or similar)
 * on a line, and is about to type the alg. The pre-state is `applyAlg(scramble + prefixMoves)`
 * to a solved cube. We rank candidate algs by how the post-state compares to a
 * "goal" specific to the stage:
 *
 *   - cross / xcross: D-cross is fully solved, plus N F2L pairs solved.
 *   - 1st/2nd/3rd/4th pair: cross + N pairs solved, where N is the pair index.
 *   - OLL: cross + 4 pairs solved (= F2L done) AND U face is one colour.
 *   - PLL: cube fully solved (modulo a final AUF).
 *
 * "Progress" score = number of newly-solved relevant stickers between pre and post.
 * Higher = better. We return the top-N candidates.
 */

import type { CubeState, Face } from './cube3_sim';
import { cloneCube, applyAlg, FACES } from './cube3_sim';
import type { AlgdbCase, AlgdbCategory } from '@cuberoot/shared';

export type Stage =
  | { kind: 'cross' }
  | { kind: 'pair'; index: number /* 1..4 — how many pairs (incl this one) should be solved after */ }
  | { kind: 'oll' }
  | { kind: 'pll' };

/**
 * Sticker positions relevant to "cross solved on D + N F2L pairs solved".
 *
 * D cross = D[1,3,5,7] (4 edge stickers) plus the matching F[7], R[7], B[7], L[7] edge centers.
 * F2L pairs (4 of them, in slot order: FR / FL / BL / BR):
 *   FR slot — corner: D[2], F[8], R[6]; edge: F[5], R[3]
 *   FL slot — corner: D[0], F[6], L[8]; edge: F[3], L[5]
 *   BL slot — corner: D[6], L[6], B[8]; edge: L[3], B[5]
 *   BR slot — corner: D[8], R[8], B[6]; edge: R[5], B[3]
 *
 * (This is the mapping when standard scheme has white on D, green on F, red on R, etc.
 * Sticker indices follow our cube3_sim row-major-from-each-face's-natural-orientation.)
 */
const CROSS_STICKERS: ReadonlyArray<[Face, number]> = [
  ['D', 1], ['D', 3], ['D', 5], ['D', 7],
  ['F', 7], ['R', 7], ['B', 7], ['L', 7],
];

const F2L_SLOTS: ReadonlyArray<ReadonlyArray<[Face, number]>> = [
  // Each slot's 5 stickers (corner 3 + edge 2)
  [['D', 2], ['F', 8], ['R', 6], ['F', 5], ['R', 3]], // FR
  [['D', 0], ['F', 6], ['L', 8], ['F', 3], ['L', 5]], // FL
  [['D', 6], ['L', 6], ['B', 8], ['L', 3], ['B', 5]], // BL
  [['D', 8], ['R', 8], ['B', 6], ['R', 5], ['B', 3]], // BR
];

/** Count "solved" stickers — sticker color matches its face center. */
function countSolved(c: CubeState, list: ReadonlyArray<[Face, number]>): number {
  let n = 0;
  for (const [f, i] of list) {
    if (c[f][i] === f) n++;
  }
  return n;
}

/** Whether all stickers in list match their face center. */
function allSolved(c: CubeState, list: ReadonlyArray<[Face, number]>): boolean {
  for (const [f, i] of list) {
    if (c[f][i] !== f) return false;
  }
  return true;
}

/** Whether U face is one color (any color, not necessarily yellow). */
function uFaceOneColor(c: CubeState): boolean {
  const first = c.U[0];
  for (let i = 1; i < 9; i++) if (c.U[i] !== first) return false;
  return true;
}

/** Whether the cube is solved up to a final AUF (U / U' / U2 from solved). */
function solvedModuloAuf(c: CubeState): boolean {
  for (let trial = 0; trial < 4; trial++) {
    let ok = true;
    for (const f of FACES) {
      for (let i = 0; i < 9; i++) {
        if (c[f][i] !== f) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (ok) return true;
    // Apply U to test next
    const tmp = cloneCube(c);
    applyAlg(tmp, 'U');
    c = tmp;
  }
  return false;
}

/** A single candidate suggestion. */
export interface AlgSuggestion {
  /** The case it came from. */
  caseName: string;
  /** The alg to apply. */
  alg: string;
  /** Score — higher = better. */
  score: number;
  /** Sticker state of the cube AFTER preMoves but BEFORE alg (for thumbnail). */
  preState: CubeState;
  /** Source category. */
  category: AlgdbCategory;
}

interface ScoreContext {
  preState: CubeState;
  /** Number of F2L pairs that should be solved after the alg (for pair stages). */
  pairsAfter: number;
  stage: Stage;
}

/** Rough move count (linear, ignores parens expansion). */
function moveCount(alg: string): number {
  return (alg.match(/[RLUDFBMESxyzrludfb][w]?[2]?'?/g) ?? []).length;
}

function scoreCandidate(alg: string, ctx: ScoreContext): number {
  const post = cloneCube(ctx.preState);
  applyAlg(post, alg);
  const lenPenalty = moveCount(alg) * 0.1; // Tiebreaker: shorter algs rank higher.

  if (ctx.stage.kind === 'cross' || ctx.stage.kind === 'pair') {
    let s = 0;
    const crossPre = countSolved(ctx.preState, CROSS_STICKERS);
    const crossPost = countSolved(post, CROSS_STICKERS);
    if (crossPost < crossPre) s -= 100;
    s += (crossPost - crossPre) * 0.5;
    let pairsPre = 0, pairsPost = 0;
    for (const slot of F2L_SLOTS) {
      if (allSolved(ctx.preState, slot)) pairsPre++;
      if (allSolved(post, slot)) pairsPost++;
    }
    // Massive reward for solving exactly one more pair, smaller for keeping count.
    s += (pairsPost - pairsPre) * 100;
    // Reward not breaking existing pairs.
    if (pairsPost < pairsPre) s -= 50;
    return s - lenPenalty;
  }
  if (ctx.stage.kind === 'oll') {
    let s = 0;
    let pairsPre = 0, pairsPost = 0;
    for (const slot of F2L_SLOTS) {
      if (allSolved(ctx.preState, slot)) pairsPre++;
      if (allSolved(post, slot)) pairsPost++;
    }
    if (pairsPost < pairsPre) s -= 100;
    if (uFaceOneColor(post)) s += 100;
    return s - lenPenalty;
  }
  if (ctx.stage.kind === 'pll') {
    return (solvedModuloAuf(post) ? 100 : -50) - lenPenalty;
  }
  return -lenPenalty;
}

/** Extract all algs from one algdb file. */
function flatAlgs(cases: AlgdbCase[]): Array<{ caseName: string; alg: string; setup: string }> {
  const out: Array<{ caseName: string; alg: string; setup: string }> = [];
  for (const c of cases) {
    if (c.standard) out.push({ caseName: c.name, alg: c.standard, setup: c.setup });
    for (const oriAlgs of c.algs) {
      for (const e of oriAlgs) out.push({ caseName: c.name, alg: e.alg, setup: c.setup });
    }
  }
  // De-dup by alg string within same case
  const seen = new Set<string>();
  return out.filter(x => {
    const key = `${x.caseName}|${x.alg}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Rank algs in `db` against the current cube state for the given stage.
 * Returns top N (default 12) by descending score.
 */
export function rankAlgs(
  preState: CubeState,
  db: AlgdbCase[],
  category: AlgdbCategory,
  stage: Stage,
  topN = 12,
): AlgSuggestion[] {
  const candidates = flatAlgs(db);
  const ctx: ScoreContext = {
    preState,
    pairsAfter: stage.kind === 'pair' ? stage.index : 0,
    stage,
  };
  const scored = candidates.map(c => ({
    caseName: c.caseName,
    alg: c.alg,
    score: scoreCandidate(c.alg, ctx),
    preState,
    category,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
