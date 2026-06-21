import { describe, it, expect } from 'vitest';
import {
  solveSlide15,
  parseSlide15Scramble,
  slide15Apply,
  slide15Solved,
  slide15WalkingDistance,
  slide15CombinedHeuristic,
  SLIDE15_GODS_NUMBER,
  SLIDE15_STATE_COUNT_APPROX,
  SLIDE15_MEAN_OPTIMAL,
} from '@/lib/slide15-solver';
import {
  type SlideDir, SLIDE_DIRS, SLIDE_DELTA, SLIDE_INVERSE,
  solvedSlider, blankValue, legalSlides, applySlide, parseSliderScramble,
} from '@/lib/slider-puzzle';
import { renderSlide15ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/slide15_svg';

// The 15-puzzle is a 4×4 slider. Its state space (16!/2 ≈ 1.05×10¹³) is far too large to enumerate, so
// the solver uses per-instance IDA* with an admissible heuristic (Walking-Distance, max'd with
// inversion-distance) — the TIER C pattern. These tests cross-check it against an INDEPENDENT plain
// BFS on SHALLOW states (where BFS is cheap), proving the heuristic admissible/optimal without needing
// to explore deep states.

const W = 4, H = 4, N = 16, BLANK = 15;
const DIMS = { width: W, height: H };

// ── Independent reference model (NOT built on the solver's apply) ──────────────
const DELTA: Record<string, [number, number]> = {
  U: [1, 0], D: [-1, 0], L: [0, 1], R: [0, -1], // blank Δ — same convention as the 8-puzzle
};
const DIRS = ['U', 'D', 'L', 'R'] as const;
type Dir = (typeof DIRS)[number];

interface State { g: number[]; blank: number; }
const solved = (): State => ({ g: Array.from({ length: N }, (_, i) => i), blank: BLANK });
const keyOf = (s: State) => s.g.join(',');

function slide(s: State, dir: Dir): boolean {
  const r = Math.floor(s.blank / W), c = s.blank % W;
  const [dr, dc] = DELTA[dir];
  const nr = r + dr, nc = c + dc;
  if (nr < 0 || nr >= H || nc < 0 || nc >= W) return false;
  const nb = nr * W + nc;
  s.g[s.blank] = s.g[nb];
  s.g[nb] = BLANK;
  s.blank = nb;
  return true;
}

function applySeq(seq: Dir[]): State {
  const s = solved();
  for (const dir of seq) if (!slide(s, dir)) throw new Error(`off-grid: ${dir}`);
  return s;
}

// Independent plain BFS out to a shallow depth → optimal distance per state (cheap because shallow).
function referenceBfs(maxDepth: number): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(keyOf(solved()), 0);
  let frontier: State[] = [solved()];
  let d = 0;
  while (frontier.length && d < maxDepth) {
    const next: State[] = [];
    for (const s of frontier) {
      const r = Math.floor(s.blank / W), c = s.blank % W;
      for (const dir of DIRS) {
        const [dr, dc] = DELTA[dir];
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
        const nb = nr * W + nc;
        const ng = s.g.slice();
        ng[s.blank] = ng[nb];
        ng[nb] = BLANK;
        const kk = ng.join(',');
        if (!dist.has(kk)) { dist.set(kk, d + 1); next.push({ g: ng, blank: nb }); }
      }
    }
    frontier = next;
    d++;
  }
  return dist;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random LEGAL slide sequence (never off-grid, never immediately undoing) of `len` moves.
function randomLegalSeq(rnd: () => number, len: number): Dir[] {
  const s = solved();
  const seq: Dir[] = [];
  let last = -1;
  for (let i = 0; i < len; i++) {
    const r = Math.floor(s.blank / W), c = s.blank % W;
    const legal: number[] = [];
    for (let di = 0; di < 4; di++) {
      if (last >= 0 && DIRS[di] === SLIDE_INVERSE[DIRS[last] as SlideDir]) continue;
      const [dr, dc] = DELTA[DIRS[di]];
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < H && nc >= 0 && nc < W) legal.push(di);
    }
    const di = legal[Math.floor(rnd() * legal.length)];
    slide(s, DIRS[di]);
    seq.push(DIRS[di]);
    last = di;
  }
  return seq;
}

