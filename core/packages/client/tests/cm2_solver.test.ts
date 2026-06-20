import { describe, it, expect } from 'vitest';
import {
  solveCm2,
  cm2Apply,
  parseCm2Scramble,
  cm2GraphStats,
  cm2ExamplesByLength,
  cm2AllScramblesByLength,
  cm2AllStates,
  CM2_MOVE_NAMES,
  CM2_GODS_NUMBER,
  CM2_LENGTH_DISTRIBUTION,
  CM2_TOTAL_STATES,
  CM2_ROTATION_COUNT,
} from '@/lib/cm2-solver';
import { renderCm2ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cm2_svg';

// ── Independent geometric re-derivation (move-model fidelity anchor) ───────────
// cstimer has NO Cmetrick Mini solver/apply (megascramble.js:29 only emits random tokens), so the
// move EFFECTS can't be cross-checked against an oracle. Instead we re-build the cube rotation group
// (order 24) + the X/Y 90° generators FROM SCRATCH here, using real 3D rotation matrices —
// completely independently of the solver's internal tables — and assert the geometry reproduces the
// solver's 12 move effects move-for-move. A subtly-wrong mechanism would fail here even though the
// puzzle would still "solve" itself.
//
// Physics: 4 balls (0=TL,1=TR,2=BL,3=BR), each ∈ cube rotation group. Row move (U=top {0,1},
// D=bottom {2,3}) rolls 90° about Y; column move (R=right {1,3}, L=left {0,2}) rolls 90° about X.
// `<`/`^` = +90°, `>`/`v` = −90° (inverse), `2` = 180° (self-inverse). The rotation enumeration uses
// the SAME deterministic closure order as the solver (closure of {RX,RY,RZ} from I3), so orientation
// indices align between this reference and the solver — letting us compare state vectors directly.

type Vec3 = readonly [number, number, number];
type Mat3 = readonly [Vec3, Vec3, Vec3];
const DIRS: ReadonlyArray<Vec3> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
function dirIndex(v: Vec3): number {
  for (let i = 0; i < 6; i++) if (DIRS[i][0] === v[0] && DIRS[i][1] === v[1] && DIRS[i][2] === v[2]) return i;
  throw new Error(`bad dir ${v}`);
}
function applyMat(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}
function matMul(a: Mat3, b: Mat3): Mat3 {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r as unknown as Mat3;
}
const I3: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const RX: Mat3 = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
const RY: Mat3 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
const RZ: Mat3 = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];

const REF_MATS: Mat3[] = [];
const REF_IDX = new Map<string, number>();
{
  const key = (m: Mat3) => JSON.stringify(m);
  REF_IDX.set(key(I3), 0); REF_MATS.push(I3);
  let fr: Mat3[] = [I3];
  while (fr.length) {
    const nx: Mat3[] = [];
    for (const m of fr) for (const g of [RX, RY, RZ]) {
      const m2 = matMul(g, m);
      const k = key(m2);
      if (!REF_IDX.has(k)) { REF_IDX.set(k, REF_MATS.length); REF_MATS.push(m2); nx.push(m2); }
    }
    fr = nx;
  }
}
const refMatIdx = (m: Mat3) => REF_IDX.get(JSON.stringify(m))!;
const REF_ID = refMatIdx(I3);
// composition: MUL[g][o] = idx(G·O) (rotate orientation o by g)
const REF_MUL: number[][] = REF_MATS.map((G) => REF_MATS.map((O) => refMatIdx(matMul(G, O))));
const RY1 = refMatIdx(RY), RYinv = refMatIdx(matMul(RY, matMul(RY, RY))), RY2 = refMatIdx(matMul(RY, RY));
const RX1 = refMatIdx(RX), RXinv = refMatIdx(matMul(RX, matMul(RX, RX))), RX2 = refMatIdx(matMul(RX, RX));

