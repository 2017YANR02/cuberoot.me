import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { createRequire } from 'node:module';
import {
  solveSsq1,
  ssq1Apply,
  parseSsq1Scramble,
  randomSsq1Scramble,
  SSQ1_MAX_LENGTH,
  SSQ1_STATE_COUNT_STR,
} from '@/lib/ssq1-solver';

// ── INDEPENDENT model (re-derived here, NOT imported from the solver) ──────────────────
// Super Square-1 = TWO independent Square-1 sides P0, P1. Each side = 24 thirty-degree slots
// (top 0..11, bottom 12..23). A corner occupies two adjacent slots with the same id; an edge one slot.
// A tuple (a,b,c,d)/ → P0 top by a + P0 bottom by d; P1 top by b + P1 bottom by c; then slice BOTH.
// Moves use cstimer's index math; the slice swaps slots i+6 ↔ i+12. This is the validity oracle: a
// wrong move model in the solver would fail the round-trip even though the puzzle still "solves itself".
const CORNER_SLOTS: [number, number][] = [
  [0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23],
];
const EDGE_SLOTS = [2, 5, 8, 11, 12, 15, 18, 21];
const SIDE1_OFFSET = 50;
function refSolved(off: number): number[] {
  const p = new Array<number>(24).fill(-1);
  CORNER_SLOTS.forEach((pair, ci) => { p[pair[0]] = off + ci; p[pair[1]] = off + ci; });
  EDGE_SLOTS.forEach((slot, ei) => { p[slot] = off + 100 + ei; });
  return p;
}
const REF_P0 = refSolved(0);
const REF_P1 = refSolved(SIDE1_OFFSET);
function rTop(a: number[], k: number): number[] { k = ((k % 12) + 12) % 12; if (!k) return a.slice(); const n = a.slice(); for (let i = 0; i < 12; i++) n[i] = a[(12 + i - k) % 12]; return n; }
function rBot(a: number[], k: number): number[] { k = ((k % 12) + 12) % 12; if (!k) return a.slice(); const n = a.slice(); for (let i = 0; i < 12; i++) n[12 + i] = a[12 + ((12 + i - k) % 12)]; return n; }
function rSlice(a: number[]): number[] { const n = a.slice(); for (let i = 0; i < 6; i++) { const c = n[i + 6]; n[i + 6] = n[i + 12]; n[i + 12] = c; } return n; }

interface RefState { p0: number[]; p1: number[]; }
function refSolvedState(): RefState { return { p0: REF_P0.slice(), p1: REF_P1.slice() }; }
function refApplyTurns(st: RefState, a: number, b: number, c: number, d: number): RefState {
  let p0 = st.p0, p1 = st.p1;
  if (a) p0 = rTop(p0, a);
  if (d) p0 = rBot(p0, d);
  if (b) p1 = rTop(p1, b);
  if (c) p1 = rBot(p1, c);
  return { p0, p1 };
}
function refSliceBoth(st: RefState): RefState { return { p0: rSlice(st.p0), p1: rSlice(st.p1) }; }
function refApplyTuple(st: RefState, a: number, b: number, c: number, d: number): RefState {
  return refSliceBoth(refApplyTurns(st, a, b, c, d));
}

