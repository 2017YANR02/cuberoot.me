import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import {
  solveBic,
  bicApply,
  parseBicScramble,
  bicGraphStats,
  bicExamplesByLength,
  bicAllScramblesByLength,
  bicRandomWalkState,
  BIC_MOVE_NAMES,
  BIC_GODS_NUMBER,
  BIC_DIST_HISTOGRAM,
  BIC_STATE_COUNT,
  BIC_SOLVED,
} from '@/lib/bicube-solver';
import { renderBicScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/bicube_svg';

// ── Independent move-model re-derivation (fidelity anchor) ─────────────────────
// We rebuild the bicube move model FROM the cstimer geometry spec, completely independently of the
// solver's internal PERM tables: our own copy of d / SOLVED / the 8-cycle doMove / the 5-distinct-with-0
// gate. Then we assert the solver's single-token applies match this independent geometry, run an
// independent BFS that reproduces the closure / God / full histogram, and round-trip real cstimer
// scrambles. We do NOT import any solver-internal permutation tables.

const D: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2, 5, 8, 7, 6, 3, 4],
  [6, 7, 8, 13, 20, 19, 18, 11, 12],
  [0, 3, 6, 11, 18, 17, 16, 9, 10],
  [8, 5, 2, 15, 22, 21, 20, 13, 14],
];
const FACE = 'UFLR';
const SOLVED: ReadonlyArray<number> = [1, 1, 2, 3, 3, 2, 4, 4, 0, 5, 6, 7, 8, 9, 10, 10, 5, 6, 7, 8, 9, 11, 11];
const SUFF = ['', '2', "'"];

// One quarter turn (cstimer's exact 8-cycle), in place.
function refQuarter(s: number[], face: number): void {
  const di = D[face];
  let t = s[di[0]];
  s[di[0]] = s[di[6]]; s[di[6]] = s[di[4]]; s[di[4]] = s[di[2]]; s[di[2]] = t;
  t = s[di[7]];
  s[di[7]] = s[di[5]]; s[di[5]] = s[di[3]]; s[di[3]] = s[di[1]]; s[di[1]] = t;
}
// Apply (face, amount) tokens, returning a fresh array.
function refApplyTok(cur: ReadonlyArray<number>, tok: string): number[] {
  const face = FACE.indexOf(tok[0]);
  const suf = tok.slice(1);
  const amount = suf === '' ? 1 : suf === '2' ? 2 : 3;
  const next = cur.slice();
  for (let k = 0; k < amount; k++) refQuarter(next, face);
  return next;
}
function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...SOLVED];
  for (const tok of seq) c = refApplyTok(c, tok);
  return c;
}
// Bandaging gate: 9 face stickers show exactly 5 distinct colors and one of them is 0.
function refCanMove(state: ReadonlyArray<number>, face: number): boolean {
  const di = D[face];
  const seen: number[] = [];
  let z = false;
  for (let i = 0; i < 9; i++) {
    const c = state[di[i]];
    if (!seen.includes(c)) { seen.push(c); if (c === 0) z = true; }
  }
  return seen.length === 5 && z;
}
const ALL_TOKENS: string[] = [];
for (let f = 0; f < 4; f++) for (let a = 1; a <= 3; a++) ALL_TOKENS.push(FACE[f] + SUFF[a - 1]);

// Compact key over the 19 moving positions (centres 4,10,12,14 never move).
const MOVING = (() => { const fx = new Set([4, 10, 12, 14]); const o: number[] = []; for (let i = 0; i < 23; i++) if (!fx.has(i)) o.push(i); return o; })();
const keyOf = (c: ReadonlyArray<number>) => MOVING.map((p) => c[p]).join(',');

