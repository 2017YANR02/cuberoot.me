import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  solveCuboid334,
  cuboid334Apply,
  parseCuboid334Scramble,
  cuboid334Heuristic,
  cuboid334DbStats,
  randomCuboid334Scramble,
  CUBOID334_MOVE_NAMES,
  CUBOID334_OPTIMAL_DEPTH_CAP,
  CUBOID334_STATE_COUNT_STR,
  CUBOID334_GROUP_ORDER_STR,
} from '@/lib/cuboid334-solver';
import { renderCuboid334ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid334_svg';

// ── INDEPENDENT geometric re-derivation of the 334 move model ─────────────────────
// We rebuild the 66-facelet permutations FROM 3D geometry here — NOT importing the solver's MOVE_PERM
// — so a subtly-wrong mechanism in the solver would fail this anchor even though the puzzle would
// still "solve" itself (the A6 copy-the-table mistake proved nothing; this does not).
const NX = 3, NY = 4, NZ = 3;
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
const N = REF_STICKERS.length; // 66
const k = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => `${x},${y},${z}|${nx},${ny},${nz}`;
const REF_IDX = new Map<string, number>(REF_STICKERS.map((s, i) => [k(s.x, s.y, s.z, s.nx, s.ny, s.nz), i]));
const cx = (x: number) => x - 1, icx = (c: number) => c + 1, cz = (z: number) => z - 1, icz = (c: number) => c + 1;
const YMID = (NY - 1) / 2;
function refPerm(pred: (s: RS) => boolean, tf: (s: RS) => [number, number, number, number, number, number]): number[] {
  const fwd = new Array<number>(N);
  for (let i = 0; i < N; i++) { const s = REF_STICKERS[i]; if (!pred(s)) { fwd[i] = i; continue; } const [a, b, c, d, e, f] = tf(s); const di = REF_IDX.get(k(a, b, c, d, e, f)); if (di === undefined) throw new Error('ref left surface'); fwd[i] = di; }
  const P = new Array<number>(N); for (let s = 0; s < N; s++) P[fwd[s]] = s; return P;
}
const RU = refPerm((s) => s.y === 3, (s) => [icx(cz(s.z)), s.y, icz(-cx(s.x)), s.nz, s.ny, -s.nx]);
const Ru = refPerm((s) => s.y === 2, (s) => [icx(cz(s.z)), s.y, icz(-cx(s.x)), s.nz, s.ny, -s.nx]);
const mkX = (sx: number) => refPerm((s) => s.x === sx, (s) => [s.x, 2 * YMID - s.y, icz(-cz(s.z)), s.nx, -s.ny, -s.nz]);
const mkZ = (sz: number) => refPerm((s) => s.z === sz, (s) => [icx(-cx(s.x)), 2 * YMID - s.y, s.z, -s.nx, -s.ny, s.nz]);
const RR2 = mkX(2), RL2 = mkX(0), RM2 = mkX(1), RF2 = mkZ(2), RB2 = mkZ(0), RS2 = mkZ(1);
const FACE_CODE: Record<RFace, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const REF_SOLVED = REF_STICKERS.map((s) => FACE_CODE[s.face]);
interface RM { name: string; base: number[]; pow: number; }
const REF_MOVES: ReadonlyArray<RM> = [
  { name: 'U', base: RU, pow: 1 }, { name: "U'", base: RU, pow: 3 }, { name: 'U2', base: RU, pow: 2 },
  { name: 'u', base: Ru, pow: 1 }, { name: "u'", base: Ru, pow: 3 }, { name: 'u2', base: Ru, pow: 2 },
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
  const turns: ReadonlyArray<ReadonlyArray<string[]>> = [[['U', "U'", 'U2'], ['u', "u'", 'u2']], [['R2', 'L2', 'M2']], [['F2', 'B2', 'S2']]];
  let done = 0, lastaxis = -1; const s: string[] = [];
  for (let i = 0; i < len; i++) { let first = 0, second = 0; do { first = Math.floor(rnd() * turns.length); second = Math.floor(rnd() * turns[first].length); if (first !== lastaxis) { done = 0; lastaxis = first; } } while (((done >> second) & 1) !== 0); done |= 1 << second; const cell = turns[first][second]; s.push(cell[Math.floor(rnd() * cell.length)]); }
  return s.join(' ');
}

describe('cuboid334 reference (independent geometry)', () => {
  it('exposes the exact 12-token alphabet', () => {
    expect(CUBOID334_MOVE_NAMES.length).toBe(12);
    expect([...CUBOID334_MOVE_NAMES].sort()).toEqual(['B2', 'F2', 'L2', 'M2', 'R2', 'S2', 'U', "U'", 'U2', 'u', "u'", 'u2'].sort());
  });

  it('base move orders match the physics (U⁴ = u⁴ = id, all lateral² = id)', () => {
    expect(keyOf(refApplyTokens(['U', 'U', 'U', 'U']))).toBe(REF_SOLVED_KEY);
    expect(keyOf(refApplyTokens(['u', 'u', 'u', 'u']))).toBe(REF_SOLVED_KEY);
    for (const t of ['R2', 'L2', 'M2', 'F2', 'B2', 'S2']) expect(keyOf(refApplyTokens([t, t])), `${t}²`).toBe(REF_SOLVED_KEY);
  });

  it('the 12 move effects are reproduced move-for-move by the solver apply', () => {
    const rnd = mulberry32(0x334a11);
    for (const tok of CUBOID334_MOVE_NAMES) {
      expect(Array.from(cuboid334Apply(tok))).toEqual(refApplyTokens([tok]));
      for (let t = 0; t < 20; t++) {
        const pre: string[] = []; const n = 1 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) pre.push(CUBOID334_MOVE_NAMES[Math.floor(rnd() * 12)]);
        expect(Array.from(cuboid334Apply([...pre, tok].join(' '))), `${tok} after ${pre.join(' ')}`).toEqual(refApplyTokens([...pre, tok]));
      }
    }
  });
});

