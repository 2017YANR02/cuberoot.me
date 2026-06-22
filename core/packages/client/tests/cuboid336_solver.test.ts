import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  solveCuboid336,
  cuboid336Apply,
  parseCuboid336Scramble,
  cuboid336Heuristic,
  cuboid336DbStats,
  randomCuboid336Scramble,
  CUBOID336_MOVE_NAMES,
  CUBOID336_MAX_LENGTH,
  CUBOID336_STATE_COUNT_STR,
  CUBOID336_ORBIT_PRODUCT_STR,
  CUBOID336_GROUP_ORDER_STR,
} from '@/lib/cuboid336-solver';
import { renderCuboid336ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid336_svg';

// ── INDEPENDENT geometric re-derivation of the 336 move model ─────────────────────
// We rebuild the 90-facelet permutations FROM 3D geometry here — NOT importing the solver's MOVE_PERM —
// so a subtly-wrong mechanism in the solver would fail this anchor even though the puzzle would still
// "solve" itself (the copy-the-table mistake proved nothing; this does not).
const NX = 3, NY = 6, NZ = 3;
type RFace = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';
interface RS { x: number; y: number; z: number; nx: number; ny: number; nz: number; face: RFace; }
const NORMALS: ReadonlyArray<{ id: RFace; n: [number, number, number] }> = [
  { id: 'U', n: [0, 1, 0] }, { id: 'D', n: [0, -1, 0] },
  { id: 'R', n: [1, 0, 0] }, { id: 'L', n: [-1, 0, 0] },
  { id: 'B', n: [0, 0, 1] }, { id: 'F', n: [0, 0, -1] },
];
const inSolid = (x: number, y: number, z: number) => x >= 0 && x < NX && y >= 0 && y < NY && z >= 0 && z < NZ;
const REF_STICKERS: RS[] = (() => {
  const out: RS[] = [];
  for (let x = 0; x < NX; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
    for (const f of NORMALS) { const [dx, dy, dz] = f.n; if (!inSolid(x + dx, y + dy, z + dz)) out.push({ x, y, z, nx: dx, ny: dy, nz: dz, face: f.id }); }
  }
  return out;
})();
const N = REF_STICKERS.length; // 90
const k = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => `${x},${y},${z}|${nx},${ny},${nz}`;
const REF_IDX = new Map<string, number>(REF_STICKERS.map((s, i) => [k(s.x, s.y, s.z, s.nx, s.ny, s.nz), i]));
const cx = (x: number) => x - 1, icx = (c: number) => c + 1, cz = (z: number) => z - 1, icz = (c: number) => c + 1;
const YMID = (NY - 1) / 2;
function refPerm(pred: (s: RS) => boolean, tf: (s: RS) => [number, number, number, number, number, number]): number[] {
  const fwd = new Array<number>(N);
  for (let i = 0; i < N; i++) { const s = REF_STICKERS[i]; if (!pred(s)) { fwd[i] = i; continue; } const [a, b, c, d, e, f] = tf(s); const di = REF_IDX.get(k(a, b, c, d, e, f)); if (di === undefined) throw new Error('ref left surface'); fwd[i] = di; }
  const P = new Array<number>(N); for (let s = 0; s < N; s++) P[fwd[s]] = s; return P;
}
const mkY = (yL: number) => refPerm((s) => s.y === yL, (s) => [icx(cz(s.z)), s.y, icz(-cx(s.x)), s.nz, s.ny, -s.nx]);
const RU = mkY(5), Ru = mkY(4), R3u = mkY(3);
const mkX = (sx: number) => refPerm((s) => s.x === sx, (s) => [s.x, 2 * YMID - s.y, icz(-cz(s.z)), s.nx, -s.ny, -s.nz]);
const mkZ = (sz: number) => refPerm((s) => s.z === sz, (s) => [icx(-cx(s.x)), 2 * YMID - s.y, s.z, -s.nx, -s.ny, s.nz]);
const RR2 = mkX(2), RL2 = mkX(0), RM2 = mkX(1), RF2 = mkZ(2), RB2 = mkZ(0), RS2 = mkZ(1);
const FACE_CODE: Record<RFace, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const REF_SOLVED = REF_STICKERS.map((s) => FACE_CODE[s.face]);
interface RM { name: string; base: number[]; pow: number; }
const REF_MOVES: ReadonlyArray<RM> = [
  { name: 'U', base: RU, pow: 1 }, { name: "U'", base: RU, pow: 3 }, { name: 'U2', base: RU, pow: 2 },
  { name: 'u', base: Ru, pow: 1 }, { name: "u'", base: Ru, pow: 3 }, { name: 'u2', base: Ru, pow: 2 },
  { name: '3u', base: R3u, pow: 1 }, { name: "3u'", base: R3u, pow: 3 }, { name: '3u2', base: R3u, pow: 2 },
  { name: 'R2', base: RR2, pow: 1 }, { name: 'L2', base: RL2, pow: 1 }, { name: 'M2', base: RM2, pow: 1 },
  { name: 'F2', base: RF2, pow: 1 }, { name: 'B2', base: RB2, pow: 1 }, { name: 'S2', base: RS2, pow: 1 },
];
const REF_BY_NAME = new Map(REF_MOVES.map((m) => [m.name, m]));
function refApplyBase(state: ReadonlyArray<number>, base: number[]): number[] { const o = new Array<number>(N); for (let i = 0; i < N; i++) o[i] = state[base[i]]; return o; }
function refApplyTokens(tokens: string[]): number[] { let s = [...REF_SOLVED]; for (const t of tokens) { const m = REF_BY_NAME.get(t); if (!m) throw new Error('ref bad ' + t); for (let i = 0; i < m.pow; i++) s = refApplyBase(s, m.base); } return s; }
function refApply(scr: string): number[] { return refApplyTokens(scr.trim().split(/\s+/).filter(Boolean)); }
const keyOf = (s: ReadonlyArray<number>) => s.join(',');
const REF_SOLVED_KEY = keyOf(REF_SOLVED);

function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function randomRefScramble(len: number, rnd: () => number): string {
  const turns: ReadonlyArray<ReadonlyArray<string[]>> = [[['U', "U'", 'U2'], ['u', "u'", 'u2'], ['3u', '3u2', "3u'"]], [['R2', 'L2', 'M2']], [['F2', 'B2', 'S2']]];
  let done = 0, lastaxis = -1; const s: string[] = [];
  for (let i = 0; i < len; i++) { let first = 0, second = 0; do { first = Math.floor(rnd() * turns.length); second = Math.floor(rnd() * turns[first].length); if (first !== lastaxis) { done = 0; lastaxis = first; } } while (((done >> second) & 1) !== 0); done |= 1 << second; const cell = turns[first][second]; s.push(cell[Math.floor(rnd() * cell.length)]); }
  return s.join(' ');
}

describe('cuboid336 reference (independent geometry)', () => {
  it('exposes the exact 15-token alphabet (21 cstimer tokens, 15 distinct base/power moves)', () => {
    expect(CUBOID336_MOVE_NAMES.length).toBe(15);
    expect([...CUBOID336_MOVE_NAMES].sort()).toEqual(
      ['B2', 'F2', 'L2', 'M2', 'R2', 'S2', 'U', "U'", 'U2', 'u', "u'", 'u2', '3u', "3u'", '3u2'].sort(),
    );
  });

  it('base move orders match the physics (U^4 = u^4 = 3u^4 = id, all lateral^2 = id)', () => {
    expect(keyOf(refApplyTokens(['U', 'U', 'U', 'U']))).toBe(REF_SOLVED_KEY);
    expect(keyOf(refApplyTokens(['u', 'u', 'u', 'u']))).toBe(REF_SOLVED_KEY);
    expect(keyOf(refApplyTokens(['3u', '3u', '3u', '3u']))).toBe(REF_SOLVED_KEY);
    for (const t of ['R2', 'L2', 'M2', 'F2', 'B2', 'S2']) expect(keyOf(refApplyTokens([t, t])), `${t}^2`).toBe(REF_SOLVED_KEY);
  });

  it('the 15 move effects are reproduced move-for-move by the solver apply', () => {
    const rnd = mulberry32(0x336a11);
    for (const tok of CUBOID336_MOVE_NAMES) {
      expect(Array.from(cuboid336Apply(tok))).toEqual(refApplyTokens([tok]));
      for (let t = 0; t < 20; t++) {
        const pre: string[] = []; const n = 1 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) pre.push(CUBOID336_MOVE_NAMES[Math.floor(rnd() * 15)]);
        expect(Array.from(cuboid336Apply([...pre, tok].join(' '))), `${tok} after ${pre.join(' ')}`).toEqual(refApplyTokens([...pre, tok]));
      }
    }
  });
});

