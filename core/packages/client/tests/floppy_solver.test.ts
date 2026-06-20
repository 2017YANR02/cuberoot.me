import { describe, it, expect } from 'vitest';
import {
  solveFloppy,
  parseFloppyScramble,
  floppyGraphStats,
  floppyApply,
  floppyExamplesByLength,
  floppyAllScramblesByLength,
  FLOPPY_GODS_NUMBER,
  FLOPPY_LENGTH_DISTRIBUTION,
} from '@/lib/floppy-solver';
import { renderFloppyScrambleSvg, FLOPPY_DEFAULT_COLORS } from '@/app/[lang]/scramble/gen/_svg/floppy_svg';

// ── Independent reference model ───────────────────────────────────────────────
// Re-derived straight from the cstimer 1x3x3 spec (movePieces 2-cycle swap + per-axis flip bit),
// NOT from the solver's own apply — so round-trip / optimality checks are a genuine cross-check
// rather than a tautology.
const MOVE_PIECES = [[0, 1], [2, 3], [0, 3], [1, 2]]; // R L F B
const TOKENS = ['R', 'L', 'F', 'B'];

interface State { p: number[]; f: number[]; }
const solved = (): State => ({ p: [0, 1, 2, 3], f: [0, 0, 0, 0] });
const keyOf = (s: State) => s.p.join('') + '|' + s.f.join('');

function applyToken(s: State, tok: string): void {
  const axis = 'RLFB'.indexOf(tok);
  const [a, b] = MOVE_PIECES[axis];
  const t = s.p[a]; s.p[a] = s.p[b]; s.p[b] = t; // swap pieces
  s.f[axis] ^= 1;                                 // toggle this axis's flip bit
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
        const ns: State = { p: s.p.slice(), f: s.f.slice() };
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

describe('floppy-solver graph', () => {
  it('reaches exactly 192 states with the proven god-number-8 histogram', () => {
    const { total, histogram } = floppyGraphStats();
    expect(total).toBe(192);
    expect(total).toBe(24 * 16 / 2);
    expect(histogram).toEqual([...FLOPPY_LENGTH_DISTRIBUTION]);
    expect(histogram.length - 1).toBe(FLOPPY_GODS_NUMBER);
    expect(FLOPPY_GODS_NUMBER).toBe(8);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(192);
  });

  it('our histogram matches an independent BFS', () => {
    const dist = referenceBfs();
    const hist: number[] = [];
    for (const d of dist.values()) hist[d] = (hist[d] ?? 0) + 1;
    expect(dist.size).toBe(192);
    expect(hist).toEqual(floppyGraphStats().histogram);
  });
});

describe('solveFloppy', () => {
  it('handles solved / empty input', () => {
    expect(solveFloppy('')).toEqual({ solution: '', length: 0 });
    expect(solveFloppy('R R')).toEqual({ solution: '', length: 0 }); // 180° twice = identity
  });

  it('single-move scrambles solve in one move with the same (self-inverse) move', () => {
    expect(solveFloppy('R')).toEqual({ solution: 'R', length: 1 });
    expect(solveFloppy('L')).toEqual({ solution: 'L', length: 1 });
    expect(solveFloppy('B')).toEqual({ solution: 'B', length: 1 });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveFloppy('R X')).toThrow();
    expect(() => solveFloppy("R'")).toThrow();  // Floppy moves have no primes
    expect(() => solveFloppy('R2')).toThrow();
    expect(() => parseFloppyScramble('U')).toThrow(); // U is not a Floppy axis
  });

  it('solutions are valid and optimal across random scrambles (independent check)', () => {
    const dist = referenceBfs();
    const rnd = mulberry32(0xC0FFEE);
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      const { solution, length } = solveFloppy(scramble);

      // optimal: reported length equals the independent optimal distance of the scrambled state
      const scrambled = applySeq(seq);
      expect(length).toBe(dist.get(keyOf(scrambled)));
      expect(length).toBeLessThanOrEqual(FLOPPY_GODS_NUMBER);

      // valid: applying the scramble then the solution (independently) returns to solved
      const afterSol = applySeq([...seq, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(afterSol)).toBe(keyOf(solved()));
    }
  });
});

describe('floppyApply', () => {
  it('matches the independent reference state across random scrambles', () => {
    const rnd = mulberry32(0xBEEF);
    for (let trial = 0; trial < 200; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const ref = applySeq(seq);
      const got = floppyApply(seq.join(' '));
      expect(got.pieces).toEqual(ref.p);
      expect(got.flips).toEqual(ref.f);
    }
  });
});

describe('floppyExamplesByLength', () => {
  it('generates valid, optimal example scrambles for every depth 1..8', () => {
    const dist = referenceBfs();
    const ex = floppyExamplesByLength(12);
    for (let d = 1; d <= FLOPPY_GODS_NUMBER; d++) {
      const list = ex[d];
      expect(list, `depth ${d}`).toBeTruthy();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      const seen = new Set<string>();
      for (const scr of list) {
        const toks = scr.split(' ');
        expect(toks.length).toBe(d);
        expect(() => parseFloppyScramble(scr)).not.toThrow();
        // optimal solve length == d (both solver and independent reference agree)
        expect(solveFloppy(scr).length).toBe(d);
        expect(dist.get(keyOf(applySeq(toks)))).toBe(d);
        seen.add(keyOf(applySeq(toks)));
      }
      expect(seen.size).toBe(list.length); // distinct states
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = floppyAllScramblesByLength();
    const seen = new Set<string>();
    let total = 0;
    for (let d = 1; d <= FLOPPY_GODS_NUMBER; d++) {
      const list = all[d];
      expect(list.length, `depth ${d} count`).toBe(FLOPPY_LENGTH_DISTRIBUTION[d]);
      for (const scr of list) {
        expect(solveFloppy(scr).length).toBe(d);
        seen.add(scr);
      }
      total += list.length;
    }
    expect(total).toBe(191); // all 192 states minus the identity (solved)
    expect(seen.size).toBe(191); // every scramble distinct
  });
});

describe('renderFloppyScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → every face uniform (9 white U cells + 4 strips each one face color)', () => {
    const f = fills(renderFloppyScrambleSvg(''));
    expect(f.length).toBe(21); // 3×3 U grid + 4 strips × 3 cells
    const U = f.slice(0, 9);
    expect(new Set(U).size).toBe(1); // U face uniform
    expect(U[0]).toBe(FLOPPY_DEFAULT_COLORS[0]); // white
    // four strips: each 3 cells, uniform, a distinct non-white home color
    const stripColors = new Set<string>();
    for (let s = 0; s < 4; s++) {
      const strip = f.slice(9 + s * 3, 9 + s * 3 + 3);
      expect(new Set(strip).size, `strip ${s} uniform`).toBe(1);
      expect(strip[0]).not.toBe(FLOPPY_DEFAULT_COLORS[0]);
      stripColors.add(strip[0]);
    }
    expect(stripColors.size).toBe(4); // R F B L all distinct
  });

  it('scrambles render without crashing and keep 21 cells; a turn breaks uniformity', () => {
    for (const scr of ['R', 'L F', 'R L F B', 'R L F B R']) {
      const f = fills(renderFloppyScrambleSvg(scr));
      expect(f.length).toBe(21);
    }
    // a single R turn flips the two right corners → U face no longer all-white
    const fR = fills(renderFloppyScrambleSvg('R'));
    expect(new Set(fR.slice(0, 9)).size).toBeGreaterThan(1);
  });
});