// ── (a) slider core is correctly parameterized to 4×4 (move rule / notation) ───
describe('slider core @ 4×4 (shared with the solver)', () => {
  it('solved board = 0..15 with the blank (15) at the bottom-right', () => {
    expect(solvedSlider(DIMS)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(blankValue(DIMS)).toBe(15);
  });

  it('applySlide matches the independent reference move-for-move', () => {
    const rnd = mulberry32(0xF1A7);
    for (let trial = 0; trial < 200; trial++) {
      const len = 1 + Math.floor(rnd() * 30);
      const seq = randomLegalSeq(rnd, len);
      // drive the slider core directly
      const g = solvedSlider(DIMS);
      let blank = blankValue(DIMS);
      for (const dir of seq) {
        const legal = legalSlides(DIMS, blank);
        expect(legal).toContain(dir); // the reference only ever emits legal slides
        blank = applySlide(DIMS, g, blank, dir);
      }
      const ref = applySeq(seq);
      expect(g).toEqual(ref.g);
      expect(blank).toBe(ref.blank);
    }
  });

  it('parses the 4-letter notation with compressed powers (e.g. D2 → D D)', () => {
    expect(parseSliderScramble('U D L R')).toEqual(['U', 'D', 'L', 'R']);
    expect(parseSliderScramble('D2 R3')).toEqual(['D', 'D', 'R', 'R', 'R']);
    expect(parseSlide15Scramble('U2')).toEqual(['U', 'U']);
    expect(() => parseSlide15Scramble('F')).toThrow();  // no F on a slider
    expect(() => parseSlide15Scramble("R'")).toThrow();  // no primes
    expect(() => parseSlide15Scramble('U0')).toThrow();
    // SLIDE_DELTA convention (the calibrated map) is exactly the 8-puzzle's.
    expect(SLIDE_DELTA.U).toEqual([1, 0]);
    expect(SLIDE_DELTA.D).toEqual([-1, 0]);
    expect(SLIDE_DELTA.L).toEqual([0, 1]);
    expect(SLIDE_DELTA.R).toEqual([0, -1]);
    expect(SLIDE_DIRS).toEqual(['U', 'D', 'L', 'R']);
  });

  it('slide15Apply matches the independent reference state', () => {
    const rnd = mulberry32(0x15BEEF);
    for (let trial = 0; trial < 200; trial++) {
      const len = 1 + Math.floor(rnd() * 40);
      const seq = randomLegalSeq(rnd, len);
      const refState = applySeq(seq);
      const got = slide15Apply(seq.join(' '));
      expect(got.grid).toEqual(refState.g);
      expect(got.blank).toBe(refState.blank);
    }
  });
});

// ── god-number / published facts ──────────────────────────────────────────────
describe('15-puzzle constants', () => {
  it('exposes God-number 80 and the published mean / state count', () => {
    expect(SLIDE15_GODS_NUMBER).toBe(80);
    expect(SLIDE15_STATE_COUNT_APPROX).toBe(16 * 15 * 14 * 13 * 12 * 11 * 10 * 9 * 8 * 7 * 6 * 5 * 4 * 3 * 2 / 2);
    expect(SLIDE15_MEAN_OPTIMAL).toBeGreaterThan(50);
    expect(SLIDE15_MEAN_OPTIMAL).toBeLessThan(55);
  });
});

// ── (b) valid solutions, length ≤ 80, on random (incl. deeper) scrambles ───────
describe('solveSlide15 validity', () => {
  it('handles solved / trivially-cancelling input', () => {
    expect(solveSlide15('')).toEqual({ solution: '', length: 0, heuristic: 0 });
    expect(solveSlide15('D U')).toEqual({ solution: '', length: 0, heuristic: 0 });
    expect(solveSlide15('R L')).toEqual({ solution: '', length: 0, heuristic: 0 });
  });

  it('single-move scrambles solve in one move', () => {
    expect(solveSlide15('D')).toMatchObject({ solution: 'U', length: 1 });
    expect(solveSlide15('R')).toMatchObject({ solution: 'L', length: 1 });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveSlide15('D X')).toThrow();
    expect(() => solveSlide15("D'")).toThrow();
  });

  it('returns a VALID solution with length ≤ 80 across random scrambles (independent apply)', () => {
    const rnd = mulberry32(0x5A1AD);
    for (let trial = 0; trial < 60; trial++) {
      const len = 1 + Math.floor(rnd() * 45);
      const seq = randomLegalSeq(rnd, len);
      const scramble = seq.join(' ');
      const { solution, length } = solveSlide15(scramble);
      expect(length).toBeLessThanOrEqual(SLIDE15_GODS_NUMBER);
      // valid: scramble ∘ solution = solved, checked with the INDEPENDENT apply
      const after = applySeq([...seq, ...(solution ? (solution.split(' ') as Dir[]) : [])]);
      expect(keyOf(after)).toBe(keyOf(solved()));
    }
  });
});

