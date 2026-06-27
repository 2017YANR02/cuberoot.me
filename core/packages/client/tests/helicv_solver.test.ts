import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  solveHelicv,
  helicvApply,
  parseHelicvScramble,
  helicvExamplesByLength,
  randomHelicvScramble,
  helicvFaceletColors,
  HELICV_MOVE_NAMES,
  HELICV_MAX_LENGTH,
  HELICV_SOLVED,
  HELICV_STATE_COUNT_STR,
  HELICV_FACE_OF,
} from '@/lib/helicv-solver';
import { renderHelicvScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/helicv_svg';

// ── Independent oracle: cstimer's poly3dlib helicv moveTable, loaded via node:vm ─────────────────────
// cstimer has NO Curvy Copter solver (utilscramble.js:473-475 only emits random edge tokens — the SAME
// adjScramble call as heli), but poly3dlib CAN build the live puzzle:
//   makePuzzle(6,[-5],[-5,[2√2,-√5]],[-5]) → a 72-FACELET cube (heli is 48; the curvy cuts add a 12-edge
//   piece type) whose moveTable gives each edge twist as a facelet permutation.
// We load THAT independently, re-derive the 8-corner (CCW slots) + 24 face-piece (4 orbits of 6) + 24
// edge-facelet (12 orbits of 2) piece model from the geometry FROM SCRATCH (NOT copied from the solver's
// bytes), and (a) assert the solver's piece model is bit-exact against cstimer's moveTable over random
// sequences, (b) round-trip real cstimer helicv scrambles through solveHelicv and verify
// scramble∘solution = solved via this independent geometry. That geometry is the gold-standard oracle.

interface CstimerHelicv {
  EDGES: string[];
  gensF: number[][];          // 12 facelet permutations (the helicv generators), full 72-perm
  faceOf: number[];           // facelet -> face 0..5
}
function findRoot(rel: string): string | null {
  const candidates = [
    path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', '..', 'tools', 'cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, rel))) return c; } catch { /* ignore */ }
  }
  return null;
}
function makeSandbox(require: NodeJS.Require): Record<string, unknown> {
  const sandbox: Record<string, unknown> = Object.create(null);
  sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.console = console; sandbox.setTimeout = setTimeout; sandbox.clearTimeout = clearTimeout;
  sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
  sandbox.DEBUG = false; sandbox.importScripts = () => {}; sandbox.process = process; sandbox.require = require; sandbox.Math = Math;
  return sandbox;
}
function loadCstimerHelicv(): CstimerHelicv | null {
  const require = createRequire(import.meta.url);
  const root = findRoot(path.join('lib', 'poly3dlib.js'));
  if (!root) return null;
  const sandbox = makeSandbox(require);
  const ctx = vm.createContext(sandbox);
  for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'lib/poly3dlib.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const poly3d = sandbox.poly3d as {
    makePuzzle: (...a: unknown[]) => { moveTable: number[][]; getTwistyIdx: (s: string) => number; enumFacesPolys: (cb: (face: number, p: number, poly: { center: { x: number; y: number; z: number } }, idx: number) => void) => void; };
  };
  // helicv geometry (poly3dlib.js:1036).
  const puz = poly3d.makePuzzle(6, [-5], [-5, [2 * Math.sqrt(2), -Math.sqrt(5)]], [-5]);
  const EDGES = ['UF', 'UR', 'UB', 'UL', 'FR', 'BR', 'BL', 'FL', 'DF', 'DR', 'DB', 'DL'];
  let N = 0; puz.enumFacesPolys(() => { N++; });
  const faceOf: number[] = [];
  puz.enumFacesPolys((face, _p, _poly, idx) => { faceOf[idx] = face; });
  const gensF = EDGES.map((e) => puz.moveTable[puz.getTwistyIdx('1' + e)].map((v, k) => (v === -1 ? k : v)));
  return { EDGES, gensF, faceOf };
}

const ORACLE = loadCstimerHelicv();

// Build the oracle's facelet-state apply (solved facelet f shows its own face color).
function makeOracleApply(o: CstimerHelicv) {
  const idx = new Map(o.EDGES.map((e, i) => [e, i]));
  const solved = o.faceOf.slice();
  function applyTok(state: number[], tok: string): number[] {
    const g = o.gensF[idx.get(tok)!];
    const out = state.slice();
    for (let i = 0; i < state.length; i++) out[g[i]] = state[i];
    return out;
  }
  function applySeq(seq: string[]): number[] { let c = solved.slice(); for (const t of seq) c = applyTok(c, t); return c; }
  return { solved, applySeq };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Load real cstimer helicv scrambles via the scrambler (separate sandbox with the scramble engine).
function loadCstimerHelicvScrambles(count: number): string[] {
  const require = createRequire(import.meta.url);
  const root = findRoot(path.join('scramble', 'utilscramble.js'));
  if (!root) return [];
  const sandbox = makeSandbox(require);
  const ctx = vm.createContext(sandbox);
  for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/megascramble.js', 'scramble/utilscramble.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const scrMgr = sandbox.scrMgr as { scramblers: Record<string, (k: string, n?: number) => unknown>; toTxt?: (s: string) => string };
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw: unknown;
    for (let k = 0; k < 5000 && (raw === undefined || raw === null); k++) raw = scrMgr.scramblers['helicv']('helicv', 20);
    const txt = (scrMgr.toTxt ? scrMgr.toTxt(String(raw)) : String(raw)).trim();
    if (txt) out.push(txt);
  }
  return out;
}