describe('cuboid334 pattern databases (measured orbit sub-spaces)', () => {
  it('the five orbit DBs cover the measured sizes with the expected max depths', () => {
    const { sizes, maxDepths } = cuboid334DbStats();
    expect(sizes).toEqual([40320, 40320, 40320, 2520, 2]);
    expect(maxDepths).toEqual([13, 9, 13, 7, 1]);
  });
});

describe('cuboid334 state-space constants', () => {
  it('locks the Schreier-Sims group order and physical state count strings', () => {
    expect(CUBOID334_GROUP_ORDER_STR).toBe('2,642,908,293,365,760,000');
    expect(CUBOID334_STATE_COUNT_STR).toBe('165,181,768,335,360,000');
  });
});

describe('solveCuboid334 — validity (round-trip via INDEPENDENT geometry)', () => {
  it('handles solved / empty input', () => {
    expect(solveCuboid334('')).toEqual({ solution: '', length: 0, optimal: true });
    expect(solveCuboid334("U U'")).toEqual({ solution: '', length: 0, optimal: true });
  });

  it('single-move scrambles solve optimally in one move with the inverse token', () => {
    expect(solveCuboid334("U'")).toMatchObject({ solution: 'U', optimal: true });
    expect(solveCuboid334('U')).toMatchObject({ solution: "U'", optimal: true });
    expect(solveCuboid334('U2')).toMatchObject({ solution: 'U2', optimal: true });
    expect(solveCuboid334("u'")).toMatchObject({ solution: 'u', optimal: true });
    for (const t of ['R2', 'L2', 'M2', 'F2', 'B2', 'S2']) {
      const r = solveCuboid334(t);
      expect(r.length, t).toBe(1);
      expect(r.solution, t).toBe(t); // each lateral move is its own inverse
      expect(r.optimal, t).toBe(true);
    }
  });

  it('rejects invalid tokens', () => {
    expect(() => solveCuboid334('D')).toThrow();   // no D axis
    expect(() => solveCuboid334('R')).toThrow();    // lateral faces can't turn 90°
    expect(() => solveCuboid334('U3')).toThrow();
    expect(() => parseCuboid334Scramble('Rw')).toThrow();
    expect(() => parseCuboid334Scramble("M2'")).toThrow();
  });

  it('short random scrambles (depth ≤ 9) all solve optimally and round-trip (100 trials)', () => {
    const rnd = mulberry32(0x334bf5);
    for (let trial = 0; trial < 100; trial++) {
      const len = 1 + Math.floor(rnd() * 9);
      const scramble = randomRefScramble(len, rnd);
      const { solution, length, optimal } = solveCuboid334(scramble);
      const after = refApply(solution ? `${scramble} ${solution}` : scramble);
      expect(keyOf(after), `round-trip: ${scramble}`).toBe(REF_SOLVED_KEY);
      expect(length).toBe(solution ? solution.trim().split(/\s+/).filter(Boolean).length : 0);
      expect(optimal, `short scramble should solve optimally: ${scramble}`).toBe(true);
      // the optimal length can never exceed the scramble length, nor undercut the admissible bound
      expect(length).toBeLessThanOrEqual(len);
      if (length > 0) expect(cuboid334Heuristic(scramble)).toBeLessThanOrEqual(length);
    }
  });

  it('any returned solution actually solves; deeper states are optimal, greedy, or honestly too-deep (24 trials)', () => {
    const rnd = mulberry32(0x334d77);
    let optCount = 0, greedyCount = 0, tooDeep = 0;
    for (let trial = 0; trial < 24; trial++) {
      const scramble = randomRefScramble(11 + Math.floor(rnd() * 8), rnd); // depth 11–18
      let res: ReturnType<typeof solveCuboid334> | null = null;
      try {
        res = solveCuboid334(scramble);
      } catch (e) {
        expect(String((e as Error).message)).toBe('too-deep'); // never a spurious throw
        tooDeep++;
        continue;
      }
      const after = refApply(res.solution ? `${scramble} ${res.solution}` : scramble);
      expect(keyOf(after), `round-trip: ${scramble}`).toBe(REF_SOLVED_KEY); // VALID regardless of optimality
      if (res.optimal) { optCount++; if (res.length > 0) expect(cuboid334Heuristic(scramble)).toBeLessThanOrEqual(res.length); }
      else greedyCount++;
    }
    // The split is informational (hybrid TIER-D); the hard guarantee is that nothing returns a wrong solution.
    expect(optCount + greedyCount + tooDeep).toBe(24);
  });
});

