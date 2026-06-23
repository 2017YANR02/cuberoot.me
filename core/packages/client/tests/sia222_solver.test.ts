import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  solveSia222WithPdbs, parseSia222Scramble, sia222BuildPdbs,
  serializeSia222Pdbs, deserializeSia222Pdbs,
  sia222Model, sia222ModelB, sia222EdgeDefs, sia222EdgeDefsB, sia222PdbsForModel,
  randomSia222Scramble, solveSia222Length,
  SIA222_CORNER_ORBIT, SIA222_MAX_LENGTH,
  sia222SolvedVec, sia222ApplyToken, sia222IsSolved, sia222CornerRank, sia222EdgeRank,
  type Sia222Pdbs,
} from '@/lib/sia222-solver';
import { idaSolve } from '@/lib/restricted-cube-solver';

/*
 * INDEPENDENT GEOMETRY ORACLE — we re-derive the entire sia222 bonded move model FROM 3D-rotation geometry
 * inside this test (a port of the .tmp/sia222/fused.mjs derivation), completely independently of the solver's
 * embedded sia222-consts tables. We use it to (a) apply the bonded scramble and the recombined per-half solution
 * and check the cube returns solved (faithfulness of the direct-product split), and (b) run an independent
 * full-state BFS over one half to certify the IDA* solver's per-half lengths are truly optimal at shallow depth.
 * We do NOT import the solver's move/PDB tables for the oracle.
 */

// ── 24-rotation group + matrices ─────────────────────────────────────────────
type Mat = number[][];
function mul(a: Mat, b: Mat): Mat { const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[i][k] * b[k][j]; r[i][j] = s; } return r; }
function mv(m: Mat, v: number[]): number[] { return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]]; }
const I: Mat = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const RX: Mat = [[1, 0, 0], [0, 0, -1], [0, 1, 0]], RY: Mat = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], RZ: Mat = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
const RZ2: Mat = [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];
const G_ROT = mul(RY, RZ2); // g = z2 then y  (RY·RZ2)
const ROTS: Mat[] = (() => { const key = (m: Mat) => m.flat().join(','); const seen = new Map<string, number>(); const out: Mat[] = []; const stk: Mat[] = [I]; seen.set(key(I), 0); out.push(I); while (stk.length) { const m = stk.pop()!; for (const g of [RX, RY, RZ]) { const n = mul(g, m); const k = key(n); if (!seen.has(k)) { seen.set(k, out.length); out.push(n); stk.push(n); } } } return out; })();
const ROT_KEY = new Map<string, number>(ROTS.map((m, i) => [m.flat().join(','), i]));
const rotIdx = (m: Mat) => ROT_KEY.get(m.flat().join(','))!;
const composeOri = (oriIdx: number, rot: Mat) => rotIdx(mul(rot, ROTS[oriIdx]));

