import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  solveCuboid335,
  cuboid335Apply,
  parseCuboid335Scramble,
  cuboid335Heuristic,
  cuboid335DbStats,
  randomCuboid335Scramble,
  CUBOID335_MOVE_NAMES,
  CUBOID335_MAX_LENGTH,
  CUBOID335_STATE_COUNT_STR,
  CUBOID335_ORBIT_PRODUCT_STR,
} from '@/lib/cuboid335-solver';
import { renderCuboid335ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid335_svg';

// ── INDEPENDENT geometric re-derivation of the 335 move model ─────────────────────
// We rebuild the 78-facelet permutations FROM 3D geometry here — NOT importing the solver's MOVE_PERM
// — so a subtly-wrong mechanism in the solver would fail this anchor even though the puzzle would still
// "solve" itself (the A6 copy-the-table mistake proved nothing; this does not).
const NX = 3, NY = 5, NZ = 3;
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
const N = REF_STICKERS.length; // 78
const k = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => `${x},${y},${z}|${nx},${ny},${nz}`;
const REF_IDX = new Map<string, number>(REF_STICKERS.map((s, i) => [k(s.x, s.y, s.z, s.nx, s.ny, s.nz), i]));
const cx = (x: number) => x - 1, icx = (c: number) => c + 1, cz = (z: number) => z - 1, icz = (c: number) => c + 1;
const YMID = (NY - 1) / 2; // 2
function refPerm(pred: (s: RS) => boolean, tf: (s: RS) => [number, number, number, number, number, number]): number[] {
  const fwd = new Array<number>(N);
  for (let i = 0; i < N; i++) { const s = REF_STICKERS[i]; if (!pred(s)) { fwd[i] = i; continue; } const [a, b, c, d, e, f] = tf(s); const di = REF_IDX.get(k(a, b, c, d, e, f)); if (di === undefined) throw new Error('ref left surface'); fwd[i] = di; }
  const P = new Array<number>(N); for (let s = 0; s < N; s++) P[fwd[s]] = s; return P;
}
const RU = refPerm((s) => s.y === 4, (s) => [icx(cz(s.z)), s.y, icz(-cx(s.x)), s.nz, s.ny, -s.nx]);
const RD = refPerm((s) => s.y === 0, (s) => [icx(cz(s.z)), s.y, icz(-cx(s.x)), s.nz, s.ny, -s.nx]);
const mkX = (sx: number) => refPerm((s) => s.x === sx, (s) => [s.x, 2 * YMID - s.y, icz(-cz(s.z)), s.nx, -s.ny, -s.nz]);
const mkZ = (sz: number) => refPerm((s) => s.z === sz, (s) => [icx(-cx(s.x)), 2 * YMID - s.y, s.z, -s.nx, -s.ny, s.nz]);
const RR2 = mkX(2), RL2 = mkX(0), RF2 = mkZ(2), RB2 = mkZ(0);
const FACE_CODE: Record<RFace, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const REF_SOLVED = REF_STICKERS.map((s) => FACE_CODE[s.face]);
interface RM { name: string; base: number[]; pow: number; }
const REF_MOVES: ReadonlyArray<RM> = [
  { name: 'U', base: RU, pow: 1 }, { name: "U'", base: RU, pow: 3 }, { name: 'U2', base: RU, pow: 2 },
  { name: 'D', base: RD, pow: 1 }, { name: "D'", base: RD, pow: 3 }, { name: 'D2', base: RD, pow: 2 },
  { name: 'R2', base: RR2, pow: 1 }, { name: 'L2', base: RL2, pow: 1 },
  { name: 'F2', base: RF2, pow: 1 }, { name: 'B2', base: RB2, pow: 1 },
];
const REF_BY_NAME = new Map(REF_MOVES.map((m) => [m.name, m]));
function refApplyBase(state: ReadonlyArray<number>, base: number[]): number[] { const o = new Array<number>(N); for (let i = 0; i < N; i++) o[i] = state[base[i]]; return o; }
function refApplyTokens(tokens: string[]): number[] { let s = [...REF_SOLVED]; for (const t of tokens) { const m = REF_BY_NAME.get(t); if (!m) throw new Error('ref bad ' + t); for (let i = 0; i < m.pow; i++) s = refApplyBase(s, m.base); } return s; }
// rigid apply: stop at " / " separator (the cstimer 333 suffix has no rigid realisation on a 3×3×5).
function refApply(scr: string): number[] {
  const toks: string[] = [];
  for (const t of scr.trim().split(/\s+/).filter(Boolean)) { if (t === '/') break; toks.push(t); }
  return refApplyTokens(toks);
}
const keyOf = (s: ReadonlyArray<number>) => s.join(',');
const REF_SOLVED_KEY = keyOf(REF_SOLVED);

function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function randomRefScramble(len: number, rnd: () => number): string {
  const turns: ReadonlyArray<ReadonlyArray<string[]>> = [[['U', "U'", 'U2'], ['D', "D'", 'D2']], [['R2', 'L2']], [['F2', 'B2']]];
  let done = 0, lastaxis = -1; const s: string[] = [];
  for (let i = 0; i < len; i++) { let first = 0, second = 0; do { first = Math.floor(rnd() * turns.length); second = Math.floor(rnd() * turns[first].length); if (first !== lastaxis) { done = 0; lastaxis = first; } } while (((done >> second) & 1) !== 0); done |= 1 << second; const cell = turns[first][second]; s.push(cell[Math.floor(rnd() * cell.length)]); }
  return s.join(' ');
}

describe('cuboid335 reference (independent geometry)', () => {
  it('exposes the exact 10-token rigid alphabet', () => {
    expect(CUBOID335_MOVE_NAMES.length).toBe(10);
    expect([...CUBOID335_MOVE_NAMES].sort()).toEqual(['B2', 'D', "D'", 'D2', 'F2', 'L2', 'R2', 'U', "U'", 'U2'].sort());
  });

  it('base move orders match the physics (U⁴ = D⁴ = id, all lateral² = id)', () => {
    expect(keyOf(refApplyTokens(['U', 'U', 'U', 'U']))).toBe(REF_SOLVED_KEY);
    expect(keyOf(refApplyTokens(['D', 'D', 'D', 'D']))).toBe(REF_SOLVED_KEY);
    for (const t of ['R2', 'L2', 'F2', 'B2']) expect(keyOf(refApplyTokens([t, t])), `${t}²`).toBe(REF_SOLVED_KEY);
  });

  it('the 10 move effects are reproduced move-for-move by the solver apply', () => {
    const rnd = mulberry32(0x335a11);
    for (const tok of CUBOID335_MOVE_NAMES) {
      expect(Array.from(cuboid335Apply(tok))).toEqual(refApplyTokens([tok]));
      for (let t = 0; t < 20; t++) {
        const pre: string[] = []; const n = 1 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) pre.push(CUBOID335_MOVE_NAMES[Math.floor(rnd() * 10)]);
        expect(Array.from(cuboid335Apply([...pre, tok].join(' '))), `${tok} after ${pre.join(' ')}`).toEqual(refApplyTokens([...pre, tok]));
      }
    }
  });
});

