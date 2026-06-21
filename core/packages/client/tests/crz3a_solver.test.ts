import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  CRZ3A_MOVE_NAMES,
  CRZ3A_SOLUTION_LENGTH_BOUND,
  solveCrz3a,
} from '@/lib/crz3a-solver';
// Independent 3×3 oracle: the kociemba cube model. We re-apply scramble∘solution to
// a FRESH solved cube and assert it returns to solved — a check independent of the
// solver's own internal state (the solver also uses this model, but the round-trip
// re-derivation here is a separate computation that catches any sign/inversion bug).
import {
  parseMoves,
  applySequence,
  solvedCubie,
  isSolvedCubie,
} from '@/app/[lang]/scramble/solver/_kociemba/cube';

/*
 * D1b — Crazy 3×3 (crz3a) NEAR-OPTIMAL solver test.
 *
 * crz3a is mechanically an ORDINARY 3×3 cube (cstimer megascramble.js:27 uses the standard U/D/L/R/F/B move
 * set; the "crazy" is purely cosmetic), with ~4.3×10¹⁹ states — far too many for a full BFS / God's-number
 * table. So we REUSE the site's own client-side kociemba two-phase solver (lib/crz3a-solver → solveCrz3a).
 * This test:
 *   (1) generates N real `crz3a` scrambles with cstimer's own generator (via node:vm),
 *   (2) solves each with solveCrz3a (the kociemba two-phase engine, run directly — no worker/DOM),
 *   (3) asserts VALIDITY scramble∘solution = solved via an INDEPENDENT 3×3 apply (kociemba cube model),
 *   (4) asserts each near-optimal solution length ≤ a sane bound (NOT optimality — it's near-optimal),
 *   (5) asserts every solution token is a standard 3×3 HTM move.
 * If the cstimer engine can't load, it falls back to locally-generated random 3×3 scrambles so the core
 * round-trip contract is still exercised.
 */

// ── cstimer real-engine sandbox (loads the scramble core incl. megascramble.js → crz3a generator) ──
function locateCstimer(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../../tools/cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(path.join(c, 'scramble/megascramble.js'))) return c; } catch { /* ignore */ }
  }
  return null;
}

interface CstimerCtx {
  scrMgr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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
      'scramble/scramble.js', 'scramble/megascramble.js',
    ];
    for (const f of files) {
      const code = fs.readFileSync(path.join(root, f), 'utf8');
      vm.runInContext(code, ctx, { filename: f });
    }
    const scrMgr = sandbox.scrMgr as CstimerCtx['scrMgr'];
    if (!scrMgr || !scrMgr.scramblers || !scrMgr.scramblers['crz3a']) { CSTIMER = null; return null; }
    CSTIMER = { scrMgr };
    return CSTIMER;
  } catch (e) {
    console.warn('[crz3a_solver.test] cstimer vm load failed — falling back to local scrambles', e);
    CSTIMER = null;
    return null;
  }
}

function genCstimerScramble(c: CstimerCtx): string | null {
  try {
    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['crz3a'];
    if (!fn) return null;
    // crz3a's megascramble needs an explicit length (the cstimer event registry uses 25);
    // calling fn('crz3a') with no length yields an empty scramble.
    const out = fn('crz3a', 25);
    if (out == null) return null;
    const txt = c.scrMgr.toTxt ? c.scrMgr.toTxt(String(out)) : String(out);
    const s = String(txt).trim();
    return s.length > 0 ? s : null;
  } catch {
    return null;
  }
}

// Local fallback random 3×3 scramble (no consecutive same-face), used only if the
// cstimer engine can't load. Honors the same standard HTM alphabet.
function localScramble(len: number, rnd: () => number): string {
  const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
  const suff = ['', '2', "'"];
  const out: string[] = [];
  let prev = -1;
  for (let i = 0; i < len; i++) {
    let f = Math.floor(rnd() * 6);
    while (f === prev) f = Math.floor(rnd() * 6);
    prev = f;
    out.push(faces[f] + suff[Math.floor(rnd() * 3)]);
  }
  return out.join(' ');
}

