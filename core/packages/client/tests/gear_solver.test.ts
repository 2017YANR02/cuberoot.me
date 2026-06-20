import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  solveGear,
  gearApply,
  parseGearScramble,
  gearGraphStats,
  gearExamplesByLength,
  gearAllScramblesByLength,
  gearAllStates,
  GEAR_MOVE_NAMES,
  GEAR_GODS_NUMBER,
  GEAR_LENGTH_DISTRIBUTION,
  GEAR_TOTAL_STATES,
} from '@/lib/gear-solver';
import { renderGearScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/gear_svg';

// ── Independent reference: rebuild the gear move model FROM cstimer's gearcube.js semantics ───
// We re-derive cmv/emv (acycle / setNPerm / getNPerm / cornerMove / edgeMove) and the token model
// here — NOT importing the solver's internals — so a subtly-wrong mechanism would fail this anchor
// even though the puzzle would still "solve" itself. State = [corner(0..23), e0,e1,e2 (0..71)].
function acycle(arr: number[], perm: ReadonlyArray<number>): void {
  const plen = perm.length, tmp: number[] = [];
  for (let i = 0; i < plen; i++) tmp[i] = arr[perm[i]];
  for (let i = 0; i < plen; i++) { const j = (i + 1) % plen; arr[perm[j]] = tmp[i]; }
}
function fact(n: number): number { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function setNPerm(arr: number[], idx: number, n: number): number[] {
  let vall = 0x76543210, valh = 0xfedcba98;
  for (let i = 0; i < n - 1; i++) {
    const p = fact(n - 1 - i); let v = Math.floor(idx / p); idx %= p; v <<= 2;
    if (v >= 32) { v -= 32; arr[i] = (valh >> v) & 0xf; const m = (1 << v) - 1; valh = (valh & m) + ((valh >> 4) & ~m); }
    else { arr[i] = (vall >> v) & 0xf; const m = (1 << v) - 1; vall = (vall & m) + ((vall >>> 4) & ~m) + (valh << 28); valh >>= 4; }
  }
  arr[n - 1] = vall & 0xf; return arr;
}
function getNPerm(arr: ReadonlyArray<number>, n: number): number {
  let idx = 0, vall = 0x76543210, valh = 0xfedcba98;
  for (let i = 0; i < n - 1; i++) {
    const v = arr[i] << 2; idx *= n - i;
    if (v >= 32) { idx += (valh >> (v - 32)) & 0xf; valh -= 0x11111110 << (v - 32); }
    else { idx += (vall >> v) & 0xf; valh -= 0x11111111; vall -= 0x11111110 << v; }
  }
  return idx;
}
const REF_MOVE_EDGES: ReadonlyArray<ReadonlyArray<number>> = [[0, 3, 2, 1], [0, 1], [0, 3]];
function refCornerMove(arr: number[], m: number): void { acycle(arr, [0, m + 1]); }
function refEdgeMove(idx: number, m: number): number {
  const arr = setNPerm([], Math.floor(idx / 3), 4);
  acycle(arr, REF_MOVE_EDGES[m]);
  return getNPerm(arr, 4) * 3 + ((idx % 3) + (m === 0 ? 1 : 0)) % 3;
}
const REF_CMV: number[][] = [[], [], []];
for (let m = 0; m < 3; m++) for (let s = 0; s < 24; s++) { const a = setNPerm([], s, 4); refCornerMove(a, m); REF_CMV[m][s] = getNPerm(a, 4); }
const REF_EMV: number[][] = [[], [], []];
for (let m = 0; m < 3; m++) for (let s = 0; s < 72; s++) REF_EMV[m][s] = refEdgeMove(s, m);
function refBaseStep(state: ReadonlyArray<number>, m: number): number[] {
  const ns = state.slice();
  ns[0] = REF_CMV[m][ns[0]];
  for (let i = 1; i < 4; i++) ns[i] = REF_EMV[(m + i - 1) % 3][ns[i]];
  return ns;
}
const REF_SOLVED: ReadonlyArray<number> = [0, 0, 0, 0];
const keyOf = (c: ReadonlyArray<number>) => c[0] * 373248 + c[1] * 5184 + c[2] * 72 + c[3];

// token model (33 tokens = 3 axes × 11 powers). Suffix index a → steps (a+1).
const SUFFIX: ReadonlyArray<string> = ["'", "2'", "3'", "4'", "5'", "6", "5", "4", "3", "2", ""];
const AXIS: Record<string, number> = { U: 0, R: 1, F: 2 };
const TOKENS: string[] = [];
for (const ax of ['U', 'R', 'F']) for (const suf of SUFFIX) TOKENS.push(ax + suf);
function refTokenToMA(tok: string): [number, number] {
  const m = AXIS[tok[0]];
  if (m === undefined) throw new Error('bad axis ' + tok);
  const a = SUFFIX.indexOf(tok.slice(1));
  if (a < 0) throw new Error('bad suffix ' + tok);
  return [m, a + 1];
}
function refApplyTok(cur: ReadonlyArray<number>, tok: string): number[] {
  const [m, steps] = refTokenToMA(tok);
  let s = cur.slice();
  for (let k = 0; k < steps; k++) s = refBaseStep(s, m);
  return s;
}
function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...REF_SOLVED];
  for (const tok of seq) c = refApplyTok(c, tok);
  return c;
}