// reference move table (own structure, own generators)
const REF_MOVES: Record<string, { balls: number[]; g: number }> = {
  'U<': { balls: [0, 1], g: RY1 }, 'U>': { balls: [0, 1], g: RYinv }, 'U2': { balls: [0, 1], g: RY2 },
  'D<': { balls: [2, 3], g: RY1 }, 'D>': { balls: [2, 3], g: RYinv }, 'D2': { balls: [2, 3], g: RY2 },
  'R^': { balls: [1, 3], g: RX1 }, 'Rv': { balls: [1, 3], g: RXinv }, 'R2': { balls: [1, 3], g: RX2 },
  'L^': { balls: [0, 2], g: RX1 }, 'Lv': { balls: [0, 2], g: RXinv }, 'L2': { balls: [0, 2], g: RX2 },
};
const TOKENS = Object.keys(REF_MOVES);
const REF_SOLVED: ReadonlyArray<number> = [REF_ID, REF_ID, REF_ID, REF_ID];
function refApplyTok(cur: ReadonlyArray<number>, tok: string): number[] {
  const mv = REF_MOVES[tok];
  const next = cur.slice();
  for (const b of mv.balls) next[b] = REF_MUL[mv.g][cur[b]];
  return next;
}
function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...REF_SOLVED];
  for (const tok of seq) c = refApplyTok(c, tok);
  return c;
}
const keyOf = (c: ReadonlyArray<number>) => c.join(',');

