import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { createRequire } from 'node:module';
import {
  solveSq2,
  sq2Apply,
  parseSq2Scramble,
  randomSq2Scramble,
  SQ2_MAX_LENGTH,
  SQ2_STATE_COUNT_STR,
} from '@/lib/sq2-solver';

// ── INDEPENDENT model (re-derived here, NOT imported from the solver) ──────────────────
// Square-2: 24 distinct wedges. state[slot] = home id; slots 0-11 top ring, 12-23 bottom ring.
// Moves (cstimer convention): top by m → top.slice(m)+top.slice(0,m); bot by m (token -m) on the bottom
// ring; slice '0' swaps top slots 6..11 with bottom slots 12..17. This is the validity oracle: a wrong
// move model in the solver would fail the round-trip even though the puzzle would still "solve itself".
const N = 24;
type St = Uint8Array<ArrayBuffer>;
const rcopy = (s: St): St => new Uint8Array(s);
function refTop(s: St, k: number): St { k = ((k % 12) + 12) % 12; if (!k) return rcopy(s); const n = rcopy(s); for (let i = 0; i < 12; i++) n[i] = s[(i + k) % 12]; return n; }
function refBot(s: St, k: number): St { k = ((k % 12) + 12) % 12; if (!k) return rcopy(s); const n = rcopy(s); for (let i = 0; i < 12; i++) n[12 + i] = s[12 + ((i + k) % 12)]; return n; }
function refSlice(s: St): St { const n = rcopy(s); for (let i = 0; i < 6; i++) { const c = n[i + 6]; n[i + 6] = n[i + 12]; n[i + 12] = c; } return n; }
function refTok(s: St, t: string): St { if (t === '0' || t === '/') return refSlice(s); const k = parseInt(t, 10); return k > 0 ? refTop(s, k) : refBot(s, -k); }
const REF_SOLVED: St = (() => { const a = new Uint8Array(N); for (let i = 0; i < N; i++) a[i] = i; return a; })();
function refApplyTokens(s: St, toks: readonly string[]): St { let x = s; for (const t of toks) x = refTok(x, t); return x; }

// scramble "(u,d)/" → atomic move tokens (independent of the solver's parser).
function refScrambleTokens(scr: string): string[] {
  const out: string[] = [];
  const re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scr)) !== null) {
    const u = parseInt(m[1], 10), d = parseInt(m[2], 10);
    if (u !== 0) out.push('' + (((u % 12) + 12) % 12));
    if (d !== 0) { const bb = ((d % 12) + 12) % 12; if (bb !== 0) out.push('' + -bb); }
    out.push('0');
  }
  if (out.length > 0 && out[out.length - 1] === '0') out.pop();
  return out;
}
// solution "(u,d)/ … (u,d)" → atomic move tokens.
function solutionTokens(sol: string): string[] {
  const out: string[] = [];
  for (const frag of sol.trim().split(/\s+/).filter(Boolean)) {
    if (frag === '/') { out.push('0'); continue; }
    const mm = /\((-?\d+),(-?\d+)\)(\/?)/.exec(frag);
    if (!mm) continue;
    const u = parseInt(mm[1], 10), d = parseInt(mm[2], 10);
    if (u !== 0) out.push('' + (((u % 12) + 12) % 12));
    if (d !== 0) { const bb = ((d % 12) + 12) % 12; if (bb !== 0) out.push('' + -bb); }
    if (mm[3] === '/') out.push('0');
  }
  return out;
}
function isSolved(s: Uint8Array): boolean { for (let i = 0; i < N; i++) if (s[i] !== i) return false; return true; }

