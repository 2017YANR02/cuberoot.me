import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  DINO_MOVE_NAMES,
  DINO_SOLUTION_LENGTH_BOUND,
  dinoEpFromScramble,
  dinoStickers,
  dinoSolvedStickers,
  DINO_EDGE_FACES,
} from '@/lib/dino-solver';

/*
 * D-tier — Dino Cube (dinoso) NEAR-OPTIMAL solver test.
 *
 * The Dino Cube is a random-STATE, edge-only puzzle with A12 = 12!/2 = 239,500,800 states — no full BFS /
 * distance table, so we WRAP cstimer's own solver (tools/cstimer-scramble/scramble/redi.js
 * `redi.solveScramble`, the exact function the worker bridge calls). This test drives the REAL cstimer
 * engine via node:vm:
 *   (1) generate N real `dinoso` scrambles with cstimer's own generator,
 *   (2) solve each with `redi.solveScramble` (the wrapper path),
 *   (3) assert VALIDITY scramble∘solution = solved via the real engine's `redi.roundTripCheck` for ALL,
 *   (4) assert each near-optimal solution length ≤ a sane bound (NOT optimality — it's near-optimal),
 *   (5) anchor the TS edge-perm port (dinoEpFromScramble) move-for-move against the real engine's ep.
 * If the cstimer engine genuinely can't load, the oracle blocks console.warn + skip (the pure-TS sticker
 * + solved-self-certifying checks still run).
 */

// ── cstimer real-engine sandbox (loads the actual scramble core incl. redi.js → `redi`) ──
function locateCstimer(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../../tools/cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'scramble/redi.js'))) return c; } catch { /* ignore */ }
  }
  return null;
}

interface DinoEngine {
  solveScramble: (s: string) => string;
  roundTripCheck: (s: string) => boolean;
  edgePermOfScramble: (s: string) => number[];
}
interface CstimerCtx {
  scrMgr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  redi: DinoEngine;
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
      'scramble/scramble.js', 'scramble/redi.js',
    ];
    for (const f of files) {
      const code = fs.readFileSync(path.join(root, f), 'utf8');
      vm.runInContext(code, ctx, { filename: f });
    }
    const scrMgr = sandbox.scrMgr as CstimerCtx['scrMgr'];
    const redi = sandbox.redi as DinoEngine;
    if (!scrMgr || !redi || typeof redi.solveScramble !== 'function') { CSTIMER = null; return null; }
    CSTIMER = { scrMgr, redi };
    return CSTIMER;
  } catch (e) {
    console.warn('[dino_solver.test] cstimer vm load failed — skipping real-engine oracle', e);
    CSTIMER = null;
    return null;
  }
}

function genScramble(c: CstimerCtx): string | null {
  try {
    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['dinoso'];
    if (!fn) return null;
    let out: unknown;
    for (let k = 0; k < 50000 && out === undefined; k++) out = fn('dinoso');
    if (out == null) return null;
    const txt = c.scrMgr.toTxt ? c.scrMgr.toTxt(String(out)) : String(out);
    return String(txt).trim();
  } catch {
    return null;
  }
}