// Independent BFS over the legal-move graph from solved → optimal distance per reachable state.
let REF: { dist: Map<string, number>; total: number; histogram: number[] } | null = null;
function referenceBfs() {
  if (REF) return REF;
  const dist = new Map<string, number>();
  dist.set(keyOf(SOLVED), 0);
  let frontier: number[][] = [[...SOLVED]];
  let d = 0;
  while (frontier.length) {
    const next: number[][] = [];
    for (const u of frontier) {
      for (let face = 0; face < 4; face++) {
        if (!refCanMove(u, face)) continue;
        for (let amount = 1; amount <= 3; amount++) {
          let v = u.slice();
          for (let k = 0; k < amount; k++) refQuarter(v, face);
          const vk = keyOf(v);
          if (!dist.has(vk)) { dist.set(vk, d + 1); next.push(v); }
        }
      }
    }
    frontier = next; d++;
  }
  const histogram: number[] = [];
  let total = 0;
  for (const dd of dist.values()) { total++; histogram[dd] = (histogram[dd] ?? 0) + 1; }
  REF = { dist, total, histogram };
  return REF;
}
function refDistOf(c: ReadonlyArray<number>): number {
  return referenceBfs().dist.get(keyOf(c))!;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── real cstimer bic scrambles via a node:vm sandbox (same pattern as cm3_solver.test) ─────────────
function loadCstimerBic(count: number): string[] {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', '..', 'tools', 'cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  let root: string | null = null;
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'scramble', 'utilscramble.js'))) { root = c; break; } } catch { /* ignore */ }
  }
  if (!root) return [];
  const sandbox: Record<string, unknown> = Object.create(null);
  sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.console = console; sandbox.setTimeout = setTimeout; sandbox.clearTimeout = clearTimeout;
  sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
  sandbox.DEBUG = false; sandbox.importScripts = () => {}; sandbox.process = process; sandbox.require = require;
  const ctx = vm.createContext(sandbox);
  for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/utilscramble.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const scrMgr = sandbox.scrMgr as { scramblers: Record<string, (k: string, n?: number) => unknown>; toTxt?: (s: string) => string };
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw: unknown;
    for (let k = 0; k < 5000 && (raw === undefined || raw === null); k++) raw = scrMgr.scramblers['bic']('bic', 25);
    const txt = (scrMgr.toTxt ? scrMgr.toTxt(String(raw)) : String(raw)).trim();
    if (txt) out.push(txt);
  }
  return out;
}

describe('bic move model (independent geometry)', () => {
  it('the 12 move effects are reproduced by an independent re-derivation from the cstimer spec', () => {
    expect([...BIC_MOVE_NAMES].sort()).toEqual([...ALL_TOKENS].sort());
    const rnd = mulberry32(0xB1C0);
    for (const tok of ALL_TOKENS) {
      // from solved
      expect(bicApply(tok)).toEqual(refApplyTok(SOLVED, tok));
      // from a battery of random LEGAL states (only apply tokens that are legal at each step)
      for (let t = 0; t < 30; t++) {
        const pre: string[] = [];
        let cur: number[] = [...SOLVED];
        const n = 1 + Math.floor(rnd() * 10);
        for (let i = 0; i < n; i++) {
          const legal = ALL_TOKENS.filter((tk) => refCanMove(cur, FACE.indexOf(tk[0])));
          const pick = legal[Math.floor(rnd() * legal.length)];
          pre.push(pick); cur = refApplyTok(cur, pick);
        }
        if (!refCanMove(cur, FACE.indexOf(tok[0]))) continue; // skip illegal-here token
        const refState = refApplyTok(cur, tok);
        const solverState = bicApply([...pre, tok].join(' '));
        expect(solverState, `move ${tok} after ${pre.join(' ')}`).toEqual(refState);
      }
    }
  });

  it('inverse pairs and self-inverse doubles hold (when legal at solved)', () => {
    for (const f of FACE) {
      expect(bicApply(`${f} ${f}'`)).toEqual([...SOLVED]);
      expect(bicApply(`${f}' ${f}`)).toEqual([...SOLVED]);
      expect(bicApply(`${f}2 ${f}2`)).toEqual([...SOLVED]);
      expect(bicApply(`${f} ${f} ${f} ${f}`)).toEqual([...SOLVED]);
      expect(bicApply(`${f} ${f}`)).toEqual(bicApply(`${f}2`));
    }
  });
});

describe('bicApply', () => {
  it('matches the independent reference state across random legal walks', () => {
    const rnd = mulberry32(0xCAFEB1C);
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 24);
      const { scramble, state } = bicRandomWalkState(len, rnd);
      // independent re-apply of the same token sequence
      const seq = scramble ? scramble.split(' ') : [];
      expect(bicApply(scramble)).toEqual(refApplySeq(seq));
      expect(bicApply(scramble)).toEqual(state);
    }
  });
});

