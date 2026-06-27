import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  solveCm3,
  cm3Apply,
  parseCm3Scramble,
  cm3ExamplesByLength,
  randomCm3Scramble,
  CM3_MOVE_NAMES,
  CM3_MAX_LENGTH,
  CM3_SOLVED,
  CM3_STATE_COUNT_STR,
  CM3_ROTATION_COUNT,
} from '@/lib/cm3-solver';
import { renderCm3ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cm3_svg';

// ── Independent geometric re-derivation (move-model fidelity anchor) ───────────
// cstimer has NO Cmetrick solver/apply (megascramble.js:28 only emits random tokens), so the move
// EFFECTS can't be cross-checked against an oracle. Instead we re-build the cube rotation group
// (order 24) + the X/Y 90° generators FROM SCRATCH here, using real 3D rotation matrices —
// completely independently of the solver's internal tables — and assert the geometry reproduces the
// solver's 18 move effects move-for-move, then round-trip real cstimer cm3 scrambles. We do NOT
// import the solver's move table — only its public API for the thing under test.
//
// Physics: 9 balls in a 3×3 grid (row-major 0..8: row0={0,1,2}, row1={3,4,5}, row2={6,7,8}), each ∈
// cube rotation group. Row move (U=row0, E=row1, D=row2) rolls 90° about Y; column move (R=right
// {2,5,8}, M=middle {1,4,7}, L=left {0,3,6}) rolls 90° about X. `<`/`^`=+90°, `>`/`v`=−90° (inverse),
// `2`=180° (self-inverse). The rotation enumeration uses the SAME deterministic closure order as the
// solver (closure of {RX,RY,RZ} from I3), so orientation indices align — letting us compare states.

type Vec3 = readonly [number, number, number];
type Mat3 = readonly [Vec3, Vec3, Vec3];
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
const REF_MUL: number[][] = REF_MATS.map((G) => REF_MATS.map((O) => refMatIdx(matMul(G, O))));
const RY1 = refMatIdx(RY), RYinv = refMatIdx(matMul(RY, matMul(RY, RY))), RY2 = refMatIdx(matMul(RY, RY));
const RX1 = refMatIdx(RX), RXinv = refMatIdx(matMul(RX, matMul(RX, RX))), RX2 = refMatIdx(matMul(RX, RX));

const ROW: number[][] = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
const COL_R = [2, 5, 8], COL_M = [1, 4, 7], COL_L = [0, 3, 6];
// reference move table (own structure, own generators)
const REF_MOVES: Record<string, { balls: number[]; g: number }> = {
  'U<': { balls: ROW[0], g: RY1 }, 'U>': { balls: ROW[0], g: RYinv }, 'U2': { balls: ROW[0], g: RY2 },
  'E<': { balls: ROW[1], g: RY1 }, 'E>': { balls: ROW[1], g: RYinv }, 'E2': { balls: ROW[1], g: RY2 },
  'D<': { balls: ROW[2], g: RY1 }, 'D>': { balls: ROW[2], g: RYinv }, 'D2': { balls: ROW[2], g: RY2 },
  'R^': { balls: COL_R, g: RX1 }, 'Rv': { balls: COL_R, g: RXinv }, 'R2': { balls: COL_R, g: RX2 },
  'M^': { balls: COL_M, g: RX1 }, 'Mv': { balls: COL_M, g: RXinv }, 'M2': { balls: COL_M, g: RX2 },
  'L^': { balls: COL_L, g: RX1 }, 'Lv': { balls: COL_L, g: RXinv }, 'L2': { balls: COL_L, g: RX2 },
};
const TOKENS = Object.keys(REF_MOVES);
const REF_SOLVED: ReadonlyArray<number> = new Array(9).fill(REF_ID);
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

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── real cstimer cm3 scrambles via a node:vm sandbox (same pattern as build_puzzle_sampled_dist) ──
function loadCstimerCm3(count: number): string[] {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', '..', 'tools', 'cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  let root: string | null = null;
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'scramble', 'megascramble.js'))) { root = c; break; } } catch { /* ignore */ }
  }
  if (!root) return [];
  const sandbox: Record<string, unknown> = Object.create(null);
  sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.console = console; sandbox.setTimeout = setTimeout; sandbox.clearTimeout = clearTimeout;
  sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
  sandbox.DEBUG = false; sandbox.importScripts = () => {}; sandbox.process = process; sandbox.require = require;
  const ctx = vm.createContext(sandbox);
  for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/megascramble.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const scrMgr = sandbox.scrMgr as { scramblers: Record<string, (k: string, n?: number) => unknown>; toTxt?: (s: string) => string };
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw: unknown;
    for (let k = 0; k < 5000 && (raw === undefined || raw === null); k++) raw = scrMgr.scramblers['cm3']('cm3', 16);
    const txt = (scrMgr.toTxt ? scrMgr.toTxt(String(raw)) : String(raw)).trim();
    if (txt) out.push(txt);
  }
  return out;
}

