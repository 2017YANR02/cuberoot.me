import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  MPYR_MOVE_NAMES,
  MPYR_SOLUTION_LENGTH_BOUND,
  mpyrFacelets,
  mpyrSolvedFacelets,
} from '@/lib/mpyr-solver';

/*
 * D1a — Master Pyraminx (mpyrso) NEAR-OPTIMAL solver test.
 *
 * The Master Pyraminx is a random-STATE puzzle with ~4.6×10¹¹ states — no full BFS / distance table, so
 * we WRAP cstimer's own two-phase solver (tools/cstimer-scramble/scramble/pyraminx.js `mpyr.solveScramble`,
 * the exact function the worker bridge calls). This test drives the REAL cstimer engine via node:vm:
 *   (1) generate N real `mpyrso` scrambles with cstimer's own generator,
 *   (2) solve each with `mpyr.solveScramble` (the wrapper path),
 *   (3) assert VALIDITY scramble∘solution = solved via the real engine's `mpyr.roundTripCheck` for ALL,
 *   (4) assert each near-optimal solution length ≤ a sane bound (NOT optimality — it's near-optimal),
 *   (5) anchor the TS preview port (mpyrFacelets) move-for-move against the real engine's facelets.
 * If the cstimer engine genuinely can't load, the oracle blocks console.warn + skip (the pure-TS facelet
 * + solved-self-certifying checks still run).
 */

// ── cstimer real-engine sandbox (loads the actual scramble core incl. pyraminx.js → `mpyr`) ──
function locateCstimer(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../../tools/cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'scramble/pyraminx.js'))) return c; } catch { /* ignore */ }
  }
  return null;
}

interface MpyrEngine {
  solveScramble: (s: string) => string;
  roundTripCheck: (s: string) => boolean;
  faceletsOfScramble: (s: string) => number[];
  solveTest: (n: number) => number[];
}
interface CstimerCtx {
  scrMgr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  mpyr: MpyrEngine;
}

let CSTIMER: CstimerCtx | null | undefined;
function loadCstimer(): CstimerCtx | null {
  if (CSTIMER !== undefined) return CSTIMER;
  const root = locateCstimer();
  if (!root) { CSTIMER = null; return null; }
  try {
    const sandbox: Record<string, unknown> = Object.create(null);
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
    const files = [
      'lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js',
      'scramble/scramble.js', 'scramble/pyraminx.js',
    ];
    for (const f of files) {
      const code = fs.readFileSync(path.join(root, f), 'utf8');
      vm.runInContext(code, ctx, { filename: f });
    }
    const scrMgr = sandbox.scrMgr as CstimerCtx['scrMgr'];
    const mpyr = sandbox.mpyr as MpyrEngine;
    if (!scrMgr || !mpyr || typeof mpyr.solveScramble !== 'function') { CSTIMER = null; return null; }
    CSTIMER = { scrMgr, mpyr };
    return CSTIMER;
  } catch (e) {
    console.warn('[mpyr_solver.test] cstimer vm load failed — skipping real-engine oracle', e);
    CSTIMER = null;
    return null;
  }
}

function genScramble(c: CstimerCtx): string | null {
  try {
    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['mpyrso'];
    if (!fn) return null;
    const out = fn('mpyrso');
    if (out == null) return null;
    const txt = c.scrMgr.toTxt ? c.scrMgr.toTxt(String(out)) : String(out);
    return String(txt).trim();
  } catch {
    return null;
  }
}

// ── pure-TS structural checks (run regardless of engine availability) ──
describe('mpyr-solver constants & facelet port (pure TS)', () => {
  it('exposes the exact cstimer mpyrso token alphabet (8 body axes + 4 tips)', () => {
    expect(new Set(MPYR_MOVE_NAMES)).toEqual(new Set([
      'U', "U'", 'Uw', "Uw'", 'B', "B'", 'Bw', "Bw'",
      'R', "R'", 'Rw', "Rw'", 'L', "L'", 'Lw', "Lw'",
      'u', "u'", 'r', "r'", 'l', "l'", 'b', "b'",
    ]));
  });

  it('solved state → each of the 4 faces is a single color (self-certifying)', () => {
    const f = mpyrSolvedFacelets();
    expect(f.length).toBe(52);
    for (let face = 0; face < 4; face++) {
      const slice = f.slice(face * 13, face * 13 + 13);
      expect(new Set(slice).size, `face ${face} uniform when solved`).toBe(1);
    }
    // 4 faces use 4 distinct colors
    expect(new Set([f[0], f[13], f[26], f[39]]).size).toBe(4);
  });

  it('a body move breaks face uniformity; an inverse restores it', () => {
    const solved = mpyrSolvedFacelets().join(',');
    expect(mpyrFacelets('U').join(',')).not.toBe(solved);
    expect(mpyrFacelets("U U'").join(',')).toBe(solved);
    expect(mpyrFacelets('Rw Rw Rw').join(',')).toBe(solved); // base order 3
    // tips don't touch the 52 body facelets
    expect(mpyrFacelets('u').join(',')).toBe(solved);
    expect(mpyrFacelets("r' l b'").join(',')).toBe(solved);
  });
});