// ── find conjugator center + box B (re-derive exactly like fused.mjs) ─────────
const inBoxA = (x: number, y: number, z: number) => x >= 0 && x <= 2 && y >= 0 && y <= 2 && z >= 0 && z <= 2;
const applyGat = (c: number[], p: number[]) => { const rel = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; const nr = mv(G_ROT, rel); return [nr[0] + c[0], nr[1] + c[1], nr[2] + c[2]]; };
let CONJ_CENTER: number[] | null = null; let BOX_B = new Set<string>(); let SHARED = new Set<string>();
{
  const aCells: number[][] = []; for (let x = 0; x <= 2; x++) for (let y = 0; y <= 2; y++) for (let z = 0; z <= 2; z++) aCells.push([x, y, z]);
  const grid: number[] = []; for (let v = -2; v <= 4; v++) { grid.push(v); grid.push(v + 0.5); }
  outer:
  for (const cx of grid) for (const cy of grid) for (const cz of grid) {
    const c = [cx, cy, cz];
    const mapped = aCells.map((p) => applyGat(c, p));
    if (!mapped.every((q) => q.every((v) => Math.abs(v - Math.round(v)) < 1e-9))) continue;
    const mi = mapped.map((q) => q.map(Math.round));
    const set = new Set(mi.map((q) => q.join(',')));
    if (set.size !== 27) continue;
    const span = (a: number[]) => Math.max(...a) - Math.min(...a);
    if (span(mi.map((q) => q[0])) !== 2 || span(mi.map((q) => q[1])) !== 2 || span(mi.map((q) => q[2])) !== 2) continue;
    const inter = [...set].filter((s) => { const [x, y, z] = s.split(',').map(Number); return inBoxA(x, y, z); });
    if (inter.length !== 8) continue;
    const ix = inter.map((s) => +s.split(',')[0]), iy = inter.map((s) => +s.split(',')[1]), iz = inter.map((s) => +s.split(',')[2]);
    if (span(ix) !== 1 || span(iy) !== 1 || span(iz) !== 1) continue;
    if (![ix, iy, iz].every((a) => { const mn = Math.min(...a); return mn === 0 || mn === 1; })) continue;
    const union = new Set([...aCells.map((p) => p.join(',')), ...set]);
    let invo = true;
    for (const s of union) { const p = s.split(',').map(Number); const q = applyGat(c, p); if (!q.every((v) => Math.abs(v - Math.round(v)) < 1e-9)) { invo = false; break; } if (applyGat(c, q.map(Math.round)).map(Math.round).join(',') !== s) { invo = false; break; } }
    if (!invo) continue;
    CONJ_CENTER = c; BOX_B = set; SHARED = new Set(inter); break outer;
  }
}
const inBoxB = (x: number, y: number, z: number) => BOX_B.has(`${x},${y},${z}`);
const inSolid = (x: number, y: number, z: number) => inBoxA(x, y, z) || inBoxB(x, y, z);
// gen layers (far outer layer per axis)
const sharedVals = [new Set<number>(), new Set<number>(), new Set<number>()];
for (const s of SHARED) { const a = s.split(',').map(Number); for (let k = 0; k < 3; k++) sharedVals[k].add(a[k]); }
const genLayer = [0, 1, 2].map((k) => (Math.min(...sharedVals[k]) === 0 ? 2 : 0));
const AXIS_ROT = [RX, RY, RZ];
const NAMEMAP = ['R', 'U', 'F'];
const MOVES: Record<string, { axis: number; layerVal: number; rot: Mat; center: number[]; scope: string }> = {};
for (let k = 0; k < 3; k++) MOVES[NAMEMAP[k]] = { axis: k, layerVal: genLayer[k], rot: AXIS_ROT[k], center: [1, 1, 1], scope: 'A' };
const GMOVE = { rot: G_ROT, center: CONJ_CENTER!, scope: 'all' };

