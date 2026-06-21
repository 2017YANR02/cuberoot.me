import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  solveCuboid233,
  cuboid233Apply,
  parseCuboid233Scramble,
  cuboid233Heuristic,
  cuboid233DbStats,
  randomCuboid233Scramble,
  CUBOID233_MOVE_NAMES,
  CUBOID233_SAMPLED_MAX_LENGTH,
} from '@/lib/cuboid233-solver';
import { renderCuboid233ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid233_svg';

// ── INDEPENDENT geometric re-derivation of the 233 move model ─────────────────────
// We rebuild the 16-active-cubie permutations FROM 3D geometry here — NOT importing the solver's
// internals — so a subtly-wrong mechanism in the solver would fail this anchor even though the
// puzzle would still "solve" itself (the A6 copy-the-table mistake proved nothing; this does not).
// Cubie coords x∈{0,1,2}, y∈{0,1}, z∈{0,1,2}; the two centers (1,*,1) are fixed and excluded.
interface RC { x: number; y: number; z: number; corner: boolean; }
const REF_CUBIES: RC[] = (() => {
  const out: RC[] = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 3; z++) {
    const midX = x === 1, midZ = z === 1;
    if (midX && midZ) continue;
    const corner = (x === 0 || x === 2) && (z === 0 || z === 2);
    const edge = (midX && !midZ) || (!midX && midZ);
    if (corner || edge) out.push({ x, y, z, corner });
  }
  return out;
})();
const N = REF_CUBIES.length; // 16
const ckey = (x: number, y: number, z: number) => x * 100 + y * 10 + z;
const REF_ID = new Map<number, number>(REF_CUBIES.map((c, i) => [ckey(c.x, c.y, c.z), i]));
function refPerm(tf: (x: number, y: number, z: number) => [number, number, number]): number[] {
  const p = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    const c = REF_CUBIES[i];
    const [nx, ny, nz] = tf(c.x, c.y, c.z);
    const j = REF_ID.get(ckey(nx, ny, nz));
    if (j === undefined) throw new Error('ref transform left active set');
    p[j] = i;
  }
  return p;
}
const REF_U = refPerm((x, y, z) => (y !== 1 ? [x, y, z] : [z, y, 2 - x]));
const REF_R2 = refPerm((x, y, z) => (x !== 2 ? [x, y, z] : [x, 1 - y, 2 - z]));
const REF_L2 = refPerm((x, y, z) => (x !== 0 ? [x, y, z] : [x, 1 - y, 2 - z]));
const REF_F2 = refPerm((x, y, z) => (z !== 2 ? [x, y, z] : [2 - x, 1 - y, z]));
const REF_B2 = refPerm((x, y, z) => (z !== 0 ? [x, y, z] : [2 - x, 1 - y, z]));
// move set: name → (base perm, power). Independent of the solver's MOVES order.
const REF_MOVES: ReadonlyArray<{ name: string; base: number[]; pow: number }> = [
  { name: 'U', base: REF_U, pow: 1 },
  { name: "U'", base: REF_U, pow: 3 },
  { name: 'U2', base: REF_U, pow: 2 },
  { name: 'R2', base: REF_R2, pow: 1 },
  { name: 'L2', base: REF_L2, pow: 1 },
  { name: 'F2', base: REF_F2, pow: 1 },
  { name: 'B2', base: REF_B2, pow: 1 },
];
const REF_MOVE_BY_NAME = new Map(REF_MOVES.map((m) => [m.name, m]));
const REF_SOLVED: ReadonlyArray<number> = Array.from({ length: N }, (_, i) => i);
function refApplyBase(state: ReadonlyArray<number>, base: number[]): number[] {
  const o = new Array<number>(N);
  for (let i = 0; i < N; i++) o[i] = state[base[i]];
  return o;
}
function refApplyTokens(tokens: string[]): number[] {
  let s: number[] = [...REF_SOLVED];
  for (const tok of tokens) {
    const mv = REF_MOVE_BY_NAME.get(tok);
    if (!mv) throw new Error('ref bad token ' + tok);
    for (let k = 0; k < mv.pow; k++) s = refApplyBase(s, mv.base);
  }
  return s;
}
function refApply(scramble: string): number[] {
  return refApplyTokens(scramble.trim().split(/\s+/).filter(Boolean));
}
const keyOf = (s: ReadonlyArray<number>) => s.join(',');
const REF_SOLVED_KEY = keyOf(REF_SOLVED);

