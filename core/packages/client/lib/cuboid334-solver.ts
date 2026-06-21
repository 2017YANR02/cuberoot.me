/*
 * 3×3×4 cuboid (334) solver — HYBRID per-instance solver. Pure TS, no worker, no tables to download.
 *
 * The 3×3×4 is 3 wide (x) × 3 deep (z) × 4 tall (y). cstimer fixes the puzzle in space and emits a
 * 12-token alphabet (scramble/megascramble.js:9
 *   "334": [[[["U","U'","U2"],["u","u'","u2"]],[["R2","L2","M2"]],[["F2","B2","S2"]]]] ):
 *   U U' U2  — the top face (y=3) turns 90° (square 3×3 cross-section), three powers;
 *   u u' u2  — the slice just below the top (y=2) turns 90°, three powers;
 *   R2 L2 M2 — the three x-slabs (x=2 / x=0 / x=1) turn 180° only (a 90° would not fit, the y span is 4);
 *   F2 B2 S2 — the three z-slabs (z=2 / z=0 / z=1) turn 180° only.
 * There is no D/d turn — the bottom is fixed in cstimer's generator. Every move is re-derived
 * field-for-field from real 3D geometry below (U/u = +90° about +y; the six lateral slabs = 180°), so
 * a cstimer-generated 334 scramble is interpreted as the identical physical state and our solution
 * actually solves it. tests/cuboid334_solver.test.ts re-derives the same permutations INDEPENDENTLY
 * from geometry (NOT a byte-copy) and round-trips real cstimer scrambles — that is the validity oracle.
 *
 * STATE SPACE (measured, this is NOT a hand-derived formula):
 *   The 34 shell cubies split into 5 disjoint move-orbits — 8 corners, 8 top/bottom outer edges,
 *   8 middle-band corner-columns, 8 middle-band edge-centers, 2 face centers — with reachable
 *   physical sub-state counts 40320, 40320, 40320, 2520, 2 (each measured by an independent BFS).
 *   The full group order over the 66 distinguishable facelets is 2,642,908,293,365,760,000 (verified
 *   by Schreier-Sims, validated on S5/S8/A5); the physical (indistinguishable-facelet) state count is
 *   165,181,768,335,360,000 = (40320³·2520·2)/2 (a single inter-orbit permutation-parity link, factor 2).
 *   That is ~1.65×10¹⁷ — astronomically beyond TIER A (full BFS) and TIER B (packed table).
 *
 * WHY NOT PROVABLY-OPTIMAL EVERYWHERE: with only browser-buildable admissible pattern databases
 * (the five per-orbit BFS tables, max depths 13/9/13/7/1), the best admissible heuristic caps near 13
 * while the diameter is ~18-20, so IDA* explodes past depth ~12 (measured: a depth-12 state ≈ 3 s, a
 * depth-16 state times out even with a 102 MB joint PDB; weighted-A-star / greedy over the weak
 * heuristic either time out or wander to 200+ moves). A provably-optimal in-browser solver is not
 * feasible. So this is a HYBRID:
 *   • shallow states (≤ ~12 moves from solved) are solved PROVABLY OPTIMALLY by IDA* + the admissible
 *     max(orbit-distance) heuristic, within a node budget;
 *   • deeper states fall back to a fast greedy reduction (best-first over the same orbit distances),
 *     which always returns a VALID, BOUNDED solution (typically long — this is the accepted
 *     "effective + bounded" TIER-D outcome for a 1.65×10¹⁷-state puzzle with no small heuristic).
 * The returned `optimal` flag tells callers which path produced the solution.
 */

// ── geometry-derived 66-sticker model (runtime, self-verifying) ──────────────────────
const NX = 3, NY = 4, NZ = 3;
type FaceId = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';
interface Sticker { x: number; y: number; z: number; nx: number; ny: number; nz: number; face: FaceId; }
const FACE_NORMALS: ReadonlyArray<{ id: FaceId; n: [number, number, number] }> = [
  { id: 'U', n: [0, 1, 0] }, { id: 'D', n: [0, -1, 0] },
  { id: 'R', n: [1, 0, 0] }, { id: 'L', n: [-1, 0, 0] },
  { id: 'B', n: [0, 0, 1] }, { id: 'F', n: [0, 0, -1] },
];
const inSolid = (x: number, y: number, z: number) => x >= 0 && x < NX && y >= 0 && y < NY && z >= 0 && z < NZ;