// Independent full BFS over the 33 tokens (own code path) → optimal distance per state.
let REF_DIST: Map<number, number> | null = null;
function referenceDist(): Map<number, number> {
  if (REF_DIST) return REF_DIST;
  const dist = new Map<number, number>();
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

// ── cstimer real-engine oracle (Node vm sandbox) ────────────────────────────────
// Load cstimer's actual scramble core, generate ~200 real `gearso` scrambles, parse with OUR parser,
// apply, assert reachable + round-trip-solve to solved, and token set ⊆ the 33-token alphabet. This is
// the strongest anchor. If the files genuinely can't load, we console.warn + skip ONLY this block.
function locateCstimer(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../../tools/cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'scramble/gearcube.js'))) return c; } catch { /* ignore */ }
  }
  return null;
}

interface CstimerCtx {
  sandbox: Record<string, unknown>;
  scrMgr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
let CSTIMER: CstimerCtx | null | undefined;
function loadCstimer(): CstimerCtx | null {
  if (CSTIMER !== undefined) return CSTIMER;
  const root = locateCstimer();
  if (!root) { CSTIMER = null; return null; }
  try {
    function WorkerGlobalScope(this: unknown) { /* shim */ }
    const sandbox: Record<string, unknown> = Object.create(null);
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.console = console;
    sandbox.setTimeout = setTimeout;
    sandbox.clearTimeout = clearTimeout;
    sandbox.WorkerGlobalScope = WorkerGlobalScope;
    sandbox.importScripts = () => {};
    sandbox.DEBUG = false;
    sandbox.process = process;
    sandbox.require = require;
    sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
    sandbox.$ = { noop: () => {}, extend: Object.assign };
    const ctx = vm.createContext(sandbox);
    const files = ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/gearcube.js'];
    for (const f of files) {
      const code = fs.readFileSync(path.join(root, f), 'utf8');
      vm.runInContext(code, ctx, { filename: f });
    }
    const scrMgr = sandbox.scrMgr as CstimerCtx['scrMgr'];
    if (!scrMgr) { CSTIMER = null; return null; }
    CSTIMER = { sandbox, scrMgr };
    return CSTIMER;
  } catch (e) {
    console.warn('[gear_solver.test] cstimer vm load failed — skipping cstimer-oracle assertions', e);
    CSTIMER = null;
    return null;
  }
}

describe('gear-solver reference (independent BFS from gearcube.js semantics)', () => {
  it('exposes the exact 33-token alphabet', () => {
    expect([...GEAR_MOVE_NAMES].sort()).toEqual([...TOKENS].sort());
    expect(GEAR_MOVE_NAMES.length).toBe(33);
    expect(new Set(GEAR_MOVE_NAMES).size).toBe(33);
  });

  it('a single axis has period 12 (12 base steps = identity)', () => {
    for (let m = 0; m < 3; m++) {
      let st: number[] = [...REF_SOLVED];
      let order = 0;
      do { st = refBaseStep(st, m); order++; } while (keyOf(st) !== keyOf(REF_SOLVED) && order < 100);
      expect(order, `axis ${m} period`).toBe(12);
    }
  });

  it('the 33 move effects are reproduced move-for-move by the solver apply', () => {
    const rnd = mulberry32(0x6EA20D);
    for (const tok of TOKENS) {
      expect(gearApply(tok)).toEqual(refApplyTok(REF_SOLVED, tok));
      for (let t = 0; t < 20; t++) {
        const pre: string[] = [];
        const n = 1 + Math.floor(rnd() * 6);
        for (let i = 0; i < n; i++) pre.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
        const refState = refApplyTok(refApplySeq(pre), tok);
        const solverState = gearApply([...pre, tok].join(' '));
        expect(solverState, `move ${tok} after ${pre.join(' ')}`).toEqual(refState);
      }
    }
  });

  it('reaches exactly 41,472 states with god number 6 and the locked histogram', () => {
    const dist = referenceDist();
    const hist: number[] = [];
    let total = 0, sum = 0;
    for (const d of dist.values()) { total++; hist[d] = (hist[d] ?? 0) + 1; sum += d; }
    expect(total).toBe(41472);
    expect(total).toBe(GEAR_TOTAL_STATES);
    expect(hist.length - 1).toBe(6);
    expect(hist.length - 1).toBe(GEAR_GODS_NUMBER);
    expect(hist).toEqual([1, 33, 579, 5921, 18072, 13977, 2889]);
    expect(hist).toEqual([...GEAR_LENGTH_DISTRIBUTION]);
    expect(hist.reduce((a, b) => a + b, 0)).toBe(41472);
    expect(sum / total).toBeCloseTo(4.30317, 4);
  });
});

describe('gear-solver graph (solver internals)', () => {
  it('solver graph matches the independent BFS exactly', () => {
    const { total, histogram } = gearGraphStats();
    expect(total).toBe(41472);
    expect(total).toBe(GEAR_TOTAL_STATES);
    expect(histogram).toEqual([...GEAR_LENGTH_DISTRIBUTION]);
    expect(histogram.length - 1).toBe(GEAR_GODS_NUMBER);
  });

  it('locks the exact measured histogram, sum and mean', () => {
    const { histogram } = gearGraphStats();
    expect(histogram).toEqual([1, 33, 579, 5921, 18072, 13977, 2889]);
    let sum = 0, tot = 0;
    histogram.forEach((n, i) => { sum += n * i; tot += n; });
    expect(tot).toBe(41472);
    expect(sum / tot).toBeCloseTo(4.30317, 4);
  });
});

describe('solveGear', () => {
  it('handles solved / empty input', () => {
    expect(solveGear('')).toEqual({ solution: '', length: 0 });
    expect(solveGear("U' U")).toEqual({ solution: '', length: 0 });
  });

  it('single-move scrambles solve in one move with the inverse token', () => {
    // U' = 1 step → inverse = 11 steps = plain U.
    expect(solveGear("U'")).toEqual({ solution: 'U', length: 1 });
    expect(solveGear('U')).toEqual({ solution: "U'", length: 1 });
    expect(solveGear("R'")).toEqual({ solution: 'R', length: 1 });
    expect(solveGear('F6').length).toBe(1); // F6 = 6 steps, inverse = 6 steps = F6
  });

  it('rejects invalid tokens', () => {
    expect(() => solveGear('U7')).toThrow();
    expect(() => solveGear("U'2")).toThrow();
    expect(() => solveGear('B')).toThrow();   // gear has no B axis
    expect(() => parseGearScramble('D')).toThrow();
    expect(() => parseGearScramble("U''")).toThrow();
    expect(() => parseGearScramble('R8')).toThrow();
  });

  it('solutions are valid and optimal across 400 random scrambles (independent check)', () => {
    const rnd = mulberry32(0x6EA23F00);
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 16);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');

      const { solution, length } = solveGear(scramble);

      const scrambled = refApplySeq(seq);
      expect(length).toBe(refDistOf(scrambled));
      expect(length).toBeLessThanOrEqual(GEAR_GODS_NUMBER);

      const afterSol = refApplySeq([...seq, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(afterSol)).toBe(keyOf(REF_SOLVED));
    }
  });
});