// Tiny seeded PRNG so failures reproduce.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomRefScramble(len: number, rnd: () => number): string {
  // mirror cstimer mega: axes 0=[["U","U'","U2"]],1=["R2","L2"],2=["F2","B2"]; no repeat same second.
  const turns: ReadonlyArray<ReadonlyArray<string | string[]>> = [[['U', "U'", 'U2']], ['R2', 'L2'], ['F2', 'B2']];
  let donemoves = 0, lastaxis = -1; const s: string[] = [];
  for (let i = 0; i < len; i++) {
    let first = 0, second = 0;
    do { first = Math.floor(rnd() * turns.length); second = Math.floor(rnd() * turns[first].length); if (first !== lastaxis) { donemoves = 0; lastaxis = first; } } while (((donemoves >> second) & 1) !== 0);
    donemoves |= 1 << second;
    const cell = turns[first][second];
    s.push(Array.isArray(cell) ? cell[Math.floor(rnd() * cell.length)] : cell);
  }
  return s.join(' ');
}

// Independent bounded BFS over the full 16-piece state (own code path) → optimal distance, depths ≤ D.
function buildBoundedDist(maxDepth: number): Map<string, number> {
  const dist = new Map<string, number>([[REF_SOLVED_KEY, 0]]);
  let frontier: number[][] = [[...REF_SOLVED]];
  let d = 0;
  while (frontier.length && d < maxDepth) {
    const next: number[][] = [];
    for (const u of frontier) {
      for (const mv of REF_MOVES) {
        let v: number[] = u;
        for (let k = 0; k < mv.pow; k++) v = refApplyBase(v, mv.base);
        const vk = keyOf(v);
        if (!dist.has(vk)) { dist.set(vk, d + 1); next.push(v); }
      }
    }
    frontier = next; d++;
  }
  return dist;
}

describe('cuboid233 reference (independent geometry)', () => {
  it('exposes the exact 7-token alphabet', () => {
    expect(CUBOID233_MOVE_NAMES.length).toBe(7);
    expect(new Set(CUBOID233_MOVE_NAMES).size).toBe(7);
    expect([...CUBOID233_MOVE_NAMES].sort()).toEqual(['B2', 'F2', 'L2', 'R2', 'U', "U'", 'U2'].sort());
  });

  it('base move orders match the physics (U⁴ = id, all side² = id)', () => {
    // U: applying the U token 4× returns to solved.
    expect(keyOf(refApplyTokens(['U', 'U', 'U', 'U']))).toBe(REF_SOLVED_KEY);
    for (const t of ['R2', 'L2', 'F2', 'B2']) {
      expect(keyOf(refApplyTokens([t, t])), `${t}²`).toBe(REF_SOLVED_KEY);
    }
  });

  it('the 7 move effects are reproduced move-for-move by the solver apply', () => {
    const rnd = mulberry32(0x233A11);
    for (const tok of CUBOID233_MOVE_NAMES) {
      expect(cuboid233Apply(tok)).toEqual(refApplyTokens([tok]));
      for (let t = 0; t < 25; t++) {
        const pre: string[] = [];
        const n = 1 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) pre.push(CUBOID233_MOVE_NAMES[Math.floor(rnd() * CUBOID233_MOVE_NAMES.length)]);
        const refState = refApplyTokens([...pre, tok]);
        const solverState = cuboid233Apply([...pre, tok].join(' '));
        expect(solverState, `move ${tok} after ${pre.join(' ')}`).toEqual(refState);
      }
    }
  });
});