describe('cuboid335 pattern databases (measured orbit sub-spaces)', () => {
  it('the five movable orbit DBs cover the measured full sizes, 180° subgroup sizes, and phase depths', () => {
    const { sizes, inHCounts, p2MaxDepths, intoHMaxDepths } = cuboid335DbStats();
    // full reachable sub-state count per movable orbit (under all 10 moves)
    expect(sizes).toEqual([40320, 40320, 24, 24, 24]);
    // size of the 180°-only subgroup H per orbit (phase-2 lives here)
    expect(inHCounts).toEqual([96, 576, 24, 24, 24]);
    // diameter of each per-orbit 180° subgroup (phase-2 admissible PDB depth)
    expect(p2MaxDepths).toEqual([4, 7, 4, 4, 4]);
    // max moves to enter H from any sub-state (phase-1 admissible heuristic depth)
    expect(intoHMaxDepths).toEqual([11, 4, 0, 0, 0]);
  });
});

describe('cuboid335 state-space constants', () => {
  it('locks the Schreier-Sims reachable count and the orbit-product strings', () => {
    expect(CUBOID335_STATE_COUNT_STR).toBe('156,067,430,400');
    expect(CUBOID335_ORBIT_PRODUCT_STR).toBe('22,473,709,977,600');
  });
});