describe('cuboid336 pattern databases (measured orbit sub-spaces)', () => {
  it('the seven movable orbit DBs cover the measured full sizes, 180deg subgroup sizes, and phase depths', () => {
    const { sizes, inHCounts, p2MaxDepths, intoHMaxDepths } = cuboid336DbStats();
    // full reachable sub-state count per movable orbit (under all 15 moves)
    expect(sizes).toEqual([40320, 40320, 40320, 2520, 40320, 2520, 2]);
    // size of the 180deg-only subgroup H per orbit (phase-2 lives here)
    expect(inHCounts).toEqual([96, 576, 96, 36, 96, 36, 2]);
    // diameter of each per-orbit 180deg subgroup (phase-2 admissible PDB depth)
    expect(p2MaxDepths).toEqual([5, 7, 5, 5, 5, 5, 1]);
    // max moves to enter H from any sub-state (phase-1 admissible heuristic depth)
    expect(intoHMaxDepths).toEqual([11, 5, 11, 5, 11, 5, 0]);
  });
});

describe('cuboid336 state-space constants', () => {
  it('locks the Schreier-Sims group order, orbit product, and physical state-count strings', () => {
    expect(CUBOID336_GROUP_ORDER_STR).toBe('2,148,291,177,752,310,054,912,000,000');
    expect(CUBOID336_ORBIT_PRODUCT_STR).toBe('33,567,049,652,379,844,608,000,000');
    expect(CUBOID336_STATE_COUNT_STR).toBe('8,391,762,413,094,961,152,000,000');
  });
});

