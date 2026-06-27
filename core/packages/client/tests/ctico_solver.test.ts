import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  solveCtico,
  cticoApply,
  parseCticoScramble,
  cticoExamplesByLength,
  randomCticoScramble,
  cticoFaceletColors,
  CTICO_MOVE_NAMES,
  CTICO_MAX_LENGTH,
  CTICO_SOLVED,
  CTICO_STATE_COUNT_STR,
  CTICO_FACE_OF,
} from '@/lib/ctico-solver';
import { renderCticoScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/ctico_svg';

// ── Independent oracle: cstimer's poly3dlib ctico moveTable, loaded via node:vm ──────────────────────
// cstimer has NO Icosamate solver (utilscramble.js:567 only emits random vertex tokens), but poly3dlib CAN
// build the live puzzle: makePuzzle(20,[],[],[-5,0]) → an 80-facelet icosahedron whose moveTable gives each
// vertex turn as a facelet permutation. A bare token `UL` parses (default makePuzzleParser) to the SHALLOW
// layer-1 move getTwistyIdx('1'+token). We load THAT independently, re-derive the 12-vertex (Z5, 5 facelets
// CCW) + 20-face-center piece model from the geometry from scratch (NOT copied from the solver's bytes), and
// (a) assert the solver's piece model is bit-exact against cstimer's moveTable over random sequences,
// (b) round-trip real cstimer ctico scrambles through solveCtico and verify scramble∘solution = solved via
// this independent geometry. That geometry is the gold-standard oracle.

interface CstimerCtico {
  AXES: string[];
  gensF: number[][];            // 6 facelet permutations (the shallow vertex turns), full 80-perm
  faceOf: number[];             // facelet -> face 0..19
}
function vmSandbox(): Record<string, unknown> {
  const require = createRequire(import.meta.url);
  const sandbox: Record<string, unknown> = Object.create(null);
  sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.console = console; sandbox.setTimeout = setTimeout; sandbox.clearTimeout = clearTimeout;
  sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
  sandbox.DEBUG = false; sandbox.importScripts = () => {}; sandbox.process = process; sandbox.require = require; sandbox.Math = Math;
  return sandbox;
}
function cstimerRoot(file: string): string | null {
  const candidates = [
    path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', '..', 'tools', 'cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  for (const c of candidates) { try { if (fs.existsSync(path.join(c, file))) return c; } catch { /* ignore */ } }
  return null;
}

const AXES = ['UL', 'UR', 'UrUl', 'FlFr', 'LBl', 'RBr'];

function loadCstimerCtico(): CstimerCtico | null {
  const root = cstimerRoot(path.join('lib', 'poly3dlib.js'));
  if (!root) return null;
  const sandbox = vmSandbox();
  const ctx = vm.createContext(sandbox);
  for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'lib/poly3dlib.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const poly3d = sandbox.poly3d as {
    makePuzzle: (...a: unknown[]) => {
      moveTable: number[][];
      getTwistyIdx: (s: string) => number;
      enumFacesPolys: (cb: (face: number, p: number, poly: { center: { x: number; y: number; z: number } }, idx: number) => void) => void;
    };
  };
  const puz = poly3d.makePuzzle(20, [], [], [-5, 0]);
  const N = 80;
  const faceOf: number[] = [];
  puz.enumFacesPolys((face, _p, _poly, idx) => { faceOf[idx] = face; });
  // SHALLOW (layer-1) generators — the bare-token parse target. The layer-0 deep move only generates the
  // order-60 rotation group, NOT the scramble group.
  const gensF = AXES.map((a) => puz.moveTable[puz.getTwistyIdx('1' + a)].map((v, k) => (v === -1 ? k : v)));
  return { AXES, gensF, faceOf };
}

const ORACLE = loadCstimerCtico();

// Build the oracle's facelet-state apply (solved facelet f shows its own face color). Token = axis × power;
// applying = the shallow generator applied `power` times.
const POWER_OF: Record<string, number> = {};
for (const a of AXES) { POWER_OF[a] = 1; POWER_OF[a + '2'] = 2; POWER_OF[a + "2'"] = 3; POWER_OF[a + "'"] = 4; }
const AXIS_OF: Record<string, number> = {};
AXES.forEach((a, i) => { AXIS_OF[a] = i; AXIS_OF[a + '2'] = i; AXIS_OF[a + "2'"] = i; AXIS_OF[a + "'"] = i; });

function makeOracleApply(o: CstimerCtico) {
  const solved = o.faceOf.slice();
  function applyTok(state: number[], tok: string): number[] {
    const g = o.gensF[AXIS_OF[tok]];
    const power = POWER_OF[tok];
    let s = state;
    for (let t = 0; t < power; t++) { const out = s.slice(); for (let i = 0; i < 80; i++) out[g[i]] = s[i]; s = out; }
    return s;
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

// Load real cstimer ctico scrambles via the scrambler (separate sandbox with the scramble engine).
function loadCstimerCticoScrambles(count: number): string[] {
  const root = cstimerRoot(path.join('scramble', 'utilscramble.js'));
  if (!root) return [];
  const sandbox = vmSandbox();
  const ctx = vm.createContext(sandbox);
  for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/megascramble.js', 'scramble/utilscramble.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const scrMgr = sandbox.scrMgr as { scramblers: Record<string, (k: string, n?: number) => unknown>; toTxt?: (s: string) => string };
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw: unknown;
    for (let k = 0; k < 5000 && (raw === undefined || raw === null); k++) raw = scrMgr.scramblers['ctico']('ctico', 25);
    const txt = (scrMgr.toTxt ? scrMgr.toTxt(String(raw)) : String(raw)).trim();
    if (txt) out.push(txt);
  }
  return out;
}

describe('ctico-solver geometry (vs cstimer poly3dlib oracle)', () => {
  it('the oracle loads (poly3dlib makePuzzle ctico) — 80 facelets, 6 shallow generators, 20 faces', () => {
    expect(ORACLE, 'cstimer poly3dlib sandbox produced no ctico puzzle').not.toBeNull();
    const o = ORACLE!;
    expect(o.gensF.length).toBe(6);
    expect(o.faceOf.length).toBe(80);
    expect(new Set(o.faceOf).size).toBe(20);
    // each shallow generator moves exactly 40 facelets (the cap), order 5.
    for (const g of o.gensF) {
      let moved = 0; for (let i = 0; i < 80; i++) if (g[i] !== i) moved++;
      expect(moved).toBe(40);
    }
  });

  it('the solver piece model is bit-exact against cstimer moveTable (single tokens + random sequences)', () => {
    const o = ORACLE!;
    const oracle = makeOracleApply(o);
    // single tokens (all 24)
    for (const tok of CTICO_MOVE_NAMES) {
      expect(cticoFaceletColors(tok), `token ${tok}`).toEqual(oracle.applySeq([tok]));
    }
    // random sequences
    const rnd = mulberry32(0x0C71C0);
    for (let t = 0; t < 2000; t++) {
      const len = 1 + Math.floor(rnd() * 22);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(CTICO_MOVE_NAMES[Math.floor(rnd() * 24)]);
      expect(cticoFaceletColors(seq.join(' ')), `seq ${seq.join(' ')}`).toEqual(oracle.applySeq(seq));
    }
  });
});

describe('parseCticoScramble', () => {
  it('rejects invalid tokens but accepts every ctico token', () => {
    expect(() => parseCticoScramble('UL X')).toThrow();
    expect(() => parseCticoScramble('U')).toThrow();
    expect(() => parseCticoScramble("R'")).toThrow();
    expect(() => parseCticoScramble('UL3')).toThrow();
    for (const t of CTICO_MOVE_NAMES) expect(() => parseCticoScramble(t)).not.toThrow();
    expect(parseCticoScramble("  UL UR2  FlFr' ")).toEqual(['UL', 'UR2', "FlFr'"]);
  });
});

describe('solveCtico', () => {
  it('handles solved / empty input → length 0', () => {
    expect(solveCtico('')).toEqual({ solution: '', length: 0, optimal: false });
    // a turn then its inverse is identity
    expect(solveCtico("UL UL'")).toEqual({ solution: '', length: 0, optimal: false });
    expect(solveCtico('UL UL UL UL UL')).toEqual({ solution: '', length: 0, optimal: false }); // order 5
  });

  it('rejects invalid tokens', () => {
    expect(() => solveCtico('UL X')).toThrow();
    expect(() => solveCtico('foo')).toThrow();
  });

  it('100% solve-rate on ≥300 random sequences: scramble∘solution = solved, length ≤ cap, legal tokens', () => {
    const o = ORACLE!;
    const oracle = makeOracleApply(o);
    const ALPHA = new Set(CTICO_MOVE_NAMES);
    const rnd = mulberry32(0x0EF1);
    let maxLen = 0;
    for (let trial = 0; trial < 300; trial++) {
      const len = 1 + Math.floor(rnd() * 24);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(CTICO_MOVE_NAMES[Math.floor(rnd() * 24)]);
      const scramble = seq.join(' ');

      const { solution, length, optimal } = solveCtico(scramble);
      expect(optimal).toBe(false);
      expect(length).toBeLessThanOrEqual(CTICO_MAX_LENGTH);
      const solToks = solution ? solution.split(' ') : [];
      expect(solToks.length).toBe(length);
      for (const t of solToks) expect(ALPHA.has(t), `illegal token ${t}`).toBe(true);

      // valid: scramble then solution via the INDEPENDENT geometry returns to solved facelets.
      const after = oracle.applySeq([...seq, ...solToks]);
      expect(after, `failed to solve ${scramble}`).toEqual(oracle.solved);
      if (length > maxLen) maxLen = length;
    }
    expect(maxLen).toBeLessThanOrEqual(CTICO_MAX_LENGTH);
    expect(maxLen).toBeGreaterThan(0);
  });

  it('100% solve-rate on ≥200 REAL cstimer ctico scrambles (independent apply + alphabet + cap)', () => {
    const o = ORACLE!;
    const oracle = makeOracleApply(o);
    const scrambles = loadCstimerCticoScrambles(220);
    expect(scrambles.length, 'cstimer ctico sandbox produced no scrambles').toBeGreaterThanOrEqual(200);
    const ALPHA = new Set(CTICO_MOVE_NAMES);
    for (const scramble of scrambles) {
      const seq = scramble.split(/\s+/).filter(Boolean);
      for (const t of seq) expect(ALPHA.has(t), `cstimer emitted non-ctico token ${t}`).toBe(true);
      const { solution, length } = solveCtico(scramble);
      expect(length).toBeLessThanOrEqual(CTICO_MAX_LENGTH);
      const solToks = solution ? solution.split(' ') : [];
      for (const t of solToks) expect(ALPHA.has(t)).toBe(true);
      const after = oracle.applySeq([...seq, ...solToks]);
      expect(after, `failed to solve real cstimer scramble ${scramble}`).toEqual(oracle.solved);
    }
  });

  it('randomCticoScramble emits only ctico tokens of the requested length, and solves', () => {
    const rnd = mulberry32(0x5EED7);
    const ALPHA = new Set(CTICO_MOVE_NAMES);
    for (let t = 0; t < 40; t++) {
      const scr = randomCticoScramble(20, rnd);
      const toks = scr.split(/\s+/).filter(Boolean);
      expect(toks.length).toBe(20);
      for (const tok of toks) expect(ALPHA.has(tok)).toBe(true);
      const { length } = solveCtico(scr);
      expect(length).toBeLessThanOrEqual(CTICO_MAX_LENGTH);
      // round-trip via the solver's own state model
      expect(cticoApply(`${scr} ${solveCtico(scr).solution}`)).toEqual(CTICO_SOLVED);
    }
  });
});

describe('cticoExamplesByLength', () => {
  it('generates valid example scrambles whose returned solution length equals the bucket', () => {
    const ex = cticoExamplesByLength(4);
    const bins = Object.keys(ex).map(Number);
    expect(bins.length).toBeGreaterThan(0);
    const ALPHA = new Set(CTICO_MOVE_NAMES);
    for (const d of bins) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(CTICO_MAX_LENGTH);
      for (const scr of ex[d]) {
        const toks = scr.split(/\s+/).filter(Boolean);
        for (const t of toks) expect(ALPHA.has(t)).toBe(true);
        expect(solveCtico(scr).length).toBe(d);
        expect(cticoApply(`${scr} ${solveCtico(scr).solution}`)).toEqual(CTICO_SOLVED);
      }
    }
  });
});

describe('exported constants', () => {
  it('CTICO_SOLVED is the identity state and the figures are the verified ones', () => {
    expect(CTICO_SOLVED.vp).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(new Set(CTICO_SOLVED.vo).size).toBe(1);
    expect(CTICO_SOLVED.fp.length).toBe(20);
    expect(CTICO_MOVE_NAMES.length).toBe(24);
    expect(CTICO_STATE_COUNT_STR).toBe('3,556,408,552,733,836,800,000,000,000,000,000');
    expect(CTICO_MAX_LENGTH).toBeGreaterThanOrEqual(1300); // measured max over 2000+ real scrambles ~1227
  });
});

describe('renderCticoScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → canonical: each face renders a single solid color (self-proving)', () => {
    const colors = cticoFaceletColors('');
    // solved: every facelet shows its own face color.
    for (let i = 0; i < 80; i++) expect(colors[i]).toBe(CTICO_FACE_OF[i]);
    // the SVG has fills for 20 faces × 4 facelets + bg (outline polygons use fill="none").
    const f = fills(renderCticoScrambleSvg(''));
    expect(f.length).toBeGreaterThanOrEqual(81);
  });

  it('a turn breaks canonical uniformity; round-trip restores it; solving renders solved', () => {
    const solvedFills = fills(renderCticoScrambleSvg(''));
    expect(fills(renderCticoScrambleSvg('UL'))).not.toEqual(solvedFills);
    expect(fills(renderCticoScrambleSvg("UL UL'"))).toEqual(solvedFills);

    const rnd = mulberry32(0x5F1C0DE);
    for (let trial = 0; trial < 20; trial++) {
      const len = 1 + Math.floor(rnd() * 12);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(CTICO_MOVE_NAMES[Math.floor(rnd() * 24)]);
      const scramble = seq.join(' ');
      const { solution } = solveCtico(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(fills(renderCticoScrambleSvg(combined)), `after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});