describe('solveCuboid334 — provable optimality on the shallow ball', () => {
  it('exhaustive: every state within radius 4 solves to EXACTLY its BFS depth (optimal flag set)', () => {
    // Build the independent BFS tree to radius 4 (8,390 states); for EVERY reached state reconstruct a
    // scramble and assert the solver returns optimal length == true BFS depth. This is the optimality
    // oracle (IDA* == BFS) over the whole ball — the strongest correctness check a TIER-C path admits.
    const maxDepth = 4;
    const INV = (name: string) => name === 'U' ? "U'" : name === "U'" ? 'U' : name === 'u' ? "u'" : name === "u'" ? 'u' : name;
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
      const r = solveCuboid334(scramble);
      expect(r.optimal, `state ${key} should be optimal (depth ${depth})`).toBe(true);
      expect(r.length, `state ${key} optimal length`).toBe(depth);
      checked++;
    }
    expect(checked).toBe(dist.size - 1);
    expect(checked).toBeGreaterThan(8000);
    expect(maxDepth).toBeLessThanOrEqual(CUBOID334_OPTIMAL_DEPTH_CAP);
  });
});

describe('renderCuboid334ScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]).filter((f) => f !== 'none');

  it('solved → 66 stickers, exactly 6 colors (self-proving uniform faces)', () => {
    const svg = renderCuboid334ScrambleSvg('');
    expect(fills(svg).length).toBe(66);
    expect(new Set(fills(svg)).size).toBe(6);
  });

  it('a turn breaks the solved render; round-trip restores it', () => {
    const solved = renderCuboid334ScrambleSvg('');
    expect(renderCuboid334ScrambleSvg('U')).not.toEqual(solved);
    expect(renderCuboid334ScrambleSvg("U' U")).toEqual(solved);
    expect(renderCuboid334ScrambleSvg('R2 R2')).toEqual(solved);
    expect(renderCuboid334ScrambleSvg("u u'")).toEqual(solved);
  });

  it('preview tracks the solver: scramble ∘ solution renders the solved net (12 random, solvable depth)', () => {
    const rnd = mulberry32(0x334c0d);
    const solved = renderCuboid334ScrambleSvg('');
    for (let trial = 0; trial < 12; trial++) {
      const scramble = randomRefScramble(1 + Math.floor(rnd() * 9), rnd); // ≤9: always optimal-solvable
      const { solution } = solveCuboid334(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(renderCuboid334ScrambleSvg(combined), `after solving "${scramble}"`).toEqual(solved);
    }
  });

  it('sticker color counts are invariant under any scramble (faithful group action)', () => {
    const rnd = mulberry32(0x334d11);
    const tally = (scr: string) => { const m = new Map<string, number>(); for (const f of fills(renderCuboid334ScrambleSvg(scr))) m.set(f, (m.get(f) ?? 0) + 1); return m; };
    const base = tally('');
    for (let trial = 0; trial < 20; trial++) expect(tally(randomRefScramble(1 + Math.floor(rnd() * 20), rnd))).toEqual(base);
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
    console.warn('[cuboid334_solver.test] cstimer vm load failed — skipping oracle', e);
    CSTIMER = null; return null;
  }
}

describe('cstimer 334 oracle (real engine via node:vm)', () => {
  it('real 334 scrambles parse + round-trip solve to solved; tokens ⊆ the 12-token alphabet', () => {
    const c = loadCstimer();
    if (!c) { console.warn('[cuboid334_solver.test] cstimer unavailable — independent geometry already covered validity'); return; }
    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['334'];
    if (!fn) { console.warn('[cuboid334_solver.test] 334 scrambler unavailable'); return; }
    const alphabet = new Set(CUBOID334_MOVE_NAMES);
    let generated = 0, parseFails = 0; const tokSet = new Set<string>();
    for (let i = 0; i < 40; i++) {
      let scr: string;
      try { scr = String(fn('334', 40)).trim(); } catch { continue; }
      if (!scr) continue;
      generated++;
      const names = scr.trim().split(/\s+/).filter(Boolean);
      // full-scramble parse + alphabet: every cstimer 334 token must be one of our 12.
      let toks: number[];
      try { toks = parseCuboid334Scramble(scr); } catch { parseFails++; continue; }
      expect(toks.length).toBe(names.length);
      for (const t of names) { tokSet.add(t); expect(alphabet.has(t), `token in alphabet: ${t}`).toBe(true); }
      // the full cstimer state must be a legal reachable position (apply must not throw / leave surface).
      expect(refApply(scr).length).toBe(N);
      // round-trip a SHORT prefix (len-40 is too deep to solve in-browser): proves our model interprets
      // cstimer's tokens identically and the solver solves them optimally.
      const prefix = names.slice(0, 8).join(' ');
      const { solution } = solveCuboid334(prefix);
      const after = refApply(solution ? `${prefix} ${solution}` : prefix);
      expect(keyOf(after), `round-trip prefix: ${prefix}`).toBe(REF_SOLVED_KEY);
    }
    expect(generated).toBeGreaterThan(0);
    expect(parseFails).toBe(0);
    expect(tokSet.size).toBeGreaterThan(3);
  });
});

describe('randomCuboid334Scramble', () => {
  it('emits only alphabet tokens and stays reachable from solved', () => {
    const rnd = mulberry32(0x334e00);
    const alphabet = new Set(CUBOID334_MOVE_NAMES);
    for (let trial = 0; trial < 30; trial++) {
      const scr = randomCuboid334Scramble(40, rnd);
      const toks = scr.split(' ');
      expect(toks.length).toBe(40);
      for (const t of toks) expect(alphabet.has(t)).toBe(true);
      expect(refApply(scr).length).toBe(N);
    }
  });
});