// Independent full BFS over the 12 tokens (own code path) → optimal distance per state.
let REF_DIST: Map<string, number> | null = null;
function referenceDist(): Map<string, number> {
  if (REF_DIST) return REF_DIST;
  const dist = new Map<string, number>();
  dist.set(keyOf(REF_SOLVED), 0);
  let fr: number[][] = [[...REF_SOLVED]];
  let d = 0;
  while (fr.length) {
    const nx: number[][] = [];
    for (const u of fr) {
      for (const tok of TOKENS) {
        const v = refApplyTok(u, tok);
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

describe('cm2-solver geometry', () => {
  it('rebuilds the cube rotation group (order 24) and aligns with the solver', () => {
    expect(REF_MATS.length).toBe(24);
    expect(CM2_ROTATION_COUNT).toBe(24);
  });

  it('the 12 move effects are reproduced by an independent 3D-geometry re-derivation', () => {
    // Move-model fidelity anchor: for every single token, applying it via the solver (cm2Apply on a
    // 1-token scramble) must equal the geometry's own apply — from solved AND from a battery of
    // random states. Since cstimer offers no Cmetrick Mini apply/oracle, this proves the solver's
    // move permutations are exactly what the puzzle's physical rotations produce.
    expect([...CM2_MOVE_NAMES].sort()).toEqual([...TOKENS].sort());
    const rnd = mulberry32(0xC2EE);
    for (const tok of TOKENS) {
      // from solved
      expect(cm2Apply(tok)).toEqual(refApplyTok(REF_SOLVED, tok));
      // from 30 random states (built via the reference) — solver applies same single move on top
      for (let t = 0; t < 30; t++) {
        const pre: string[] = [];
        const n = 1 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) pre.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
        const refState = refApplyTok(refApplySeq(pre), tok);
        const solverState = cm2Apply([...pre, tok].join(' '));
        expect(solverState, `move ${tok} after ${pre.join(' ')}`).toEqual(refState);
      }
    }
  });

  it('inverse pairs, self-inverse 2-moves, and order-4 row/col rotations hold', () => {
    // <,> inverse; ^,v inverse; 2 self-inverse — checked through the solver's apply.
    expect(cm2Apply('U< U>')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('U> U<')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('D< D>')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('R^ Rv')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('Rv R^')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('L^ Lv')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('U2 U2')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('D2 D2')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('R2 R2')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('L2 L2')).toEqual([...REF_SOLVED]);
    // order 4 about each axis for an affected line
    expect(cm2Apply('U< U< U< U<')).toEqual([...REF_SOLVED]);
    expect(cm2Apply('R^ R^ R^ R^')).toEqual([...REF_SOLVED]);
    // two 90° == one 180° (geometry sanity)
    expect(cm2Apply('U< U<')).toEqual(cm2Apply('U2'));
    expect(cm2Apply('R^ R^')).toEqual(cm2Apply('R2'));
  });
});

describe('cm2-solver graph', () => {
  it('reaches exactly 165,888 states (= 24^4 / 2, parity-restricted) with the proven god-10 histogram', () => {
    const { total, histogram } = cm2GraphStats();
    expect(total).toBe(165888);
    expect(total).toBe(CM2_TOTAL_STATES);
    expect(total).toBe((24 ** 4) / 2);
    expect(histogram).toEqual([...CM2_LENGTH_DISTRIBUTION]);
    expect(histogram.length - 1).toBe(CM2_GODS_NUMBER);
    expect(CM2_GODS_NUMBER).toBe(10);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(165888);
  });

  it('locks the exact measured histogram, sum and mean', () => {
    const { histogram } = cm2GraphStats();
    expect(histogram).toEqual([1, 12, 86, 524, 2577, 9564, 26964, 49648, 47712, 23644, 5156]);
    let sum = 0, tot = 0;
    histogram.forEach((n, i) => { sum += n * i; tot += n; });
    expect(tot).toBe(165888);
    expect(sum).toBe(1215256);
    expect(sum / tot).toBeCloseTo(7.32576, 4);
  });

  it('our histogram matches an independent (geometry-spec) BFS', () => {
    const dist = referenceDist();
    const hist: number[] = [];
    let total = 0;
    for (const d of dist.values()) { total++; hist[d] = (hist[d] ?? 0) + 1; }
    expect(total).toBe(165888);
    expect(hist).toEqual(cm2GraphStats().histogram);
  });
});

describe('solveCm2', () => {
  it('handles solved / empty input', () => {
    expect(solveCm2('')).toEqual({ solution: '', length: 0 });
    expect(solveCm2('U< U>')).toEqual({ solution: '', length: 0 });
    expect(solveCm2('U2 U2')).toEqual({ solution: '', length: 0 });
    expect(solveCm2('R^ R^ R^ R^')).toEqual({ solution: '', length: 0 });
  });

  it('single-move scrambles solve in one move', () => {
    expect(solveCm2('U<')).toEqual({ solution: 'U>', length: 1 });
    expect(solveCm2('U>')).toEqual({ solution: 'U<', length: 1 });
    expect(solveCm2('U2')).toEqual({ solution: 'U2', length: 1 });
    expect(solveCm2('R^')).toEqual({ solution: 'Rv', length: 1 });
    expect(solveCm2('Rv')).toEqual({ solution: 'R^', length: 1 });
    expect(solveCm2('L2')).toEqual({ solution: 'L2', length: 1 });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveCm2('U< X')).toThrow();
    expect(() => solveCm2('U')).toThrow();
    expect(() => solveCm2('R')).toThrow();
    expect(() => parseCm2Scramble('U3')).toThrow();
    expect(() => parseCm2Scramble("U<'")).toThrow();
    expect(() => parseCm2Scramble('F^')).toThrow();
    expect(() => parseCm2Scramble('M^')).toThrow();   // cm3 has M, cm2 does not
  });

  it('solutions are valid and optimal across random scrambles (independent check)', () => {
    const rnd = mulberry32(0x0C2BEEF);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 16);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      const { solution, length } = solveCm2(scramble);

      // optimal: reported length equals the independent optimal distance of the scrambled state
      const scrambled = refApplySeq(seq);
      expect(length).toBe(refDistOf(scrambled));
      expect(length).toBeLessThanOrEqual(CM2_GODS_NUMBER);

      // valid: applying scramble then solution (via the independent reference) returns to solved
      const afterSol = refApplySeq([...seq, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(afterSol)).toBe(keyOf(REF_SOLVED));
    }
  });
});

describe('cm2Apply', () => {
  it('matches the independent reference state across random sequences', () => {
    const rnd = mulberry32(0xCAFED02D);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 16);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const ref = refApplySeq(seq);
      const got = cm2Apply(seq.join(' '));
      expect(got).toEqual(ref);
    }
  });

  it('a few hundred random sequences parse + apply with 0 failures and stay reachable', () => {
    const rnd = mulberry32(0xBEE52ED);
    const dist = referenceDist();
    let fails = 0;
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 20);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scr = seq.join(' ');
      try {
        const c = cm2Apply(scr);
        if (!dist.has(keyOf(c))) fails++;
      } catch { fails++; }
    }
    expect(fails).toBe(0);
  });
});