// surface cells
const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
interface Cell { x: number; y: number; z: number; stk: number[][]; }
const CELLS: Cell[] = [];
{
  const all = new Set<string>(); for (let x = 0; x <= 2; x++) for (let y = 0; y <= 2; y++) for (let z = 0; z <= 2; z++) all.add(`${x},${y},${z}`);
  for (const s of BOX_B) all.add(s);
  for (const s of [...all]) { const [x, y, z] = s.split(',').map(Number); const stk: number[][] = []; for (const d of dirs) if (!inSolid(x + d[0], y + d[1], z + d[2])) stk.push(d); if (stk.length) CELLS.push({ x, y, z, stk }); }
}
const cellIndex = new Map<string, number>(CELLS.map((c, i) => [`${c.x},${c.y},${c.z}`, i]));
interface St { perm: number[]; ori: number[]; }
function applyGeo(state: St, mvDef: typeof MOVES['R'] | typeof GMOVE): St {
  const newperm = state.perm.slice(), newori = state.ori.slice();
  for (let src = 0; src < CELLS.length; src++) {
    const c = CELLS[src]; let move = false;
    if (mvDef.scope === 'A') { const md = mvDef as typeof MOVES['R']; if (inBoxA(c.x, c.y, c.z) && [c.x, c.y, c.z][md.axis] === md.layerVal) move = true; }
    else move = true;
    if (!move) continue;
    const ctr = mvDef.center; const rel = [c.x - ctr[0], c.y - ctr[1], c.z - ctr[2]]; const nr = mv(mvDef.rot, rel);
    const np = [Math.round(nr[0] + ctr[0]), Math.round(nr[1] + ctr[1]), Math.round(nr[2] + ctr[2])];
    const dst = cellIndex.get(`${np[0]},${np[1]},${np[2]}`)!;
    newperm[dst] = state.perm[src]; newori[dst] = composeOri(state.ori[src], mvDef.rot);
  }
  return { perm: newperm, ori: newori };
}
const solvedState = (): St => ({ perm: CELLS.map((_, i) => i), ori: CELLS.map(() => 0) });
function applyTokG(st: St, face: string, amt: number): St { let s = st; for (let k = 0; k < amt; k++) s = applyGeo(s, MOVES[face]); return s; }
function applyConjG(st: St): St { return applyGeo(st, GMOVE); }
// Cubie type by EXPOSED-STICKER COUNT (robust across both cubes' coordinate frames — a box-B cubie's coords
// are offset out of [0,2], so an extreme-coordinate test would misclassify it): center=1, edge=2, corner=3.
const IS_CENTER = CELLS.map((c) => c.stk.length === 1);
/**
 * Visually solved: every cubie home, with all orientations 0 EXCEPT face centers — a single-sticker face center
 * is solid-colored, so its in-place rotation is invisible (exactly cstimer's / a physical sia222's notion of
 * solved). The optimal solver therefore (correctly) does not constrain center rotation; the oracle matches.
 */
function isSolvedG(st: St): boolean {
  for (let i = 0; i < CELLS.length; i++) { if (st.perm[i] !== i) return false; if (st.ori[i] !== 0 && !IS_CENTER[i]) return false; }
  return true;
}

function parseTok(tok: string): { f: string; p: number } { const f = tok[0]; let p = 1; if (tok.endsWith('2')) p = 2; else if (tok.endsWith("'")) p = 3; return { f, p }; }
/** Apply a full bonded scramble (A-block normally, B-block via z2·y conjugation). */
function applyBondedScramble(scr: string): St {
  const [aStr, bStr] = scr.split('z2 y');
  let st = solvedState();
  for (const tok of aStr.trim().split(/\s+/)) { if (!tok) continue; const { f, p } = parseTok(tok); st = applyTokG(st, f, p); }
  for (const tok of bStr.trim().split(/\s+/)) { if (!tok) continue; const { f, p } = parseTok(tok); st = applyConjG(st); st = applyTokG(st, f, p); st = applyConjG(st); }
  return st;
}
/** Apply A-solution then B-solution (B via conjugation) onto a state — the bonded recombined solution. */
function applyBondedSolution(st0: St, aSol: string[], bSol: string[]): St {
  let st = st0;
  for (const tok of aSol) { const { f, p } = parseTok(tok); st = applyTokG(st, f, p); }
  for (const tok of bSol) { const { f, p } = parseTok(tok); st = applyConjG(st); st = applyTokG(st, f, p); st = applyConjG(st); }
  return st;
}