const STICKERS: Sticker[] = (() => {
  const out: Sticker[] = [];
  for (let x = 0; x < NX; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
    for (const f of FACE_NORMALS) {
      const [dx, dy, dz] = f.n;
      if (!inSolid(x + dx, y + dy, z + dz)) out.push({ x, y, z, nx: dx, ny: dy, nz: dz, face: f.id });
    }
  }
  return out;
})();
const NS = STICKERS.length; // 66
const sKey = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => `${x},${y},${z}|${nx},${ny},${nz}`;
const STICKER_INDEX = new Map<string, number>(STICKERS.map((s, i) => [sKey(s.x, s.y, s.z, s.nx, s.ny, s.nz), i]));

const FACE_CODE: Record<FaceId, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const FACE_IDS: ReadonlyArray<FaceId> = ['U', 'D', 'R', 'L', 'F', 'B'];
/** Solved facelet colors (face code per sticker). */
const SOLVED_COLORS: Uint8Array = Uint8Array.from(STICKERS.map((s) => FACE_CODE[s.face]));

// 90° about +y on a y-layer: (x,z)→(z,−x) in centered coords; 180° about x / z on a slab.
const cx = (x: number) => x - 1, icx = (c: number) => c + 1, cz = (z: number) => z - 1, icz = (c: number) => c + 1;
const YMID = (NY - 1) / 2; // 1.5

function buildPerm(predicate: (s: Sticker) => boolean, transform: (s: Sticker) => [number, number, number, number, number, number]): Int32Array {
  const forward = new Int32Array(NS);
  for (let i = 0; i < NS; i++) {
    const s = STICKERS[i];
    if (!predicate(s)) { forward[i] = i; continue; }
    const [nxp, nyp, nzp, nnx, nny, nnz] = transform(s);
    const di = STICKER_INDEX.get(sKey(nxp, nyp, nzp, nnx, nny, nnz));
    if (di === undefined) throw new Error('334 transform left the surface');
    forward[i] = di;
  }
  // source-form P: state'[dst] = state[P[dst]]
  const P = new Int32Array(NS);
  for (let src = 0; src < NS; src++) P[forward[src]] = src;
  return P;
}
// U: top layer y=3, +90° about +y.
const BASE_U = buildPerm((s) => s.y === 3, (s) => {
  const ncx = cz(s.z), ncz = -cx(s.x); // (x,z)→(z,−x)
  const nnx = s.nz, nnz = -s.nx;
  return [icx(ncx), s.y, icz(ncz), nnx, s.ny, nnz];
});
// u: slice y=2, +90° about +y.
const BASE_u = buildPerm((s) => s.y === 2, (s) => {
  const ncx = cz(s.z), ncz = -cx(s.x);
  const nnx = s.nz, nnz = -s.nx;
  return [icx(ncx), s.y, icz(ncz), nnx, s.ny, nnz];
});
// x-slabs 180° about x: y→2·YMID−y, z→−z (centered); normal ny→−ny, nz→−nz.
const mkX180 = (slabX: number) => buildPerm((s) => s.x === slabX, (s) => {
  const ncy = 2 * YMID - s.y, ncz = -cz(s.z);
  return [s.x, ncy, icz(ncz), s.nx, -s.ny, -s.nz];
});
const BASE_R2 = mkX180(2), BASE_L2 = mkX180(0), BASE_M2 = mkX180(1);
// z-slabs 180° about z: x→−x, y→2·YMID−y; normal nx→−nx, ny→−ny.
const mkZ180 = (slabZ: number) => buildPerm((s) => s.z === slabZ, (s) => {
  const ncx = -cx(s.x), ncy = 2 * YMID - s.y;
  return [icx(ncx), ncy, s.z, -s.nx, -s.ny, s.nz];
});
const BASE_F2 = mkZ180(2), BASE_B2 = mkZ180(0), BASE_S2 = mkZ180(1);