describe('solveCuboid335 — validity (round-trip via INDEPENDENT geometry)', () => {
  it('handles solved / empty input', () => {
    expect(solveCuboid335('')).toEqual({ solution: '', length: 0, optimal: true });
    expect(solveCuboid335("U U'")).toEqual({ solution: '', length: 0, optimal: true });
  });

  it('single-move scrambles solve optimally in one move with the inverse token', () => {
    expect(solveCuboid335("U'")).toMatchObject({ solution: 'U', optimal: true });
    expect(solveCuboid335('U')).toMatchObject({ solution: "U'", optimal: true });
    expect(solveCuboid335('U2')).toMatchObject({ solution: 'U2', optimal: true });
    expect(solveCuboid335("D'")).toMatchObject({ solution: 'D', optimal: true });
    for (const t of ['R2', 'L2', 'F2', 'B2']) {
      const r = solveCuboid335(t);
      expect(r.length, t).toBe(1);
      expect(r.solution, t).toBe(t); // each lateral move is its own inverse
      expect(r.optimal, t).toBe(true);
    }
  });

  it('rejects invalid tokens in the cuboid part', () => {
    expect(() => solveCuboid335('U3')).toThrow();
    expect(() => parseCuboid335Scramble('Rw')).toThrow();
    expect(() => parseCuboid335Scramble("M2'")).toThrow();
    // a 90° side turn BEFORE any "/" is not a rigid 3×3×5 move → rejected
    expect(() => parseCuboid335Scramble('R')).toThrow();
  });

  it('parsing stops at the " / " separator (the 333 suffix is ignored)', () => {
    // "U / R U F" → only U is a rigid move; the 333 part is dropped
    expect(parseCuboid335Scramble('U / R U F')).toEqual(parseCuboid335Scramble('U'));
    expect(Array.from(cuboid335Apply('U / R U F'))).toEqual(Array.from(cuboid335Apply('U')));
  });

  it('short random scrambles (depth ≤ 9) all solve optimally and round-trip (100 trials)', () => {
    const rnd = mulberry32(0x335bf5);
    for (let trial = 0; trial < 100; trial++) {
      const len = 1 + Math.floor(rnd() * 9);
      const scramble = randomRefScramble(len, rnd);
      const { solution, length, optimal } = solveCuboid335(scramble);
      const after = refApply(solution ? `${scramble} ${solution}` : scramble);
      expect(keyOf(after), `round-trip: ${scramble}`).toBe(REF_SOLVED_KEY);
      expect(length).toBe(solution ? solution.trim().split(/\s+/).filter(Boolean).length : 0);
      expect(optimal, `short scramble should solve optimally: ${scramble}`).toBe(true);
      expect(length).toBeLessThanOrEqual(len);
      if (length > 0) expect(cuboid335Heuristic(scramble)).toBeLessThanOrEqual(length);
    }
  });

  it('deep random states ALWAYS solve (never throw), round-trip, and stay within the hard bound (6 trials)', () => {
    const rnd = mulberry32(0x335d77);
    let solved = 0;
    for (let trial = 0; trial < 6; trial++) {
      const scramble = randomRefScramble(30 + Math.floor(rnd() * 15), rnd); // depth 30–44 (near-diameter)
      const res = solveCuboid335(scramble); // must NOT throw — there is no too-deep anymore
      const after = refApply(res.solution ? `${scramble} ${res.solution}` : scramble);
      expect(keyOf(after), `round-trip: ${scramble}`).toBe(REF_SOLVED_KEY);
      expect(res.length, `bounded: ${scramble}`).toBeLessThanOrEqual(CUBOID335_MAX_LENGTH);
      if (res.length > 0) expect(cuboid335Heuristic(scramble)).toBeLessThanOrEqual(res.length);
      solved++;
    }
    expect(solved).toBe(6); // 100% solve-rate — the prime requirement
  });
});

