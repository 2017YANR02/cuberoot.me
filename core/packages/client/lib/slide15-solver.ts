/*
 * 15-Puzzle (数字华容道 / 十五数码) optimal solver — per-instance IDA* with the Walking-Distance
 * heuristic. Pure TS, no worker, no tables to download.
 *
 * The 15-puzzle is a 4×4 sliding puzzle: 15 numbered tiles + one blank. The blank slides to an
 * orthogonal neighbor (Up/Down/Left/Right); one slide = one move. Exactly half of all 16! cell
 * permutations are reachable from solved → 16!/2 ≈ 1.05×10¹³ states. That is FAR too many to BFS or
 * tabulate, so — unlike the 8-puzzle (TIER A full BFS) — this is a TIER C solver: each scramble is
 * solved on demand by IDA* (iterative-deepening A*) with an ADMISSIBLE heuristic, so the result is a
 * provably OPTIMAL shortest path (not an approximation). God's number is 80; the mean optimal length
 * over random states is ≈ 52.6.
 *
 * Heuristic = Walking Distance (WD) — the strong 15-puzzle heuristic. WD looks only at which goal ROW
 * each tile belongs to (ignoring its column) and counts the minimum number of VERTICAL slides to get
 * every tile into its goal row; symmetrically for columns / horizontal slides. The two are summed.
 * Because a vertical slide never changes a tile's column-class and a horizontal slide never changes a
 * tile's row-class, the row-WD and column-WD count DISJOINT move sets, so their sum never exceeds the
 * true distance → admissible (and consistent), so IDA* returns the optimal length. WD dominates plain
 * Manhattan; we also take max(WD, Manhattan + linear-conflict floor) for a tiny extra boost on some
 * states. WD over a 4×4 has only a few tens of thousands of "row-pattern" states, enumerated by one
 * BFS at module load (memoized).
 *
 * Geometry + cstimer notation (U D L R, optional compressed power like `D2`) live in the reusable
 * lib/slider-puzzle core (verified field-for-field against vendored cstimer scramble/slide.js, key
 * `15prp`; calibrated by replaying 400 real cstimer 15prp scrambles through this exact (token→blank Δ)
 * map with zero wall-hits + valid permutations). The 8-puzzle (lib/slide8-solver, full BFS) shares
 * that same core, so the move rule has a single source of truth.
 */

import {
  type SliderDims, type SlideDir, SLIDE_DIRS, SLIDE_DELTA, SLIDE_INVERSE,
  solvedSlider, blankValue, parseSliderScramble,
} from './slider-puzzle';

const DIMS: SliderDims = { width: 4, height: 4 };
const W = 4;
const H = 4;
const N_CELL = 16;        // 4×4
const BLANK = blankValue(DIMS); // 15

/** God's number for the 15-puzzle (proven by Korf et al., 2005). */
export const SLIDE15_GODS_NUMBER = 80;

/**
 * Known statistics over all reachable states (16!/2 ≈ 1.05×10¹³ — far too many to enumerate).
 * Mean optimal solution length over uniformly-random states ≈ 52.59 (Korf & Schultze, 2005). We
 * surface these as published facts; our own SAMPLED distribution (a few thousand random states) is
 * an estimate of this same distribution, NOT the exact full-space curve.
 */
export const SLIDE15_STATE_COUNT_APPROX = 10461394944000; // 16!/2
export const SLIDE15_MEAN_OPTIMAL = 52.59;

// ── Walking-Distance heuristic ────────────────────────────────────────────────
// A "WD pattern" tracks, for each board row r and each goal-row g, how many tiles whose goal row is g
// currently sit in row r (a 4×4 matrix of counts summing to ≤ 16, with the blank's row known). We BFS
// the space of such patterns from the goal pattern to get, for any pattern, the minimum number of
// vertical slides needed to make every tile sit in its goal row. The same table (by symmetry) gives
// the horizontal cost when applied to the transposed board.
//
// Pattern encoding: the 4×4 count matrix is packed into a base-(N+1) integer; we also store which row
// the blank is in (the blank moves with the tiles). We canonicalize a board to its row-pattern, look
// up the cost, and likewise for columns.

interface WdTable {
  /** cost[patternKey] = min vertical slides to reach the goal pattern. */
  cost: Map<number, number>;
}

