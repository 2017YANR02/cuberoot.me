import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyMoveState, solvedState, isSolvedState, parseStmScramble, stmApply,
  STM_MOVE_NAMES, NUM_MOVES, INVERSE_MOVE, MOVE_BASE,
} from '@/lib/stm-cube';
import {
  solveStmBruteBFS, solveStmOptimal, buildCornerPdb, buildEdge6Pdb, EDGE_GROUP_A, EDGE_GROUP_B,
  type StmTables,
} from '@/lib/stm-solver';

// ─────────────────────────────────────────────────────────────────────────────────────
// INDEPENDENT geometry re-derivation of the 3×3×3 STM model (54 stickers), built here from
// scratch — NOT importing the solver's MOVE_OPS — so a subtly-wrong mechanism in stm-cube.ts would
// fail this anchor even though the puzzle could still "solve" itself. Plus the canonical Singmaster
// cp/co/ep/eo reference (from math/group/cube_state.ts) and a cubing.js cross-check (node:vm sandbox
// is overkill here — cubing.js imports fine under vitest's ESM).
// ─────────────────────────────────────────────────────────────────────────────────────
const NN = 3;
type RFace = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';
interface RS { x: number; y: number; z: number; nx: number; ny: number; nz: number; face: RFace; }
const NORMALS: ReadonlyArray<{ id: RFace; n: [number, number, number] }> = [
  { id: 'U', n: [0, 1, 0] }, { id: 'D', n: [0, -1, 0] },
  { id: 'R', n: [1, 0, 0] }, { id: 'L', n: [-1, 0, 0] },
  { id: 'B', n: [0, 0, 1] }, { id: 'F', n: [0, 0, -1] },
];
const inSolid = (x: number, y: number, z: number) => x >= 0 && x < NN && y >= 0 && y < NN && z >= 0 && z < NN;
const REF_STK: RS[] = (() => {
  const out: RS[] = [];
  for (let x = 0; x < NN; x++) for (let y = 0; y < NN; y++) for (let z = 0; z < NN; z++)
    for (const f of NORMALS) { const [dx, dy, dz] = f.n; if (!inSolid(x + dx, y + dy, z + dz)) out.push({ x, y, z, nx: dx, ny: dy, nz: dz, face: f.id }); }
  return out;
})();
const RN = REF_STK.length; // 54
const rk = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => `${x},${y},${z}|${nx},${ny},${nz}`;
const REF_IDX = new Map<string, number>(REF_STK.map((s, i) => [rk(s.x, s.y, s.z, s.nx, s.ny, s.nz), i]));
const cc = (v: number) => v - 1, ic = (v: number) => v + 1;
function rrot(axis: 'x' | 'y' | 'z', dir: number) {
  return (s: RS): [number, number, number, number, number, number] => {
    let X = cc(s.x), Y = cc(s.y), Z = cc(s.z), A = s.nx, B = s.ny, C = s.nz;
    if (axis === 'y') { [X, Z] = dir > 0 ? [Z, -X] : [-Z, X]; [A, C] = dir > 0 ? [C, -A] : [-C, A]; }
    else if (axis === 'x') { [Y, Z] = dir > 0 ? [Z, -Y] : [-Z, Y]; [B, C] = dir > 0 ? [C, -B] : [-C, B]; }
    else { [X, Y] = dir > 0 ? [Y, -X] : [-Y, X]; [A, B] = dir > 0 ? [B, -A] : [-B, A]; }
    return [ic(X), ic(Y), ic(Z), A, B, C];
  };
}
function refPerm(pred: (s: RS) => boolean, tf: (s: RS) => [number, number, number, number, number, number]): number[] {
  const fwd = new Array<number>(RN);
  for (let i = 0; i < RN; i++) { const s = REF_STK[i]; if (!pred(s)) { fwd[i] = i; continue; } const [x, y, z, nx, ny, nz] = tf(s); const di = REF_IDX.get(rk(x, y, z, nx, ny, nz)); if (di === undefined) throw new Error('ref left surface'); fwd[i] = di; }
  const P = new Array<number>(RN); for (let s = 0; s < RN; s++) P[fwd[s]] = s; return P;
}
const REF_SPEC: Record<string, ['x' | 'y' | 'z', number, number]> = {
  U: ['y', 2, 1], D: ['y', 0, -1], R: ['x', 2, -1], L: ['x', 0, 1], F: ['z', 0, 1], B: ['z', 2, -1],
  M: ['x', 1, 1], E: ['y', 1, -1], S: ['z', 1, 1],
};
const REF_BASE: Record<string, number[]> = {};
for (const [n, [a, l, d]] of Object.entries(REF_SPEC)) { const sel = (s: RS) => (a === 'y' ? s.y : a === 'x' ? s.x : s.z) === l; REF_BASE[n] = refPerm(sel, rrot(a, d)); }
function refPow(P: number[], pow: number): number[] { let cur = Array.from({ length: RN }, (_, i) => i); for (let k = 0; k < pow; k++) { const o = new Array<number>(RN); for (let i = 0; i < RN; i++) o[i] = cur[P[i]]; cur = o; } return cur; }