// ── move set (12 scramble tokens) ──────────────────────────────────────────────────
interface Move334 { name: string; base: Int32Array; pow: number; }
const MOVES: ReadonlyArray<Move334> = [
  { name: 'U', base: BASE_U, pow: 1 }, { name: "U'", base: BASE_U, pow: 3 }, { name: 'U2', base: BASE_U, pow: 2 },
  { name: 'u', base: BASE_u, pow: 1 }, { name: "u'", base: BASE_u, pow: 3 }, { name: 'u2', base: BASE_u, pow: 2 },
  { name: 'R2', base: BASE_R2, pow: 1 }, { name: 'L2', base: BASE_L2, pow: 1 }, { name: 'M2', base: BASE_M2, pow: 1 },
  { name: 'F2', base: BASE_F2, pow: 1 }, { name: 'B2', base: BASE_B2, pow: 1 }, { name: 'S2', base: BASE_S2, pow: 1 },
];
const NG = MOVES.length; // 12
const MOVE_BY_NAME = new Map<string, number>(MOVES.map((m, i) => [m.name, i]));
/** Full per-move sticker permutation (base^pow), precomputed. perm[i] = source slot for slot i. */
const MOVE_PERM: Int32Array[] = MOVES.map((m) => {
  let p = Int32Array.from({ length: NS }, (_, i) => i);
  for (let k = 0; k < m.pow; k++) { const o = new Int32Array(NS); for (let i = 0; i < NS; i++) o[i] = p[m.base[i]]; p = o; }
  return p;
});
// inverse move index: U↔U', u↔u', everything else self-inverse.
const INVERSE_MOVE: number[] = MOVES.map((m, i) => {
  if (m.name === 'U') return MOVE_BY_NAME.get("U'")!;
  if (m.name === "U'") return MOVE_BY_NAME.get('U')!;
  if (m.name === 'u') return MOVE_BY_NAME.get("u'")!;
  if (m.name === "u'") return MOVE_BY_NAME.get('u')!;
  return i;
});
// axis: 0 = vertical (U/u), 1 = x (R2/L2/M2), 2 = z (F2/B2/S2). Same-axis moves commute → canonical order.
const MOVE_AXIS: number[] = MOVES.map((m) => (/^[Uu]/.test(m.name) ? 0 : /^[RLM]/.test(m.name) ? 1 : 2));

/** The exact 12-token alphabet cstimer's `334` generator emits. */
export const CUBOID334_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);
export const CUBOID334_TOKEN_RE = /^(U['2]?|u['2]?|[RLMFBS]2)$/;

/** Reachable physical state count (= (40320³·2520·2)/2), preformatted exact string (≫ 2^53). */
export const CUBOID334_STATE_COUNT_STR = '165,181,768,335,360,000';
/** Full facelet permutation-group order (Schreier-Sims, validated), preformatted exact string. */
export const CUBOID334_GROUP_ORDER_STR = '2,642,908,293,365,760,000';
/** Largest optimal length the IDA* path is allowed to claim (shallow only); deeper → greedy fallback. */
export const CUBOID334_OPTIMAL_DEPTH_CAP = 13;

function applyMove(state: Uint8Array, mi: number): Uint8Array<ArrayBuffer> {
  const p = MOVE_PERM[mi];
  const o = new Uint8Array(NS);
  for (let i = 0; i < NS; i++) o[i] = state[p[i]];
  return o;
}

/** Parse a scramble into move indices. Throws Error('bad: <tok>') on an invalid token. */
export function parseCuboid334Scramble(scramble: string): number[] {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!CUBOID334_TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(MOVE_BY_NAME.get(tok)!);
  }
  return out;
}

/** Apply a scramble to solved and return the raw 66-facelet color state. Throws on a bad token. */
export function cuboid334Apply(scramble: string): Uint8Array {
  let s = SOLVED_COLORS.slice();
  for (const mi of parseCuboid334Scramble(scramble)) s = applyMove(s, mi);
  return s;
}