describe('solveCuboid336 — validity (round-trip via INDEPENDENT geometry)', () => {
  it('handles solved / empty input', () => {
    expect(solveCuboid336('')).toEqual({ solution: '', length: 0, optimal: true });
    expect(solveCuboid336("U U'")).toEqual({ solution: '', length: 0, optimal: true });
  });

  it('single-move scrambles solve optimally in one move with the inverse token', () => {
    expect(solveCuboid336("U'")).toMatchObject({ solution: 'U', optimal: true });
    expect(solveCuboid336('U')).toMatchObject({ solution: "U'", optimal: true });
    expect(solveCuboid336('U2')).toMatchObject({ solution: 'U2', optimal: true });
    expect(solveCuboid336("u'")).toMatchObject({ solution: 'u', optimal: true });
    expect(solveCuboid336('3u')).toMatchObject({ solution: "3u'", optimal: true });
    expect(solveCuboid336("3u'")).toMatchObject({ solution: '3u', optimal: true });
    for (const t of ['R2', 'L2', 'M2', 'F2', 'B2', 'S2']) {
      const r = solveCuboid336(t);
      expect(r.length, t).toBe(1);
      expect(r.solution, t).toBe(t); // each lateral move is its own inverse
      expect(r.optimal, t).toBe(true);
    }
  });

  it('rejects invalid tokens', () => {
    expect(() => solveCuboid336('D')).toThrow();   // no D axis
    expect(() => solveCuboid336('R')).toThrow();    // lateral faces can't turn 90deg
    expect(() => solveCuboid336('U3')).toThrow();
    expect(() => solveCuboid336('4u')).toThrow();   // no fourth vertical layer
    expect(() => parseCuboid336Scramble('Rw')).toThrow();
    expect(() => parseCuboid336Scramble("M2'")).toThrow();
  });

  it('short random scrambles (depth <= 8) all solve optimally and round-trip (80 trials)', () => {
    const rnd = mulberry32(0x336bf5);
    for (let trial = 0; trial < 80; trial++) {
      const len = 1 + Math.floor(rnd() * 8);
      const scramble = randomRefScramble(len, rnd);
      const { solution, length, optimal } = solveCuboid336(scramble);
      const after = refApply(solution ? `${scramble} ${solution}` : scramble);
      expect(keyOf(after), `round-trip: ${scramble}`).toBe(REF_SOLVED_KEY);
      expect(length).toBe(solution ? solution.trim().split(/\s+/).filter(Boolean).length : 0);
      expect(optimal, `short scramble should solve optimally: ${scramble}`).toBe(true);
      // the optimal length can never exceed the scramble length, nor undercut the admissible bound
      expect(length).toBeLessThanOrEqual(len);
      if (length > 0) expect(cuboid336Heuristic(scramble)).toBeLessThanOrEqual(length);
    }
  });

  it('deep random states ALWAYS solve (never throw), round-trip, and stay within the hard bound (8 trials)', () => {
    const rnd = mulberry32(0x336d77);
    let solved = 0;
    for (let trial = 0; trial < 8; trial++) {
      const scramble = randomRefScramble(30 + Math.floor(rnd() * 30), rnd); // depth 30-59 (near-diameter)
      const res = solveCuboid336(scramble); // must NOT throw — there is no too-deep
      const after = refApply(res.solution ? `${scramble} ${res.solution}` : scramble);
      expect(keyOf(after), `round-trip: ${scramble}`).toBe(REF_SOLVED_KEY);
      expect(res.length, `bounded: ${scramble}`).toBeLessThanOrEqual(CUBOID336_MAX_LENGTH);
      // the admissible lower bound can never exceed the returned length
      if (res.length > 0) expect(cuboid336Heuristic(scramble)).toBeLessThanOrEqual(res.length);
      solved++;
    }
    expect(solved).toBe(8); // 100% solve-rate — the prime requirement
  });
});