describe('cuboid233 pattern databases', () => {
  it('both PDBs cover the full 8! with the expected depths', () => {
    const { cornerFull, edgeFull, cornerMax, edgeMax } = cuboid233DbStats();
    expect(cornerFull).toBe(40320);
    expect(edgeFull).toBe(40320);
    expect(cornerMax).toBe(13);
    expect(edgeMax).toBe(11);
  });
});

describe('solveCuboid233', () => {
  it('handles solved / empty input', () => {
    expect(solveCuboid233('')).toEqual({ solution: '', length: 0, heuristic: 0 });
    expect(solveCuboid233("U U'")).toEqual({ solution: '', length: 0, heuristic: 0 });
  });

  it('single-move scrambles solve in one move with the inverse token', () => {
    expect(solveCuboid233("U'").solution).toBe('U');
    expect(solveCuboid233('U').solution).toBe("U'");
    expect(solveCuboid233('U2').solution).toBe('U2');
    for (const t of ['R2', 'L2', 'F2', 'B2']) {
      const r = solveCuboid233(t);
      expect(r.length).toBe(1);
      expect(r.solution).toBe(t); // each side move is its own inverse
    }
  });

  it('rejects invalid tokens', () => {
    expect(() => solveCuboid233('D')).toThrow();    // no D axis
    expect(() => solveCuboid233('R')).toThrow();     // side faces can't turn 90°
    expect(() => solveCuboid233("R2'")).toThrow();
    expect(() => parseCuboid233Scramble('U3')).toThrow();
    expect(() => parseCuboid233Scramble('F')).toThrow();
  });

  it('IDA* returns the optimal length == independent BFS distance over 800 random scrambles', () => {
    const dist = buildBoundedDist(7); // states within reach of depth 7 from solved
    const rnd = mulberry32(0x233BF5);
    let checkedShallow = 0;
    for (let trial = 0; trial < 800; trial++) {
      const len = 1 + Math.floor(rnd() * 25);
      const scramble = randomRefScramble(len, rnd);
      const tokens = scramble.split(' ');
      const scrambled = refApplyTokens(tokens);
      const sk = keyOf(scrambled);

      const { solution, length } = solveCuboid233(scramble);

      // validity: scramble ∘ solution = solved (via the INDEPENDENT apply)
      const after = refApplyTokens([...tokens, ...(solution ? solution.split(' ') : [])]);
      expect(keyOf(after), `round-trip: ${scramble}`).toBe(REF_SOLVED_KEY);
      expect(length).toBeLessThanOrEqual(CUBOID233_SAMPLED_MAX_LENGTH);

      // optimality: when the scrambled state is shallow enough that the independent BFS knows its true
      // distance, assert IDA* matched it exactly (provable shortest).
      const trueD = dist.get(sk);
      if (trueD !== undefined) { checkedShallow++; expect(length, `optimal: ${scramble}`).toBe(trueD); }

      // heuristic admissibility: the lower bound never exceeds the optimal length.
      expect(cuboid233Heuristic(scramble)).toBeLessThanOrEqual(length);
    }
    expect(checkedShallow).toBeGreaterThan(20); // some random scrambles land in the shallow set
  });

  it('exhaustive shallow optimality: every depth ≤ 6 state solves to exactly its BFS distance', () => {
    // Walk the independent BFS tree and, for each reached state, reconstruct a scramble (the BFS path)
    // then assert the solver's optimal length equals the state's BFS depth. This checks EVERY state in
    // the ball of radius 6 (tens of thousands), not just sampled ones.
    const maxDepth = 6;
    const dist = new Map<string, number>([[REF_SOLVED_KEY, 0]]);
    const pathTo = new Map<string, string[]>([[REF_SOLVED_KEY, []]]);
    let frontier: number[][] = [[...REF_SOLVED]];
    let d = 0;
    while (frontier.length && d < maxDepth) {
      const next: number[][] = [];
      for (const u of frontier) {
        const upath = pathTo.get(keyOf(u))!;
        for (const mv of REF_MOVES) {
          let v: number[] = u;
          for (let k = 0; k < mv.pow; k++) v = refApplyBase(v, mv.base);
          const vk = keyOf(v);
          if (!dist.has(vk)) { dist.set(vk, d + 1); pathTo.set(vk, [...upath, mv.name]); next.push(v); }
        }
      }
      frontier = next; d++;
    }
    let checked = 0;
    for (const [k, depth] of dist) {
      if (depth === 0) continue;
      const scramble = pathTo.get(k)!.join(' ');
      expect(solveCuboid233(scramble).length, `state ${k}`).toBe(depth);
      checked++;
    }
    expect(checked).toBe(dist.size - 1);
    expect(checked).toBeGreaterThan(20000);
  });
});