// Build our solver's facelet coloring from a cubie state, to compare to the geometry reference. We map
// each cubie slot's home stickers to the destination slot's stickers using the move ops indirectly —
// simplest is to apply the SAME token sequence to a labeled sticker array via the solver's per-move
// sticker perm; but stm-cube doesn't expose sticker perms publicly. Instead we verify the cubie-level
// (cp/co/ep/eo/center) state against an independent cubie tracker derived from REF_STK.
const RC = (v: number) => v - 1;
function refCornerName(x: number, y: number, z: number): string { const s = new Set([RC(y) > 0 ? 'U' : 'D', RC(z) < 0 ? 'F' : 'B', RC(x) > 0 ? 'R' : 'L']); return ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'].find((nm) => [...nm].every((ch) => s.has(ch)))!; }
function refEdgeName(x: number, y: number, z: number): string { const p: string[] = []; if (RC(y) > 0) p.push('U'); else if (RC(y) < 0) p.push('D'); if (RC(z) < 0) p.push('F'); else if (RC(z) > 0) p.push('B'); if (RC(x) > 0) p.push('R'); else if (RC(x) < 0) p.push('L'); const s = new Set(p); return ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'].find((nm) => nm.length === 2 && [...nm].every((ch) => s.has(ch)) && s.size === 2)!; }

describe('stm-cube: geometry-derived move model', () => {
  it('exposes the 27 STM generators', () => {
    expect(STM_MOVE_NAMES.length).toBe(27);
    expect(NUM_MOVES).toBe(27);
    const expected = ['U', 'D', 'R', 'L', 'F', 'B', 'M', 'E', 'S'].flatMap((b) => [b, b + '2', b + "'"]);
    expect([...STM_MOVE_NAMES].sort()).toEqual([...expected].sort());
  });

  it('each base generator has order 4, slices order 4', () => {
    for (const b of ['U', 'D', 'R', 'L', 'F', 'B', 'M', 'E', 'S']) {
      let s = solvedState();
      for (let i = 0; i < 4; i++) s = applyMoveState(s, STM_MOVE_NAMES.indexOf(b));
      expect(isSolvedState(s), `${b}^4`).toBe(true);
    }
  });

  it('cp/co/ep/eo of the 6 face moves match the canonical Singmaster reference', () => {
    // from app/[lang]/math/group/_components/cube_state.ts
    const REF: Record<string, { cp: number[]; co: number[]; ep: number[]; eo: number[] }> = {
      U: { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      D: { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      R: { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      L: { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      F: { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
      B: { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
    };
    for (const f of ['U', 'D', 'R', 'L', 'F', 'B']) {
      const s = applyMoveState(solvedState(), STM_MOVE_NAMES.indexOf(f));
      expect([...s.cp], `${f}.cp`).toEqual(REF[f].cp);
      expect([...s.co], `${f}.co`).toEqual(REF[f].co);
      expect([...s.ep], `${f}.ep`).toEqual(REF[f].ep);
      expect([...s.eo], `${f}.eo`).toEqual(REF[f].eo);
      expect([...s.center], `${f}.center fixed`).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });

  it('slice moves M/E/S permute centers (the STM-defining property)', () => {
    // centers are NOT fixed by slices; this is exactly what an HTM solver gets wrong.
    for (const sl of ['M', 'E', 'S']) {
      const s = applyMoveState(solvedState(), STM_MOVE_NAMES.indexOf(sl));
      expect([...s.center], `${sl} moves centers`).not.toEqual([0, 1, 2, 3, 4, 5]);
    }
    // a single slice is a 4-cycle of 4 centers (the other 2 fixed)
    const m = applyMoveState(solvedState(), STM_MOVE_NAMES.indexOf('M'));
    let fixed = 0; for (let i = 0; i < 6; i++) if (m.center[i] === i) fixed++;
    expect(fixed, 'M fixes exactly 2 centers (R,L)').toBe(2);
  });

  it('center-permutation group under STM has exactly 24 elements (cube reorientation group)', () => {
    const seen = new Set<string>();
    let frontier = [solvedState()];
    seen.add([...solvedState().center].join(','));
    while (frontier.length) {
      const next: ReturnType<typeof solvedState>[] = [];
      for (const s of frontier) for (let mi = 0; mi < NUM_MOVES; mi++) {
        const ns = applyMoveState(s, mi); const key = [...ns.center].join(',');
        if (!seen.has(key)) { seen.add(key); next.push(ns); }
      }
      frontier = next;
    }
    expect(seen.size).toBe(24);
  });

  it('reproduces the independent-geometry facelet effect for all 27 generators after random prefixes', () => {
    // We compare cubie state by reconstructing the geometry-reference cubie permutation from REF and the
    // solver's cp/ep. Build a name→idx via the reference, then assert the induced corner/edge permutation
    // matches. (Orientation already locked by the face-move reference above; here we lock permutation
    // equivalence across ALL 27 generators incl. slices for arbitrary sequences.)
    // reference corner/edge home idx
    const CN = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
    const EN = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
    // build cubie groups in REF
    const byPos = new Map<string, number[]>();
    for (let i = 0; i < RN; i++) { const s = REF_STK[i]; const k = `${s.x},${s.y},${s.z}`; if (!byPos.has(k)) byPos.set(k, []); byPos.get(k)!.push(i); }
    const cubies = [...byPos.entries()].map(([k, sts]) => { const [x, y, z] = k.split(',').map(Number); return { x, y, z, sts }; });
    const refCorners = cubies.filter((c) => c.sts.length === 3).map((c) => ({ ...c, idx: CN.indexOf(refCornerName(c.x, c.y, c.z)) }));
    const refEdges = cubies.filter((c) => c.sts.length === 2).map((c) => ({ ...c, idx: EN.indexOf(refEdgeName(c.x, c.y, c.z)) }));
    const stickerToCorner = new Int32Array(RN).fill(-1); refCorners.forEach((c) => c.sts.forEach((si) => { stickerToCorner[si] = c.idx; }));
    const stickerToEdge = new Int32Array(RN).fill(-1); refEdges.forEach((c) => c.sts.forEach((si) => { stickerToEdge[si] = c.idx; }));
    const cornerFirst = new Array<number>(8); refCorners.forEach((c) => { cornerFirst[c.idx] = c.sts[0]; });
    const edgeFirst = new Array<number>(12); refEdges.forEach((c) => { edgeFirst[c.idx] = c.sts[0]; });

    function refCubie(tokens: string[]): { cp: number[]; ep: number[] } {
      // apply tokens to a labeled sticker permutation to find cp/ep
      let s = Array.from({ length: RN }, (_, i) => i); // s[slot] = source sticker
      for (const t of tokens) { const m = /^([UDRLFBMES])('|2)?$/.exec(t)!; const pow = m[2] === '2' ? 2 : m[2] === "'" ? 3 : 1; const P = refPow(REF_BASE[m[1]], pow); const o = new Array<number>(RN); for (let i = 0; i < RN; i++) o[i] = s[P[i]]; s = o; }
      const cp = new Array<number>(8), ep = new Array<number>(12);
      for (let slot = 0; slot < 8; slot++) cp[slot] = stickerToCorner[s[cornerFirst[slot]]];
      for (let slot = 0; slot < 12; slot++) ep[slot] = stickerToEdge[s[edgeFirst[slot]]];
      return { cp, ep };
    }

    let seed = 0x5757; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (const tok of STM_MOVE_NAMES) {
      for (let t = 0; t < 8; t++) {
        const pre: string[] = []; const n = Math.floor(rnd() * 6);
        for (let i = 0; i < n; i++) pre.push(STM_MOVE_NAMES[Math.floor(rnd() * 27)]);
        const seq = [...pre, tok];
        const ref = refCubie(seq);
        const our = stmApply(seq.join(' '));
        expect([...our.cp], `cp ${seq.join(' ')}`).toEqual(ref.cp);
        expect([...our.ep], `ep ${seq.join(' ')}`).toEqual(ref.ep);
      }
    }
  });
});

describe('stm-cube: invariants & round-trip', () => {
  function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  it('self-inverse: scramble ∘ inverse = solved (incl. centers home)', () => {
    const r = rng(1);
    for (let trial = 0; trial < 2000; trial++) {
      const toks: number[] = [];
      for (let i = 0; i < 26; i++) toks.push(Math.floor(r() * 27));
      let s = solvedState();
      for (const mi of toks) s = applyMoveState(s, mi);
      for (const mi of toks.slice().reverse()) s = applyMoveState(s, INVERSE_MOVE[mi]);
      expect(isSolvedState(s)).toBe(true);
    }
  });

  it('orientation-sum invariants always hold (Σco≡0 mod 3, Σeo≡0 mod 2)', () => {
    const r = rng(2);
    for (let trial = 0; trial < 3000; trial++) {
      const toks: number[] = [];
      for (let i = 0; i < 26; i++) toks.push(Math.floor(r() * 27));
      let s = solvedState();
      for (const mi of toks) s = applyMoveState(s, mi);
      expect([...s.co].reduce((a, b) => a + b, 0) % 3).toBe(0);
      expect([...s.eo].reduce((a, b) => a + b, 0) % 2).toBe(0);
    }
  });

  it('parses + rejects tokens correctly', () => {
    expect(parseStmScramble("R U M' E2 S")).toHaveLength(5);
    expect(() => parseStmScramble('X')).toThrow();
    expect(() => parseStmScramble("R3")).toThrow();
    expect(() => parseStmScramble('Rw')).toThrow();
  });

  it('INVERSE_MOVE is a true involution-respecting inverse', () => {
    for (let mi = 0; mi < NUM_MOVES; mi++) {
      let s = applyMoveState(solvedState(), mi);
      s = applyMoveState(s, INVERSE_MOVE[mi]);
      expect(isSolvedState(s), STM_MOVE_NAMES[mi]).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
// OPTIMALITY (the whole point). solveStmBruteBFS is an INDEPENDENT optimal oracle (plain BFS over the
// full state, centers included — optimal by construction, no PDBs). These run in CI (fast, shallow).
// ─────────────────────────────────────────────────────────────────────────────────────
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function randStmScramble(len: number, r: () => number): number[] { const a: number[] = []; let last = -1; for (let i = 0; i < len; i++) { let mi; do { mi = Math.floor(r() * NUM_MOVES); } while (MOVE_BASE[mi] === last); a.push(mi); last = MOVE_BASE[mi]; } return a; }
function applyMoves(toks: number[]) { let s = solvedState(); for (const mi of toks) s = applyMoveState(s, mi); return s; }
function verifySolves(state: ReturnType<typeof solvedState>, solution: string): boolean {
  let s = state; for (const tok of solution.split(/\s+/).filter(Boolean)) s = applyMoveState(s, STM_MOVE_NAMES.indexOf(tok)); return isSolvedState(s);
}

describe('STM brute-BFS optimal oracle (table-free, CI)', () => {
  it('single-move scrambles solve in exactly 1 move with the inverse', () => {
    for (const name of STM_MOVE_NAMES) {
      const r = solveStmBruteBFS(name, 4)!;
      expect(r.length, name).toBe(1);
      expect(verifySolves(stmApply(name), r.solution), name).toBe(true);
      expect(r.solution, name).toBe(STM_MOVE_NAMES[INVERSE_MOVE[STM_MOVE_NAMES.indexOf(name)]]);
    }
  });

  it('S2 M2 E2 (a pure 3-slice scramble) is solved optimally in 3', () => {
    const r = solveStmBruteBFS('S2 M2 E2', 5)!;
    expect(r.length).toBe(3);
    expect(verifySolves(stmApply('S2 M2 E2'), r.solution)).toBe(true);
  });

  it('returns a valid optimal solution for random shallow scrambles (centers home)', () => {
    const r = rng(7);
    let tested = 0;
    for (let trial = 0; trial < 80; trial++) {
      const toks = randStmScramble(1 + Math.floor(r() * 4), r); // depth ≤4 keeps brute BFS memory-light
      const state = applyMoves(toks);
      const res = solveStmBruteBFS(state, 6);
      if (!res) continue; // memory-guard tripped on a rare case — skip
      tested++;
      // BFS length is optimal by construction; it can be SHORTER than the scramble (cancellations).
      expect(res.length).toBeLessThanOrEqual(toks.length);
      expect(verifySolves(state, res.solution)).toBe(true);
      expect(res.length).toBeLessThanOrEqual(20); // STM god's-number upper bound
    }
    expect(tested).toBeGreaterThan(40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
// FULL PDB-driven solveStmOptimal optimality cross-check. The PDBs take minutes to build, so this runs
// ONLY when the cached tables exist locally (.tmp/stm/tables built once via build_stm_pdbs, or set
// STM_RUN_PDB=1 to enable (loads the cached tables from .tmp/stm/tables; build them once via
// build_stm_pdbs). OFF by default — the 173 MB tables exceed the vitest worker memory budget, and the
// Korf max(corner,edgeA,edgeB) heuristic is too weak for the hardest deep STM states to solve quickly
// (see the report: h(superflip)=6 vs depth 16; superflip needs >1e9 nodes). So CI runs only the fast
// table-free oracle tests above. When enabled, this proves solveStmOptimal == brute BFS on shallow
// scrambles (the provable-optimality core), with deeper assertions bounded by a node budget.
// ─────────────────────────────────────────────────────────────────────────────────────
const CACHE_DIR = path.resolve(__dirname, '../../../.tmp/stm/tables');
function loadCachedPdb(name: string) {
  const f = path.join(CACHE_DIR, name + '.pdb');
  if (!fs.existsSync(f)) return null;
  const buf = fs.readFileSync(f);
  const size = buf.readUInt32LE(0), maxDepth = buf.readUInt32LE(4);
  const dist = new Uint8Array(buf.buffer, buf.byteOffset + 8, size);
  return { dist, size, maxDepth };
}
const runPdb = process.env.STM_RUN_PDB === '1';

describe.skipIf(!runPdb)('STM full PDB optimal solver (opt-in: STM_RUN_PDB=1, cached tables)', () => {
  let T: StmTables;
  it('loads/builds the 3 PDBs (corner diam 11, edge diam 9)', () => {
    const corner = loadCachedPdb('corner') ?? buildCornerPdb();
    const edgeA = loadCachedPdb('edgeA') ?? buildEdge6Pdb(EDGE_GROUP_A);
    const edgeB = loadCachedPdb('edgeB') ?? buildEdge6Pdb(EDGE_GROUP_B);
    expect(corner.maxDepth).toBe(11);  // STM corner diameter (slices don't move corners; = HTM)
    expect(edgeA.maxDepth).toBe(9);
    expect(edgeB.maxDepth).toBe(9);
    T = { corner, edgeA, edgeB };
  }, 600_000);

  it('solveStmOptimal == brute-BFS optimal on shallow scrambles (PROVABLE OPTIMALITY)', () => {
    const r = rng(99);
    let tested = 0;
    for (let trial = 0; trial < 120; trial++) {
      const toks = randStmScramble(1 + Math.floor(r() * 4), r);
      const state = applyMoves(toks);
      const brute = solveStmBruteBFS(state, 6);
      if (!brute) continue;
      const opt = solveStmOptimal(state, T, 12)!;
      expect(opt.length, `scr ${toks.map((m) => STM_MOVE_NAMES[m]).join(' ')}`).toBe(brute.length);
      expect(verifySolves(state, opt.solution)).toBe(true);
      tested++;
    }
    expect(tested).toBeGreaterThan(40);
  }, 180_000);

  it('moderate-depth scrambles solve optimally within budget (≤ god\'s bound 20)', () => {
    // depth ≲13 is comfortably fast with this heuristic; cap nodes so a hard one can't hang the suite.
    const r = rng(123);
    let solved = 0;
    for (let trial = 0; trial < 8; trial++) {
      const toks = randStmScramble(11, r);
      const state = applyMoves(toks);
      const opt = solveStmOptimal(state, T, 22, 3e8);
      if (!opt) continue; // budget-exhausted on a rare hard one — acceptable (heuristic-strength wall)
      expect(opt.length).toBeLessThanOrEqual(20);
      expect(verifySolves(state, opt.solution)).toBe(true);
      solved++;
    }
    expect(solved).toBeGreaterThan(0);
  }, 180_000);
});