// deterministic PRNG so the test is reproducible.
function mulberry32(seed: number): () => number {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('sq2 model algebra', () => {
  it('sq2Apply("") is the solved identity', () => {
    expect(Array.from(sq2Apply(''))).toEqual(Array.from(REF_SOLVED));
  });
  it('slice is an involution', () => {
    const once = refSlice(REF_SOLVED);
    expect(Array.from(refSlice(once))).toEqual(Array.from(REF_SOLVED));
    expect(Array.from(once)).not.toEqual(Array.from(REF_SOLVED));
  });
  it('top^12 = bottom^12 = identity', () => {
    let s = REF_SOLVED.slice(); for (let i = 0; i < 12; i++) s = refTop(s, 1); expect(Array.from(s)).toEqual(Array.from(REF_SOLVED));
    s = REF_SOLVED.slice(); for (let i = 0; i < 12; i++) s = refBot(s, 1); expect(Array.from(s)).toEqual(Array.from(REF_SOLVED));
  });
  it('the solver parser agrees with the independent parser on a real-shape scramble', () => {
    const scr = '(1,0)/ (3,-2)/ (-5,6)/ (0,4)/';
    expect(parseSq2Scramble(scr)).toEqual(refScrambleTokens(scr));
  });
  it('state count string is exposed', () => {
    expect(SQ2_STATE_COUNT_STR).toBe('76,828,484,468,736,000');
  });
});

describe('sq2 solver — validity (scramble ∘ solution = solved) on random scrambles', () => {
  it('solves 500 reproducible random scrambles back to solved, with valid notation', () => {
    const rnd = mulberry32(0xC0FFEE);
    let solved = 0;
    for (let i = 0; i < 500; i++) {
      const scr = randomSq2Scramble(10, rnd);
      const start = refApplyTokens(REF_SOLVED, refScrambleTokens(scr));
      const out = solveSq2(scr);
      const fin = refApplyTokens(start, solutionTokens(out.solution));
      expect(isSolved(fin), `scramble ${scr} → solution ${out.solution} did not solve`).toBe(true);
    }
    // (loop asserts each; count just documents coverage)
    solved = 500;
    expect(solved).toBe(500);
  });

  it('returns the empty solution for an already-solved puzzle', () => {
    const out = solveSq2('');
    expect(out.length).toBe(0);
    expect(out.solution).toBe('');
  });
});

describe('sq2 solver — bounded length (high sample)', () => {
  it('every solution length ≤ SQ2_MAX_LENGTH over 2000 random scrambles; logs mean/median/max', () => {
    const rnd = mulberry32(0x5EED42);
    const lens: number[] = [];
    let over = 0;
    for (let i = 0; i < 2000; i++) {
      const out = solveSq2(randomSq2Scramble(10, rnd));
      lens.push(out.length);
      if (out.length > SQ2_MAX_LENGTH) over++;
    }
    lens.sort((a, b) => a - b);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    // eslint-disable-next-line no-console
    console.log(`[sq2] N=2000 tuple length: mean=${mean.toFixed(1)} median=${lens[1000]} min=${lens[0]} max=${lens[lens.length - 1]} (bound ${SQ2_MAX_LENGTH})`);
    expect(over).toBe(0);
    expect(lens[lens.length - 1]).toBeLessThanOrEqual(SQ2_MAX_LENGTH);
  });
});

// ── cstimer real-engine oracle (Node vm sandbox) ────────────────────────────────────────
// Generate REAL `sq2` scrambles from cstimer's own generator and round-trip-solve them with the
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
    if (!scrMgr || !scrMgr.scramblers || !scrMgr.scramblers['sq2']) return null;
    const gen = (): string => {
      let out: unknown;
      for (let k = 0; k < 50000 && (out === undefined || out === null); k++) out = scrMgr.scramblers!['sq2']('sq2', 10);
      const txt = scrMgr.toTxt ? scrMgr.toTxt(String(out)) : String(out);
      return String(txt).trim();
    };
    return { gen };
  } catch (e) {
    console.warn('[sq2_solver.test] cstimer vm load failed — skipping cstimer-oracle assertions', e);
    return null;
  }
}

describe('sq2 solver — cstimer real-scramble oracle', () => {
  const eng = loadScrMgr();
  (eng ? it : it.skip)('round-trip-solves 200 real cstimer sq2 scrambles to solved', () => {
    if (!eng) return;
    let tuples = 0, badTuple = 0;
    for (let i = 0; i < 200; i++) {
      const scr = eng.gen();
      // sanity: every token is (u,d)/ with u,d ∈ [-5,6].
      const re = /\((-?\d+),(-?\d+)\)\//g; let m: RegExpExecArray | null;
      while ((m = re.exec(scr)) !== null) { tuples++; const u = +m[1], d = +m[2]; if (u < -5 || u > 6 || d < -5 || d > 6) badTuple++; }
      const start = refApplyTokens(REF_SOLVED, refScrambleTokens(scr));
      const out = solveSq2(scr);
      const fin = refApplyTokens(start, solutionTokens(out.solution));
      expect(isSolved(fin), `cstimer scramble ${scr} did not round-trip-solve`).toBe(true);
      expect(out.length).toBeLessThanOrEqual(SQ2_MAX_LENGTH);
    }
    expect(tuples).toBeGreaterThan(0);
    expect(badTuple).toBe(0);
  });
});