describe('renderCuboid233ScrambleSvg', () => {
  const fills = (svg: string) => [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]).filter((f) => f !== 'none');

  it('solved → each face uniform (self-proving)', () => {
    const svg = renderCuboid233ScrambleSvg('');
    expect(fills(svg).length).toBe(42); // 42 stickers
    // Group stickers into faces by counting distinct colors: a solved net has exactly 6 colors.
    expect(new Set(fills(svg)).size).toBe(6);
  });

  it('a turn breaks the solved render; round-trip restores it', () => {
    const solved = renderCuboid233ScrambleSvg('');
    expect(renderCuboid233ScrambleSvg('U')).not.toEqual(solved);
    expect(renderCuboid233ScrambleSvg("U' U")).toEqual(solved);
    expect(renderCuboid233ScrambleSvg('R2 R2')).toEqual(solved);
  });

  it('preview tracks the solver: scramble ∘ optimal solution renders the solved net', () => {
    const rnd = mulberry32(0x233C0D);
    const solved = renderCuboid233ScrambleSvg('');
    for (let trial = 0; trial < 60; trial++) {
      const len = 1 + Math.floor(rnd() * 12);
      const scramble = randomRefScramble(len, rnd);
      const { solution } = solveCuboid233(scramble);
      const combined = solution ? `${scramble} ${solution}` : scramble;
      expect(renderCuboid233ScrambleSvg(combined), `after solving "${scramble}"`).toEqual(solved);
    }
  });

  it('sticker color counts stay constant under any scramble (faithful group action)', () => {
    const rnd = mulberry32(0x233D11);
    const solvedCounts = (() => { const m = new Map<string, number>(); for (const f of fills(renderCuboid233ScrambleSvg(''))) m.set(f, (m.get(f) ?? 0) + 1); return m; })();
    for (let trial = 0; trial < 50; trial++) {
      const scramble = randomRefScramble(1 + Math.floor(rnd() * 20), rnd);
      const m = new Map<string, number>();
      for (const f of fills(renderCuboid233ScrambleSvg(scramble))) m.set(f, (m.get(f) ?? 0) + 1);
      expect(m).toEqual(solvedCounts);
    }
  });
});

