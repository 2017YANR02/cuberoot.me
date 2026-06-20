import { describe, it, expect } from 'vitest';
import {
  solveUfo,
  parseUfoScramble,
  ufoGraphStats,
  ufoApply,
  ufoExamplesByLength,
  ufoAllScramblesByLength,
  ufoAllStates,
  UFO_GODS_NUMBER,
  UFO_LENGTH_DISTRIBUTION,
  UFO_TOTAL_STATES,
} from '@/lib/ufo-solver';
import { renderUfoScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/ufo_svg';

// ── Independent reference model ───────────────────────────────────────────────
// Built straight from the cstimer ufo spec (megascramble.js:34 → tokens A B C U U' U2' U2 U3) using
// the verified base permutations over 48 home slots. This reference has its OWN apply path
// (refApplyPerm / refApplySeq) — it never calls the solver's ufoApply. The U powers (U2/U3/U4=U2'/
// U5=U') are RECOMPOSED here from the base U, so a wrong power in the solver would diverge. Round-trip
// and optimality assertions use this reference's apply, not the solver's.

const U: ReadonlyArray<number> = [
  8, 1, 10, 3, 12, 5, 14, 7, 16, 9, 18, 11, 20, 13, 22, 15, 24, 17, 26, 19, 28, 21, 30, 23,
  32, 25, 34, 27, 36, 29, 38, 31, 40, 33, 42, 35, 44, 37, 46, 39, 0, 41, 2, 43, 4, 45, 6, 47,
];
const A: ReadonlyArray<number> = [
  3, 2, 1, 0, 7, 6, 5, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
];
const B: ReadonlyArray<number> = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 18, 17, 16, 23, 22, 21, 20,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
];
const C: ReadonlyArray<number> = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 35, 34, 33, 32, 39, 38, 37, 36, 40, 41, 42, 43, 44, 45, 46, 47,
];

// compose: (compose(g1,g2))[i] = g1[g2[i]] (apply g2 then g1).
function compose(g1: ReadonlyArray<number>, g2: ReadonlyArray<number>): number[] {
  const r = new Array<number>(48);
  for (let i = 0; i < 48; i++) r[i] = g1[g2[i]];
  return r;
}
const U2 = compose(U, U);
const U3 = compose(U2, U);
const U4 = compose(U3, U); // U2'
const U5 = compose(U4, U); // U'

const REF_PERM: Record<string, ReadonlyArray<number>> = {
  U, "U'": U5, U2, "U2'": U4, U3, A, B, C,
};
const TOKENS = Object.keys(REF_PERM);

const SOLVED: ReadonlyArray<number> = (() => {
  const c = new Array<number>(48).fill(-1);
  for (let i = 0; i < 8; i++) c[i] = i;
  for (let i = 0; i < 8; i++) c[16 + i] = 8 + i;
  for (let i = 0; i < 8; i++) c[32 + i] = 16 + i;
  return c;
})();

// reference apply: next[g[i]] = cur[i].
function refApplyPerm(cur: ReadonlyArray<number>, g: ReadonlyArray<number>): number[] {
  const next = new Array<number>(48).fill(-1);
  for (let i = 0; i < 48; i++) next[g[i]] = cur[i];
  return next;
}
function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...SOLVED];
  for (const tok of seq) c = refApplyPerm(c, REF_PERM[tok]);
  return c;
}
const keyOf = (c: ReadonlyArray<number>) => c.join(',');