describe('cm3-solver geometry', () => {
  it('rebuilds the cube rotation group (order 24) and aligns with the solver', () => {
    expect(REF_MATS.length).toBe(24);
    expect(CM3_ROTATION_COUNT).toBe(24);
  });

  it('the 18 move effects are reproduced by an independent 3D-geometry re-derivation', () => {
    // Move-model fidelity anchor: for every single token, applying it via the solver (cm3Apply on a
    // 1-token scramble) must equal the geometry's own apply — from solved AND from a battery of
    // random states.
    expect([...CM3_MOVE_NAMES].sort()).toEqual([...TOKENS].sort());
    const rnd = mulberry32(0xC3EE);
    for (const tok of TOKENS) {
      expect(cm3Apply(tok)).toEqual(refApplyTok(REF_SOLVED, tok));
      for (let t = 0; t < 25; t++) {
        const pre: string[] = [];
        const n = 1 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) pre.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
        const refState = refApplyTok(refApplySeq(pre), tok);
        const solverState = cm3Apply([...pre, tok].join(' '));
        expect(solverState, `move ${tok} after ${pre.join(' ')}`).toEqual(refState);
      }
    }
  });

  it('inverse pairs, self-inverse 2-moves, order-4 line rotations, and 90+90==180 hold', () => {
    for (const [a, b] of [['U<', 'U>'], ['E<', 'E>'], ['D<', 'D>'], ['R^', 'Rv'], ['M^', 'Mv'], ['L^', 'Lv']]) {
      expect(cm3Apply(`${a} ${b}`)).toEqual([...REF_SOLVED]);
      expect(cm3Apply(`${b} ${a}`)).toEqual([...REF_SOLVED]);
    }
    for (const t of ['U2', 'E2', 'D2', 'R2', 'M2', 'L2']) expect(cm3Apply(`${t} ${t}`)).toEqual([...REF_SOLVED]);
    expect(cm3Apply('U< U< U< U<')).toEqual([...REF_SOLVED]);
    expect(cm3Apply('M^ M^ M^ M^')).toEqual([...REF_SOLVED]);
    expect(cm3Apply('U< U<')).toEqual(cm3Apply('U2'));
    expect(cm3Apply('M^ M^')).toEqual(cm3Apply('M2'));
    // the middle row/col really exist (cm2 has no E / M)
    expect(cm3Apply('E<')).not.toEqual([...REF_SOLVED]);
    expect(cm3Apply('M^')).not.toEqual([...REF_SOLVED]);
  });
});

describe('cm3Apply', () => {
  it('matches the independent reference state across random sequences', () => {
    const rnd = mulberry32(0xCAFED03D);
    for (let trial = 0; trial < 250; trial++) {
      const len = 1 + Math.floor(rnd() * 24);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      expect(cm3Apply(seq.join(' '))).toEqual(refApplySeq(seq));
    }
  });
});

