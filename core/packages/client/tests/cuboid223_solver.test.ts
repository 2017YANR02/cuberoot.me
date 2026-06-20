import { describe, it, expect } from 'vitest';
import {
  solveCuboid223,
  parseCuboid223Scramble,
  cuboid223GraphStats,
  cuboid223Apply,
  cuboid223ExamplesByLength,
  cuboid223AllScramblesByLength,
  CUBOID223_GODS_NUMBER,
  CUBOID223_LENGTH_DISTRIBUTION,
} from '@/lib/cuboid223-solver';
import { renderCuboid223ScrambleSvg, CUBOID223_DEFAULT_COLORS } from '@/app/[lang]/scramble/gen/_svg/cuboid223_svg';

// ── Independent reference model ───────────────────────────────────────────────
// Re-derived straight from the cstimer 2x2x3 spec (corner perm of 8 + middle-layer perm of 3, each
// transformed by the same circle() cycles), NOT from the solver's own apply — so round-trip /
// optimality checks are a genuine cross-check rather than a tautology.
const TOKENS = ['U', 'U2', "U'", 'D', 'D2', "D'", 'R2', 'F2'];

// cstimer mathlib.circle: forward cycle.
function circle(arr: number[], ...idx: number[]): void {
  const last = idx.length - 1;
  const temp = arr[idx[last]];
  for (let i = last; i > 0; i--) arr[idx[i]] = arr[idx[i - 1]];
  arr[idx[0]] = temp;
}

interface State { c: number[]; e: number[]; }
const solved = (): State => ({ c: [0, 1, 2, 3, 4, 5, 6, 7], e: [0, 1, 2] });
const keyOf = (s: State) => s.c.join('') + '|' + s.e.join('');

// apply one base move (0=U,1=D,2=R,3=F) once to a state in place.
function applyBase(s: State, base: number): void {
  if (base === 0) circle(s.c, 0, 1, 2, 3);
  else if (base === 1) circle(s.c, 4, 5, 6, 7);
  else if (base === 2) { circle(s.c, 2, 5); circle(s.c, 3, 6); circle(s.e, 0, 1); }
  else { circle(s.c, 0, 5); circle(s.c, 3, 4); circle(s.e, 0, 2); }
}
const TOKEN_DEF: Record<string, { base: number; pow: number }> = {
  U: { base: 0, pow: 1 }, U2: { base: 0, pow: 2 }, "U'": { base: 0, pow: 3 },
  D: { base: 1, pow: 1 }, D2: { base: 1, pow: 2 }, "D'": { base: 1, pow: 3 },
  R2: { base: 2, pow: 1 }, F2: { base: 3, pow: 1 },
};
function applyToken(s: State, tok: string): void {
  const d = TOKEN_DEF[tok];
  for (let k = 0; k < d.pow; k++) applyBase(s, d.base);
}
function applySeq(seq: string[]): State {
  const s = solved();
  for (const tok of seq) applyToken(s, tok);
  return s;
}