// ── Independent full BFS over the 8 tokens (own code path) → optimal distance per state ──
let REF_DIST: Map<string, number> | null = null;
function referenceDist(): Map<string, number> {
  if (REF_DIST) return REF_DIST;
  const dist = new Map<string, number>();
  dist.set(keyOf(SOLVED), 0);
  let fr: number[][] = [[...SOLVED]];
  let d = 0;
  while (fr.length) {
    const nx: number[][] = [];
    for (const u of fr) {
      for (const tok of TOKENS) {
        const v = refApplyPerm(u, REF_PERM[tok]);
        const vk = keyOf(v);
        if (!dist.has(vk)) { dist.set(vk, d + 1); nx.push(v); }
      }
    }
    fr = nx; d++;
  }
  REF_DIST = dist;
  return dist;
}
function refDistOf(c: ReadonlyArray<number>): number {
  return referenceDist().get(keyOf(c))!;
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

describe('ufo-solver graph', () => {
  it('reaches exactly 60,480 states with the proven god-number-10 histogram', () => {
    const { total, histogram } = ufoGraphStats();
    expect(total).toBe(60480);
    expect(total).toBe(UFO_TOTAL_STATES);
    expect(histogram).toEqual([...UFO_LENGTH_DISTRIBUTION]);
    expect(histogram.length - 1).toBe(UFO_GODS_NUMBER);
    expect(UFO_GODS_NUMBER).toBe(10);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(60480);
  });

  it('locks the exact measured histogram and mean', () => {
    const { histogram } = ufoGraphStats();
    expect(histogram).toEqual([1, 8, 33, 151, 577, 1924, 5733, 13778, 21715, 14241, 2319]);
    let sum = 0, tot = 0;
    histogram.forEach((n, i) => { sum += n * i; tot += n; });
    expect(tot).toBe(60480);
    expect(sum / tot).toBeCloseTo(7.7443, 4);
  });

  it('our histogram matches an independent (cstimer-spec) BFS', () => {
    const dist = referenceDist();
    const hist: number[] = [];
    let total = 0;
    for (const d of dist.values()) { total++; hist[d] = (hist[d] ?? 0) + 1; }
    expect(total).toBe(60480);
    expect(hist).toEqual(ufoGraphStats().histogram);
  });
});

describe('solveUfo', () => {
  it('handles solved / empty input', () => {
    expect(solveUfo('')).toEqual({ solution: '', length: 0 });
    expect(solveUfo('A A')).toEqual({ solution: '', length: 0 });
    expect(solveUfo("U U'")).toEqual({ solution: '', length: 0 });
    expect(solveUfo('U3 U3')).toEqual({ solution: '', length: 0 });
  });

  it('single-move scrambles solve in one move', () => {
    expect(solveUfo('A')).toEqual({ solution: 'A', length: 1 });   // self-inverse
    expect(solveUfo('U')).toEqual({ solution: "U'", length: 1 });
    expect(solveUfo("U'")).toEqual({ solution: 'U', length: 1 });
    expect(solveUfo('U2')).toEqual({ solution: "U2'", length: 1 });
    expect(solveUfo('U3')).toEqual({ solution: 'U3', length: 1 });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveUfo('A X')).toThrow();
    expect(() => solveUfo('R')).toThrow();
    expect(() => solveUfo('D')).toThrow();
    expect(() => parseUfoScramble('U4')).toThrow();
    expect(() => parseUfoScramble("U3'")).toThrow();
    expect(() => parseUfoScramble('A2')).toThrow();
  });

  it('solutions are valid and optimal across random scrambles (independent check)', () => {
    const rnd = mulberry32(0x0F0BEEF);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 16);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      const { solution, length } = solveUfo(scramble);

      // optimal: reported length equals the independent optimal distance of the scrambled state
      const scrambled = refApplySeq(seq);
      expect(length).toBe(refDistOf(scrambled));
      expect(length).toBeLessThanOrEqual(UFO_GODS_NUMBER);

      // valid: applying scramble then solution (via the independent reference) returns to solved
      const afterSol = refApplySeq([...seq, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(afterSol)).toBe(keyOf(SOLVED));
    }
  });
});

describe('ufoApply', () => {
  it('matches the independent reference state across random sequences', () => {
    const rnd = mulberry32(0xCAFED00D);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 16);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const ref = refApplySeq(seq);
      const got = ufoApply(seq.join(' '));
      expect(got).toEqual(ref);
    }
  });

  it('a few hundred random sequences parse + apply with 0 failures and stay reachable', () => {
    const rnd = mulberry32(0xBEE5EED);
    const dist = referenceDist();
    let fails = 0;
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 20);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scr = seq.join(' ');
      try {
        const c = ufoApply(scr);
        if (!dist.has(keyOf(c))) fails++;
      } catch { fails++; }
    }
    expect(fails).toBe(0);
  });
});