describe('solveCuboid335 — provable optimality on the shallow ball', () => {
  it('exhaustive: every state within radius 4 solves to EXACTLY its BFS depth (optimal flag set)', () => {
    const maxDepth = 4;
    const INV = (name: string) => name === 'U' ? "U'" : name === "U'" ? 'U' : name === 'D' ? "D'" : name === "D'" ? 'D' : name;
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
      const r = solveCuboid335(scramble);
      expect(r.optimal, `state ${key} should be optimal (depth ${depth})`).toBe(true);
      expect(r.length, `state ${key} optimal length`).toBe(depth);
      checked++;
    }
    expect(checked).toBe(dist.size - 1);
    // radius-4 ball over the 10-move generator (U/D 90° + 4 side 180°) — exact size lock.
    expect(dist.size).toBe(3613);
    expect(checked).toBeGreaterThan(3600);
  });
});

describe('renderCuboid335ScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]).filter((f) => f !== 'none');

  it('solved → 78 stickers, exactly 6 colors (self-proving uniform faces)', () => {
    const svg = renderCuboid335ScrambleSvg('');
    expect(fills(svg).length).toBe(78);
    expect(new Set(fills(svg)).size).toBe(6);
  });

  it('a turn breaks the solved render; round-trip restores it', () => {
    const solved = renderCuboid335ScrambleSvg('');
    expect(renderCuboid335ScrambleSvg('U')).not.toEqual(solved);
    expect(renderCuboid335ScrambleSvg("U' U")).toEqual(solved);
    expect(renderCuboid335ScrambleSvg('R2 R2')).toEqual(solved);
    expect(renderCuboid335ScrambleSvg("D D'")).toEqual(solved);
  });

  it('preview tracks the solver: scramble ∘ solution renders the solved net (12 random, solvable depth)', () => {
    const rnd = mulberry32(0x335c0d);
    const solved = renderCuboid335ScrambleSvg('');
    for (let trial = 0; trial < 12; trial++) {
      const scramble = randomRefScramble(1 + Math.floor(rnd() * 9), rnd);
      const { solution } = solveCuboid335(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(renderCuboid335ScrambleSvg(combined), `after solving "${scramble}"`).toEqual(solved);
    }
  });

  it('sticker color counts are invariant under any scramble (faithful group action)', () => {
    const rnd = mulberry32(0x335d11);
    const tally = (scr: string) => { const m = new Map<string, number>(); for (const f of fills(renderCuboid335ScrambleSvg(scr))) m.set(f, (m.get(f) ?? 0) + 1); return m; };
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
    // 335 = `<cuboid> / ${333}` → also need min2phase + the 333 scrambler (vs 334 which doesn't).
    for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'lib/min2phase.js', 'scramble/scramble.js', 'scramble/scramble_333_edit.js', 'scramble/megascramble.js']) {
      vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
    }
    const scrMgr = sandbox.scrMgr as CstimerCtx['scrMgr'];
    if (!scrMgr) { CSTIMER = null; return null; }
    CSTIMER = { sandbox, scrMgr };
    return CSTIMER;
  } catch (e) {
    console.warn('[cuboid335_solver.test] cstimer vm load failed — skipping oracle', e);
    CSTIMER = null; return null;
  }
}