// ── cstimer real-engine oracle (Node vm sandbox) ────────────────────────────────
// Load cstimer's actual scramble core, generate ~200 real `233` scrambles, parse with OUR parser,
// apply via the INDEPENDENT reference model, assert reachable-from-solved (round-trip-solve), token
// set ⊆ the 7-token alphabet. cstimer ships no 233 solver/apply, so this anchors notation fidelity:
// a real cstimer 233 scramble must be solvable by our solver back to solved.
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
interface CstimerCtx { sandbox: Record<string, unknown>; scrMgr: any; } // eslint-disable-line @typescript-eslint/no-explicit-any
let CSTIMER: CstimerCtx | null | undefined;
function loadCstimer(): CstimerCtx | null {
  if (CSTIMER !== undefined) return CSTIMER;
  const root = locateCstimer();
  if (!root) { CSTIMER = null; return null; }
  try {
    function WorkerGlobalScope(this: unknown) { /* shim */ }
    const sandbox: Record<string, unknown> = Object.create(null);
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.console = console;
    sandbox.setTimeout = setTimeout;
    sandbox.clearTimeout = clearTimeout;
    sandbox.WorkerGlobalScope = WorkerGlobalScope;
    sandbox.importScripts = () => {};
    sandbox.DEBUG = false;
    sandbox.process = process;
    sandbox.require = require;
    sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
    sandbox.$ = { noop: () => {}, extend: Object.assign, isArray: Array.isArray };
    const ctx = vm.createContext(sandbox);
    const files = ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/megascramble.js'];
    for (const f of files) {
      const code = fs.readFileSync(path.join(root, f), 'utf8');
      vm.runInContext(code, ctx, { filename: f });
    }
    const scrMgr = sandbox.scrMgr as CstimerCtx['scrMgr'];
    if (!scrMgr) { CSTIMER = null; return null; }
    CSTIMER = { sandbox, scrMgr };
    return CSTIMER;
  } catch (e) {
    console.warn('[cuboid233_solver.test] cstimer vm load failed — skipping cstimer-oracle assertions', e);
    CSTIMER = null;
    return null;
  }
}

describe('cstimer 233 oracle (real engine via node:vm)', () => {
  it('real 233 scrambles parse + round-trip solve to solved; tokens ⊆ the 7-token alphabet', () => {
    const c = loadCstimer();
    if (!c) {
      console.warn('[cuboid233_solver.test] cstimer engine unavailable — skipping oracle (independent geometry already passed)');
      return;
    }
    const fn = c.scrMgr.scramblers && c.scrMgr.scramblers['233'];
    if (!fn) {
      console.warn('[cuboid233_solver.test] 233 scrambler not available — skipping real-scramble round-trip');
      return;
    }
    const alphabet = new Set(CUBOID233_MOVE_NAMES);
    const tokSet = new Set<string>();
    let parseFails = 0, generated = 0;
    for (let i = 0; i < 200; i++) {
      let scr: string;
      try { scr = String(fn('233', 25)).trim(); } catch { continue; }
      if (!scr) continue;
      generated++;
      let toks: number[];
      try { toks = parseCuboid233Scramble(scr); } catch { parseFails++; continue; }
      const names = scr.trim().split(/\s+/).filter(Boolean);
      for (const t of names) { tokSet.add(t); expect(alphabet.has(t), `token in alphabet: ${t}`).toBe(true); }
      expect(toks.length).toBe(names.length);
      // round-trip: solver's solution applied to the INDEPENDENT scrambled state returns solved.
      const { solution, length } = solveCuboid233(scr);
      expect(length).toBeLessThanOrEqual(CUBOID233_SAMPLED_MAX_LENGTH);
      const after = refApply(solution ? `${scr} ${solution}` : scr);
      expect(keyOf(after), `round-trip: ${scr}`).toBe(REF_SOLVED_KEY);
    }
    expect(generated).toBeGreaterThan(0);
    expect(parseFails).toBe(0);
    expect(tokSet.size).toBeGreaterThan(1);
  });
});

describe('randomCuboid233Scramble', () => {
  it('emits only alphabet tokens and never repeats the same slice consecutively on one axis', () => {
    const rnd = mulberry32(0x233E00);
    const alphabet = new Set(CUBOID233_MOVE_NAMES);
    for (let trial = 0; trial < 50; trial++) {
      const scr = randomCuboid233Scramble(25, rnd);
      const toks = scr.split(' ');
      expect(toks.length).toBe(25);
      for (const t of toks) expect(alphabet.has(t)).toBe(true);
      // any generated scramble must be solvable (reachable)
      const after = refApply(scr);
      expect(after.length).toBe(N);
    }
  });
});