describe('bic graph (full BFS closure)', () => {
  it('reaches exactly 1,108,800 states with God 28 and the locked histogram', () => {
    const { total, histogram } = bicGraphStats();
    expect(total).toBe(1108800);
    expect(total).toBe(BIC_STATE_COUNT);
    expect(histogram).toEqual([...BIC_DIST_HISTOGRAM]);
    expect(histogram.length - 1).toBe(BIC_GODS_NUMBER);
    expect(BIC_GODS_NUMBER).toBe(28);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(1108800);
  });

  it('the solver histogram matches an independent (geometry-spec) BFS', () => {
    const ref = referenceBfs();
    expect(ref.total).toBe(1108800);
    expect(ref.histogram).toEqual(bicGraphStats().histogram);
    // mean ≈ 18.80 (20,846,786 / 1,108,800)
    let sum = 0, tot = 0;
    ref.histogram.forEach((n, i) => { sum += n * i; tot += n; });
    expect(tot).toBe(1108800);
    expect(sum).toBe(20846786);
    expect(sum / tot).toBeCloseTo(18.801, 2);
  });
});

describe('parseBicScramble', () => {
  it('rejects invalid tokens but accepts every bic token', () => {
    expect(() => parseBicScramble('U X')).toThrow();
    expect(() => parseBicScramble('U3')).toThrow();
    expect(() => parseBicScramble('D')).toThrow();   // bic has no D face
    expect(() => parseBicScramble('B')).toThrow();
    expect(() => parseBicScramble("U'2")).toThrow();
    expect(() => parseBicScramble('Uw')).toThrow();
    for (const t of BIC_MOVE_NAMES) expect(() => parseBicScramble(t)).not.toThrow();
    expect(parseBicScramble("  U F2  L' ")).toEqual(['U', 'F2', "L'"]);
    expect(BIC_MOVE_NAMES.length).toBe(12);
  });
});

describe('solveBic', () => {
  it('handles solved / empty input → length 0', () => {
    expect(solveBic('')).toEqual({ solution: '', length: 0 });
    expect(solveBic("U U'")).toEqual({ solution: '', length: 0 });
    expect(solveBic('U2 U2')).toEqual({ solution: '', length: 0 });
    expect(solveBic('U U U U')).toEqual({ solution: '', length: 0 });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveBic('U X')).toThrow();
    expect(() => solveBic('foo')).toThrow();
  });

  it('provably optimal on ≥400 random legal-walk states: length == independent BFS distance, valid', () => {
    const rnd = mulberry32(0x0B1CBEE);
    const ALPHA = new Set(BIC_MOVE_NAMES);
    let mismatches = 0, invalid = 0;
    for (let trial = 0; trial < 420; trial++) {
      const len = 1 + Math.floor(rnd() * 30);
      const { scramble, state } = bicRandomWalkState(len, rnd);
      const { solution, length } = solveBic(scramble);
      // optimal: reported length equals the independent optimal distance
      if (length !== refDistOf(state)) mismatches++;
      const solToks = solution ? solution.split(' ') : [];
      expect(solToks.length).toBe(length);
      for (const t of solToks) expect(ALPHA.has(t), `illegal token ${t}`).toBe(true);
      // valid: scramble then solution via the INDEPENDENT reference returns to solved
      const after = refApplySeq([...(scramble ? scramble.split(' ') : []), ...solToks]);
      if (keyOf(after) !== keyOf(SOLVED)) invalid++;
    }
    expect(mismatches).toBe(0);
    expect(invalid).toBe(0);
  });

  it('100% solve-rate on ≥200 REAL cstimer bic scrambles, provably optimal (independent apply + BFS)', () => {
    const scrambles = loadCstimerBic(220);
    expect(scrambles.length, 'cstimer bic sandbox produced no scrambles').toBeGreaterThanOrEqual(200);
    const ALPHA = new Set(BIC_MOVE_NAMES);
    let illegalMoves = 0, parseFails = 0, unsolved = 0, suboptimal = 0;
    const lens: number[] = [];
    for (const scramble of scrambles) {
      const seq = scramble.split(/\s+/).filter(Boolean);
      // every scramble token in the 12-alphabet (move-model contract with cstimer)
      for (const t of seq) if (!ALPHA.has(t)) illegalMoves++;
      let solOut;
      try { solOut = solveBic(scramble); } catch { parseFails++; continue; }
      const solToks = solOut.solution ? solOut.solution.split(' ') : [];
      for (const t of solToks) if (!ALPHA.has(t)) illegalMoves++;
      const scrState = refApplySeq(seq);
      const after = refApplySeq([...seq, ...solToks]);
      if (keyOf(after) !== keyOf(SOLVED)) unsolved++;
      if (solOut.length !== refDistOf(scrState)) suboptimal++;
      lens.push(solOut.length);
    }
    expect(illegalMoves).toBe(0);
    expect(parseFails).toBe(0);
    expect(unsolved).toBe(0);
    expect(suboptimal).toBe(0); // provably optimal
    // smooth, sane lengths (spec: min ~5 / max ~23 / mean ~17)
    const min = Math.min(...lens), max = Math.max(...lens);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(BIC_GODS_NUMBER);
  });
});

