import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import {
  solveHeli,
  heliApply,
  parseHeliScramble,
  heliExamplesByLength,
  randomHeliScramble,
  heliFaceletColors,
  HELI_MOVE_NAMES,
  HELI_MAX_LENGTH,
  HELI_SOLVED,
  HELI_STATE_COUNT_STR,
  HELI_FACE_OF,
} from '@/lib/heli-solver';
import { renderHeliScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/heli_svg';

// ── Independent oracle: cstimer's poly3dlib heli moveTable, loaded via node:vm ───────────────────────
// cstimer has NO Helicopter solver (utilscramble.js:473 only emits random edge tokens), but poly3dlib
// CAN build the live puzzle: makePuzzle(6,[-5],[-5,√0.5],[-5]) → a 48-facelet cube whose moveTable gives
// each edge twist as a facelet permutation. We load THAT independently, re-derive the 8-corner (CCW
// slots) + 24-wing piece model from the geometry from scratch (NOT copied from the solver's bytes), and
// (a) assert the solver's piece model is bit-exact against cstimer's moveTable over random sequences,
// (b) round-trip real cstimer heli scrambles through solveHeli and verify scramble∘solution = solved via
// this independent geometry. That geometry is the gold-standard oracle.

interface CstimerHeli {
  EDGES: string[];
  gensF: number[][];          // 12 facelet permutations (the heli generators), full 48-perm
  faceOf: number[];           // facelet -> face 0..5
  corners: number[][];        // 8 corners, each 3 facelet ids (CCW order)
  wingFL: number[];           // 24 wing facelet ids (sorted)
}
function loadCstimerHeli(): CstimerHeli | null {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', '..', 'tools', 'cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  let root: string | null = null;
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'lib', 'poly3dlib.js'))) { root = c; break; } } catch { /* ignore */ }
  }
  if (!root) return null;
  const sandbox: Record<string, unknown> = Object.create(null);
  sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.console = console; sandbox.setTimeout = setTimeout; sandbox.clearTimeout = clearTimeout;
  sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
  sandbox.DEBUG = false; sandbox.importScripts = () => {}; sandbox.process = process; sandbox.require = require; sandbox.Math = Math;
  const ctx = vm.createContext(sandbox);
  for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'lib/poly3dlib.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const poly3d = sandbox.poly3d as {
    makePuzzle: (...a: unknown[]) => {
      moveTable: number[][];
      getTwistyIdx: (s: string) => number;
      enumFacesPolys: (cb: (face: number, p: number, poly: { center: { x: number; y: number; z: number } }, idx: number) => void) => void;
      faceNames: string[];
    };
  };
  const puz = poly3d.makePuzzle(6, [-5], [-5, Math.sqrt(0.5)], [-5]);
  const EDGES = ['UF', 'UR', 'UB', 'UL', 'FR', 'BR', 'BL', 'FL', 'DF', 'DR', 'DB', 'DL'];
  const N = 48;
  const cen: number[][] = [], faceOf: number[] = [];
  puz.enumFacesPolys((face, _p, poly, idx) => { cen[idx] = [poly.center.x, poly.center.y, poly.center.z]; faceOf[idx] = face; });
  const gensF = EDGES.map((e) => puz.moveTable[puz.getTwistyIdx('1' + e)].map((v, k) => (v === -1 ? k : v)));
  // re-derive corners (min|coord|≈0.667) + wings (≈0.333), corner slots CCW around vertex normal.
  const rad = (c: number[]) => { const ac = [Math.abs(c[0]), Math.abs(c[1]), Math.abs(c[2])].sort((a, b) => a - b); return ac[0]; };
  const cornerFL: number[] = [], wingFL: number[] = [];
  for (let i = 0; i < N; i++) (rad(cen[i]) > 0.5 ? cornerFL : wingFL).push(i);
  wingFL.sort((a, b) => a - b);
  const byV: Record<string, number[]> = {}; const VO: string[] = [];
  for (const i of cornerFL) { const k = [Math.sign(cen[i][0]), Math.sign(cen[i][1]), Math.sign(cen[i][2])].join(','); if (!(k in byV)) { byV[k] = []; VO.push(k); } byV[k].push(i); }
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const corners = VO.map((k) => {
    const fls = byV[k]; const n = k.split(',').map(Number); const rc = cen[fls[0]];
    const proj = (c: number[]) => { const d = dot(c, n); return [c[0] - d * n[0], c[1] - d * n[1], c[2] - d * n[2]]; };
    const u = proj(rc); const un = Math.hypot(u[0], u[1], u[2]); const ub = u.map((x) => x / un); const wb = cross(n, ub);
    return fls.map((fl) => { const pc = proj(cen[fl]); return [fl, Math.atan2(dot(pc, wb), dot(pc, ub))] as [number, number]; })
      .sort((a, b) => a[1] - b[1]).map((a) => a[0]);
  });
  return { EDGES, gensF, faceOf, corners, wingFL };
}