describe('solveCuboid336 — provable optimality on the shallow ball', () => {
  it('exhaustive: every state within radius 3 solves to EXACTLY its BFS depth (optimal flag set)', () => {
    // Build the independent BFS tree to radius 3; for EVERY reached state reconstruct a scramble and assert
    // the solver returns optimal length == true BFS depth. This is the optimality oracle (IDA* == BFS) over
    // the whole ball — the strongest correctness check a TIER-D path admits. Radius 3 keeps CI fast while the
    // 15-move branching gives thousands of distinct states.
    const maxDepth = 3;
    const INV = (name: string) => name === 'U' ? "U'" : name === "U'" ? 'U' : name === 'u' ? "u'" : name === "u'" ? 'u' : name === '3u' ? "3u'" : name === "3u'" ? '3u' : name;
    const dist = new Map<string, number>([[REF_SOLVED_KEY, 0]]);
    const pathTo = new Map<string, string[]>([[REF_SOLVED_KEY, []]]);
    let frontier: number[][] = [[...REF_SOLVED]]; let d = 0;
    while (frontier.length && d < maxDepth) {
      const next: number[][] = [];
      for (const u of frontier) {
        const upath = pathTo.get(keyOf(u))!;
        const last = upath[upath.length - 1];
        for (const mv of REF_MOVES) {
          if (last && mv.name === INV(last)) continue;
          let v: number[] = u; for (let i = 0; i < mv.pow; i++) v = refApplyBase(v, mv.base);
          const vk = keyOf(v);
          if (!dist.has(vk)) { dist.set(vk, d + 1); pathTo.set(vk, [...upath, mv.name]); next.push(v); }
        }
      }
      frontier = next; d++;
    }
    let checked = 0;
    for (const [key, depth] of dist) {
      if (depth === 0) continue;
      const scramble = pathTo.get(key)!.join(' ');
      const r = solveCuboid336(scramble);
      expect(r.optimal, `state ${key} should be optimal (depth ${depth})`).toBe(true);
      expect(r.length, `state ${key} optimal length`).toBe(depth);
      checked++;
    }
    expect(checked).toBe(dist.size - 1);
    expect(checked).toBeGreaterThan(1500); // radius-3 over 15 moves (with inverse/axis pruning) → ~1.8k states
  });
});