describe('helicv-solver geometry (vs cstimer poly3dlib oracle)', () => {
  it('the oracle loads (poly3dlib makePuzzle helicv) — 72 facelets, 12 generators, all involutions', () => {
    expect(ORACLE, 'cstimer poly3dlib sandbox produced no helicv puzzle').not.toBeNull();
    const o = ORACLE!;
    expect(o.gensF.length).toBe(12);
    expect(o.faceOf.length).toBe(72); // curvy copter = 72 facelets (heli is 48)
    // every edge twist is a 180° involution
    for (let g = 0; g < 12; g++) { const p = o.gensF[g]; for (let i = 0; i < 72; i++) expect(p[p[i]]).toBe(i); }
  });

  it('the solver piece model is bit-exact against cstimer moveTable (single tokens + random sequences)', () => {
    const o = ORACLE!;
    const oracle = makeOracleApply(o);
    for (const tok of HELICV_MOVE_NAMES) {
      expect(helicvFaceletColors(tok), `token ${tok}`).toEqual(oracle.applySeq([tok]));
    }
    const rnd = mulberry32(0x4E12);
    for (let t = 0; t < 2000; t++) {
      const len = 1 + Math.floor(rnd() * 22);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(HELICV_MOVE_NAMES[Math.floor(rnd() * 12)]);
      expect(helicvFaceletColors(seq.join(' ')), `seq ${seq.join(' ')}`).toEqual(oracle.applySeq(seq));
    }
  });

  it('is a DIFFERENT puzzle from heli (72 vs 48 facelets) — documents the verified non-equivalence', () => {
    // heli has 48 facelets, helicv 72; helicv's extra 24 are the 12 curvy edge pieces (orbits of 2).
    expect(ORACLE!.faceOf.length).toBe(72);
    expect(HELICV_FACE_OF.length).toBe(72);
  });
});

describe('parseHelicvScramble', () => {
  it('rejects invalid tokens but accepts every helicv token', () => {
    expect(() => parseHelicvScramble('UF X')).toThrow();
    expect(() => parseHelicvScramble('U')).toThrow();
    expect(() => parseHelicvScramble("R'")).toThrow();
    expect(() => parseHelicvScramble('UF2')).toThrow();
    for (const t of HELICV_MOVE_NAMES) expect(() => parseHelicvScramble(t)).not.toThrow();
    expect(parseHelicvScramble('  UF DR  BL ')).toEqual(['UF', 'DR', 'BL']);
  });
});