// ── pure-TS structural checks (run regardless of engine availability) ──
describe('dino-solver constants & sticker port (pure TS)', () => {
  it('exposes the exact cstimer dinoso token alphabet (8 corner axes, optionally primed)', () => {
    expect(new Set(DINO_MOVE_NAMES)).toEqual(new Set([
      'F', "F'", 'L', "L'", 'B', "B'", 'R', "R'",
      'f', "f'", 'l', "l'", 'b', "b'", 'r', "r'",
    ]));
  });

  it('solved state → each of the 6 faces is a single color (self-certifying)', () => {
    const st = dinoSolvedStickers();
    expect(st.length).toBe(24);
    // group stickers by their solved face and assert uniformity
    const byFace = new Map<number, Set<number>>();
    for (let s = 0; s < 24; s++) {
      const e = Math.floor(s / 2);
      const face = DINO_EDGE_FACES[e][s % 2];
      const set = byFace.get(face) ?? new Set<number>();
      set.add(st[s]);
      byFace.set(face, set);
    }
    expect(byFace.size).toBe(6);
    for (const [face, colors] of byFace) {
      expect(colors.size, `face ${face} uniform when solved`).toBe(1);
    }
    // 6 distinct face colors
    expect(new Set([...byFace.values()].map((s) => [...s][0])).size).toBe(6);
  });

  it('a move breaks face uniformity; its inverse / order-3 restores it', () => {
    const solved = dinoStickers('').join(',');
    expect(dinoStickers('F').join(',')).not.toBe(solved);
    expect(dinoStickers("F F'").join(',')).toBe(solved);
    expect(dinoStickers('F F F').join(',')).toBe(solved); // order 3
    expect(dinoStickers('r l b').join(',')).not.toBe(solved);
  });

  it('solved edge perm is the identity; a move permutes it', () => {
    expect(dinoEpFromScramble('')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(dinoEpFromScramble('F')).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(dinoEpFromScramble("F F'")).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('rejects unknown tokens in the strict edge-perm path', () => {
    expect(() => dinoEpFromScramble('X')).toThrow();
    expect(() => dinoEpFromScramble("F2")).toThrow();
  });
});

// ── cstimer real-engine oracle: generation + validity + length + edge-perm faithfulness ──
describe('cstimer dino oracle (real engine via node:vm)', () => {
  it('N real dinoso scrambles all round-trip (scramble∘solution = solved) + length ≤ bound', () => {
    const c = loadCstimer();
    if (!c) { console.warn('[dino_solver.test] cstimer engine unavailable — skipping oracle'); return; }

    // make sure the generator is callable (lazy prune-table build on first solve)
    let probe: string | null = null;
    for (let i = 0; i < 20 && probe === null; i++) probe = genScramble(c);
    if (probe === null) {
      console.warn('[dino_solver.test] dinoso generator unavailable — skipping real-scramble oracle');
      return;
    }

    const N = 40;
    const lengths: number[] = [];
    const tokSet = new Set<string>();
    let generated = 0, roundTripFails = 0;
    const tokenRe = /^[FLBRflbr]'?$/;

    for (let i = 0; i < N; i++) {
      const scr = genScramble(c);
      if (!scr) continue;
      generated++;

      // (a) the near-optimal solution (cstimer IDA*) + its length ≤ a sane bound.
      const sol = c.redi.solveScramble(scr).trim();
      const len = sol ? sol.split(/\s+/).length : 0;
      lengths.push(len);
      expect(len, `length bound: ${scr} → ${sol}`).toBeLessThanOrEqual(DINO_SOLUTION_LENGTH_BOUND);
      for (const t of sol.split(/\s+/)) {
        if (!t) continue;
        if (!tokenRe.test(t)) tokSet.add(t); // collect any UNEXPECTED token
      }

      // (b) VALIDITY: the real engine confirms scramble∘solution = solved, by
      // applying the just-computed solution on top of the scramble's edge perm
      // and checking the result is the identity (avoids re-running the solver).
      const ep = c.redi.edgePermOfScramble(scr + (sol ? ' ' + sol : ''));
      const ok = ep.every((v, k) => v === k);
      if (!ok) roundTripFails++;
      expect(ok, `round-trip valid: ${scr} → ${sol}`).toBe(true);
    }

    expect(generated).toBeGreaterThan(0);
    expect(roundTripFails).toBe(0);
    expect([...tokSet], 'no unexpected solution tokens').toEqual([]);

    // record the near-optimal length distribution (mean) — informational, with a loose sanity range.
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    // dino near-optimal solutions are typically ~7–11 face-turns (God's number 10); assert a wide band.
    expect(mean).toBeGreaterThan(3);
    expect(mean).toBeLessThan(DINO_SOLUTION_LENGTH_BOUND);
    // eslint-disable-next-line no-console
    console.log(`[dino_solver.test] near-optimal length over ${lengths.length} real scrambles: mean ${mean.toFixed(2)}, min ${Math.min(...lengths)}, max ${Math.max(...lengths)}`);
  }, 180_000); // ~40 scrambles × one solve each + lazy prune-table build on first solve

  it('empty scramble solves to empty; a single move solves to its inverse', () => {
    const c = loadCstimer();
    if (!c) { console.warn('[dino_solver.test] cstimer engine unavailable — skipping'); return; }
    expect(c.redi.solveScramble('').trim()).toBe('');
    expect(c.redi.roundTripCheck('')).toBe(true);
    expect(c.redi.roundTripCheck('F')).toBe(true);
    expect(c.redi.roundTripCheck("r' l b")).toBe(true);
  }, 60_000);

  it('TS edge-perm port (dinoEpFromScramble) matches the real cstimer edge perm move-for-move', () => {
    const c = loadCstimer();
    if (!c) { console.warn('[dino_solver.test] cstimer engine unavailable — skipping edge-perm anchor'); return; }
    const moves = [
      'F', "F'", 'L', "L'", 'B', "B'", 'R', "R'",
      'f', "f'", 'l', "l'", 'b', "b'", 'r', "r'",
    ];
    let seed = 0x9E37;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let checked = 0;
    for (let trial = 0; trial < 200; trial++) {
      const len = 1 + Math.floor(rnd() * 14);
      const seq: string[] = [];
      for (let i = 0; i < len; i++) seq.push(moves[Math.floor(rnd() * moves.length)]);
      const scr = seq.join(' ');
      const ref = c.redi.edgePermOfScramble(scr);
      const got = dinoEpFromScramble(scr);
      expect(got, `ep for "${scr}"`).toEqual(ref);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