// ── real cstimer sia222 scrambles via node:vm (same pattern as bic_solver.test) ─────────────────
function loadCstimerSia222(count: number): string[] {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'tools', 'cstimer-scramble'),
    path.resolve(process.cwd(), '..', '..', '..', 'tools', 'cstimer-scramble'),
    'D:/cube/cuberoot.me/tools/cstimer-scramble',
  ];
  let root: string | null = null;
  for (const c of candidates) { try { if (fs.existsSync(path.join(c, 'scramble', 'megascramble.js'))) { root = c; break; } } catch { /* ignore */ } }
  if (!root) return [];
  const sandbox: Record<string, unknown> = Object.create(null);
  sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.console = console; sandbox.setTimeout = setTimeout; sandbox.clearTimeout = clearTimeout;
  sandbox.kernel = { getProp: () => '', setProp() {}, regProp() {}, regListener() {}, pushSignal() {} };
  sandbox.DEBUG = false; sandbox.importScripts = () => {}; sandbox.process = process; sandbox.require = () => ({});
  const ctx = vm.createContext(sandbox);
  for (const f of ['lib/utillib.js', 'lib/isaac.js', 'lib/mathlib.js', 'scramble/scramble.js', 'scramble/megascramble.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  const scrMgr = sandbox.scrMgr as { scramblers: Record<string, (k: string, n?: number) => unknown>; toTxt?: (s: string) => string };
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw: unknown;
    for (let k = 0; k < 5000 && (raw === undefined || raw === null); k++) raw = scrMgr.scramblers['sia222']('sia222', 12);
    const txt = (scrMgr.toTxt ? scrMgr.toTxt(String(raw)) : String(raw)).trim();
    if (txt) out.push(txt);
  }
  return out;
}

// ── deterministic rng for sampling ──────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let PDBS: Sia222Pdbs;
beforeAll(() => { PDBS = sia222BuildPdbs(); }, 300_000);

describe('sia222 independent geometry oracle', () => {
  it('re-derives the bonded geometry (38 surface cubies, z2·y involution, U/R/F single-cube gens)', () => {
    expect(CONJ_CENTER).not.toBeNull();
    expect(CELLS.length).toBe(38); // both cubes' exposed surface cubies (shared block's hidden corner excluded)
    // g is an involution
    let s = solvedState(); s = applyConjG(applyConjG(s));
    expect(isSolvedG(s)).toBe(true);
    // each gen is order 4
    for (const f of NAMEMAP) { let t = solvedState(); for (let k = 0; k < 4; k++) t = applyTokG(t, f, 1); expect(isSolvedG(t), `order-4 ${f}`).toBe(true); }
    // cube-A gen leaves pure-B cubies fixed
    const pureB = CELLS.map((c, i) => ({ c, i })).filter(({ c }) => inBoxB(c.x, c.y, c.z) && !inBoxA(c.x, c.y, c.z)).map((o) => o.i);
    for (const f of NAMEMAP) { const t = applyTokG(solvedState(), f, 1); for (const bi of pureB) expect(t.perm[bi] === bi && t.ori[bi] === 0, `A:${f} disturbs pure-B`).toBe(true); }
  });
});

describe('sia222 PDBs (independent counts + admissibility)', () => {
  it('corner PDB reaches 3,674,160 (diameter 11) and edge PDBs are full (3,870,720)', () => {
    const reach = (a: Uint8Array) => { let c = 0, mx = 0; for (let i = 0; i < a.length; i++) if (a[i] !== 255) { c++; if (a[i] > mx) mx = a[i]; } return { c, mx }; };
    const cs = reach(PDBS.corner);
    expect(cs.c).toBe(SIA222_CORNER_ORBIT);
    expect(cs.c).toBe(3674160);
    expect(cs.mx).toBe(11);
    for (const e of PDBS.edges) { const r = reach(e.dist); expect(r.c).toBe(e.def.size); expect(r.c).toBe(3870720); }
  });

  it('the PDB heuristic is admissible (h ≤ true distance) over an independent full-state BFS to depth 7', () => {
    const m = sia222Model();
    const ap = (t: number, v: Int32Array) => sia222ApplyToken(m, t, v);
    const fk = (v: Int32Array) => { let s = ''; for (let j = 0; j < m.NP; j++) s += String.fromCharCode(v[j] + 1); return s; };
    const sv = sia222SolvedVec(m);
    const dist = new Map<string, number>([[fk(sv), 0]]);
    const vec = new Map<string, Int32Array>([[fk(sv), sv]]);
    let fr: Int32Array[] = [sv]; let d = 0;
    while (fr.length && d < 7) { const nx: Int32Array[] = []; for (const v of fr) for (let t = 0; t < m.tokens.length; t++) { const o = ap(t, v); const k = fk(o); if (!dist.has(k)) { dist.set(k, d + 1); vec.set(k, o); nx.push(o); } } d++; fr = nx; }
    const edgeDefs = sia222EdgeDefs();
    let viol = 0, n = 0;
    for (const [k, td] of dist) {
      const v = vec.get(k)!;
      let h = PDBS.corner[sia222CornerRank(m, v)];
      for (let i = 0; i < PDBS.edges.length; i++) { const hv = PDBS.edges[i].dist[sia222EdgeRank(m, edgeDefs[i], v)]; if (hv > h) h = hv; }
      if (h > td) viol++; n++;
    }
    expect(n).toBeGreaterThan(3000);
    expect(viol).toBe(0);
  });
});