describe('renderCuboid336ScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]).filter((f) => f !== 'none');

  it('solved → 90 stickers, exactly 6 colors (self-proving uniform faces)', () => {
    const svg = renderCuboid336ScrambleSvg('');
    expect(fills(svg).length).toBe(90);
    expect(new Set(fills(svg)).size).toBe(6);
  });

  it('a turn breaks the solved render; round-trip restores it', () => {
    const solved = renderCuboid336ScrambleSvg('');
    expect(renderCuboid336ScrambleSvg('U')).not.toEqual(solved);
    expect(renderCuboid336ScrambleSvg("U' U")).toEqual(solved);
    expect(renderCuboid336ScrambleSvg('3u')).not.toEqual(solved);
    expect(renderCuboid336ScrambleSvg('R2 R2')).toEqual(solved);
    expect(renderCuboid336ScrambleSvg("u u'")).toEqual(solved);
  });

  it('preview tracks the solver: scramble ∘ solution renders the solved net (12 random, solvable depth)', () => {
    const rnd = mulberry32(0x336c0d);
    const solved = renderCuboid336ScrambleSvg('');
    for (let trial = 0; trial < 12; trial++) {
      const scramble = randomRefScramble(1 + Math.floor(rnd() * 8), rnd); // <=8: always optimal-solvable
      const { solution } = solveCuboid336(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(renderCuboid336ScrambleSvg(combined), `after solving "${scramble}"`).toEqual(solved);
    }
  });

  it('sticker color counts are invariant under any scramble (faithful group action)', () => {
    const rnd = mulberry32(0x336d11);
    const tally = (scr: string) => { const m = new Map<string, number>(); for (const f of fills(renderCuboid336ScrambleSvg(scr))) m.set(f, (m.get(f) ?? 0) + 1); return m; };
    const base = tally('');
    for (let trial = 0; trial < 20; trial++) expect(tally(randomRefScramble(1 + Math.floor(rnd() * 30), rnd))).toEqual(base);
  });
});

// ── cstimer real-engine oracle (Node vm sandbox) ────────────────────────────────
function locateCstimer(): string | null {
  const candidates = [path.resolve(__dirname, '../../../../tools/cstimer-scramble'), 'D:/cube/cuberoot.me/tools/cstimer-scramble'];
  for (const c of candidates) { try { if (fs.existsSync(path.join(c, 'scramble/megascramble.js'))) return c; } catch { /* ignore */ } }
  return null;
}
interface CstimerCtx { sandbox: Record<string, unknown>; scrMgr: any; } // eslint-disable-line @typescript-eslint/no-explicit-any
let CSTIMER: CstimerCtx | null | undefined;
function loadCstimer(): CstimerCtx | null {
  if (CSTIMER !== undefined) return CSTIMER;
  const root = locateCstimer();
  if (!root) { CSTIMER = null; return null; }
  try {
    function WorkerGlobalScope(this: unknown) { /* shim */ }
    const sandbox: Record<string, unknown> = Object.create(null);
    sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.window = sandbox; sandbox.global = sandbox;
    sandbox.console = console; sandbox.setTimeout = setTimeout; sandbox.clearTimeout = clearTimeout;
    sandbox.WorkerGlobalScope = WorkerGlobalScope; sandbox.importScripts = () => {}; sandbox.DEBUG = false;
    sandbox.process = process; sandbox.require = require;
    sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
    sandbox.$ = { noop: () => {}, extend: Object.assign, isArray: Array.isArray };
    const ctx = vm.createContext(sandbox);
    for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/megascramble.js']) {
      vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
    }
    const scrMgr = sandbox.scrMgr as CstimerCtx['scrMgr'];
    if (!scrMgr) { CSTIMER = null; return null; }
    CSTIMER = { sandbox, scrMgr };
    return CSTIMER;
  } catch (e) {
    console.warn('[cuboid336_solver.test] cstimer vm load failed — skipping oracle', e);
    CSTIMER = null; return null;
  }
}