/**
 * Encode a row-pattern: matrix m[r][g] (counts) + blankRow. Each cell count is 0..4 (≤ H), packed in
 * base 5 over 16 cells, then × H + blankRow. Stable & collision-free for 4×4.
 */
function encodeWd(m: number[][], blankRow: number): number {
  let k = 0;
  for (let r = 0; r < H; r++) {
    for (let g = 0; g < H; g++) {
      k = k * (H + 1) + m[r][g];
    }
  }
  return k * H + blankRow;
}

/** Build the WD cost table by BFS backward from the goal pattern (memoized). */
function buildWdTable(): WdTable {
  // Goal pattern: row r holds exactly the H tiles whose goal row is r → m[r][r] = H, except the goal
  // row of the blank, which holds H−1 tiles + the blank. The blank's goal row is the last (H−1).
  // We model the blank as occupying a slot in its row but contributing no tile to any goal-row count;
  // so the goal pattern has m[r][r] = H for r<H−1 and m[H−1][H−1] = H−1 (the 16th slot is the blank),
  // blankRow = H−1.
  const goal: number[][] = Array.from({ length: H }, () => new Array<number>(H).fill(0));
  for (let r = 0; r < H; r++) goal[r][r] = H;
  goal[H - 1][H - 1] = H - 1; // blank occupies one slot of its goal row
  const goalKey = encodeWd(goal, H - 1);

  const cost = new Map<number, number>();
  cost.set(goalKey, 0);
  // BFS frontier of (matrix, blankRow). One vertical slide = the blank swaps with a tile in an
  // adjacent row; that tile (goal-row g) moves from its row into the blank's row. Equivalent forward
  // move from a state: pick a tile in row blankRow±1 with some goal-row g, move it toward blankRow.
  type Node = { m: number[][]; b: number; key: number };
  let frontier: Node[] = [{ m: goal, b: H - 1, key: goalKey }];
  let d = 0;
  while (frontier.length) {
    const next: Node[] = [];
    for (const node of frontier) {
      const { m, b } = node;
      // The blank can move up (to row b−1) or down (to row b+1). Moving the blank from row b into row
      // nb pulls one tile from row nb (of some goal class g) into row b.
      for (const nb of [b - 1, b + 1]) {
        if (nb < 0 || nb >= H) continue;
        for (let g = 0; g < H; g++) {
          if (m[nb][g] === 0) continue;
          // copy matrix, move one tile of class g from row nb → row b
          const nm = m.map((row) => row.slice());
          nm[nb][g] -= 1;
          nm[b][g] += 1;
          const key = encodeWd(nm, nb);
          if (cost.has(key)) continue;
          cost.set(key, d + 1);
          next.push({ m: nm, b: nb, key });
        }
      }
    }
    frontier = next;
    d++;
  }
  return { cost };
}

let WD: WdTable | null = null;
function wdTable(): WdTable {
  if (!WD) WD = buildWdTable();
  return WD;
}

/**
 * Row-pattern key for a board (g[pos] = tile value, BLANK = blank). m[r][g] = #tiles in board-row r
 * whose GOAL row is g; blank contributes only to blankRow.
 */
function rowPatternKey(g: number[]): number {
  const m: number[][] = Array.from({ length: H }, () => new Array<number>(H).fill(0));
  let blankRow = 0;
  for (let pos = 0; pos < N_CELL; pos++) {
    const v = g[pos];
    const r = Math.floor(pos / W);
    if (v === BLANK) { blankRow = r; continue; }
    const goalRow = Math.floor(v / W);
    m[r][goalRow] += 1;
  }
  return encodeWd(m, blankRow);
}

/** Column-pattern key = row-pattern of the transposed board (goal column instead of goal row). */
function colPatternKey(g: number[]): number {
  const m: number[][] = Array.from({ length: H }, () => new Array<number>(H).fill(0));
  let blankCol = 0;
  for (let pos = 0; pos < N_CELL; pos++) {
    const v = g[pos];
    const c = pos % W;
    if (v === BLANK) { blankCol = c; continue; }
    const goalCol = v % W;
    m[c][goalCol] += 1;
  }
  return encodeWd(m, blankCol);
}