describe('gearApply', () => {
  it('matches the independent reference state across random sequences', () => {
    const rnd = mulberry32(0x6EAFD02D);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 16);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const ref = refApplySeq(seq);
      const got = gearApply(seq.join(' '));
      expect(got).toEqual(ref);
    }
  });

  it('a few hundred random sequences parse + apply with 0 failures and stay reachable', () => {
    const rnd = mulberry32(0x6EE52ED);
    const dist = referenceDist();
    let fails = 0;
    for (let trial = 0; trial < 400; trial++) {
      const len = 1 + Math.floor(rnd() * 20);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scr = seq.join(' ');
      try {
        const c = gearApply(scr);
        if (!dist.has(keyOf(c))) fails++;
      } catch { fails++; }
    }
    expect(fails).toBe(0);
  });
});

describe('gearExamplesByLength', () => {
  it('generates valid, optimal example scrambles for every depth 1..6', () => {
    const ex = gearExamplesByLength(12);
    for (let d = 1; d <= GEAR_GODS_NUMBER; d++) {
      const list = ex[d];
      expect(list, `depth ${d}`).toBeTruthy();
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      const seen = new Set<number>();
      for (const scr of list) {
        const toks = scr.split(' ');
        expect(toks.length).toBe(d);
        expect(() => parseGearScramble(scr)).not.toThrow();
        expect(solveGear(scr).length).toBe(d);
        expect(refDistOf(refApplySeq(toks))).toBe(d);
        seen.add(keyOf(refApplySeq(toks)));
      }
      expect(seen.size).toBe(list.length); // distinct states
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = gearAllScramblesByLength();
    let total = 0;
    const seenStates = new Set<number>();
    for (let d = 1; d <= GEAR_GODS_NUMBER; d++) {
      const list = all[d];
      expect(list.length, `depth ${d} count`).toBe(GEAR_LENGTH_DISTRIBUTION[d]);
      total += list.length;
      for (const scr of list) seenStates.add(keyOf(refApplySeq(scr.split(' '))));
    }
    expect(total).toBe(41471); // all 41,472 states minus the identity (solved)
    expect(seenStates.size).toBe(41471);
  });

  it('gearAllStates yields every reachable state once incl identity, matching the distribution', () => {
    const states = gearAllStates();
    expect(states.length).toBe(41472);
    const perDepth = new Array<number>(GEAR_GODS_NUMBER + 1).fill(0);
    let identity = 0;
    // first row = depth 0 / identity / empty scramble
    expect(states[0].depth).toBe(0);
    expect(states[0].scramble).toBe('');
    for (const { depth, scramble } of states) {
      perDepth[depth]++;
      if (depth === 0) { identity++; expect(scramble).toBe(''); }
    }
    expect(identity).toBe(1);
    expect(perDepth).toEqual([...GEAR_LENGTH_DISTRIBUTION]);
  });
});

describe('renderGearScrambleSvg', () => {
  // all explicit fills (exclude fill="none").
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]).filter((f) => f !== 'none');

  it('solved → a fixed canonical render (self-proving)', () => {
    const svg = renderGearScrambleSvg('');
    // the raw state caption must be the solved coordinates.
    expect(svg).toContain('[0, 0, 0, 0]');
    expect(fills(svg).length).toBeGreaterThan(0);
  });

  it('a turn breaks the solved render; round-trip restores it', () => {
    const solved = renderGearScrambleSvg('');
    expect(renderGearScrambleSvg('U')).not.toEqual(solved);
    expect(renderGearScrambleSvg("U' U")).toEqual(solved);
  });

  it('preview tracks the solver: scramble ∘ optimal solution renders the solved puzzle', () => {
    const rnd = mulberry32(0x6E1C02E);
    const solved = renderGearScrambleSvg('');
    for (let trial = 0; trial < 60; trial++) {
      const len = 1 + Math.floor(rnd() * 12);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(TOKENS[Math.floor(rnd() * TOKENS.length)]);
      const scramble = seq.join(' ');
      const { solution } = solveGear(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(renderGearScrambleSvg(combined), `puzzle after solving "${scramble}"`).toEqual(solved);
    }
  });
});