describe('cstimer 336 oracle (real engine via node:vm)', () => {
  it('real 336 scrambles parse + round-trip solve to solved; tokens ⊆ the 21-token alphabet', () => {
    const c = loadCstimer();
    if (!c) { console.warn('[cuboid336_solver.test] cstimer unavailable — independent geometry already covered validity'); return; }
    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['336'];
    if (!fn) { console.warn('[cuboid336_solver.test] 336 scrambler unavailable'); return; }
    const alphabet = new Set(CUBOID336_MOVE_NAMES);
    let generated = 0, parseFails = 0; const tokSet = new Set<string>();
    for (let i = 0; i < 40; i++) {
      let scr: string;
      try { scr = String(fn('336', 50)).trim(); } catch { continue; }
      if (!scr) continue;
      generated++;
      const names = scr.trim().split(/\s+/).filter(Boolean);
      // full-scramble parse + alphabet: every cstimer 336 token must be one of our 21 (15 distinct moves).
      let toks: number[];
      try { toks = parseCuboid336Scramble(scr); } catch { parseFails++; continue; }
      expect(toks.length).toBe(names.length);
      for (const t of names) { tokSet.add(t); expect(alphabet.has(t), `token in alphabet: ${t}`).toBe(true); }
      // the full cstimer state must be a legal reachable position (apply must not throw / leave surface).
      expect(refApply(scr).length).toBe(N);
      // round-trip a SHORT prefix (len-50 is too deep to solve optimally in-browser): proves our model
      // interprets cstimer's tokens identically and the solver solves them optimally.
      const prefix = names.slice(0, 7).join(' ');
      const { solution } = solveCuboid336(prefix);
      const after = refApply(solution ? `${prefix} ${solution}` : prefix);
      expect(keyOf(after), `round-trip prefix: ${prefix}`).toBe(REF_SOLVED_KEY);
    }
    expect(generated).toBeGreaterThan(0);
    expect(parseFails).toBe(0);
    expect(tokSet.size).toBeGreaterThan(5);
  });

  it('EVERY real (len-50) cstimer 336 scramble solves — 100% solve-rate, round-trips, bounded length', () => {
    // The prime requirement: a real near-uniformly-random cstimer state must RETURN a valid solution. We
    // solve 8 FULL len-50 real scrambles, assert none throw, each round-trips via INDEPENDENT geometry, and
    // length <= the hard bound. This is the regression that locks the two-phase fix.
    const c = loadCstimer();
    if (!c) { console.warn('[cuboid336_solver.test] cstimer unavailable — skipping real-scramble solve-rate'); return; }
    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['336'];
    if (!fn) { console.warn('[cuboid336_solver.test] 336 scrambler unavailable'); return; }
    let attempted = 0, solved = 0;
    let maxLen = 0;
    for (let i = 0; i < 8; i++) {
      const scr = String(fn('336', 50)).trim();
      if (!scr) continue;
      attempted++;
      const res = solveCuboid336(scr); // must NOT throw
      const after = refApply(`${scr} ${res.solution}`);
      expect(keyOf(after), `round-trip real scramble: ${scr}`).toBe(REF_SOLVED_KEY);
      expect(res.length, `bounded real scramble: ${scr}`).toBeLessThanOrEqual(CUBOID336_MAX_LENGTH);
      if (res.length > maxLen) maxLen = res.length;
      solved++;
    }
    expect(attempted).toBeGreaterThanOrEqual(8);
    expect(solved).toBe(attempted); // 100% solve-rate
    expect(maxLen).toBeLessThanOrEqual(CUBOID336_MAX_LENGTH);
  });
});

describe('randomCuboid336Scramble', () => {
  it('emits only alphabet tokens and stays reachable from solved', () => {
    const rnd = mulberry32(0x336e00);
    const alphabet = new Set(CUBOID336_MOVE_NAMES);
    for (let trial = 0; trial < 30; trial++) {
      const scr = randomCuboid336Scramble(50, rnd);
      const toks = scr.split(' ');
      expect(toks.length).toBe(50);
      for (const t of toks) expect(alphabet.has(t)).toBe(true);
      expect(refApply(scr).length).toBe(N);
    }
  });
});