describe('bicExamplesByLength', () => {
  it('generates valid, optimal example scrambles whose returned solution length equals the bucket', () => {
    const ex = bicExamplesByLength(8);
    const bins = Object.keys(ex).map(Number).sort((a, b) => a - b);
    expect(bins.length).toBeGreaterThan(0);
    const ALPHA = new Set(BIC_MOVE_NAMES);
    for (const d of bins) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(BIC_GODS_NUMBER);
      for (const scr of ex[d]) {
        const toks = scr.split(/\s+/).filter(Boolean);
        for (const t of toks) expect(ALPHA.has(t)).toBe(true);
        expect(solveBic(scr).length).toBe(d);
        const after = refApplySeq([...toks, ...solveBic(scr).solution.split(' ').filter(Boolean)]);
        expect(keyOf(after)).toBe(keyOf(SOLVED));
      }
    }
  });

  it('full enumeration covers every non-trivial state exactly once (counts == distribution)', () => {
    const all = bicAllScramblesByLength();
    let total = 0;
    const seen = new Set<string>();
    for (let d = 1; d <= BIC_GODS_NUMBER; d++) {
      const list = all[d] ?? [];
      expect(list.length, `depth ${d} count`).toBe(BIC_DIST_HISTOGRAM[d]);
      total += list.length;
      for (const scr of list) seen.add(keyOf(refApplySeq(scr.split(' '))));
    }
    expect(total).toBe(1108799); // all states minus the identity
    expect(seen.size).toBe(1108799); // every non-trivial state exactly once
  });
});

describe('exported constants', () => {
  it('BIC_SOLVED is the cstimer solved array; counts & God figure are the measured values', () => {
    expect([...BIC_SOLVED]).toEqual([1, 1, 2, 3, 3, 2, 4, 4, 0, 5, 6, 7, 8, 9, 10, 10, 5, 6, 7, 8, 9, 11, 11]);
    expect(new Set(BIC_SOLVED).size).toBe(12); // 12 distinct color labels
    expect(BIC_STATE_COUNT).toBe(1108800);
    expect(BIC_GODS_NUMBER).toBe(28);
    expect(BIC_DIST_HISTOGRAM.reduce((a, b) => a + b, 0)).toBe(1108800);
  });
});

describe('renderBicScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → canonical layout (deterministic, derived from BIC_SOLVED)', () => {
    const f = fills(renderBicScrambleSvg(''));
    expect(f.length).toBeGreaterThan(0);
    // self-proving: rendering the solved state twice is identical, and it is NOT all one color
    expect(fills(renderBicScrambleSvg(''))).toEqual(f);
    expect(new Set(f.slice(1)).size).toBeGreaterThan(1);
  });

  it('a turn breaks canonical; round-trip restores it; solving renders solved', () => {
    const solvedFills = fills(renderBicScrambleSvg(''));
    expect(fills(renderBicScrambleSvg('U'))).not.toEqual(solvedFills);
    expect(fills(renderBicScrambleSvg("U U'"))).toEqual(solvedFills);
    expect(fills(renderBicScrambleSvg('U2 U2'))).toEqual(solvedFills);

    const rnd = mulberry32(0x5F1CB1C);
    for (let trial = 0; trial < 30; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const { scramble } = bicRandomWalkState(len, rnd);
      const { solution } = solveBic(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(fills(renderBicScrambleSvg(combined)), `after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});