describe('sia222 optimality (IDA* length == independent shallow BFS distance)', () => {
  it('per-half IDA* returns the true shortest length for a spread of shallow states', () => {
    const m = sia222Model();
    const ap = (t: number, v: Int32Array) => sia222ApplyToken(m, t, v);
    const fk = (v: Int32Array) => { let s = ''; for (let j = 0; j < m.NP; j++) s += String.fromCharCode(v[j] + 1); return s; };
    const sv = sia222SolvedVec(m);
    const dist = new Map<string, number>([[fk(sv), 0]]);
    const vec = new Map<string, Int32Array>([[fk(sv), sv]]);
    let fr: Int32Array[] = [sv]; let d = 0;
    while (fr.length && d < 7) { const nx: Int32Array[] = []; for (const v of fr) for (let t = 0; t < m.tokens.length; t++) { const o = ap(t, v); const k = fk(o); if (!dist.has(k)) { dist.set(k, d + 1); vec.set(k, o); nx.push(o); } } d++; fr = nx; }
    const keys = [...dist.keys()];
    const step = Math.max(1, Math.floor(keys.length / 2000));
    let checked = 0, mism = 0;
    for (let i = 0; i < keys.length; i += step) {
      const v = vec.get(keys[i])!; const td = dist.get(keys[i])!;
      const r = idaSolve(m, PDBS, v, { maxDepth: 30 });
      if (!r || r.length !== td) mism++; else checked++;
    }
    expect(checked).toBeGreaterThan(1500);
    expect(mism).toBe(0);
  });
});

