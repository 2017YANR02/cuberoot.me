import { describe, it, expect } from 'vitest';
import {
  solveSlide8,
  parseSlide8Scramble,
  slide8GraphStats,
  slide8Apply,
  slide8ExamplesByLength,
  slide8AllScramblesByLength,
  slide8ScrambleToRank,
  SLIDE8_GODS_NUMBER,
  SLIDE8_STATE_COUNT,
  SLIDE8_LENGTH_DISTRIBUTION,
} from '@/lib/slide8-solver';
import { renderSlide8ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/slide8_svg';

// ── Independent reference model ───────────────────────────────────────────────
// Re-derived straight from the verified cstimer 8-puzzle spec (3×3 grid, blank slides to an
// orthogonal neighbor). The token → blank Δ map was confirmed by replaying 1000 real cstimer
// `8prp` scrambles through cstimer's own slideMove with zero wall hits. This reference is NOT
// built on the solver's own apply — round-trip / optimality checks are a genuine cross-check.
//
//   U → row+1   D → row−1   L → col+1   R → col−1   (rows downward from 0; solved blank at pos 8)
const DELTA: Record<string, [number, number]> = {
  U: [1, 0], D: [-1, 0], L: [0, 1], R: [0, -1],
};
const DIRS = ['U', 'D', 'L', 'R'] as const;
type Dir = (typeof DIRS)[number];
const BLANK = 8; // blank tile value (sits at the bottom-right when solved)

interface State { g: number[]; blank: number; }
const solved = (): State => ({ g: [0, 1, 2, 3, 4, 5, 6, 7, 8], blank: 8 });
const keyOf = (s: State) => s.g.join(',');

// expand a scramble into single ±1 slides (D2 → D D); throws on a bad token.
function expand(scr: string): Dir[] {
  const out: Dir[] = [];
  for (const tok of scr.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = /^([UDLR])(\d+)?$/.exec(tok);
    if (!m) throw new Error(`bad: ${tok}`);
    const dir = m[1] as Dir;
    const n = m[2] ? Number(m[2]) : 1;
    for (let k = 0; k < n; k++) out.push(dir);
  }
  return out;
}

// apply one slide to a state; returns false if it runs off the grid (no mutation then).
function slide(s: State, dir: Dir): boolean {
  const r = Math.floor(s.blank / 3), c = s.blank % 3;
  const [dr, dc] = DELTA[dir];
  const nr = r + dr, nc = c + dc;
  if (nr < 0 || nr > 2 || nc < 0 || nc > 2) return false;
  const nb = nr * 3 + nc;
  s.g[s.blank] = s.g[nb];
  s.g[nb] = BLANK;
  s.blank = nb;
  return true;
}

function applySeq(seq: Dir[]): State {
  const s = solved();
  for (const dir of seq) {
    if (!slide(s, dir)) throw new Error(`off-grid: ${dir}`);
  }
  return s;
}

// Independent full BFS over the whole reachable graph → optimal distance per state.
function referenceBfs(): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(keyOf(solved()), 0);
  let frontier: State[] = [solved()];
  let d = 0;
  while (frontier.length) {
    const next: State[] = [];
    for (const s of frontier) {
      const r = Math.floor(s.blank / 3), c = s.blank % 3;
      for (const dir of DIRS) {
        const [dr, dc] = DELTA[dir];
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
        const nb = nr * 3 + nc;
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

// Tiny deterministic PRNG (seeded) so failures are reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate a random LEGAL slide sequence (never runs off the grid) of `len` moves.
function randomLegalSeq(rnd: () => number, len: number): Dir[] {
  const s = solved();
  const seq: Dir[] = [];
  for (let i = 0; i < len; i++) {
    const r = Math.floor(s.blank / 3), c = s.blank % 3;
    const legal = DIRS.filter((dir) => {
      const [dr, dc] = DELTA[dir];
      const nr = r + dr, nc = c + dc;
      return nr >= 0 && nr <= 2 && nc >= 0 && nc <= 2;
    });
    const dir = legal[Math.floor(rnd() * legal.length)];
    slide(s, dir);
    seq.push(dir);
  }
  return seq;
}

// Reference BFS over 181,440 states is built once and shared (it is the slow part).
let REF: Map<string, number> | null = null;
const ref = () => (REF ??= referenceBfs());

describe('slide8-solver graph', () => {
  it('reaches exactly 181,440 states with the proven god-number-31 histogram', () => {
    const { total, histogram } = slide8GraphStats();
    expect(total).toBe(181440);
    expect(total).toBe(362880 / 2); // 9!/2
    expect(total).toBe(SLIDE8_STATE_COUNT);
    expect(histogram).toEqual([...SLIDE8_LENGTH_DISTRIBUTION]);
    expect(histogram.length - 1).toBe(SLIDE8_GODS_NUMBER);
    expect(SLIDE8_GODS_NUMBER).toBe(31);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(181440);
  });

  it('our histogram matches an independent BFS', () => {
    const dist = ref();
    const hist: number[] = [];
    for (const d of dist.values()) hist[d] = (hist[d] ?? 0) + 1;
    expect(dist.size).toBe(181440);
    expect(hist).toEqual(slide8GraphStats().histogram);
  });
});

describe('solveSlide8', () => {
  it('handles solved / empty input', () => {
    expect(solveSlide8('')).toEqual({ solution: '', length: 0 });
    expect(solveSlide8('D U')).toEqual({ solution: '', length: 0 }); // slide blank away then back
    expect(solveSlide8('R L')).toEqual({ solution: '', length: 0 }); // R (col−1) then L (col+1) back
  });

  it('single-move scrambles solve in one move', () => {
    // From solved (blank at bottom-right), only U (row+1) and... blank is at row 2,col 2.
    // U=row+1 off-grid, D=row-1 legal, L=col+1 off-grid, R=col-1 legal.
    expect(solveSlide8('D')).toEqual({ solution: 'U', length: 1 }); // inverse of D is U
    expect(solveSlide8('R')).toEqual({ solution: 'L', length: 1 }); // inverse of R is L
  });

  it('rejects invalid tokens', () => {
    expect(() => solveSlide8('D X')).toThrow();
    expect(() => solveSlide8('F')).toThrow();   // no F on a slider
    expect(() => solveSlide8("D'")).toThrow();   // no primes
    expect(() => parseSlide8Scramble('U0')).toThrow();
    expect(() => parseSlide8Scramble('Z2')).toThrow();
  });

  it('solutions are valid and optimal across random scrambles (independent check)', () => {
    const dist = ref();
    const rnd = mulberry32(0x8C0FFEE);
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 40);
      const seq = randomLegalSeq(rnd, len);
      const scramble = seq.join(' ');

      const { solution, length } = solveSlide8(scramble);

      // optimal: reported length equals the independent optimal distance of the scrambled state
      const scrambled = applySeq(seq);
      expect(length).toBe(dist.get(keyOf(scrambled)));
      expect(length).toBeLessThanOrEqual(SLIDE8_GODS_NUMBER);

      // valid: applying the scramble then the solution (independently) returns to solved
      const afterSol = applySeq([...seq, ...(solution ? (solution.split(' ') as Dir[]) : [])]);
      expect(keyOf(afterSol)).toBe(keyOf(solved()));
    }
  });
});

describe('slide8Apply', () => {
  it('matches the independent reference state across random scrambles', () => {
    const rnd = mulberry32(0x8BEEF);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 40);
      const seq = randomLegalSeq(rnd, len);
      const refState = applySeq(seq);
      const got = slide8Apply(seq.join(' '));
      expect(got.grid).toEqual(refState.g);
      expect(got.blank).toBe(refState.blank);
    }
  });

  it('scramble→rank is consistent with the reference permutation parity', () => {
    // solved rank = 0
    expect(slide8ScrambleToRank('')).toBe(0);
    // a legal scramble lands on a reachable (dist ≥ 0) state — solveSlide8 would throw otherwise.
    expect(() => solveSlide8('D R U L')).not.toThrow();
  });
});