const ORACLE = loadCstimerHeli();

// Build the oracle's facelet-state apply (solved facelet f shows its own face color).
function makeOracleApply(o: CstimerHeli) {
  const idx = new Map(o.EDGES.map((e, i) => [e, i]));
  const solved = o.faceOf.slice();
  function applyTok(state: number[], tok: string): number[] {
    const g = o.gensF[idx.get(tok)!];
    const out = state.slice();
    for (let i = 0; i < 48; i++) out[g[i]] = state[i];
    return out;
  }
  function applySeq(seq: string[]): number[] { let c = solved.slice(); for (const t of seq) c = applyTok(c, t); return c; }
  return { solved, applyTok, applySeq };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Load real cstimer heli scrambles via the scrambler (separate sandbox with the scramble engine).
function loadCstimerHeliScrambles(count: number): string[] {
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
  sandbox.DEBUG = false; sandbox.importScripts = () => {}; sandbox.process = process; sandbox.require = require; sandbox.Math = Math;
  const ctx = vm.createContext(sandbox);
  for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/megascramble.js', 'scramble/utilscramble.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const scrMgr = sandbox.scrMgr as { scramblers: Record<string, (k: string, n?: number) => unknown>; toTxt?: (s: string) => string };
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw: unknown;
    for (let k = 0; k < 5000 && (raw === undefined || raw === null); k++) raw = scrMgr.scramblers['heli']('heli', 20);
    const txt = (scrMgr.toTxt ? scrMgr.toTxt(String(raw)) : String(raw)).trim();
    if (txt) out.push(txt);
  }
  return out;
}

describe('heli-solver geometry (vs cstimer poly3dlib oracle)', () => {
  it('the oracle loads (poly3dlib makePuzzle heli) — 48 facelets, 12 generators, 8 corners + 24 wings', () => {
    expect(ORACLE, 'cstimer poly3dlib sandbox produced no heli puzzle').not.toBeNull();
    const o = ORACLE!;
    expect(o.gensF.length).toBe(12);
    expect(o.faceOf.length).toBe(48);
    expect(o.corners.length).toBe(8);
    expect(o.corners.every((c) => c.length === 3)).toBe(true);
    expect(o.wingFL.length).toBe(24);
  });

  it('the solver piece model is bit-exact against cstimer moveTable (single tokens + random sequences)', () => {
    const o = ORACLE!;
    const oracle = makeOracleApply(o);
    // single tokens
    for (const tok of HELI_MOVE_NAMES) {
      expect(heliFaceletColors(tok), `token ${tok}`).toEqual(oracle.applySeq([tok]));
    }
    // random sequences
    const rnd = mulberry32(0x4E11);
    for (let t = 0; t < 2000; t++) {
      const len = 1 + Math.floor(rnd() * 22);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(HELI_MOVE_NAMES[Math.floor(rnd() * 12)]);
      expect(heliFaceletColors(seq.join(' ')), `seq ${seq.join(' ')}`).toEqual(oracle.applySeq(seq));
    }
  });
});

describe('parseHeliScramble', () => {
  it('rejects invalid tokens but accepts every heli token', () => {
    expect(() => parseHeliScramble('UF X')).toThrow();
    expect(() => parseHeliScramble('U')).toThrow();
    expect(() => parseHeliScramble("R'")).toThrow();
    expect(() => parseHeliScramble('UF2')).toThrow();
    for (const t of HELI_MOVE_NAMES) expect(() => parseHeliScramble(t)).not.toThrow();
    expect(parseHeliScramble('  UF DR  BL ')).toEqual(['UF', 'DR', 'BL']);
  });
});

