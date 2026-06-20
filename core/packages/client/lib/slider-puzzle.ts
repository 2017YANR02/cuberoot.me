/*
 * Generic sliding-tile puzzle core (8-puzzle, 15-puzzle, …) — reusable across grid sizes.
 *
 * A W×H sliding puzzle is a permutation of W·H cells: (W·H − 1) numbered tiles + one blank.
 * The only move is to slide the blank to an orthogonally-adjacent cell (Up/Down/Left/Right),
 * swapping the blank with the tile there. One slide = one move. Exactly half of all (W·H)!
 * permutations are reachable from solved ((W·H)!/2), because each slide is a transposition of
 * the blank with a neighbor and the blank's taxicab parity is coupled to the permutation parity.
 *
 * This module owns ONLY the geometry + move rule, parameterized by width/height, so both the
 * 8-puzzle (full-BFS, lib/slide8-solver) and the future 15-puzzle (IDA*, lib/slide15-solver)
 * share one source of truth for "what is a legal slide". Higher-level solvers layer their own
 * search/encoding on top.
 *
 * Notation matches the vendored cstimer `scramble/slide.js` (keys `8prp` / `15prp`). cstimer emits
 * the four bare tokens U D L R (with an optional compressed power, e.g. `D2`), each meaning the
 * BLANK slides one cell in that direction. The exact (token → blank Δ) map below was verified
 * empirically by replaying 1000 real `cstimerScramble('8p')` outputs through cstimer's own
 * slideMove and confirming zero wall-hits + valid permutations:
 *   U → row+1   D → row−1   L → col+1   R → col−1
 * (rows count downward from 0 at the top; the solved blank sits at the bottom-right corner.)
 * Replicating this bit-for-bit guarantees a cstimer-generated scramble is read as the identical
 * physical state, so a solution actually solves it.
 */

/** Grid dimensions (width = columns, height = rows). */
export interface SliderDims {
  width: number;
  height: number;
}

/** Slide direction = which way the BLANK moves. */
export type SlideDir = 'U' | 'D' | 'L' | 'R';
export const SLIDE_DIRS: ReadonlyArray<SlideDir> = ['U', 'D', 'L', 'R'];

/** Blank Δ(row, col) per cstimer token (verified against scramble/slide.js — see file header). */
export const SLIDE_DELTA: Readonly<Record<SlideDir, readonly [number, number]>> = {
  U: [1, 0],
  D: [-1, 0],
  L: [0, 1],
  R: [0, -1],
};

/** Number of cells = tiles + blank. */
export function cellCount(dims: SliderDims): number {
  return dims.width * dims.height;
}

/** Solved arrangement: g[pos] = pos (tiles 0..n−2 in order, blank = n−1 at the last cell). */
export function solvedSlider(dims: SliderDims): number[] {
  const n = cellCount(dims);
  return Array.from({ length: n }, (_, i) => i);
}

/** The blank tile value (= last index), which sits at the bottom-right when solved. */
export function blankValue(dims: SliderDims): number {
  return cellCount(dims) - 1;
}

/**
 * Legal directions for a blank at `blankPos` (those that stay on the grid). Useful for BFS/IDA*
 * neighbor generation without throwing.
 */
export function legalSlides(dims: SliderDims, blankPos: number): SlideDir[] {
  const r = Math.floor(blankPos / dims.width);
  const c = blankPos % dims.width;
  const out: SlideDir[] = [];
  for (const dir of SLIDE_DIRS) {
    const [dr, dc] = SLIDE_DELTA[dir];
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < dims.height && nc >= 0 && nc < dims.width) out.push(dir);
  }
  return out;
}

/**
 * Apply one slide in-place to grid `g` (g[pos] = tile value), given the blank's current position.
 * Returns the blank's new position, or −1 if the move would leave the grid (no-op, g untouched).
 */
export function applySlide(dims: SliderDims, g: number[], blankPos: number, dir: SlideDir): number {
  const r = Math.floor(blankPos / dims.width);
  const c = blankPos % dims.width;
  const [dr, dc] = SLIDE_DELTA[dir];
  const nr = r + dr;
  const nc = c + dc;
  if (nr < 0 || nr >= dims.height || nc < 0 || nc >= dims.width) return -1;
  const nb = nr * dims.width + nc;
  g[blankPos] = g[nb];
  g[nb] = blankValue(dims);
  return nb;
}

/** Inverse direction (used to reverse a solution into a scramble). */
export const SLIDE_INVERSE: Readonly<Record<SlideDir, SlideDir>> = {
  U: 'D',
  D: 'U',
  L: 'R',
  R: 'L',
};

const TOKEN_RE_CACHE = new Map<string, RegExp>();
/** Token regex for a scramble of the four bare letters with an optional power ≥ 1, e.g. `D2`. */
function tokenRe(): RegExp {
  let re = TOKEN_RE_CACHE.get('slider');
  if (!re) {
    re = /^([UDLR])(\d+)?$/;
    TOKEN_RE_CACHE.set('slider', re);
  }
  return re;
}

/**
 * Parse a cstimer-style scramble string into a flat list of single slides. A compressed token like
 * `D2` expands to two `D` slides. Throws Error('bad: <tok>') on an unrecognized token.
 */
export function parseSliderScramble(scramble: string): SlideDir[] {
  const out: SlideDir[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = tokenRe().exec(tok);
    if (!m) throw new Error(`bad: ${tok}`);
    const dir = m[1] as SlideDir;
    const pow = m[2] ? Number(m[2]) : 1;
    if (pow < 1) throw new Error(`bad: ${tok}`);
    for (let k = 0; k < pow; k++) out.push(dir);
  }
  return out;
}

/**
 * Apply a full scramble to the solved grid, returning { grid, blank }. Throws on an invalid token
 * (parse) and on a slide that runs off the grid (Error('off-grid: <dir>')) — cstimer scrambles
 * never do the latter, so it only fires on hand-typed nonsense.
 */
export function sliderApply(dims: SliderDims, scramble: string): { grid: number[]; blank: number } {
  const grid = solvedSlider(dims);
  let blank = blankValue(dims); // solved blank position = last cell
  for (const dir of parseSliderScramble(scramble)) {
    const nb = applySlide(dims, grid, blank, dir);
    if (nb < 0) throw new Error(`off-grid: ${dir}`);
    blank = nb;
  }
  return { grid, blank };
}