// ── cstimer real-engine oracle: generation + validity + length + preview faithfulness ──
describe('cstimer mpyr oracle (real engine via node:vm)', () => {
  it("solveTest's own random-state self-check passes (sanity that the engine works)", () => {
    const c = loadCstimer();
    if (!c) { console.warn('[mpyr_solver.test] cstimer engine unavailable — skipping oracle'); return; }
    // solveTest scrambles n random body moves, solves, and (internally) console.errors on failure.
    // It returns [p1len, p2len, t1, t2]; just assert it runs and returns sane numbers.
    for (const n of [5, 8, 12, 16]) {
      const r = c.mpyr.solveTest(n);
      expect(Array.isArray(r)).toBe(true);
      expect(r[0]).toBeGreaterThanOrEqual(0);
      expect(r[1]).toBeGreaterThanOrEqual(0);
    }
  }, 120_000); // first solve builds prune tables

  it('N real mpyrso scrambles all round-trip (scramble∘solution = solved) + length ≤ bound', () => {
    const c = loadCstimer();
    if (!c) { console.warn('[mpyr_solver.test] cstimer engine unavailable — skipping oracle'); return; }

    // make sure the generator is callable (lazy prune-table build on first solve)
    let probe: string | null = null;
    for (let i = 0; i < 20 && probe === null; i++) probe = genScramble(c);
    if (probe === null) {
      console.warn('[mpyr_solver.test] mpyrso generator unavailable — skipping real-scramble oracle');
      return;
    }

    const N = 24; // each solve ~2-3s (cstimer two-phase); keep total under the test timeout
    const lengths: number[] = [];
    const tokSet = new Set<string>();
    let generated = 0, roundTripFails = 0;
    const bodyTokens = new Set([
      'U', "U'", 'Uw', "Uw'", 'B', "B'", 'Bw', "Bw'",
      'R', "R'", 'Rw', "Rw'", 'L', "L'", 'Lw', "Lw'",
    ]);
    const tipBase = new Set(['u', 'r', 'l', 'b']);

    for (let i = 0; i < N; i++) {
      const scr = genScramble(c);
      if (!scr) continue;
      generated++;

      // (a) VALIDITY: the real engine confirms scramble∘solution = solved.
      const ok = c.mpyr.roundTripCheck(scr);
      if (!ok) roundTripFails++;
      expect(ok, `round-trip valid: ${scr}`).toBe(true);

      // (b) the near-optimal solution length (cstimer two-phase + tips) ≤ a sane bound.
      const sol = c.mpyr.solveScramble(scr).trim();
      const len = sol ? sol.split(/\s+/).length : 0;
      lengths.push(len);
      expect(len, `length bound: ${scr} → ${sol}`).toBeLessThanOrEqual(MPYR_SOLUTION_LENGTH_BOUND);
      for (const t of sol.split(/\s+/)) {
        if (!t) continue;
        const base = t.replace(/2?'?$/, '');
        if (!(bodyTokens.has(t) || tipBase.has(base))) tokSet.add(t); // collect any UNEXPECTED token
      }
    }

    expect(generated).toBeGreaterThan(0);
    expect(roundTripFails).toBe(0);
    expect([...tokSet], 'no unexpected solution tokens').toEqual([]);

    // record the near-optimal length distribution (mean) — informational, with a loose sanity range.
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    // cstimer's near-optimal master-pyraminx solutions are typically ~10–20 face-turns; assert a wide band.
    expect(mean).toBeGreaterThan(4);
    expect(mean).toBeLessThan(MPYR_SOLUTION_LENGTH_BOUND);
    // eslint-disable-next-line no-console
    console.log(`[mpyr_solver.test] near-optimal length over ${lengths.length} real scrambles: mean ${mean.toFixed(2)}, min ${Math.min(...lengths)}, max ${Math.max(...lengths)}`);
  }, 180_000); // ~24 scrambles × ~2-3s each + lazy prune-table build on first solve

  it('TS preview port (mpyrFacelets) matches the real cstimer cubie facelets move-for-move', () => {
    const c = loadCstimer();
    if (!c) { console.warn('[mpyr_solver.test] cstimer engine unavailable — skipping facelet anchor'); return; }
    // build random body-move sequences and compare our 52-facelet array to the real engine's.
    const body = [
      'U', "U'", 'Uw', "Uw'", 'B', "B'", 'Bw', "Bw'",
      'R', "R'", 'Rw', "Rw'", 'L', "L'", 'Lw', "Lw'",
    ];
    let seed = 0x9E37;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let checked = 0;
    for (let trial = 0; trial < 80; trial++) {
      const len = 1 + Math.floor(rnd() * 12);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(body[Math.floor(rnd() * body.length)]);
      const scr = seq.join(' ');
      const ref = c.mpyr.faceletsOfScramble(scr);
      const got = mpyrFacelets(scr);
      expect(got, `facelets for "${scr}"`).toEqual(ref);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
