import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { createRequire } from 'node:module';
import {
  solveBsq,
  bsqApply,
  parseBsqScramble,
  randomBsqScramble,
  BSQ_MAX_LENGTH,
  BSQ_STATE_COUNT_STR,
} from '@/lib/bsq-solver';

// ── INDEPENDENT model (re-derived here, NOT imported from the solver) ──────────────────
// Bandaged Square-1 = ONE Square-1 whose move set is < / , (1,0) >: the TOP layer may turn `(x,0)`, the
// `/` slice may fire, the BOTTOM layer is NEVER turned directly. 24 thirty-degree slots (top 0..11 CW,
// bottom 12..23 CW); a corner spans two adjacent slots with the same id, an edge one slot. This is the
// validity oracle — a wrong move model (or wrong embedded generators) in the solver would fail the
// round-trip even though the puzzle still "solves itself". (The `/` slice DOES move pieces to/from the
// bottom, so bottom slots are not frozen — modelled with the full 24-slot board.)
const CORNER_SLOTS: [number, number][] = [
  [0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23],
];
const EDGE_SLOTS = [2, 5, 8, 11, 12, 15, 18, 21];
function refSolved(): number[] {
  const p = new Array<number>(24).fill(-1);
  CORNER_SLOTS.forEach((pair, ci) => { p[pair[0]] = ci; p[pair[1]] = ci; });
  EDGE_SLOTS.forEach((slot, ei) => { p[slot] = 100 + ei; });
  return p;
}
const REF = refSolved();
// cstimer top-turn convention: new[i] = old[(12+i-k)%12] for i<12 (bottom unchanged).
function rTop(a: number[], k: number): number[] {
  k = ((k % 12) + 12) % 12; if (!k) return a.slice();
  const n = a.slice(); for (let i = 0; i < 12; i++) n[i] = a[(12 + i - k) % 12]; return n;
}
// NOTE: there is NO rBot here — bsq never turns the bottom directly (y always 0). The slice still touches
// the bottom slots, so we model the full 24-slot board with rSlice.
function rSlice(a: number[]): number[] { const n = a.slice(); for (let i = 0; i < 6; i++) { const c = n[i + 6]; n[i + 6] = n[i + 12]; n[i + 12] = c; } return n; }

// scramble "(x,0)/ …" → moves (independent of the solver's parser). Bottom component ignored (always 0).
type RefMove = { kind: 'turn'; top: number } | { kind: 'slice' };
function refParse(scr: string): RefMove[] {
  const out: RefMove[] = [];
  const re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scr)) !== null) {
    if (m[0] === '/') out.push({ kind: 'slice' });
    else out.push({ kind: 'turn', top: +m[1] });
  }
  return out;
}
function refApplyScramble(scr: string): number[] {
  let st = REF.slice();
  for (const mv of refParse(scr)) st = mv.kind === 'slice' ? rSlice(st) : (mv.top ? rTop(st, mv.top) : st);
  return st;
}

/** Apply a solution to a state — and ASSERT every move is legal `</,(1,0)>`: a `/` slice, or a `(x,0)`
 *  top-turn whose bottom component is 0. Returns the state; throws on an illegal token (the crux of bsq).
 *  The solution string is "(x,0) / …" fragments joined by spaces; the last fragment may have no slice. */