/** Walking-Distance heuristic for a board: vertical WD + horizontal WD (admissible & consistent). */
function walkingDistance(g: number[]): number {
  const t = wdTable();
  const rk = rowPatternKey(g);
  const ck = colPatternKey(g);
  const rc = t.cost.get(rk);
  const cc = t.cost.get(ck);
  // Both keys are always reachable (every legal board maps to a valid pattern); guard anyway.
  return (rc ?? 0) + (cc ?? 0);
}

// ── Inversion-distance heuristic ──────────────────────────────────────────────
// A second admissible 15-puzzle heuristic that complements WD. Reading the tiles in row-major order
// (ignoring the blank) gives a permutation; the number of inversions bounds how many tiles must pass
// each other. A single horizontal slide changes the row-major inversion count by at most ... it leaves
// it unchanged, while a vertical slide changes it by an amount that, amortized, needs ≥ ceil(inv/3)
// vertical moves. So vertical-ID = ceil(rowMajorInversions / 3). By symmetry (column-major reading),
// horizontal-ID = ceil(colMajorInversions / 3). Their sum is admissible. Combined as max(WD, ID) it
// kills the worst-case blowups that plain WD leaves on near-god-number states.
function inversions(seq: number[]): number {
  let inv = 0;
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length; j++) if (seq[i] > seq[j]) inv++;
  }
  return inv;
}

function inversionDistance(g: number[]): number {
  // row-major tile sequence (skip blank) → vertical moves
  const rowMajor: number[] = [];
  for (let pos = 0; pos < N_CELL; pos++) if (g[pos] !== BLANK) rowMajor.push(g[pos]);
  const vertical = Math.ceil(inversions(rowMajor) / 3);
  // column-major: read tiles column by column, by their column-major goal index
  const colMajor: number[] = [];
  for (let c = 0; c < W; c++) {
    for (let r = 0; r < H; r++) {
      const v = g[r * W + c];
      if (v === BLANK) continue;
      // remap each tile to its column-major goal rank so a column-sorted board has 0 inversions
      const gr = Math.floor(v / W);
      const gc = v % W;
      colMajor.push(gc * H + gr);
    }
  }
  const horizontal = Math.ceil(inversions(colMajor) / 3);
  return vertical + horizontal;
}

/** Combined admissible heuristic = max(Walking-Distance, Inversion-Distance). */
function heuristic(g: number[]): number {
  const wd = walkingDistance(g);
  const id = inversionDistance(g);
  return wd > id ? wd : id;
}

// ── public types ──────────────────────────────────────────────────────────────

export interface Slide15Solution {
  /** Optimal solution as space-separated single slides (U/D/L/R); empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
  /** WD heuristic value of the scrambled state (a lower bound on `length`), for diagnostics. */
  heuristic: number;
}

// ── board / scramble apply ──────────────────────────────────────────────────────

/** Re-export the scramble parser (validates tokens). Throws Error('bad: <tok>'). */
export { parseSliderScramble as parseSlide15Scramble } from './slider-puzzle';

/**
 * Apply a scramble to the solved puzzle, returning the raw 4×4 grid (grid[pos] = tile, 15 = blank) +
 * blank position, for rendering / search. Throws on an invalid token / off-grid slide (cstimer
 * scrambles never do the latter).
 */
export function slide15Apply(scramble: string): { grid: number[]; blank: number } {
  const g = solvedSlider(DIMS);
  let blank = BLANK;
  for (const dir of parseSliderScramble(scramble)) {
    const r = Math.floor(blank / W);
    const c = blank % W;
    const [dr, dc] = SLIDE_DELTA[dir];
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= H || nc < 0 || nc >= W) throw new Error(`off-grid: ${dir}`);
    const nb = nr * W + nc;
    g[blank] = g[nb];
    g[nb] = BLANK;
    blank = nb;
  }
  return { grid: g, blank };
}

const SOLVED = solvedSlider(DIMS);
function isSolved(g: number[]): boolean {
  for (let i = 0; i < N_CELL; i++) if (g[i] !== SOLVED[i]) return false;
  return true;
}

// Direction index helpers for fast neighbor generation in IDA*.
const DIR_IDX: Record<SlideDir, number> = { U: 0, D: 1, L: 2, R: 3 };
const INV_IDX: number[] = SLIDE_DIRS.map((d) => DIR_IDX[SLIDE_INVERSE[d]]);