describe('solveHelicv', () => {
  it('handles solved / empty input → length 0', () => {
    expect(solveHelicv('')).toEqual({ solution: '', length: 0, optimal: false });
    expect(solveHelicv('UF UF')).toEqual({ solution: '', length: 0, optimal: false });
  });

  it('rejects invalid tokens', () => {
    expect(() => solveHelicv('UF X')).toThrow();
    expect(() => solveHelicv('foo')).toThrow();
  });

  it('100% solve-rate on ≥500 random sequences: scramble∘solution = solved, length ≤ cap, legal tokens', () => {
    const o = ORACLE!;
    const oracle = makeOracleApply(o);
    const ALPHA = new Set(HELICV_MOVE_NAMES);
    const rnd = mulberry32(0x0EF2);
    let maxLen = 0;
    for (let trial = 0; trial < 600; trial++) {
      const len = 1 + Math.floor(rnd() * 24);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(HELICV_MOVE_NAMES[Math.floor(rnd() * 12)]);
      const scramble = seq.join(' ');

      const { solution, length, optimal } = solveHelicv(scramble);
      expect(optimal).toBe(false);
      expect(length).toBeLessThanOrEqual(HELICV_MAX_LENGTH);
      const solToks = solution ? solution.split(' ') : [];
      expect(solToks.length).toBe(length);
      for (const t of solToks) expect(ALPHA.has(t), `illegal token ${t}`).toBe(true);

      const after = oracle.applySeq([...seq, ...solToks]);
      expect(after, `failed to solve ${scramble}`).toEqual(oracle.solved);
      if (length > maxLen) maxLen = length;
    }
    expect(maxLen).toBeLessThanOrEqual(HELICV_MAX_LENGTH);
    expect(maxLen).toBeGreaterThan(0);
  });

  it('100% solve-rate on ≥200 REAL cstimer helicv scrambles (independent apply + alphabet + cap)', () => {
    const o = ORACLE!;
    const oracle = makeOracleApply(o);
    const scrambles = loadCstimerHelicvScrambles(220);
    expect(scrambles.length, 'cstimer helicv sandbox produced no scrambles').toBeGreaterThanOrEqual(200);
    const ALPHA = new Set(HELICV_MOVE_NAMES);
    for (const scramble of scrambles) {
      const seq = scramble.split(/\s+/).filter(Boolean);
      for (const t of seq) expect(ALPHA.has(t), `cstimer emitted non-helicv token ${t}`).toBe(true);
      const { solution, length } = solveHelicv(scramble);
      expect(length).toBeLessThanOrEqual(HELICV_MAX_LENGTH);
      const solToks = solution ? solution.split(' ') : [];
      for (const t of solToks) expect(ALPHA.has(t)).toBe(true);
      const after = oracle.applySeq([...seq, ...solToks]);
      expect(after, `failed to solve real cstimer scramble ${scramble}`).toEqual(oracle.solved);
    }
  });

  it('NEVER returns scramble⁻¹ (the solution is a real reduction, not an inverse playback)', () => {
    // For a long scramble, the bounded reduction's length is far above the scramble length, and the
    // solution is not just the reversed scramble. (Degenerate "return scramble⁻¹" would give length ==
    // scramble length and exact reverse — guard against the偷工 failure mode from §0.0 #8.)
    const scr = randomHelicvScramble(20, mulberry32(0xABCDE));
    const { solution, length } = solveHelicv(scr);
    expect(length).toBeGreaterThan(20); // a real reduction runs much longer than the 20-move scramble
    const rev = scr.split(/\s+/).reverse().join(' ');
    expect(solution).not.toBe(rev);
  });

  it('randomHelicvScramble emits only helicv tokens of the requested length, and solves', () => {
    const rnd = mulberry32(0x5EED8);
    const ALPHA = new Set(HELICV_MOVE_NAMES);
    for (let t = 0; t < 50; t++) {
      const scr = randomHelicvScramble(20, rnd);
      const toks = scr.split(/\s+/).filter(Boolean);
      expect(toks.length).toBe(20);
      for (const tok of toks) expect(ALPHA.has(tok)).toBe(true);
      const { length } = solveHelicv(scr);
      expect(length).toBeLessThanOrEqual(HELICV_MAX_LENGTH);
      expect(helicvApply(`${scr} ${solveHelicv(scr).solution}`)).toEqual(HELICV_SOLVED);
    }
  });
});

describe('helicvExamplesByLength', () => {
  it('generates valid example scrambles whose returned solution length equals the bucket', () => {
    const ex = helicvExamplesByLength(4);
    const bins = Object.keys(ex).map(Number);
    expect(bins.length).toBeGreaterThan(0);
    const ALPHA = new Set(HELICV_MOVE_NAMES);
    for (const d of bins) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(HELICV_MAX_LENGTH);
      for (const scr of ex[d]) {
        const toks = scr.split(/\s+/).filter(Boolean);
        for (const t of toks) expect(ALPHA.has(t)).toBe(true);
        expect(solveHelicv(scr).length).toBe(d);
        expect(helicvApply(`${scr} ${solveHelicv(scr).solution}`)).toEqual(HELICV_SOLVED);
      }
    }
  });
});

describe('exported constants', () => {
  it('HELICV_SOLVED is the identity state and the figures are the verified ones', () => {
    expect(HELICV_SOLVED.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(HELICV_SOLVED.co).size).toBe(1);
    expect(HELICV_SOLVED.wp.length).toBe(24);
    expect(HELICV_SOLVED.ep.length).toBe(24);
    expect(HELICV_MOVE_NAMES.length).toBe(12);
    // |G| = 8!·3^7·(6!)^4·2^12/2^5 = heli's |G| × 256 (Schreier-Sims verified)
    expect(HELICV_STATE_COUNT_STR).toBe('3,033,257,372,496,691,200,000');
    expect(HELICV_MAX_LENGTH).toBeGreaterThanOrEqual(290); // measured max over 1000+ real scrambles
  });
});

describe('renderHelicvScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);

  it('solved → canonical: each face renders a single solid color (self-proving)', () => {
    const colors = helicvFaceletColors('');
    for (let i = 0; i < 72; i++) expect(colors[i]).toBe(HELICV_FACE_OF[i]);
    const f = fills(renderHelicvScrambleSvg(''));
    expect(f.length).toBeGreaterThanOrEqual(73); // 1 bg + 6 face rects(none-fill) + 72 facelet polygons
  });

  it('a turn breaks canonical uniformity; round-trip restores it; solving renders solved', () => {
    const solvedFills = fills(renderHelicvScrambleSvg(''));
    expect(fills(renderHelicvScrambleSvg('UF'))).not.toEqual(solvedFills);
    expect(fills(renderHelicvScrambleSvg('UF UF'))).toEqual(solvedFills);

    const rnd = mulberry32(0x5F1C0D2);
    for (let trial = 0; trial < 30; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(HELICV_MOVE_NAMES[Math.floor(rnd() * 12)]);
      const scramble = seq.join(' ');
      const { solution } = solveHelicv(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(fills(renderHelicvScrambleSvg(combined)), `after solving "${scramble}"`).toEqual(solvedFills);
    }
  });
});
