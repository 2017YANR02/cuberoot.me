import { describe, it, expect } from 'vitest';
import {
  solveIvy,
  parseIvyScramble,
  classifyIvyTokens,
  ivyGraphStats,
  ivyApply,
  ivyExamplesByLength,
  ivyAllScramblesByLength,
  IVY_GODS_NUMBER,
  IVY_LENGTH_DISTRIBUTION,
} from '@/lib/ivy-solver';
import { renderIvyScrambleSvg, IVY_DEFAULT_COLORS } from '@/app/[lang]/scramble/gen/_svg/ivy_svg';

// ── Independent reference model ───────────────────────────────────────────────
// Re-derived straight from the Ivy spec (cstimer moveCenters + "letter = base twice,
// primed = base once"), NOT from the solver's own apply — so round-trip / optimality
// checks are a genuine cross-check rather than a tautology.
const MOVE_CENTERS = [[0, 3, 1], [0, 2, 4], [1, 5, 2], [3, 4, 5]];
const TOKENS = ['R', "R'", 'L', "L'", 'D', "D'", 'B', "B'"];

interface State { c: number[]; k: number[]; }
const solved = (): State => ({ c: [0, 1, 2, 3, 4, 5], k: [0, 0, 0, 0] });
const keyOf = (s: State) => s.c.join('') + s.k.join('');

function applyToken(s: State, tok: string): void {
  const axis = 'RLDB'.indexOf(tok[0]);
  const times = tok.endsWith("'") ? 1 : 2; // bare letter = base twice, primed = base once
  const [a, b, d] = MOVE_CENTERS[axis];
  for (let t = 0; t < times; t++) {
    const va = s.c[a], vb = s.c[b], vd = s.c[d];
    s.c[b] = va; s.c[d] = vb; s.c[a] = vd; // content a→b→d→a
    s.k[axis] = (s.k[axis] + 1) % 3;
  }
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
        const ns: State = { c: s.c.slice(), k: s.k.slice() };
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

describe('ivy-solver graph', () => {
  it('reaches exactly 29,160 states with the proven god-number-8 histogram', () => {
    const { total, histogram } = ivyGraphStats();
    expect(total).toBe(29160);
    expect(total).toBe(81 * 360);
    expect(histogram).toEqual([...IVY_LENGTH_DISTRIBUTION]);
    expect(histogram.length - 1).toBe(IVY_GODS_NUMBER);
    expect(IVY_GODS_NUMBER).toBe(8);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(29160);
  });

  it('our histogram matches an independent BFS', () => {
    const dist = referenceBfs();
    const hist: number[] = [];
    for (const d of dist.values()) hist[d] = (hist[d] ?? 0) + 1;
    expect(dist.size).toBe(29160);
    expect(hist).toEqual(ivyGraphStats().histogram);
  });
});

describe('solveIvy', () => {
  it('handles solved / empty input', () => {
    expect(solveIvy('')).toEqual({ solution: '', length: 0 });
    expect(solveIvy("R R'")).toEqual({ solution: '', length: 0 }); // base^2 ∘ base^1 = identity
  });

  it('single-move scrambles solve in one move with the inverse', () => {
    expect(solveIvy('R')).toEqual({ solution: "R'", length: 1 });
    expect(solveIvy("R'")).toEqual({ solution: 'R', length: 1 });
    expect(solveIvy("B'")).toEqual({ solution: 'B', length: 1 });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveIvy('R X')).toThrow();
    expect(() => solveIvy('R2')).toThrow();
    expect(() => parseIvyScramble('U')).toThrow(); // U is not an Ivy axis
  });

  it('classifyIvyTokens flags non-Ivy tokens (drives the /sim input red highlight + play gate)', () => {
    expect(classifyIvyTokens('R').every((s) => !s.bad)).toBe(true);
    // a 3x3 "F" is not an Ivy move → flagged bad (blocks playback, shown red)
    expect(classifyIvyTokens("R F R'").filter((s) => s.bad).map((s) => s.text)).toEqual(['F']);
    expect(classifyIvyTokens('U2').some((s) => s.bad)).toBe(true);
    expect(classifyIvyTokens('').every((s) => !s.bad)).toBe(true);
    // whitespace preserved and never flagged, so the highlight mirror stays aligned
    expect(classifyIvyTokens('R  L').map((s) => s.text)).toEqual(['R', '  ', 'L']);
  });

  it('solutions are valid and optimal across random scrambles (independent check)', () => {
    const dist = referenceBfs();
    const rnd = mulberry32(0xC0FFEE);
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      const { solution, length } = solveIvy(scramble);

      // optimal: reported length equals the independent optimal distance of the scrambled state
      const scrambled = applySeq(seq);
      expect(length).toBe(dist.get(keyOf(scrambled)));
      expect(length).toBeLessThanOrEqual(IVY_GODS_NUMBER);

      // valid: applying the scramble then the solution (independently) returns to solved
      const afterSol = applySeq([...seq, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(afterSol)).toBe(keyOf(solved()));
    }
  });
});