describe('cstimer 335 oracle (real engine via node:vm)', () => {
  it('real 335 scrambles parse + the cuboid part round-trip solves; rigid tokens ⊆ the 10-token alphabet', () => {
    const c = loadCstimer();
    if (!c) { console.warn('[cuboid335_solver.test] cstimer unavailable — independent geometry already covered validity'); return; }
    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['335'];
    if (!fn) { console.warn('[cuboid335_solver.test] 335 scrambler unavailable'); return; }
    const alphabet = new Set(CUBOID335_MOVE_NAMES);
    let generated = 0, parseFails = 0; const tokSet = new Set<string>();
    for (let i = 0; i < 20; i++) {
      let scr: string;
      try { scr = String(fn('335', 23)).trim(); } catch { continue; }
      if (!scr) continue;
      generated++;
      // a real 335 scramble must contain the " / " separator (cuboid part + 333 part)
      expect(scr.includes('/'), `has separator: ${scr}`).toBe(true);
      const cuboidPart = scr.split(' / ')[0];
      const names = cuboidPart.trim().split(/\s+/).filter(Boolean);
      // every cuboid-part token must be one of our 10 rigid moves
      let toks: number[];
      try { toks = parseCuboid335Scramble(cuboidPart); } catch { parseFails++; continue; }
      expect(toks.length).toBe(names.length);
      for (const t of names) { tokSet.add(t); expect(alphabet.has(t), `token in alphabet: ${t}`).toBe(true); }
      // the cuboid-part state must be a legal reachable position (apply must not throw / leave surface).
      expect(refApply(cuboidPart).length).toBe(N);
      // parsing the FULL string (with the 333 suffix) must equal parsing only the cuboid part.
      expect(parseCuboid335Scramble(scr)).toEqual(toks);
      // round-trip the cuboid part: proves our model interprets cstimer's rigid tokens identically.
      const { solution } = solveCuboid335(cuboidPart);
      const after = refApply(solution ? `${cuboidPart} ${solution}` : cuboidPart);
      expect(keyOf(after), `round-trip cuboid part: ${cuboidPart}`).toBe(REF_SOLVED_KEY);
    }
    expect(generated).toBeGreaterThan(0);
    expect(parseFails).toBe(0);
    expect(tokSet.size).toBeGreaterThan(3);
  });

  it('EVERY real cstimer 335 scramble solves — 100% solve-rate, round-trips, bounded length', () => {
    // The prime requirement: a real cstimer state must RETURN a valid solution. We solve 8 FULL real
    // scrambles (the solver consumes the whole string, applying the rigid cuboid part), assert none
    // throw, each round-trips via INDEPENDENT geometry, and length ≤ the hard bound.
    const c = loadCstimer();
    if (!c) { console.warn('[cuboid335_solver.test] cstimer unavailable — skipping real-scramble solve-rate'); return; }
    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['335'];
    if (!fn) { console.warn('[cuboid335_solver.test] 335 scrambler unavailable'); return; }
    let attempted = 0, solved = 0;
    let maxLen = 0;
    for (let i = 0; i < 8; i++) {
      const scr = String(fn('335', 30)).trim();
      if (!scr) continue;
      attempted++;
      const res = solveCuboid335(scr); // must NOT throw — solver consumes the full string (cuboid part)
      // round-trip the RIGID part ∘ solution (refApply stops at "/", so build cuboidPart + solution).
      const cuboidPart = scr.split(' / ')[0];
      const after = refApply(res.solution ? `${cuboidPart} ${res.solution}` : cuboidPart);
      expect(keyOf(after), `round-trip real scramble: ${scr}`).toBe(REF_SOLVED_KEY);
      expect(res.length, `bounded real scramble: ${scr}`).toBeLessThanOrEqual(CUBOID335_MAX_LENGTH);
      if (res.length > maxLen) maxLen = res.length;
      solved++;
    }
    expect(attempted).toBeGreaterThanOrEqual(8);
    expect(solved).toBe(attempted); // 100% solve-rate
    expect(maxLen).toBeLessThanOrEqual(CUBOID335_MAX_LENGTH);
  });
});

describe('randomCuboid335Scramble', () => {
  it('emits only rigid alphabet tokens and stays reachable from solved', () => {
    const rnd = mulberry32(0x335e00);
    const alphabet = new Set(CUBOID335_MOVE_NAMES);
    for (let trial = 0; trial < 30; trial++) {
      const scr = randomCuboid335Scramble(40, rnd);
      const toks = scr.split(' ');
      expect(toks.length).toBe(40);
      for (const t of toks) expect(alphabet.has(t)).toBe(true);
      expect(refApply(scr).length).toBe(N);
    }
  });
});