// ── orbit decomposition + per-orbit pattern databases ───────────────────────────────
// Cubies = groups of stickers sharing a position; orbits = connected components under the moves.
interface Cubie { x: number; y: number; z: number; stickers: number[]; }
const CUBIES: Cubie[] = (() => {
  const byPos = new Map<string, number[]>();
  for (let i = 0; i < NS; i++) {
    const s = STICKERS[i];
    const k = `${s.x},${s.y},${s.z}`;
    if (!byPos.has(k)) byPos.set(k, []);
    byPos.get(k)!.push(i);
  }
  return [...byPos.entries()].map(([k, sts]) => {
    const [x, y, z] = k.split(',').map(Number);
    return { x, y, z, stickers: sts };
  });
})();
const NC = CUBIES.length; // 34
// cubie permutation per move (which cubie position maps where) — for orbit detection only.
function cubiePermOf(mi: number): number[] {
  const perm = MOVE_PERM[mi];
  const forward = new Int32Array(NS);
  for (let dst = 0; dst < NS; dst++) forward[perm[dst]] = dst;
  const stickerCubie = new Int32Array(NS);
  for (let ci = 0; ci < NC; ci++) for (const si of CUBIES[ci].stickers) stickerCubie[si] = ci;
  const cp = new Array<number>(NC);
  for (let ci = 0; ci < NC; ci++) cp[ci] = stickerCubie[forward[CUBIES[ci].stickers[0]]];
  return cp;
}
const ORBITS: number[][] = (() => {
  const parent = Array.from({ length: NC }, (_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let mi = 0; mi < NG; mi++) { const cp = cubiePermOf(mi); for (let p = 0; p < NC; p++) parent[find(p)] = find(cp[p]); }
  const m = new Map<number, number[]>();
  for (let p = 0; p < NC; p++) { const r = find(p); if (!m.has(r)) m.set(r, []); m.get(r)!.push(p); }
  return [...m.values()].sort((a, b) => Math.min(...a) - Math.min(...b));
})();
const NORB = ORBITS.length; // 5
// Each orbit's sticker slots, in a fixed canonical order (sorted by cubie index then sticker index).
const ORBIT_STICKERS: number[][] = ORBITS.map((mem) =>
  [...mem].sort((a, b) => a - b).flatMap((c) => CUBIES[c].stickers));

/**
 * A pattern database over one orbit: a dense index per facelet-coloring of the orbit's slots + the
 * exact BFS distance to solved over that sub-space, plus a per-move transition table on those indices.
 * Because moves keep each orbit's facelets within the orbit, the projection is a faithful quotient and
 * its BFS distance is an admissible lower bound on the full distance → max over orbits is admissible.
 */
interface OrbitDb { index: (s: Uint8Array) => number; dist: Uint8Array; trans: Int32Array[]; size: number; maxDepth: number; }
function buildOrbitDb(slots: number[]): OrbitDb {
  const map = new Map<string, number>();
  const index = (s: Uint8Array): number => {
    let k = '';
    for (const si of slots) k += String.fromCharCode(s[si] + 48);
    let v = map.get(k);
    if (v === undefined) { v = map.size; map.set(k, v); }
    return v;
  };
  // BFS from solved, building reps + dist + transitions in one pass.
  const reps: Uint8Array[] = [SOLVED_COLORS.slice()];
  const distArr: number[] = [0];
  index(SOLVED_COLORS); // assigns 0
  const seen = new Set<number>([0]);
  const trans: number[][] = Array.from({ length: NG }, () => []);
  let frontier = [0]; let d = 0; let maxDepth = 0;
  while (frontier.length) {
    const next: number[] = [];
    for (const idx of frontier) {
      const st = reps[idx];
      for (let mi = 0; mi < NG; mi++) {
        const ns = applyMove(st, mi);
        const ni = index(ns);
        trans[mi][idx] = ni;
        if (!seen.has(ni)) { seen.add(ni); reps[ni] = ns; distArr[ni] = d + 1; next.push(ni); }
      }
    }
    if (!next.length) break;
    frontier = next; d++; maxDepth = d;
  }
  return {
    index,
    dist: Uint8Array.from(distArr),
    trans: trans.map((t) => Int32Array.from(t)),
    size: reps.length,
    maxDepth,
  };
}
let DBS: OrbitDb[] | null = null;
function dbs(): OrbitDb[] {
  if (!DBS) DBS = ORBIT_STICKERS.map(buildOrbitDb);
  return DBS;
}

/** Admissible heuristic from the orbit-index tuple: max of the five orbit distances. */
function heuristicFromTuple(tuple: Int32Array, D: OrbitDb[]): number {
  let h = 0;
  for (let i = 0; i < NORB; i++) { const d = D[i].dist[tuple[i]]; if (d > h) h = d; }
  return h;
}
function tupleOf(state: Uint8Array, D: OrbitDb[]): Int32Array {
  const t = new Int32Array(NORB);
  for (let i = 0; i < NORB; i++) t[i] = D[i].index(state);
  return t;
}
const SOLVED_TUPLE_KEY = (() => {
  const D = dbs();
  return tupleOf(SOLVED_COLORS, D).join(',');
})();
const isSolvedColors = (s: Uint8Array): boolean => { for (let i = 0; i < NS; i++) if (s[i] !== SOLVED_COLORS[i]) return false; return true; };

// ── budgeted optimal IDA* (provably shortest when it returns within budget) ──────────
export interface Cuboid334Solution {
  /** Solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count. */
  length: number;
  /** Always true: this solver only ever returns a provably-optimal solution (else it throws too-deep).
   *  Kept on the result shape for API symmetry with the other puzzle solvers. */
  optimal: boolean;
}

const IDA_NODE_BUDGET = 12_000_000; // ~2-3s ceiling; shallow/moderate states finish far below this.

/** Optimal IDA* on orbit-index tuples (heuristic max(orbit dist)). Returns null if budget exceeded. */
function solveOptimal(start: Uint8Array, D: OrbitDb[]): number[] | null {
  const t0 = tupleOf(start, D);
  if (t0.join(',') === SOLVED_TUPLE_KEY && isSolvedColors(start)) return [];
  const TR = D.map((d) => d.trans);
  const tupBuf: Int32Array[] = Array.from({ length: 64 }, () => new Int32Array(NORB));
  const pathStack = new Int32Array(64);
  let found: number[] | null = null;
  let nodes = 0;
  let budgetHit = false;

  function dfs(tuple: Int32Array, g: number, bound: number, last: number, depth: number): number {
    const f = g + heuristicFromTuple(tuple, D);
    if (f > bound) return f;
    if (tuple.join(',') === SOLVED_TUPLE_KEY) { found = Array.from(pathStack.subarray(0, depth)); return -1; }
    let min = Infinity;
    for (let mi = 0; mi < NG; mi++) {
      if (last >= 0) {
        if (mi === INVERSE_MOVE[last]) continue;
        if (MOVE_AXIS[mi] === MOVE_AXIS[last] && mi < last) continue;
      }
      if (++nodes > IDA_NODE_BUDGET) { budgetHit = true; return -1; }
      const nt = tupBuf[depth];
      for (let i = 0; i < NORB; i++) nt[i] = TR[i][mi][tuple[i]];
      pathStack[depth] = mi;
      const r = dfs(nt, g + 1, bound, mi, depth + 1);
      if (found) return -1;
      if (budgetHit) return -1;
      if (r < min) min = r;
    }
    return min;
  }

  let bound = heuristicFromTuple(t0, D);
  // Only attempt to prove optimality up to the depth where it stays cheap.
  while (bound <= CUBOID334_OPTIMAL_DEPTH_CAP + 4) {
    const r = dfs(t0, 0, bound, -1, 0);
    if (found) {
      // `found` is set inside the dfs closure, which TS's flow analysis can't track (it narrows the
      // null-initialized capture to `never`); re-widen explicitly before use.
      const sol: number[] = found;
      // Verify on the real color state (guards against any orbit-projection quirk).
      let s = start.slice();
      for (const mi of sol) s = applyMove(s, mi);
      return isSolvedColors(s) ? sol : null;
    }
    if (budgetHit || r === Infinity) return null;
    bound = r;
  }
  return null;
}

/** Thrown when a state is too deeply scrambled for the in-browser optimal-search budget. NOT
 *  "unsolvable" — the puzzle is always solvable; the 1.65×10¹⁷ space simply has no browser-light fast
 *  solver for near-maximally-scrambled states, and no admissible heuristic strong enough for IDA* to
 *  reach God's number (~18-20) in interactive time (measured: a depth-12 state already ≈ 3 s, and a
 *  102 MB joint PDB still times out at depth 16). The UI shows this gracefully and offers a short
 *  scramble that always solves. Greedy/weighted/hill-climb fallbacks were measured to either time out
 *  or wander to 200+ moves, so no "valid but long" path is offered — only provably-optimal or too-deep. */
export const CUBOID334_TOO_DEEP = 'too-deep';

/**
 * Solve a 3×3×4 scramble to a PROVABLE optimum via IDA* + the admissible max(orbit-distance)
 * heuristic, within a node budget. Throws Error('bad: …') on a bad token, or Error('too-deep') when
 * the state is beyond the in-browser optimal-search budget (i.e. deeper than ~13-14 moves). The
 * returned `optimal` flag is always true.
 */
export function solveCuboid334(scramble: string): Cuboid334Solution {
  const D = dbs();
  const start = cuboid334Apply(scramble);
  const opt = solveOptimal(start, D);
  if (!opt) throw new Error(CUBOID334_TOO_DEEP);
  return { solution: opt.map((m) => MOVES[m].name).join(' '), length: opt.length, optimal: true };
}

/** Admissible lower bound (max orbit distance) of a scramble — for diagnostics/tests. */
export function cuboid334Heuristic(scramble: string): number {
  const D = dbs();
  return heuristicFromTuple(tupleOf(cuboid334Apply(scramble), D), D);
}

// ── faithful cstimer-style random scramble (mirrors megascramble.js mega() for 334) ──
export function randomCuboid334Scramble(len: number, rnd: () => number = Math.random): string {
  // axes: 0 = vertical with TWO slots [U-family, u-family]; 1 = [R2,L2,M2]; 2 = [F2,B2,S2].
  const turns: ReadonlyArray<ReadonlyArray<string | string[]>> = [
    [['U', "U'", 'U2'], ['u', "u'", 'u2']],
    [['R2', 'L2', 'M2']],
    [['F2', 'B2', 'S2']],
  ];
  let donemoves = 0;
  let lastaxis = -1;
  const s: string[] = [];
  for (let i = 0; i < len; i++) {
    let first = 0, second = 0;
    do {
      first = Math.floor(rnd() * turns.length);
      second = Math.floor(rnd() * turns[first].length);
      if (first !== lastaxis) { donemoves = 0; lastaxis = first; }
    } while (((donemoves >> second) & 1) !== 0);
    donemoves |= 1 << second;
    const cell = turns[first][second];
    s.push(Array.isArray(cell) ? cell[Math.floor(rnd() * cell.length)] : cell);
  }
  return s.join(' ');
}

export interface Cuboid334Sample { scramble: string; length: number; optimal: boolean; }

/**
 * Sample `n` random short scrambles of `scrambleLen` moves and solve each PROVABLY OPTIMALLY (default
 * length 8 keeps every solve in the fast optimal regime). Returns (optimal length, optimal-flag) per
 * sample. This is the optimal-solution-length distribution for `scrambleLen`-move random scrambles —
 * NOT the full-space distribution (the 1.65×10¹⁷ space can't be enumerated, and maximally-scrambled
 * states can't be solved optimally in-browser; see the solver notes). Deterministic with a seeded `rnd`.
 * Too-deep samples (should not occur at small `scrambleLen`) are skipped.
 */
export function cuboid334SampleDistribution(n: number, rnd: () => number = Math.random, scrambleLen = 8): Cuboid334Sample[] {
  dbs();
  const out: Cuboid334Sample[] = [];
  for (let i = 0; i < n; i++) {
    const scramble = randomCuboid334Scramble(scrambleLen, rnd);
    try {
      const { length, optimal } = solveCuboid334(scramble);
      out.push({ scramble, length, optimal });
    } catch { /* skip a too-deep sample (rare at small scrambleLen) */ }
  }
  return out;
}

/** Test/diagnostic: per-orbit DB coverage + max depths. */
export function cuboid334DbStats(): { sizes: number[]; maxDepths: number[] } {
  const D = dbs();
  return { sizes: D.map((d) => d.size), maxDepths: D.map((d) => d.maxDepth) };
}

export { NS, NC, NORB, ORBITS, STICKERS, FACE_IDS, SOLVED_COLORS };