describe('ivyApply', () => {
  it('matches the independent reference state across random scrambles', () => {
    const rnd = mulberry32(0xBEEF);
    for (let trial = 0; trial < 200; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const ref = applySeq(seq);
      const got = ivyApply(seq.join(' '));
      expect(got.centers).toEqual(ref.c);
      expect(got.corners).toEqual(ref.k);
    }
  });
});

describe('ivyExamplesByLength', () => {
  it('generates valid, optimal example scrambles for every depth 1..8', () => {
    const dist = referenceBfs();
    const ex = ivyExamplesByLength(12);
    for (let d = 1; d <= IVY_GODS_NUMBER; d++) {
      const list = ex[d];
      expect(list, `depth ${d}`).toBeTruthy();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      const seen = new Set<string>();
      for (const scr of list) {
        // tokens parse, scramble has exactly d moves
        const toks = scr.split(' ');
        expect(toks.length).toBe(d);
        expect(() => parseIvyScramble(scr)).not.toThrow();
        // optimal solve length == d (both solver and independent reference agree)
        expect(solveIvy(scr).length).toBe(d);
        expect(dist.get(keyOf(applySeq(toks)))).toBe(d);
        seen.add(keyOf(applySeq(toks)));
      }
      expect(seen.size).toBe(list.length); // distinct states
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = ivyAllScramblesByLength();
    const seen = new Set<string>();
    let total = 0;
    for (let d = 1; d <= IVY_GODS_NUMBER; d++) {
      const list = all[d];
      expect(list.length, `depth ${d} count`).toBe(IVY_LENGTH_DISTRIBUTION[d]);
      for (const scr of list) {
        expect(solveIvy(scr).length).toBe(d);
        seen.add(scr);
      }
      total += list.length;
    }
    expect(total).toBe(29159); // all 29,160 states minus the identity (solved)
    expect(seen.size).toBe(29159); // every scramble distinct
  });
});

describe('renderIvyScrambleSvg', () => {
  const FRAME = '#1c1c1c';
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → 6 uniform faces (center lens + 2 petals share the home color), one color per face', () => {
    const f = fills(renderIvyScrambleSvg(''));
    expect(f.length).toBe(18); // 6 faces × (center lens + 2 petals); cut lines are strokes, not fills
    const faceColors = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const face = f.slice(i * 3, i * 3 + 3); // [petal, petal, lens] in FACES order
      // when solved, the 2 petal colors equal the center color → face looks solid
      expect(new Set(face).size).toBe(1);
      faceColors.add(face[0]);
    }
    // each face is a distinct home color → color mapping is a bijection over the 6 colors
    expect(faceColors.size).toBe(6);
    expect([...faceColors].sort()).toEqual([...IVY_DEFAULT_COLORS].sort());
  });

  it('scrambles render without crashing; every region gets a real face color (no frame fallback)', () => {
    for (const scr of ['R', "L' D", 'R L D B', "R' L' D' B'"]) {
      const f = fills(renderIvyScrambleSvg(scr));
      expect(f.length).toBe(18); // 6 faces × 3 regions
      expect(f.some((c) => c === FRAME)).toBe(false); // FRAME is only a fallback; never triggers for valid states
      expect(f.every((c) => (IVY_DEFAULT_COLORS as string[]).includes(c))).toBe(true);
    }
  });
});