function refApplySolution(st: number[], sol: string): { state: number[]; illegal: number } {
  let cur = st;
  let illegal = 0;
  for (const frag of sol.trim().split(/\s+/).filter(Boolean)) {
    if (frag === '/') { cur = rSlice(cur); continue; }
    const mm = /^\((-?\d+),(-?\d+)\)(\/?)$/.exec(frag);
    if (!mm) { illegal++; continue; }
    const top = +mm[1], bot = +mm[2];
    if (bot !== 0) illegal++;             // ILLEGAL on the bandaged puzzle (bottom turned)
    if (top) cur = rTop(cur, top);
    if (mm[3] === '/') cur = rSlice(cur);
  }
  return { state: cur, illegal };
}
function eq(a: number[], b: number[]): boolean { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
function isSolved(st: number[]): boolean { return eq(st, REF); }

// every solution token must be a `/` slice or a `(x,0)` turn (bottom 0) — the legal `</,(1,0)>` set.
function solutionTokensAllLegal(sol: string): boolean {
  for (const frag of sol.trim().split(/\s+/).filter(Boolean)) {
    if (frag === '/') continue;
    const mm = /^\((-?\d+),(-?\d+)\)(\/?)$/.exec(frag);
    if (!mm) return false;
    if (+mm[2] !== 0) return false; // bottom component must be 0
  }
  return true;
}

// deterministic PRNG so the test is reproducible.
function mulberry32(seed: number): () => number {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('bsq model algebra', () => {
  it('bsqApply("") is the solved identity (24-slot piece array)', () => {
    expect(Array.from(bsqApply(''))).toEqual(REF);
  });
  it('slice is an involution; bsqApply matches the independent applier on a real-shape scramble', () => {
    const once = rSlice(REF.slice());
    expect(rSlice(once)).toEqual(REF);
    expect(eq(once, REF)).toBe(false);
    const scr = '(1,0) / (3,0) / (-5,0) / (0,0) / (6,0) /';
    expect(Array.from(bsqApply(scr))).toEqual(refApplyScramble(scr));
  });
  it('top^12 = identity; the solver parser agrees with the independent parser', () => {
    let p = REF.slice(); for (let i = 0; i < 12; i++) p = rTop(p, 1); expect(eq(p, REF)).toBe(true);
    const scr = '(1,0) / (3,0) / (-5,0) / (6,0) /';
    const solver = parseBsqScramble(scr).filter((m) => m.kind === 'turn').map((m) => (m as { top: number }).top);
    const ref = refParse(scr).filter((m) => m.kind === 'turn').map((m) => (m as { top: number }).top);
    expect(solver).toEqual(ref);
  });
  it('state count string is exposed (huge subgroup → a string, §0.0 #4)', () => {
    expect(typeof BSQ_STATE_COUNT_STR).toBe('string');
    expect(BSQ_STATE_COUNT_STR.length).toBeGreaterThan(0);
  });
});

describe('bsq solver — validity (scramble ∘ solution = solved) on random scrambles', () => {
  it('solves 500 reproducible random scrambles back to solved, with ONLY legal </,(1,0)> moves', () => {
    const rnd = mulberry32(0xC0FFEE);
    for (let i = 0; i < 500; i++) {
      const scr = randomBsqScramble(10, rnd);
      const start = refApplyScramble(scr);
      const out = solveBsq(scr);
      const { state, illegal } = refApplySolution(start, out.solution);
      expect(illegal, `scramble ${scr} → solution ${out.solution} has illegal (bottom-turn) tokens`).toBe(0);
      expect(isSolved(state), `scramble ${scr} → solution ${out.solution} did not solve`).toBe(true);
      expect(out.length).toBeLessThanOrEqual(BSQ_MAX_LENGTH);
    }
  });

  it('returns the empty solution for an already-solved puzzle', () => {
    const out = solveBsq('');
    expect(out.length).toBe(0);
    expect(out.solution).toBe('');
  });
});

describe('bsq solver — every solution move is in the legal </,(1,0)> set (the crux of the puzzle)', () => {
  it('over 300 random scrambles, no solution ever emits a (x,b) turn with b≠0', () => {
    const rnd = mulberry32(0xBADBEEF);
    let bad = 0;
    for (let i = 0; i < 300; i++) {
      const out = solveBsq(randomBsqScramble(10, rnd));
      if (!solutionTokensAllLegal(out.solution)) bad++;
    }
    expect(bad).toBe(0);
  });
});

describe('bsq solver — bounded length + non-degenerate spread (high sample)', () => {
  it('every solution length ≤ BSQ_MAX_LENGTH over 2000 random scrambles; logs mean/median/max', () => {
    const rnd = mulberry32(0x5EED42);
    const lens: number[] = [];
    let over = 0;
    for (let i = 0; i < 2000; i++) {
      const out = solveBsq(randomBsqScramble(10, rnd));
      lens.push(out.length);
      if (out.length > BSQ_MAX_LENGTH) over++;
    }
    lens.sort((a, b) => a - b);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    // eslint-disable-next-line no-console
    console.log(`[bsq] N=2000 fragment length: mean=${mean.toFixed(1)} median=${lens[1000]} min=${lens[0]} max=${lens[lens.length - 1]} (bound ${BSQ_MAX_LENGTH}); quality bucket = valid+bounded (three-stage shape+corner+edge reduction)`);
    // NON-degenerate spread (guards against the inverse-of-scramble cheat that produced a single-bar dist).
    // NOTE: the length histogram is genuinely MULTI-MODAL — that is REAL structure of the restricted bsq
    // move set (corner-perm group = 120-perm near-subgroup ≤6 frags + 600-perm far-coset ≥9 frags; edge
    // 3-cycles floor at 8 frags), NOT a solver artifact — do not "smooth" it (see bsq-solver.ts header
    // "DISTRIBUTION SHAPE"). The search minimizes fragment count (the reported metric); mean ≈ 16, max ≈ 60.
    expect(new Set(lens).size).toBeGreaterThan(5);
    expect(over).toBe(0);
    expect(lens[lens.length - 1]).toBeLessThanOrEqual(BSQ_MAX_LENGTH);
  });
});

// ── cstimer real-engine oracle (Node vm sandbox) ────────────────────────────────────────
// Generate REAL `bsq` scrambles from cstimer's own generator and round-trip-solve them with the
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
    if (!scrMgr || !scrMgr.scramblers || !scrMgr.scramblers['bsq']) return null;
    const gen = (): string => {
      let out: unknown;
      for (let k = 0; k < 50000 && (out === undefined || out === null); k++) out = scrMgr.scramblers!['bsq']('bsq', 10);
      const txt = scrMgr.toTxt ? scrMgr.toTxt(String(out)) : String(out);
      return String(txt).trim();
    };
    return { gen };
  } catch (e) {
    console.warn('[bsq_solver.test] cstimer vm load failed — skipping cstimer-oracle assertions', e);
    return null;
  }
}

describe('bsq solver — cstimer real-scramble oracle', () => {
  const eng = loadScrMgr();
  (eng ? it : it.skip)('round-trip-solves 200 real cstimer bsq scrambles with only legal moves', () => {
    if (!eng) return;
    let turns = 0, badTuple = 0;
    for (let i = 0; i < 200; i++) {
      const scr = eng.gen();
      // sanity: every twist token is `(x,0)` (bottom 0); slices are `/`.
      const re = /\((-?\d+),(-?\d+)\)/g; let m: RegExpExecArray | null;
      while ((m = re.exec(scr)) !== null) { turns++; if (+m[2] !== 0 || +m[1] < -6 || +m[1] > 6) badTuple++; }
      const start = refApplyScramble(scr);
      const out = solveBsq(scr);
      const { state, illegal } = refApplySolution(start, out.solution);
      expect(illegal, `cstimer scramble ${scr} produced illegal solution tokens`).toBe(0);
      expect(isSolved(state), `cstimer scramble ${scr} did not round-trip-solve`).toBe(true);
      expect(out.length).toBeLessThanOrEqual(BSQ_MAX_LENGTH);
    }
    expect(turns).toBeGreaterThan(0);
    expect(badTuple).toBe(0); // cstimer bsq only ever emits (x,0) twists
  });
});