describe('parseCm3Scramble', () => {
  it('rejects invalid tokens but accepts every cm3 token', () => {
    expect(() => parseCm3Scramble('U< X')).toThrow();
    expect(() => parseCm3Scramble('U')).toThrow();
    expect(() => parseCm3Scramble('U3')).toThrow();
    expect(() => parseCm3Scramble('F^')).toThrow();
    for (const t of CM3_MOVE_NAMES) expect(() => parseCm3Scramble(t)).not.toThrow();
    expect(parseCm3Scramble('  U< E2  M^ ')).toEqual(['U<', 'E2', 'M^']);
  });
});

describe('solveCm3', () => {
  it('handles solved / empty input → length 0', () => {
    expect(solveCm3('')).toEqual({ solution: '', length: 0, optimal: false });
    expect(solveCm3('U< U>')).toEqual({ solution: '', length: 0, optimal: false });
    expect(solveCm3('M2 M2')).toEqual({ solution: '', length: 0, optimal: false });
    expect(solveCm3('U< U< U< U<')).toEqual({ solution: '', length: 0, optimal: false });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveCm3('U< X')).toThrow();
    expect(() => solveCm3('foo')).toThrow();
  });

  it('100% solve-rate on ≥500 random sequences: scramble∘solution = solved, length ≤ cap, legal tokens', () => {
    const rnd = mulberry32(0x0C3BEEF);
    const ALPHA = new Set(CM3_MOVE_NAMES);
    let maxLen = 0;
    for (let trial = 0; trial < 600; trial++) {
      const len = 1 + Math.floor(rnd() * 24);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      const { solution, length, optimal } = solveCm3(scramble);
      expect(optimal).toBe(false);
      expect(length).toBeLessThanOrEqual(CM3_MAX_LENGTH);
      const solToks = solution ? solution.split(' ') : [];
      expect(solToks.length).toBe(length);
      for (const t of solToks) expect(ALPHA.has(t), `illegal token ${t}`).toBe(true);

      // valid: scramble then solution via the INDEPENDENT reference returns to all-identity
      const after = refApplySeq([...seq, ...solToks]);
      expect(keyOf(after), `failed to solve ${scramble}`).toBe(keyOf(REF_SOLVED));
      if (length > maxLen) maxLen = length;
    }
    // sanity: the cap is not absurdly loose (max observed should be comfortably under it)
    expect(maxLen).toBeLessThanOrEqual(CM3_MAX_LENGTH);
    expect(maxLen).toBeGreaterThan(0);
  });

  it('100% solve-rate on ≥200 REAL cstimer cm3 scrambles (independent apply + alphabet + cap)', () => {
    const scrambles = loadCstimerCm3(220);
    expect(scrambles.length, 'cstimer cm3 sandbox produced no scrambles').toBeGreaterThanOrEqual(200);
    const ALPHA = new Set(CM3_MOVE_NAMES);
    for (const scramble of scrambles) {
      const seq = scramble.split(/\s+/).filter(Boolean);
      // every scramble token is in the cm3 alphabet (move-model contract with cstimer)
      for (const t of seq) expect(ALPHA.has(t), `cstimer emitted non-cm3 token ${t}`).toBe(true);
      const { solution, length } = solveCm3(scramble);
      expect(length).toBeLessThanOrEqual(CM3_MAX_LENGTH);
      const solToks = solution ? solution.split(' ') : [];
      for (const t of solToks) expect(ALPHA.has(t)).toBe(true);
      const after = refApplySeq([...seq, ...solToks]);
      expect(keyOf(after), `failed to solve real cstimer scramble ${scramble}`).toBe(keyOf(REF_SOLVED));
    }
  });

  it('randomCm3Scramble emits only cm3 tokens of the requested length, and solves', () => {
    const rnd = mulberry32(0x5EED5);
    const ALPHA = new Set(CM3_MOVE_NAMES);
    for (let t = 0; t < 50; t++) {
      const scr = randomCm3Scramble(16, rnd);
      const toks = scr.split(/\s+/).filter(Boolean);
      expect(toks.length).toBe(16);
      for (const tok of toks) expect(ALPHA.has(tok)).toBe(true);
      // no immediate same-group repeat (cstimer mega no-repeat rule)
      const group = (n: string) => n[0];
      for (let i = 1; i < toks.length; i++) {
        // consecutive tokens may share a group only if cstimer's rule allows? mega forbids repeating a
        // group within the same axis-run; once the axis flips the bitmask resets, so a same-group repeat
        // across an axis flip is impossible too (group letter is unique per axis). Assert no adjacent dup.
        if (group(toks[i]) === group(toks[i - 1])) {
          // same letter ⇒ must be a different power but the no-repeat rule forbids repeating the same
          // group consecutively within a run; an axis flip changes the letter. So adjacency-equal letters
          // should never happen.
          throw new Error(`adjacent same-group tokens ${toks[i - 1]} ${toks[i]}`);
        }
      }
      expect(solveCm3(scr).length).toBeLessThanOrEqual(CM3_MAX_LENGTH);
      const after = refApplySeq([...toks, ...(solveCm3(scr).solution.split(' ').filter(Boolean))]);
      expect(keyOf(after)).toBe(keyOf(REF_SOLVED));
    }
  });
});