const HTM_RE = /^[URFDLB][2']?$/;

// ── pure-TS structural checks ──
describe('crz3a-solver constants (pure TS)', () => {
  it('exposes the standard 3×3 HTM token alphabet (18 moves)', () => {
    expect(CRZ3A_MOVE_NAMES.length).toBe(18);
    for (const m of CRZ3A_MOVE_NAMES) expect(HTM_RE.test(m), m).toBe(true);
    expect(new Set(CRZ3A_MOVE_NAMES).size).toBe(18);
  });

  it('an already-solved (empty) scramble returns length 0', async () => {
    const r = await solveCrz3a('');
    expect(r.length).toBe(0);
    expect(r.solution).toBe('');
    // a scramble that nets to solved (X X') is also length 0
    const r2 = await solveCrz3a("R R'");
    expect(r2.length).toBe(0);
  });

  it('throws on a non-3×3 token', async () => {
    await expect(solveCrz3a('Rw')).rejects.toThrow();
    await expect(solveCrz3a('Z')).rejects.toThrow();
  });
});

// ── real-engine oracle: generation + validity + length + token alphabet ──
describe('crz3a near-optimal solver (kociemba two-phase) — validity + length', () => {
  it('N real crz3a scrambles all round-trip (scramble∘solution = solved) + length ≤ bound', async () => {
    const c = loadCstimer();
    const N = 22; // each solve uses the (once-built, memoized) kociemba tables
    let seed = 0x1234abcd;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    const lengths: number[] = [];
    let used = 0, roundTripFails = 0, fromCstimer = 0;

    for (let i = 0; i < N; i++) {
      // prefer a real cstimer crz3a scramble; fall back to a local random 3×3 scramble.
      let scr: string | null = c ? genCstimerScramble(c) : null;
      if (scr) fromCstimer++;
      if (!scr) scr = localScramble(20 + (i % 6), rnd);
      if (!scr) continue;
      used++;

      const { solution, length } = await solveCrz3a(scr);

      // (a) every solution token is a standard 3×3 HTM move.
      if (length > 0) {
        for (const t of solution.split(/\s+/)) {
          expect(HTM_RE.test(t), `solution token "${t}" for ${scr}`).toBe(true);
        }
      }

      // (b) VALIDITY via an INDEPENDENT 3×3 apply: scramble∘solution = solved.
      const after = applySequence(
        applySequence(solvedCubie(), parseMoves(scr)),
        length > 0 ? parseMoves(solution) : [],
      );
      const ok = isSolvedCubie(after);
      if (!ok) roundTripFails++;
      expect(ok, `round-trip valid: ${scr} → ${solution}`).toBe(true);

      // (c) near-optimal length ≤ a sane bound (NOT an optimality claim).
      expect(length, `length bound: ${scr} → ${solution}`).toBeLessThanOrEqual(CRZ3A_SOLUTION_LENGTH_BOUND);
      lengths.push(length);
    }

    expect(used).toBeGreaterThan(0);
    expect(roundTripFails).toBe(0);

    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    // kociemba two-phase solutions of random 3×3 states are typically ~18-23 HTM.
    expect(mean).toBeGreaterThan(10);
    expect(mean).toBeLessThanOrEqual(CRZ3A_SOLUTION_LENGTH_BOUND);
    // eslint-disable-next-line no-console
    console.log(`[crz3a_solver.test] near-optimal length over ${lengths.length} scrambles (${fromCstimer} from cstimer): mean ${mean.toFixed(2)}, min ${Math.min(...lengths)}, max ${Math.max(...lengths)}`);
  }, 180_000); // ~22 solves + a one-time kociemba prune-table build on the first solve
});