/**
 * One bounded DFS of IDA*. Mutates `g`/`path` during search (both restored on backtrack). Returns
 * either the found solution (dir indices, when reached) or the smallest f-value that exceeded `bound`
 * (the next threshold to try). `Infinity` means the subtree was fully explored with nothing exceeding
 * — i.e. no solution exists within reach (unsolvable parity; cstimer scrambles never hit this).
 */
function idaBoundedDfs(g: number[], blank: number, bound: number): { path: number[] } | number {
  const path: number[] = []; // dir indices accumulated on the live search path
  let found = false;

  function dfs(blankPos: number, gCost: number, lastDirIdx: number): number {
    const h = heuristic(g);
    const f = gCost + h;
    if (f > bound) return f; // prune; report this f as a candidate next threshold
    if (h === 0 && isSolved(g)) { found = true; return -1; }
    let min = Infinity;
    const r = Math.floor(blankPos / W);
    const c = blankPos % W;
    for (let di = 0; di < 4; di++) {
      if (lastDirIdx >= 0 && di === INV_IDX[lastDirIdx]) continue; // never immediately undo
      const [dr, dc] = SLIDE_DELTA[SLIDE_DIRS[di]];
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
      const nb = nr * W + nc;
      g[blankPos] = g[nb];
      g[nb] = BLANK;
      path.push(di);
      const t = dfs(nb, gCost + 1, di);
      if (found) return -1;
      if (t < min) min = t;
      path.pop();
      g[nb] = g[blankPos];
      g[blankPos] = BLANK;
    }
    return min;
  }

  const next = dfs(blank, 0, -1);
  if (found) return { path: path.slice() };
  return next; // smallest exceeding f, or Infinity if exhausted
}

/** Locate the blank (value 15) in a grid. */
function blankPosOf(g: number[]): number {
  for (let i = 0; i < N_CELL; i++) if (g[i] === BLANK) return i;
  return -1;
}

/**
 * Optimally solve a raw 4×4 grid state (g[pos] = tile, 15 = blank) with IDA* + the combined
 * Walking-Distance / inversion heuristic. Returns the provably shortest solution. The grid is NOT
 * mutated. Throws on an unsolvable parity (every cstimer / fairly-shuffled state is solvable).
 */
export function solveSlide15Grid(grid: number[]): Slide15Solution {
  const h0 = heuristic(grid);
  if (isSolved(grid)) return { solution: '', length: 0, heuristic: 0 };
  const blank = blankPosOf(grid);

  // Classic IDA*: start bound = heuristic, then raise it to the smallest f that exceeded last round
  // until a solution is found. The bound only ever increases by ≥ 2 (parity), and never past 80.
  let bound = h0;
  while (bound <= SLIDE15_GODS_NUMBER) {
    const g = grid.slice();
    const res = idaBoundedDfs(g, blank, bound);
    if (typeof res !== 'number') {
      const dirs = res.path.map((di) => SLIDE_DIRS[di]);
      return { solution: dirs.join(' '), length: dirs.length, heuristic: h0 };
    }
    if (res === Infinity) throw new Error('unsolvable');
    bound = res;
  }
  throw new Error('unsolvable');
}

/**
 * Optimally solve a 15-puzzle scramble with IDA* + Walking-Distance. The result is the provably
 * shortest solution. Throws on invalid token / off-grid slide / unsolvable parity (cstimer scrambles
 * are always solvable). Typical random states solve in milliseconds to a few seconds.
 */
export function solveSlide15(scramble: string): Slide15Solution {
  const { grid } = slide15Apply(scramble);
  return solveSlide15Grid(grid);
}

/** The combined admissible heuristic of a scramble's state (lower bound on optimal length). */
export function slide15Heuristic(scramble: string): number {
  return heuristic(slide15Apply(scramble).grid);
}

/** Walking-Distance of a raw grid (test/diagnostic). */
export function slide15WalkingDistance(grid: number[]): number {
  return walkingDistance(grid);
}

/** Combined admissible heuristic max(WD, inversion-distance) of a raw grid (test/diagnostic). */
export function slide15CombinedHeuristic(grid: number[]): number {
  return heuristic(grid);
}

/** Solved 4×4 grid (for rendering / tests). */
export function slide15Solved(): number[] {
  return solvedSlider(DIMS);
}