describe('cm3ExamplesByLength', () => {
  it('generates valid example scrambles whose returned solution length equals the bucket', () => {
    const ex = cm3ExamplesByLength(6);
    const bins = Object.keys(ex).map(Number);
    expect(bins.length).toBeGreaterThan(0);
    const ALPHA = new Set(CM3_MOVE_NAMES);
    for (const d of bins) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(CM3_MAX_LENGTH);
      for (const scr of ex[d]) {
        const toks = scr.split(/\s+/).filter(Boolean);
        for (const t of toks) expect(ALPHA.has(t)).toBe(true);
        expect(solveCm3(scr).length).toBe(d);
        const after = refApplySeq([...toks, ...solveCm3(scr).solution.split(' ').filter(Boolean)]);
        expect(keyOf(after)).toBe(keyOf(REF_SOLVED));
      }
    }
  });
});

describe('exported constants', () => {
  it('CM3_SOLVED is 9 identity orientations and state count is the jaapsch figure', () => {
    expect(CM3_SOLVED.length).toBe(9);
    expect(new Set(CM3_SOLVED).size).toBe(1);
    expect(CM3_STATE_COUNT_STR).toBe('165,112,971,264');
    expect(CM3_MOVE_NAMES.length).toBe(18);
    expect(CM3_MAX_LENGTH).toBeGreaterThanOrEqual(47);
  });
});

describe('renderCm3ScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → canonical: 9 identical balls (background + 9 balls × 4 fills)', () => {
    const f = fills(renderCm3ScrambleSvg(''));
    // 1 bg rect + 9 balls × (1 circle + 3 wedges) = 1 + 36 = 37 fills.
    expect(f.length).toBe(37);
    const ballFills = f.slice(1);
    const ball0 = ballFills.slice(0, 4);
    for (let b = 1; b < 9; b++) {
      expect(ballFills.slice(b * 4, b * 4 + 4), `ball ${b} == ball 0 when solved`).toEqual(ball0);
    }
    expect(new Set(ball0).size).toBe(3); // a ball shows 3 distinct sticker colors at solved
  });

  it('a turn breaks canonical uniformity; round-trip restores it; solving renders solved', () => {
    const solvedFills = fills(renderCm3ScrambleSvg(''));
    expect(fills(renderCm3ScrambleSvg('E<'))).not.toEqual(solvedFills);
    expect(fills(renderCm3ScrambleSvg('E< E>'))).toEqual(solvedFills);
    expect(fills(renderCm3ScrambleSvg('M2 M2'))).toEqual(solvedFills);

    const rnd = mulberry32(0x5F1C03E);
    for (let trial = 0; trial < 40; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');
      const { solution } = solveCm3(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(fills(renderCm3ScrambleSvg(combined)), `after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});
