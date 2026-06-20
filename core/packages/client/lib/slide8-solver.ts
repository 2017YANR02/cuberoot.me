/*
 * 8-Puzzle (八数码) optimal solver — pure TS, no worker, no tables to download.
 *
 * The 8-puzzle is a 3×3 sliding puzzle: 8 numbered tiles + 1 blank. The blank slides to an
 * orthogonal neighbor (Up/Down/Left/Right); one slide = one move. Exactly half of all 9! cell
 * permutations are reachable from solved → 9!/2 = 181,440 states (verified by the BFS below and
 * by an independent reference BFS in the tests; do NOT assume all 9! are reachable). God's number
 * is 31, mean optimal length ≈ 21.97.
 *
 * Because the whole graph fits in memory, we BFS from solved once (memoized) and store, for every
 * reachable state, the slide that steps it toward solved — so every solve is a true optimal
 * shortest path, computed instantly (Ivy / Floppy / 2×2×3 pattern).
 *
 * Geometry + cstimer notation (U D L R, optional compressed power like `D2`) live in the reusable
 * lib/slider-puzzle core (verified field-for-field against vendored cstimer scramble/slide.js, key
 * `8prp`). The future 15-puzzle (lib/slide15-solver, IDA*) shares that same core, so the move rule
 * has a single source of truth.
 *
 * State encoding: a permutation of {0..8} (g[pos] = tile, 8 = blank) ranked into [0, 9!) via the
 * Lehmer code. We index the dist/toSolved arrays by that rank (size 9! = 362,880; the unreachable
 * odd-parity half stays dist = −1, harmless).
 */

import {
  type SliderDims, type SlideDir, SLIDE_DIRS, SLIDE_DELTA, SLIDE_INVERSE,
  solvedSlider, blankValue, parseSliderScramble,
} from './slider-puzzle';

const DIMS: SliderDims = { width: 3, height: 3 };
const N_CELL = 9;          // 3×3
const N_RANK = 362880;     // 9!
const BLANK = blankValue(DIMS); // 8
const SOLVED_RANK = 0;     // rank of [0,1,2,3,4,5,6,7,8]

/** God's number for the 8-puzzle, proven by the full BFS below. */
export const SLIDE8_GODS_NUMBER = 31;

/** Reachable-state count = 9!/2 (verified by the BFS + an independent reference BFS in tests). */
export const SLIDE8_STATE_COUNT = 181440;

/**
 * Optimal-solution-length distribution over all 181,440 reachable states (index = optimal move
 * count). Locked by tests; also surfaced in the UI.
 */
export const SLIDE8_LENGTH_DISTRIBUTION: ReadonlyArray<number> = [
  1, 2, 4, 8, 16, 20, 39, 62, 116, 152, 286, 396, 748, 1024, 1893, 2512, 4485, 5638, 9529, 10878,
  16993, 17110, 23952, 20224, 24047, 15578, 14560, 6274, 3910, 760, 221, 2,
];

// ── permutation rank / unrank (Lehmer code over {0..8}) ───────────────────────
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];

/** Lehmer rank of a permutation of {0..8}. */
function permRank(p: number[]): number {
  let r = 0;
  for (let i = 0; i < N_CELL; i++) {
    let cnt = 0;
    for (let j = i + 1; j < N_CELL; j++) if (p[j] < p[i]) cnt++;
    r = r * (N_CELL - i) + cnt;
  }
  return r;
}

function permUnrank(rank: number): number[] {
  const elems: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const p: number[] = [];
  let r = rank;
  for (let i = 0; i < N_CELL; i++) {
    const fac = FACT[N_CELL - 1 - i];
    const d = Math.floor(r / fac);
    r %= fac;
    p.push(elems[d]);
    elems.splice(d, 1);
  }
  return p;
}

/** Position of the blank (value 8) in a permutation. */
function blankPosOf(p: number[]): number {
  for (let i = 0; i < N_CELL; i++) if (p[i] === BLANK) return i;
  return -1;
}

// ── precomputed graph (built once, memoized) ──────────────────────────────────
interface Slide8Graph {
  /** mv[rank][dirIdx] = rank after sliding the blank `dir`, or −1 if off-grid. */
  mv: Int32Array;
  /** toSolved[rank] = dir index (0..3) stepping toward solved, −1 if solved/unreached. */
  toSolved: Int8Array;
  /** dist[rank] = optimal distance to solved, −1 if unreached. */
  dist: Int16Array;
}
let GRAPH: Slide8Graph | null = null;

function buildGraph(): Slide8Graph {
  const mv = new Int32Array(N_RANK * 4).fill(-1);
  // Build the move table for every permutation rank.
  for (let rank = 0; rank < N_RANK; rank++) {
    const p = permUnrank(rank);
    const blank = blankPosOf(p);
    const r = Math.floor(blank / 3);
    const c = blank % 3;
    for (let di = 0; di < 4; di++) {
      const dir = SLIDE_DIRS[di];
      const [dr, dc] = SLIDE_DELTA[dir];
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
      const nb = nr * 3 + nc;
      // swap blank with neighbor
      const q = p.slice();
      q[blank] = q[nb];
      q[nb] = BLANK;
      mv[rank * 4 + di] = permRank(q);
    }
  }

  const toSolved = new Int8Array(N_RANK).fill(-1);
  const dist = new Int16Array(N_RANK).fill(-1);
  dist[SOLVED_RANK] = 0;
  // inverse direction index, so apply(child, inverse) = parent.
  const invIdx = SLIDE_DIRS.map((d) => SLIDE_DIRS.indexOf(SLIDE_INVERSE[d]));
  let frontier: number[] = [SOLVED_RANK];
  let d = 0;
  while (frontier.length) {
    const next: number[] = [];
    for (const u of frontier) {
      for (let di = 0; di < 4; di++) {
        const v = mv[u * 4 + di];
        if (v < 0 || dist[v] !== -1) continue;
        dist[v] = d + 1;
        // apply(u, di) = v ⇒ to go from v toward solved (=u) apply the inverse of di.
        toSolved[v] = invIdx[di];
        next.push(v);
      }
    }
    frontier = next;
    d++;
  }
  return { mv, toSolved, dist };
}