// ── cstimer real-engine oracle ──────────────────────────────────────────────────
describe('cstimer gear oracle (real engine via node:vm)', () => {
  it('real gearso scrambles parse + stay reachable + round-trip solve; tokens ⊆ alphabet', () => {
    const c = loadCstimer();
    if (!c) {
      console.warn('[gear_solver.test] cstimer engine unavailable — skipping oracle (independent BFS already passed)');
      return;
    }

    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['gearso'];
    if (!fn) {
      console.warn('[gear_solver.test] gearso scrambler not available — skipping real-scramble round-trip');
      return;
    }

    const dist = referenceDist();
    const alphabet = new Set(TOKENS);
    const tokSet = new Set<string>();
    let parseFails = 0, generated = 0;

    for (let i = 0; i < 200; i++) {
      let scr: string;
      try {
        scr = String(fn('gearso', 0)).trim();
      } catch {
        continue;
      }
      if (!scr) continue;
      generated++;
      let toks: string[];
      try {
        toks = parseGearScramble(scr);
      } catch {
        parseFails++;
        continue;
      }
      for (const t of toks) {
        tokSet.add(t);
        expect(alphabet.has(t), `token in alphabet: ${t}`).toBe(true);
      }
      const st = gearApply(scr);
      expect(dist.has(keyOf(st)), `reachable: ${scr}`).toBe(true);
      const { solution } = solveGear(scr);
      const after = refApplySeq([...toks, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(after), `round-trip: ${scr}`).toBe(keyOf(REF_SOLVED));
    }
    expect(generated).toBeGreaterThan(0);
    expect(parseFails).toBe(0);
    for (const t of tokSet) expect(alphabet.has(t)).toBe(true);
  });
});