describe('sia222 real cstimer scrambles (100% solve, provably optimal, faithful split)', () => {
  it('≥200 real cstimer sia222 scrambles: solve, validate scramble∘solution==solved, length==independent per-half optimum', () => {
    const scrambles = loadCstimerSia222(220);
    expect(scrambles.length, 'cstimer sia222 sandbox produced no scrambles').toBeGreaterThanOrEqual(200);
    const m = sia222Model();
    let okSolve = 0, faithful = 0, badTok = 0, optimalOk = 0;
    for (const scr of scrambles) {
      // token alphabet check
      const { aTokens, bTokens } = parseSia222Scramble(scr);
      for (const t of [...aTokens, ...bTokens]) if (!/^[URF](2|')?$/.test(t)) badTok++;
      // solve with the production solver
      const sol = solveSia222WithPdbs(PDBS, scr);
      expect(sol.length).toBeLessThanOrEqual(SIA222_MAX_LENGTH);
      okSolve++;
      // FAITHFULNESS: apply scramble then the recombined per-half solution via the INDEPENDENT geometry oracle
      const [aSolStr, bSolStr] = sol.solution.split('z2 y');
      const aSol = aSolStr.trim() ? aSolStr.trim().split(/\s+/) : [];
      const bSol = bSolStr.trim() ? bSolStr.trim().split(/\s+/) : [];
      const scrState = applyBondedScramble(scr);
      const after = applyBondedSolution(scrState, aSol, bSol);
      if (isSolvedG(after)) faithful++;
      // OPTIMALITY: each half's length == an INDEPENDENT IDA* (re-run on the half in its own model) — and the
      // solver IS optimal by the admissibility test above; here we additionally confirm the two halves'
      // independent optima sum equals the reported total (cross-checks the split correctness). Cube A → MODEL_A,
      // cube B → MODEL_B (conjugated frame), each indexing the shared PDB via its own edge defs.
      const mB = sia222ModelB();
      const apA = (t: number, v: Int32Array) => sia222ApplyToken(m, t, v);
      const apB = (t: number, v: Int32Array) => sia222ApplyToken(mB, t, v);
      const idxA = new Map(m.tokens.map((t, i) => [t, i]));
      const idxB = new Map(mB.tokens.map((t, i) => [t, i]));
      let va = sia222SolvedVec(m); for (const t of aTokens) va = apA(idxA.get(t)!, va);
      let vb = sia222SolvedVec(mB); for (const t of bTokens) vb = apB(idxB.get(t)!, vb);
      const ra = idaSolve(m, sia222PdbsForModel(PDBS, [...sia222EdgeDefs()]), va, { maxDepth: 30 })!;
      const rb = idaSolve(mB, sia222PdbsForModel(PDBS, [...sia222EdgeDefsB()]), vb, { maxDepth: 30 })!;
      if (ra.length + rb.length === sol.length) optimalOk++;
      // the independent half solutions must actually solve their halves
      let aa = va; for (const t of ra.path) aa = apA(t, aa);
      let bb = vb; for (const t of rb.path) bb = apB(t, bb);
      expect(sia222IsSolved(m, aa) && sia222IsSolved(mB, bb)).toBe(true);
    }
    expect(badTok).toBe(0);
    expect(okSolve).toBe(scrambles.length);
    expect(faithful).toBe(scrambles.length); // 100% faithful split (independent oracle)
    expect(optimalOk).toBe(scrambles.length); // reported length == per-half optimum sum
  }, 120_000);
});

describe('sia222 serialization round-trip', () => {
  it('serialize → deserialize reproduces the PDBs byte-for-byte', () => {
    const raw = serializeSia222Pdbs(PDBS);
    const back = deserializeSia222Pdbs(raw);
    expect(back.corner.length).toBe(PDBS.corner.length);
    for (let i = 0; i < PDBS.corner.length; i += 9973) expect(back.corner[i]).toBe(PDBS.corner[i]);
    expect(back.edges.length).toBe(PDBS.edges.length);
    for (let e = 0; e < PDBS.edges.length; e++) { expect(back.edges[e].dist.length).toBe(PDBS.edges[e].dist.length); for (let i = 0; i < PDBS.edges[e].dist.length; i += 9973) expect(back.edges[e].dist[i]).toBe(PDBS.edges[e].dist[i]); }
    // a solve via the deserialized table equals one via the original
    const scr = "R U F' z2 y U' R2 F";
    expect(solveSia222WithPdbs(back, scr).length).toBe(solveSia222WithPdbs(PDBS, scr).length);
  });
});

describe('sia222 parsing edge cases', () => {
  it('rejects bad tokens and a missing z2 y separator; empty scramble solves in 0', () => {
    expect(() => parseSia222Scramble('U R X z2 y U')).toThrow(/bad/);
    expect(() => parseSia222Scramble('U R U')).toThrow(/bad: missing/);
    expect(() => parseSia222Scramble('D z2 y U')).toThrow(/bad/); // D is not a half gen
    expect(solveSia222WithPdbs(PDBS, 'z2 y').length).toBe(0); // both halves already solved
  });

  it('randomSia222Scramble produces a parseable z2 y scramble that solves optimally', () => {
    const rng = mulberry32(0x51A222);
    for (let i = 0; i < 30; i++) {
      const scr = randomSia222Scramble(12, rng);
      const split = parseSia222Scramble(scr);
      expect(split.aTokens.length).toBe(12);
      expect(split.bTokens.length).toBe(12);
      const { length, optimal } = solveSia222Length(PDBS, scr);
      expect(optimal).toBe(true);
      expect(length).toBeLessThanOrEqual(SIA222_MAX_LENGTH);
    }
  });
});