// scramble "(a,b,c,d)/" → [a,b,c,d] tuples (independent of the solver's parser).
function refScrambleTuples(scr: string): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scr)) !== null) out.push([+m[1], +m[2], +m[3], +m[4]]);
  return out;
}
function refApplyScramble(scr: string): RefState {
  let st = refSolvedState();
  for (const [a, b, c, d] of refScrambleTuples(scr)) st = refApplyTuple(st, a, b, c, d);
  return st;
}
// solution "(a,b,c,d)/ … (a,b,c,d)" → apply to a state (the LAST fragment may have no trailing slice).
function refApplySolution(st: RefState, sol: string): RefState {
  let cur = st;
  for (const frag of sol.trim().split(/\s+/).filter(Boolean)) {
    const mm = /\((-?\d+),(-?\d+),(-?\d+),(-?\d+)\)(\/?)/.exec(frag);
    if (!mm) continue;
    cur = refApplyTurns(cur, +mm[1], +mm[2], +mm[3], +mm[4]);
    if (mm[5] === '/') cur = refSliceBoth(cur);
  }
  return cur;
}
function eq(a: number[], b: number[]): boolean { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
function isSolved(st: RefState): boolean { return eq(st.p0, REF_P0) && eq(st.p1, REF_P1); }

// deterministic PRNG so the test is reproducible.
function mulberry32(seed: number): () => number {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('ssq1 model algebra', () => {
  it('ssq1Apply("") is the solved identity (flat 48-slot array)', () => {
    expect(Array.from(ssq1Apply(''))).toEqual([...REF_P0, ...REF_P1]);
  });
  it('slice (within a tuple) is an involution per side', () => {
    const once = refSliceBoth(refSolvedState());
    expect(Array.from(refSliceBoth(once).p0)).toEqual(REF_P0);
    expect(Array.from(refSliceBoth(once).p1)).toEqual(REF_P1);
    expect(eq(once.p0, REF_P0)).toBe(false);
  });
  it('top^12 = bottom^12 = identity on a side', () => {
    let p = REF_P0.slice(); for (let i = 0; i < 12; i++) p = rTop(p, 1); expect(eq(p, REF_P0)).toBe(true);
    p = REF_P0.slice(); for (let i = 0; i < 12; i++) p = rBot(p, 1); expect(eq(p, REF_P0)).toBe(true);
  });
  it('the solver parser agrees with the independent parser on a real-shape scramble', () => {
    const scr = '(1,0,0,-1)/ (3,-2,1,0)/ (-5,6,2,3)/ (0,4,-1,0)/';
    const solver = parseSsq1Scramble(scr).map((t) => [t.a, t.b, t.c, t.d]);
    expect(solver).toEqual(refScrambleTuples(scr).map((t) => [...t]));
  });
  it('state count string is exposed', () => {
    expect(typeof SSQ1_STATE_COUNT_STR).toBe('string');
    expect(SSQ1_STATE_COUNT_STR.length).toBeGreaterThan(0);
  });
});

describe('ssq1 solver — validity (scramble ∘ solution = solved) on random scrambles', () => {
  it('solves 500 reproducible random scrambles back to solved, with valid notation', () => {
    const rnd = mulberry32(0xC0FFEE);
    for (let i = 0; i < 500; i++) {
      const scr = randomSsq1Scramble(10, rnd);
      const start = refApplyScramble(scr);
      const out = solveSsq1(scr);
      const fin = refApplySolution(start, out.solution);
      expect(isSolved(fin), `scramble ${scr} → solution ${out.solution} did not solve`).toBe(true);
    }
  });

  it('returns the empty solution for an already-solved puzzle', () => {
    const out = solveSsq1('');
    expect(out.length).toBe(0);
    expect(out.solution).toBe('');
  });
});

describe('ssq1 solver — bounded length (high sample)', () => {
  it('every solution length ≤ SSQ1_MAX_LENGTH over 2000 random scrambles; logs mean/median/max', () => {
    const rnd = mulberry32(0x5EED42);
    const lens: number[] = [];
    let over = 0;
    for (let i = 0; i < 2000; i++) {
      const out = solveSsq1(randomSsq1Scramble(10, rnd));
      lens.push(out.length);
      if (out.length > SSQ1_MAX_LENGTH) over++;
    }
    lens.sort((a, b) => a - b);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    // eslint-disable-next-line no-console
    console.log(`[ssq1] N=2000 tuple length: mean=${mean.toFixed(1)} median=${lens[1000]} min=${lens[0]} max=${lens[lens.length - 1]} (bound ${SSQ1_MAX_LENGTH}); quality bucket = valid+bounded (inverse reduction)`);
    expect(over).toBe(0);
    expect(lens[lens.length - 1]).toBeLessThanOrEqual(SSQ1_MAX_LENGTH);
  });
});

// ── cstimer real-engine oracle (Node vm sandbox) ────────────────────────────────────────
// Generate REAL `ssq1t` scrambles from cstimer's own generator and round-trip-solve them with the
// independent apply. If the cstimer files can't load, console.warn + skip ONLY this block.
function locateCstimer(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../../tools/cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'scramble/utilscramble.js'))) return c; } catch { /* ignore */ }
  }
  return null;
}
function loadScrMgr(): { gen: () => string } | null {
  const root = locateCstimer();
  if (!root) return null;
  try {
    const require = createRequire(import.meta.url);
    function WorkerGlobalScope(this: unknown) { /* shim */ }
    const sandbox: Record<string, unknown> = Object.create(null);
    sandbox.WorkerGlobalScope = WorkerGlobalScope;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.global = sandbox;
    sandbox.console = console;
    sandbox.setTimeout = setTimeout;
    sandbox.clearTimeout = clearTimeout;
    sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
    sandbox.DEBUG = false;
    sandbox.importScripts = () => {};
    sandbox.process = process;
    sandbox.require = require;
    const ctx = vm.createContext(sandbox);
    for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/utilscramble.js']) {
      vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
    }
    const scrMgr = sandbox.scrMgr as { scramblers?: Record<string, (k: string, n?: number) => unknown>; toTxt?: (s: string) => string };
    if (!scrMgr || !scrMgr.scramblers || !scrMgr.scramblers['ssq1t']) return null;
    const gen = (): string => {
      let out: unknown;
      for (let k = 0; k < 50000 && (out === undefined || out === null); k++) out = scrMgr.scramblers!['ssq1t']('ssq1t', 10);
      const txt = scrMgr.toTxt ? scrMgr.toTxt(String(out)) : String(out);
      return String(txt).trim();
    };
    return { gen };
  } catch (e) {
    console.warn('[ssq1_solver.test] cstimer vm load failed — skipping cstimer-oracle assertions', e);
    return null;
  }
}

describe('ssq1 solver — cstimer real-scramble oracle', () => {
  const eng = loadScrMgr();
  (eng ? it : it.skip)('round-trip-solves 200 real cstimer ssq1t scrambles to solved', () => {
    if (!eng) return;
    let tuples = 0, badTuple = 0;
    for (let i = 0; i < 200; i++) {
      const scr = eng.gen();
      // sanity: every token is a (a,b,c,d)/ 4-tuple.
      const re = /\((-?\d+),(-?\d+),(-?\d+),(-?\d+)\)\//g; let m: RegExpExecArray | null;
      while ((m = re.exec(scr)) !== null) { tuples++; if ([+m[1], +m[2], +m[3], +m[4]].some((v) => v < -6 || v > 6)) badTuple++; }
      const start = refApplyScramble(scr);
      const out = solveSsq1(scr);
      const fin = refApplySolution(start, out.solution);
      expect(isSolved(fin), `cstimer scramble ${scr} did not round-trip-solve`).toBe(true);
      expect(out.length).toBeLessThanOrEqual(SSQ1_MAX_LENGTH);
    }
    expect(tuples).toBeGreaterThan(0);
    expect(badTuple).toBe(0);
  });
});