// Independent full BFS over the whole reachable graph → optimal distance per state.
function referenceBfs(): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(keyOf(solved()), 0);
  let frontier = [solved()];
  let d = 0;
  while (frontier.length) {
    const next: State[] = [];
    for (const s of frontier) {
      for (const tok of TOKENS) {
        const ns: State = { c: s.c.slice(), e: s.e.slice() };
        applyToken(ns, tok);
        const kk = keyOf(ns);
        if (!dist.has(kk)) { dist.set(kk, d + 1); next.push(ns); }
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

// Reference BFS over 241,920 states is built once and shared (it is the slow part).
let REF: Map<string, number> | null = null;
const ref = () => (REF ??= referenceBfs());

describe('cuboid223-solver graph', () => {
  it('reaches exactly 241,920 states with the proven god-number-14 histogram', () => {
    const { total, histogram } = cuboid223GraphStats();
    expect(total).toBe(241920);
    expect(total).toBe(40320 * 6);
    expect(histogram).toEqual([...CUBOID223_LENGTH_DISTRIBUTION]);
    expect(histogram.length - 1).toBe(CUBOID223_GODS_NUMBER);
    expect(CUBOID223_GODS_NUMBER).toBe(14);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(241920);
  });

  it('our histogram matches an independent BFS', () => {
    const dist = ref();
    const hist: number[] = [];
    for (const d of dist.values()) hist[d] = (hist[d] ?? 0) + 1;
    expect(dist.size).toBe(241920);
    expect(hist).toEqual(cuboid223GraphStats().histogram);
  });
});

describe('solveCuboid223', () => {
  it('handles solved / empty input', () => {
    expect(solveCuboid223('')).toEqual({ solution: '', length: 0 });
    expect(solveCuboid223('R2 R2')).toEqual({ solution: '', length: 0 }); // R2 twice = identity
    expect(solveCuboid223("U U'")).toEqual({ solution: '', length: 0 });
    expect(solveCuboid223('U U U U')).toEqual({ solution: '', length: 0 });
  });

  it('single-move scrambles solve in one move', () => {
    expect(solveCuboid223('R2')).toEqual({ solution: 'R2', length: 1 }); // R2 self-inverse
    expect(solveCuboid223('F2')).toEqual({ solution: 'F2', length: 1 });
    expect(solveCuboid223('U')).toEqual({ solution: "U'", length: 1 });
    expect(solveCuboid223("D'")).toEqual({ solution: 'D', length: 1 });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveCuboid223('R2 X')).toThrow();
    expect(() => solveCuboid223('R')).toThrow();   // R has no 90° on a 2×2×3
    expect(() => solveCuboid223("F'")).toThrow();   // F only turns 180°
    expect(() => solveCuboid223('F')).toThrow();
    expect(() => parseCuboid223Scramble('L2')).toThrow(); // L is not a 2×2×3 axis
    expect(() => parseCuboid223Scramble('U3')).toThrow();
  });

  it('solutions are valid and optimal across random scrambles (independent check)', () => {
    const dist = ref();
    const rnd = mulberry32(0xC0FFEE);
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 22);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      const { solution, length } = solveCuboid223(scramble);

      // optimal: reported length equals the independent optimal distance of the scrambled state
      const scrambled = applySeq(seq);
      expect(length).toBe(dist.get(keyOf(scrambled)));
      expect(length).toBeLessThanOrEqual(CUBOID223_GODS_NUMBER);

      // valid: applying the scramble then the solution (independently) returns to solved
      const afterSol = applySeq([...seq, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(afterSol)).toBe(keyOf(solved()));
    }
  });
});

describe('cuboid223Apply', () => {
  it('matches the independent reference state across random scrambles', () => {
    const rnd = mulberry32(0xBEEF);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 22);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const refState = applySeq(seq);
      const got = cuboid223Apply(seq.join(' '));
      expect(got.corners).toEqual(refState.c);
      expect(got.mids).toEqual(refState.e);
    }
  });
});