// ── (c) optimality cross-check + (d) admissibility on SHALLOW states ──────────
describe('solveSlide15 optimality (cross-checked against an independent BFS)', () => {
  it('IDA* length == independent BFS shortest distance on shallow scrambles, and WD/heuristic are admissible', () => {
    const MAX_DEPTH = 14; // BFS to depth 14 is cheap; enough to exercise non-trivial states
    const dist = referenceBfs(MAX_DEPTH + 1);
    const rnd = mulberry32(0x09714A1);
    let checked = 0;
    for (let trial = 0; trial < 500; trial++) {
      const len = 1 + Math.floor(rnd() * MAX_DEPTH);
      const seq = randomLegalSeq(rnd, len);
      const scramble = seq.join(' ');
      const state = applySeq(seq);
      const trueD = dist.get(keyOf(state));
      if (trueD === undefined) continue; // random walk may cancel below MAX_DEPTH; skip if not in ref
      checked++;
      // (c) optimality: IDA* returns exactly the independent shortest distance
      const { length } = solveSlide15(scramble);
      expect(length, `optimal length for "${scramble}"`).toBe(trueD);
      // (d) admissibility: neither WD nor the combined heuristic ever exceeds the true distance
      expect(slide15WalkingDistance(state.g), `WD admissibility for "${scramble}"`).toBeLessThanOrEqual(trueD);
      expect(slide15CombinedHeuristic(state.g), `combined-heuristic admissibility for "${scramble}"`).toBeLessThanOrEqual(trueD);
    }
    expect(checked).toBeGreaterThan(300); // we actually exercised a healthy number of distinct states
  });
});

// ── preview SVG is self-proving (solved = canonical 1..15) and tracks the solver ─
describe('renderSlide15ScrambleSvg', () => {
  const labels = (svg: string) => [...svg.matchAll(/>(\d+)<\/text>/g)].map((m) => m[1]);
  const rects = (svg: string) => [...svg.matchAll(/<rect /g)].length;

  it('solved → canonical 1..15 tiles + one blank cell', () => {
    const svg = renderSlide15ScrambleSvg('');
    expect(rects(svg)).toBe(16); // 16 cells
    expect(labels(svg)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']);
  });

  it('preview tracks the solver: scramble ∘ solution renders the canonical solved grid', () => {
    const rnd = mulberry32(0x15D16);
    const solvedLabels = labels(renderSlide15ScrambleSvg(''));
    for (let trial = 0; trial < 40; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const scramble = randomLegalSeq(rnd, len).join(' ');
      const { solution } = solveSlide15(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(labels(renderSlide15ScrambleSvg(combined)), `grid after solving "${scramble}"`).toEqual(solvedLabels);
    }
  });
});

// sanity: solved board export matches the slider core
describe('slide15Solved', () => {
  it('= 0..15', () => {
    expect(slide15Solved()).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });
});