describe('ufoExamplesByLength', () => {
  it('generates valid, optimal example scrambles for every depth 1..10', () => {
    const ex = ufoExamplesByLength(12);
    for (let d = 1; d <= UFO_GODS_NUMBER; d++) {
      const list = ex[d];
      expect(list, `depth ${d}`).toBeTruthy();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      const seen = new Set<string>();
      for (const scr of list) {
        const toks = scr.split(' ');
        expect(toks.length).toBe(d);
        expect(() => parseUfoScramble(scr)).not.toThrow();
        // optimal solve length == d (solver and independent reference agree)
        expect(solveUfo(scr).length).toBe(d);
        expect(refDistOf(refApplySeq(toks))).toBe(d);
        seen.add(keyOf(refApplySeq(toks)));
      }
      expect(seen.size).toBe(list.length); // distinct states
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = ufoAllScramblesByLength();
    let total = 0;
    const seenStates = new Set<string>();
    for (let d = 1; d <= UFO_GODS_NUMBER; d++) {
      const list = all[d];
      expect(list.length, `depth ${d} count`).toBe(UFO_LENGTH_DISTRIBUTION[d]);
      total += list.length;
      for (const scr of list) {
        expect(solveUfo(scr).length).toBe(d);
        seenStates.add(keyOf(refApplySeq(scr.split(' '))));
      }
    }
    expect(total).toBe(60479); // all 60,480 states minus the identity (solved)
    expect(seenStates.size).toBe(60479); // every non-trivial state exactly once
  });

  it('ufoAllStates yields every reachable state once incl identity, matching the distribution', () => {
    const states = ufoAllStates();
    expect(states.length).toBe(60480);
    const perDepth = new Array<number>(UFO_GODS_NUMBER + 1).fill(0);
    let identity = 0;
    for (const { depth, scramble } of states) {
      perDepth[depth]++;
      if (depth === 0) { identity++; expect(scramble).toBe(''); }
    }
    expect(identity).toBe(1);
    expect(perDepth).toEqual([...UFO_LENGTH_DISTRIBUTION]);
  });
});

describe('renderUfoScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → canonical: disc + 3 ball families (24 octant wedges) + 3 empty gap sectors', () => {
    const svg = renderUfoScrambleSvg('');
    const f = fills(svg);
    // 1 disc backdrop + 3 occupied balls × 8 wedges (24) + 3 empty gap circles = 28 fills.
    expect(f.length).toBe(28);
    const empty = '#E6E6E6';
    const emptyCount = f.filter((c) => c === empty).length;
    expect(emptyCount).toBe(3); // exactly the 3 gap sectors are empty when solved
    // 24 distinct octant colors when solved (every piece is distinguishable)
    const wedgeFills = f.filter((c) => c !== empty && c !== '#FFFFFF');
    expect(wedgeFills.length).toBe(24);
    expect(new Set(wedgeFills).size).toBe(24);
  });

  it('a turn breaks canonical uniformity; round-trip restores it', () => {
    const solvedFills = fills(renderUfoScrambleSvg(''));
    expect(fills(renderUfoScrambleSvg('U'))).not.toEqual(solvedFills);
    expect(fills(renderUfoScrambleSvg("U U'"))).toEqual(solvedFills);
    expect(fills(renderUfoScrambleSvg('A A'))).toEqual(solvedFills);
  });

  it('net tracks the solver: scramble ∘ optimal solution renders the solved disc', () => {
    const rnd = mulberry32(0x5F1C0DE);
    const solvedFills = fills(renderUfoScrambleSvg(''));
    for (let trial = 0; trial < 60; trial++) {
      const len = 1 + Math.floor(rnd() * 12);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');
      const { solution } = solveUfo(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(fills(renderUfoScrambleSvg(combined)), `disc after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});