describe('cuboid223ExamplesByLength', () => {
  it('generates valid, optimal example scrambles for every depth 1..14', () => {
    const dist = ref();
    const ex = cuboid223ExamplesByLength(12);
    for (let d = 1; d <= CUBOID223_GODS_NUMBER; d++) {
      const list = ex[d];
      expect(list, `depth ${d}`).toBeTruthy();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      const seen = new Set<string>();
      for (const scr of list) {
        const toks = scr.split(' ');
        expect(toks.length).toBe(d);
        expect(() => parseCuboid223Scramble(scr)).not.toThrow();
        // optimal solve length == d (both solver and independent reference agree)
        expect(solveCuboid223(scr).length).toBe(d);
        expect(dist.get(keyOf(applySeq(toks)))).toBe(d);
        seen.add(keyOf(applySeq(toks)));
      }
      expect(seen.size).toBe(list.length); // distinct states
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = cuboid223AllScramblesByLength();
    const seen = new Set<string>();
    let total = 0;
    for (let d = 1; d <= CUBOID223_GODS_NUMBER; d++) {
      const list = all[d];
      expect(list.length, `depth ${d} count`).toBe(CUBOID223_LENGTH_DISTRIBUTION[d]);
      for (const scr of list) {
        expect(solveCuboid223(scr).length).toBe(d);
        seen.add(scr);
      }
      total += list.length;
    }
    expect(total).toBe(241919); // all 241,920 states minus the identity (solved)
    expect(seen.size).toBe(241919); // every scramble distinct
  });
});

describe('renderCuboid223ScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → every face uniform (6 faces, each its own color)', () => {
    const f = fills(renderCuboid223ScrambleSvg(''));
    expect(f.length).toBe(32); // 8 corners×3 + 4 mids×2 = 24 + 8
    // count of each color = stickers on that face: U 4, D 4, R 6, L 6, F 6, B 6.
    const counts: Record<string, number> = {};
    for (const c of f) counts[c] = (counts[c] ?? 0) + 1;
    expect(Object.keys(counts).length).toBe(6); // exactly 6 distinct colors
    const byColor = (i: number) => counts[CUBOID223_DEFAULT_COLORS[i]] ?? 0;
    expect(byColor(0)).toBe(4); // U
    expect(byColor(5)).toBe(4); // D
    expect(byColor(1)).toBe(6); // R
    expect(byColor(2)).toBe(6); // F
    expect(byColor(3)).toBe(6); // B
    expect(byColor(4)).toBe(6); // L
  });

  it('scrambles render without crashing and keep 32 cells; a turn breaks uniformity', () => {
    for (const scr of ['R2', 'U R2', 'U R2 F2 D2', "U' D R2 F2 U2"]) {
      const f = fills(renderCuboid223ScrambleSvg(scr));
      expect(f.length).toBe(32);
    }
    // a single R2 turn must change the sticker arrangement away from solved
    const solvedFills = fills(renderCuboid223ScrambleSvg(''));
    const r2Fills = fills(renderCuboid223ScrambleSvg('R2'));
    expect(r2Fills).not.toEqual(solvedFills);
    // applying R2 twice returns to solved (self-proving net consistency)
    expect(fills(renderCuboid223ScrambleSvg('R2 R2'))).toEqual(solvedFills);
  });

  // The net uses its own hand-coded sticker permutation tables (U/D/R/F PERM), independent of
  // the solver's corner/edge cycles. Cross-check that the net is a faithful group action that
  // tracks the solver: (a) the per-color count multiset is invariant under any scramble (no
  // sticker is created/lost), and (b) scramble ∘ (solver's solution) renders the solved net —
  // which ties the hand-coded PERM tables to the independently-verified solver. A subtly-wrong
  // PERM (wrong cycle direction / sticker assignment) would pass the weak checks above but fail
  // here.
  it('net is a faithful group action that tracks the solver across random scrambles', () => {
    const rnd = mulberry32(0x223C0DE);
    const solvedFills = fills(renderCuboid223ScrambleSvg(''));
    const solvedSig = (() => {
      const c: Record<string, number> = {};
      for (const f of solvedFills) c[f] = (c[f] ?? 0) + 1;
      return Object.entries(c).map(([k, v]) => `${k}:${v}`).sort().join(' ');
    })();
    for (let trial = 0; trial < 200; trial++) {
      const len = 1 + Math.floor(rnd() * 16);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      // (a) face-count multiset invariant
      const f = fills(renderCuboid223ScrambleSvg(scramble));
      expect(f.length).toBe(32);
      const c: Record<string, number> = {};
      for (const x of f) c[x] = (c[x] ?? 0) + 1;
      const sig = Object.entries(c).map(([k, v]) => `${k}:${v}`).sort().join(' ');
      expect(sig, `face counts for "${scramble}"`).toBe(solvedSig);

      // (b) scramble ∘ solver-solution renders the solved net (PERM ↔ solver consistency)
      const { solution } = solveCuboid223(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(fills(renderCuboid223ScrambleSvg(combined)), `net after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});