describe('cm2ExamplesByLength', () => {
  it('generates valid, optimal example scrambles for every depth 1..10', () => {
    const ex = cm2ExamplesByLength(12);
    for (let d = 1; d <= CM2_GODS_NUMBER; d++) {
      const list = ex[d];
      expect(list, `depth ${d}`).toBeTruthy();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      const seen = new Set<string>();
      for (const scr of list) {
        const toks = scr.split(' ');
        expect(toks.length).toBe(d);
        expect(() => parseCm2Scramble(scr)).not.toThrow();
        // optimal solve length == d (solver and independent reference agree)
        expect(solveCm2(scr).length).toBe(d);
        expect(refDistOf(refApplySeq(toks))).toBe(d);
        seen.add(keyOf(refApplySeq(toks)));
      }
      expect(seen.size).toBe(list.length); // distinct states
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = cm2AllScramblesByLength();
    let total = 0;
    const seenStates = new Set<string>();
    for (let d = 1; d <= CM2_GODS_NUMBER; d++) {
      const list = all[d];
      expect(list.length, `depth ${d} count`).toBe(CM2_LENGTH_DISTRIBUTION[d]);
      total += list.length;
      for (const scr of list) seenStates.add(keyOf(refApplySeq(scr.split(' '))));
    }
    expect(total).toBe(165887); // all 165,888 states minus the identity (solved)
    expect(seenStates.size).toBe(165887); // every non-trivial state exactly once
  });

  it('cm2AllStates yields every reachable state once incl identity, matching the distribution', () => {
    const states = cm2AllStates();
    expect(states.length).toBe(165888);
    const perDepth = new Array<number>(CM2_GODS_NUMBER + 1).fill(0);
    let identity = 0;
    for (const { depth, scramble } of states) {
      perDepth[depth]++;
      if (depth === 0) { identity++; expect(scramble).toBe(''); }
    }
    expect(identity).toBe(1);
    expect(perDepth).toEqual([...CM2_LENGTH_DISTRIBUTION]);
  });
});

describe('renderCm2ScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → canonical: 4 identical balls (background + 4 balls × 4 fills)', () => {
    const svg = renderCm2ScrambleSvg('');
    const f = fills(svg);
    // 1 bg rect + 4 balls × (1 circle + 3 wedges) = 1 + 16 = 17 fills.
    expect(f.length).toBe(17);
    // drop the bg rect (first fill), split the remaining 16 into 4 balls of 4 fills each.
    const ballFills = f.slice(1);
    const ball0 = ballFills.slice(0, 4);
    for (let b = 1; b < 4; b++) {
      expect(ballFills.slice(b * 4, b * 4 + 4), `ball ${b} == ball 0 when solved`).toEqual(ball0);
    }
    // a ball shows 3 distinct sticker colors at solved (front/up/right)
    expect(new Set([ball0[0], ball0[1], ball0[2], ball0[3]]).size).toBe(3); // circle reuses front color
  });

  it('a turn breaks canonical uniformity; round-trip restores it', () => {
    const solvedFills = fills(renderCm2ScrambleSvg(''));
    expect(fills(renderCm2ScrambleSvg('U<'))).not.toEqual(solvedFills);
    expect(fills(renderCm2ScrambleSvg('U< U>'))).toEqual(solvedFills);
    expect(fills(renderCm2ScrambleSvg('R2 R2'))).toEqual(solvedFills);
  });

  it('preview tracks the solver: scramble ∘ optimal solution renders the solved puzzle', () => {
    const rnd = mulberry32(0x5F1C02E);
    const solvedFills = fills(renderCm2ScrambleSvg(''));
    for (let trial = 0; trial < 60; trial++) {
      const len = 1 + Math.floor(rnd() * 12);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');
      const { solution } = solveCm2(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(fills(renderCm2ScrambleSvg(combined)), `puzzle after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});