describe('solveHeli', () => {
  it('handles solved / empty input → length 0', () => {
    expect(solveHeli('')).toEqual({ solution: '', length: 0, optimal: false });
    // a single edge twist is its own inverse
    expect(solveHeli('UF UF')).toEqual({ solution: '', length: 0, optimal: false });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveHeli('UF X')).toThrow();
    expect(() => solveHeli('foo')).toThrow();
  });

  it('100% solve-rate on ≥500 random sequences: scramble∘solution = solved, length ≤ cap, legal tokens', () => {
    const o = ORACLE!;
    const oracle = makeOracleApply(o);
    const ALPHA = new Set(HELI_MOVE_NAMES);
    const rnd = mulberry32(0x0EF1);
    let maxLen = 0;
    for (let trial = 0; trial < 600; trial++) {
      const len = 1 + Math.floor(rnd() * 24);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(HELI_MOVE_NAMES[Math.floor(rnd() * 12)]);
      const scramble = seq.join(' ');

      const { solution, length, optimal } = solveHeli(scramble);
      expect(optimal).toBe(false);
      expect(length).toBeLessThanOrEqual(HELI_MAX_LENGTH);
      const solToks = solution ? solution.split(' ') : [];
      expect(solToks.length).toBe(length);
      for (const t of solToks) expect(ALPHA.has(t), `illegal token ${t}`).toBe(true);

      // valid: scramble then solution via the INDEPENDENT geometry returns to solved facelets.
      const after = oracle.applySeq([...seq, ...solToks]);
      expect(after, `failed to solve ${scramble}`).toEqual(oracle.solved);
      if (length > maxLen) maxLen = length;
    }
    expect(maxLen).toBeLessThanOrEqual(HELI_MAX_LENGTH);
    expect(maxLen).toBeGreaterThan(0);
  });

  it('100% solve-rate on ≥200 REAL cstimer heli scrambles (independent apply + alphabet + cap)', () => {
    const o = ORACLE!;
    const oracle = makeOracleApply(o);
    const scrambles = loadCstimerHeliScrambles(220);
    expect(scrambles.length, 'cstimer heli sandbox produced no scrambles').toBeGreaterThanOrEqual(200);
    const ALPHA = new Set(HELI_MOVE_NAMES);
    for (const scramble of scrambles) {
      const seq = scramble.split(/\s+/).filter(Boolean);
      for (const t of seq) expect(ALPHA.has(t), `cstimer emitted non-heli token ${t}`).toBe(true);
      const { solution, length } = solveHeli(scramble);
      expect(length).toBeLessThanOrEqual(HELI_MAX_LENGTH);
      const solToks = solution ? solution.split(' ') : [];
      for (const t of solToks) expect(ALPHA.has(t)).toBe(true);
      const after = oracle.applySeq([...seq, ...solToks]);
      expect(after, `failed to solve real cstimer scramble ${scramble}`).toEqual(oracle.solved);
    }
  });

  it('randomHeliScramble emits only heli tokens of the requested length, and solves', () => {
    const rnd = mulberry32(0x5EED7);
    const ALPHA = new Set(HELI_MOVE_NAMES);
    for (let t = 0; t < 50; t++) {
      const scr = randomHeliScramble(20, rnd);
      const toks = scr.split(/\s+/).filter(Boolean);
      expect(toks.length).toBe(20);
      for (const tok of toks) expect(ALPHA.has(tok)).toBe(true);
      const { length } = solveHeli(scr);
      expect(length).toBeLessThanOrEqual(HELI_MAX_LENGTH);
      // round-trip via the solver's own state model
      expect(heliApply(`${scr} ${solveHeli(scr).solution}`)).toEqual(HELI_SOLVED);
    }
  });
});

describe('heliExamplesByLength', () => {
  it('generates valid example scrambles whose returned solution length equals the bucket', () => {
    const ex = heliExamplesByLength(4);
    const bins = Object.keys(ex).map(Number);
    expect(bins.length).toBeGreaterThan(0);
    const ALPHA = new Set(HELI_MOVE_NAMES);
    for (const d of bins) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(HELI_MAX_LENGTH);
      for (const scr of ex[d]) {
        const toks = scr.split(/\s+/).filter(Boolean);
        for (const t of toks) expect(ALPHA.has(t)).toBe(true);
        expect(solveHeli(scr).length).toBe(d);
        expect(heliApply(`${scr} ${solveHeli(scr).solution}`)).toEqual(HELI_SOLVED);
      }
    }
  });
});

describe('exported constants', () => {
  it('HELI_SOLVED is the identity state and the figures are the verified ones', () => {
    expect(HELI_SOLVED.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(HELI_SOLVED.co).size).toBe(1);
    expect(HELI_SOLVED.wp.length).toBe(24);
    expect(HELI_MOVE_NAMES.length).toBe(12);
    expect(HELI_STATE_COUNT_STR).toBe('11,848,661,611,315,200,000');
    expect(HELI_MAX_LENGTH).toBeGreaterThanOrEqual(318); // measured max over 1000+ real scrambles
  });
});

describe('renderHeliScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → canonical: each face renders a single solid color (self-proving)', () => {
    const colors = heliFaceletColors('');
    // solved: every facelet shows its own face color.
    for (let i = 0; i < 48; i++) expect(colors[i]).toBe(HELI_FACE_OF[i]);
    // and the SVG has the expected number of fills (1 bg + 6 face rects(none-fill) + 48 facelet polygons).
    const f = fills(renderHeliScrambleSvg(''));
    expect(f.length).toBeGreaterThanOrEqual(49);
  });

  it('a turn breaks canonical uniformity; round-trip restores it; solving renders solved', () => {
    const solvedFills = fills(renderHeliScrambleSvg(''));
    expect(fills(renderHeliScrambleSvg('UF'))).not.toEqual(solvedFills);
    expect(fills(renderHeliScrambleSvg('UF UF'))).toEqual(solvedFills);

    const rnd = mulberry32(0x5F1C0DE);
    for (let trial = 0; trial < 30; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(HELI_MOVE_NAMES[Math.floor(rnd() * 12)]);
      const scramble = seq.join(' ');
      const { solution } = solveHeli(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(fills(renderHeliScrambleSvg(combined)), `after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});