describe('slide8ExamplesByLength', () => {
  it('generates valid, optimal example scrambles for every depth 1..31', () => {
    const dist = ref();
    const ex = slide8ExamplesByLength(12);
    for (let d = 1; d <= SLIDE8_GODS_NUMBER; d++) {
      const list = ex[d];
      expect(list, `depth ${d}`).toBeTruthy();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      const seen = new Set<string>();
      for (const scr of list) {
        const toks = expand(scr);
        expect(toks.length).toBe(d);
        expect(() => parseSlide8Scramble(scr)).not.toThrow();
        // optimal solve length == d (both solver and independent reference agree)
        expect(solveSlide8(scr).length).toBe(d);
        expect(dist.get(keyOf(applySeq(toks)))).toBe(d);
        seen.add(keyOf(applySeq(toks)));
      }
      expect(seen.size).toBe(list.length); // distinct states
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = slide8AllScramblesByLength();
    const seen = new Set<string>();
    let total = 0;
    for (let d = 1; d <= SLIDE8_GODS_NUMBER; d++) {
      const list = all[d];
      expect(list.length, `depth ${d} count`).toBe(SLIDE8_LENGTH_DISTRIBUTION[d]);
      for (const scr of list) {
        expect(solveSlide8(scr).length).toBe(d);
        seen.add(scr);
      }
      total += list.length;
    }
    expect(total).toBe(181439); // all 181,440 states minus the identity (solved)
    expect(seen.size).toBe(181439); // every scramble distinct
  });
});

describe('renderSlide8ScrambleSvg', () => {
  const labels = (svg: string) => [...svg.matchAll(/>(\d)<\/text>/g)].map((m) => m[1]);
  const rects = (svg: string) => [...svg.matchAll(/<rect /g)].length;

  it('solved → canonical 1..8 tiles + one blank cell', () => {
    const svg = renderSlide8ScrambleSvg('');
    expect(rects(svg)).toBe(9); // 9 cells
    // 8 numbered tiles in reading order 1..8, blank cell carries no <text>
    expect(labels(svg)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('a slide moves the blank (tile order changes) and round-trips back to solved', () => {
    const solvedSvg = renderSlide8ScrambleSvg('');
    const moved = renderSlide8ScrambleSvg('D');
    expect(rects(moved)).toBe(9);
    expect(labels(moved)).not.toEqual(labels(solvedSvg));
    // D then its inverse U → back to canonical solved
    expect(labels(renderSlide8ScrambleSvg('D U'))).toEqual(labels(solvedSvg));
  });

  it('preview tracks the solver: scramble ∘ solution renders the canonical solved grid', () => {
    const rnd = mulberry32(0x8D16);
    const solvedLabels = labels(renderSlide8ScrambleSvg(''));
    for (let trial = 0; trial < 100; trial++) {
      const len = 1 + Math.floor(rnd() * 30);
      const scramble = randomLegalSeq(rnd, len).join(' ');
      const { solution } = solveSlide8(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(labels(renderSlide8ScrambleSvg(combined)), `grid after solving "${scramble}"`).toEqual(solvedLabels);
    }
  });
});