function graph(): Slide8Graph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ────────────────────────────────────────────────────────────────

/** Re-export the scramble parser (validates tokens). Throws Error('bad: <tok>'). */
export { parseSliderScramble as parseSlide8Scramble } from './slider-puzzle';

/** Apply a scramble to the solved puzzle and return its permutation rank. */
export function slide8ScrambleToRank(scramble: string): number {
  const p = solvedSlider(DIMS);
  let blank = BLANK;
  for (const dir of parseSliderScramble(scramble)) {
    const r = Math.floor(blank / 3);
    const c = blank % 3;
    const [dr, dc] = SLIDE_DELTA[dir];
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr > 2 || nc < 0 || nc > 2) throw new Error(`off-grid: ${dir}`);
    const nb = nr * 3 + nc;
    p[blank] = p[nb];
    p[nb] = BLANK;
    blank = nb;
  }
  return permRank(p);
}

export interface Slide8Solution {
  /** Optimal solution as space-separated single slides (U/D/L/R); empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/** Optimally solve an 8-puzzle scramble. Throws on an invalid token / off-grid slide. */
export function solveSlide8(scramble: string): Slide8Solution {
  const g = graph();
  let rank = slide8ScrambleToRank(scramble);
  if (g.dist[rank] < 0) throw new Error('unreachable');
  const dirs: string[] = [];
  let guard = 0;
  while (rank !== SOLVED_RANK) {
    const di = g.toSolved[rank];
    if (di < 0 || guard++ > SLIDE8_GODS_NUMBER) throw new Error('unsolvable');
    dirs.push(SLIDE_DIRS[di]);
    rank = g.mv[rank * 4 + di];
  }
  return { solution: dirs.join(' '), length: dirs.length };
}

/**
 * Apply a scramble to the solved puzzle, returning the raw 3×3 grid (grid[pos] = tile, 8 = blank)
 * + blank position, for rendering. Throws on invalid input.
 */
export function slide8Apply(scramble: string): { grid: number[]; blank: number } {
  const p = solvedSlider(DIMS);
  let blank = BLANK;
  for (const dir of parseSliderScramble(scramble)) {
    const r = Math.floor(blank / 3);
    const c = blank % 3;
    const [dr, dc] = SLIDE_DELTA[dir];
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr > 2 || nc < 0 || nc > 2) throw new Error(`off-grid: ${dir}`);
    const nb = nr * 3 + nc;
    p[blank] = p[nb];
    p[nb] = BLANK;
    blank = nb;
  }
  return { grid: p, blank };
}

/** Shortest scramble producing state `rank` = inverse of its optimal solution (reverse path). */
function rankToScramble(g: Slide8Graph, rank: number): string {
  const sol: SlideDir[] = [];
  let cur = rank;
  let guard = 0;
  while (cur !== SOLVED_RANK) {
    const di = g.toSolved[cur];
    if (di < 0 || guard++ > SLIDE8_GODS_NUMBER) break;
    sol.push(SLIDE_DIRS[di]);
    cur = g.mv[cur * 4 + di];
  }
  // scramble = inverse of the toward-solved path, in reverse order.
  return sol.reverse().map((d) => SLIDE_INVERSE[d]).join(' ');
}

/**
 * Up to `perBin` example scrambles per optimal length, by spread-sampling states at each BFS depth
 * and inverting their optimal solution (a depth-d state yields a length-d scramble). The whole
 * state space is enumerable, so no corpus is needed. Returns { depth: [scramble, …] } for 1..31.
 */
export function slide8ExamplesByLength(perBin = 12): Record<number, string[]> {
  const g = graph();
  const counts: number[] = [];
  for (let i = 0; i < g.dist.length; i++) {
    const d = g.dist[i];
    if (d > 0) counts[d] = (counts[d] ?? 0) + 1;
  }
  const wantInf = !Number.isFinite(perBin);
  const want = perBin;
  const step: number[] = [];
  counts.forEach((c, d) => { step[d] = wantInf ? 1 : Math.max(1, Math.floor(c / want)); });
  const seen: number[] = [];
  const out: Record<number, string[]> = {};
  for (let i = 0; i < g.dist.length; i++) {
    const d = g.dist[i];
    if (d <= 0) continue;
    if (!wantInf && (out[d]?.length ?? 0) >= want) continue;
    const k = (seen[d] = (seen[d] ?? 0) + 1);
    if (wantInf || (k - 1) % step[d] === 0) (out[d] ??= []).push(rankToScramble(g, i));
  }
  return out;
}

/**
 * Every non-trivial state's shortest scramble, grouped by optimal length (1..31). The full state
 * space is enumerable, so this is the complete corpus (181,439 states; the 181,440th is the
 * identity/solved). Used for the "download all states" button (CSV, ~181k rows — fine).
 */
export function slide8AllScramblesByLength(): Record<number, string[]> {
  return slide8ExamplesByLength(Infinity);
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function slide8GraphStats(): { total: number; histogram: number[] } {
  const { dist } = graph();
  const histogram: number[] = [];
  let total = 0;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (d < 0) continue;
    total++;
    histogram[d] = (histogram[d] ?? 0) + 1;
  }
  return { total, histogram };
}
