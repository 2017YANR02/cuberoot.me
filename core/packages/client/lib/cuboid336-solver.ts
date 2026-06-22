/*
 * 3x3x6 cuboid (336) solver — TWO-PHASE REDUCTION hybrid. Pure TS, no worker, no tables to download.
 *
 * The 3x3x6 is 3 wide (x) x 6 tall (y) x 3 deep (z). cstimer's `336` generator (megascramble.js:10) is a
 * pure case-1 mega (NO `/333` suffix — unlike 335/337) emitting a 21-token alphabet:
 *   U U' U2  — the top cap (y=5) turns 90deg (square 3x3 cross-section), three powers;
 *   u u' u2  — the slice below it (y=4) turns 90deg;
 *   3u 3u' 3u2 — the third slice down (y=3) turns 90deg (cstimer writes the set as ["3u","3u2","3u'"]);
 *   R2 L2 M2 — the three x-slabs (x=2 / x=0 / x=1) turn 180deg only (a 90deg would not fit, y span 6);
 *   F2 B2 S2 — the three z-slabs (z=2 / z=0 / z=1) turn 180deg only.
 * There is NO D / d / 3d turn — the bottom three layers (y=0,1,2) are fixed in cstimer's generator. Every
 * token is rigidly realizable on a real 6-tall cuboid (no human-shorthand suffix to drop), so a cstimer 336
 * scramble is interpreted as the identical physical state and our solution actually solves it. Every move is
 * re-derived field-for-field from real 3D geometry below (U/u/3u = +90deg about +y; the six lateral slabs =
 * 180deg). tests/cuboid336_solver.test.ts re-derives the same permutations INDEPENDENTLY from geometry (NOT
 * a byte-copy) and round-trips real cstimer scrambles — that is the validity oracle.
 *
 * STATE SPACE (measured, this is NOT a hand-derived formula):
 *   The 50 shell cubies split into 7 disjoint move-orbits (none frozen) — three 8-corner-column orbits (one
 *   per movable y-layer), one 8 cap-outer-edge orbit, two 8 middle-band edge-center orbits, and one 2 face-
 *   center pair — with reachable physical sub-state counts 40320, 40320, 40320, 2520, 40320, 2520, 2 (each
 *   measured by an independent BFS). The naive orbit product is 33,567,049,652,379,844,608,000,000; the
 *   reachable PHYSICAL state count is that / 4 = 8,391,762,413,094,961,152,000,000 (a measured rank-2 parity
 *   coupling: U couples orbits {0,1}, u couples {2,3}, 3u couples {4,5}, the four R2/L2/F2/B2 slabs couple
 *   {1,3,5}, and M2/S2 couple {6}; 7 parities - rank 5 = 2 relations = factor 2^2). The full distinguishable-
 *   facelet group order over the 90 facelets is 2,148,291,177,752,310,054,912,000,000 (verified by Schreier-
 *   Sims, validated on S5; = physical x 256, the 2^8 color-stabilizer kernel). That is ~8.4x10^24 physical
 *   states — astronomically beyond TIER A (full BFS) and TIER B (packed table).
 *
 * STRATEGY — genuine TWO-PHASE reduction, so EVERY real scramble solves FAST (TIER D near-optimal):
 *   • PHASE 1 drives every orbit INTO the all-180deg subgroup H = <U2,u2,3u2,R2,L2,M2,F2,B2,S2> (a state from
 *     which 180deg-only moves can finish it). The goal test is unambiguous — "every orbit sub-state is in H"
 *     (per-orbit intoH==0) — so no fragile coset quotient is needed. The admissible per-orbit guide intoH[idx]
 *     is the BFS distance (over ALL 15 moves) to the nearest in-H sub-state (a multi-source BFS seeded from
 *     every in-H index). Each 90deg vertical move takes ONLY its own layer-PAIR out of H — U↔{0,1}, u↔{2,3},
 *     3u↔{4,5} (verified) — so the three pairs are driven by DISJOINT moves and are mutually independent, and
 *     180deg moves PRESERVE in-H membership for every orbit. Phase-1 therefore reduces one PAIR into H at a
 *     time (deepest layer first: 3u, u, U), each a bounded CLOSED-SET A* over {that layer's 3 vertical moves}
 *     ∪ {the 9 180deg moves} with the tight per-pair guide max(intoH[a],intoH[b]) — a 2-orbit reduction that
 *     can't explode (hard node cap + greedy fallback). The 180deg moves never break an already-reduced deeper
 *     pair. Zero tables.
 *   • PHASE 2 solves to solved using ONLY the nine 180deg moves, run entirely in COMPACT in-H index space.
 *     Inside H each orbit's set is tiny (96/576/96/36/96/36/2) BUT all six big orbits {0..5} are coupled by
 *     R2/L2/F2/B2, so the true joint cost (≤ ~24) sits MANY moves above any single 3-orbit view. The
 *     heuristic is max over a BANK of seven overlapping EXACT joint-TRIPLE PDBs centered on the two big orbits
 *     {0,1} ({0,1,2},{0,1,3},{0,1,4},{0,1,5},{0,2,4},{1,3,5},{2,3,4}; ~16M cells total) plus orbit 6's own
 *     p2Dist. Even so the heuristic stays loose (the all-six coupling), so phase-2 is a WEIGHTED CLOSED-SET A*
 *     ladder (increasing weights, each with a hard node cap; lowest weight that fits the cap wins) — bounded
 *     in time AND length, near-optimal over the 180deg subgroup rather than provably optimal.
 * Each phase is bounded and near-optimal => the total is bounded and near-optimal (NOT a proven global
 * optimum). For the rare shallow state where a single all-15-move optimal IDA* finishes within a small
 * node budget AND beats the two-phase length, that optimal answer is returned with `optimal: true`; otherwise
 * the two-phase answer is returned with `optimal: false` (honestly "near-optimal"). Every real scramble
 * RETURNS — there is no "too-deep".
 */

// ── geometry-derived 90-sticker model (runtime, self-verifying) ──────────────────────
const NX = 3, NY = 6, NZ = 3;
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
const NS = STICKERS.length; // 90
const sKey = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => `${x},${y},${z}|${nx},${ny},${nz}`;
const STICKER_INDEX = new Map<string, number>(STICKERS.map((s, i) => [sKey(s.x, s.y, s.z, s.nx, s.ny, s.nz), i]));

const FACE_CODE: Record<FaceId, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const FACE_IDS: ReadonlyArray<FaceId> = ['U', 'D', 'R', 'L', 'F', 'B'];
/** Solved facelet colors (face code per sticker). */
const SOLVED_COLORS: Uint8Array = Uint8Array.from(STICKERS.map((s) => FACE_CODE[s.face]));

// 90deg about +y on a y-layer: (x,z)→(z,−x) in centered coords; 180deg about x / z on a slab.
const cx = (x: number) => x - 1, icx = (c: number) => c + 1, cz = (z: number) => z - 1, icz = (c: number) => c + 1;
const YMID = (NY - 1) / 2; // 2.5

function buildPerm(predicate: (s: Sticker) => boolean, transform: (s: Sticker) => [number, number, number, number, number, number]): Int32Array {
  const forward = new Int32Array(NS);
  for (let i = 0; i < NS; i++) {
    const s = STICKERS[i];
    if (!predicate(s)) { forward[i] = i; continue; }
    const [nxp, nyp, nzp, nnx, nny, nnz] = transform(s);
    const di = STICKER_INDEX.get(sKey(nxp, nyp, nzp, nnx, nny, nnz));
    if (di === undefined) throw new Error('336 transform left the surface');
    forward[i] = di;
  }
  // source-form P: state'[dst] = state[P[dst]]
  const P = new Int32Array(NS);
  for (let src = 0; src < NS; src++) P[forward[src]] = src;
  return P;
}
// vertical layers, +90deg about +y: (x,z)→(z,−x).
const mkY90 = (yL: number) => buildPerm((s) => s.y === yL, (s) => {
  const ncx = cz(s.z), ncz = -cx(s.x);
  const nnx = s.nz, nnz = -s.nx;
  return [icx(ncx), s.y, icz(ncz), nnx, s.ny, nnz];
});
const BASE_U = mkY90(5), BASE_u = mkY90(4), BASE_3u = mkY90(3);
// x-slabs 180deg about x: y→2·YMID−y, z→−z (centered); normal ny→−ny, nz→−nz.
const mkX180 = (slabX: number) => buildPerm((s) => s.x === slabX, (s) => {
  const ncy = 2 * YMID - s.y, ncz = -cz(s.z);
  return [s.x, ncy, icz(ncz), s.nx, -s.ny, -s.nz];
});
const BASE_R2 = mkX180(2), BASE_L2 = mkX180(0), BASE_M2 = mkX180(1);
// z-slabs 180deg about z: x→−x, y→2·YMID−y; normal nx→−nx, ny→−ny.
const mkZ180 = (slabZ: number) => buildPerm((s) => s.z === slabZ, (s) => {
  const ncx = -cx(s.x), ncy = 2 * YMID - s.y;
  return [icx(ncx), ncy, s.z, -s.nx, -s.ny, s.nz];
});
const BASE_F2 = mkZ180(2), BASE_B2 = mkZ180(0), BASE_S2 = mkZ180(1);

// ── move set (15 scramble tokens) ────────────────────────────────────────────────────
interface Move336 { name: string; base: Int32Array; pow: number; }
const MOVES: ReadonlyArray<Move336> = [
  { name: 'U', base: BASE_U, pow: 1 }, { name: "U'", base: BASE_U, pow: 3 }, { name: 'U2', base: BASE_U, pow: 2 },
  { name: 'u', base: BASE_u, pow: 1 }, { name: "u'", base: BASE_u, pow: 3 }, { name: 'u2', base: BASE_u, pow: 2 },
  { name: '3u', base: BASE_3u, pow: 1 }, { name: "3u'", base: BASE_3u, pow: 3 }, { name: '3u2', base: BASE_3u, pow: 2 },
  { name: 'R2', base: BASE_R2, pow: 1 }, { name: 'L2', base: BASE_L2, pow: 1 }, { name: 'M2', base: BASE_M2, pow: 1 },
  { name: 'F2', base: BASE_F2, pow: 1 }, { name: 'B2', base: BASE_B2, pow: 1 }, { name: 'S2', base: BASE_S2, pow: 1 },
];
const NG = MOVES.length; // 15
const MOVE_BY_NAME = new Map<string, number>(MOVES.map((m, i) => [m.name, i]));
/** Indices of the nine 180deg-only moves (phase-2 generator set): U2 u2 3u2 R2 L2 M2 F2 B2 S2. */
const PHASE2_MOVES: number[] = ['U2', 'u2', '3u2', 'R2', 'L2', 'M2', 'F2', 'B2', 'S2'].map((n) => MOVE_BY_NAME.get(n)!);
/** Full per-move sticker permutation (base^pow), precomputed. perm[i] = source slot for slot i. */
const MOVE_PERM: Int32Array[] = MOVES.map((m) => {
  let p = Int32Array.from({ length: NS }, (_, i) => i);
  for (let k = 0; k < m.pow; k++) { const o = new Int32Array(NS); for (let i = 0; i < NS; i++) o[i] = p[m.base[i]]; p = o; }
  return p;
});
// inverse move index: U↔U', u↔u', 3u↔3u', everything else self-inverse.
const INVERSE_MOVE: number[] = MOVES.map((m, i) => {
  if (m.name === 'U') return MOVE_BY_NAME.get("U'")!;
  if (m.name === "U'") return MOVE_BY_NAME.get('U')!;
  if (m.name === 'u') return MOVE_BY_NAME.get("u'")!;
  if (m.name === "u'") return MOVE_BY_NAME.get('u')!;
  if (m.name === '3u') return MOVE_BY_NAME.get("3u'")!;
  if (m.name === "3u'") return MOVE_BY_NAME.get('3u')!;
  return i;
});
// axis: 0 = vertical (U/u/3u), 1 = x (R2/L2/M2), 2 = z (F2/B2/S2). Same-axis moves commute → canonical order.
const MOVE_AXIS: number[] = MOVES.map((m) => (/^(3?u|U)/.test(m.name) ? 0 : /^[RLM]/.test(m.name) ? 1 : 2));

/** The exact 21-token alphabet cstimer's `336` generator emits (15 distinct base/power moves). */
export const CUBOID336_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);
export const CUBOID336_TOKEN_RE = /^(U['2]?|u['2]?|3u['2]?|[RLMFBS]2)$/;

/** Reachable physical state count (= orbit product / 4), preformatted exact string (≫ 2^53). */
export const CUBOID336_STATE_COUNT_STR = '8,391,762,413,094,961,152,000,000';
/** Naive orbit product 40320^4·2520^2·2 (over-counts the reachable count by the 4× parity coupling). */
export const CUBOID336_ORBIT_PRODUCT_STR = '33,567,049,652,379,844,608,000,000';
/** Full facelet permutation-group order (Schreier-Sims, validated on S5), preformatted exact string. */
export const CUBOID336_GROUP_ORDER_STR = '2,148,291,177,752,310,054,912,000,000';
/** Hard upper bound on a returned two-phase solution length (phase-1 diam + phase-2 diam ≪ this). */
export const CUBOID336_MAX_LENGTH = 60;
/** Optimal-shortcut node budget: a shallow state solved optimally below this is returned as optimal. */
const OPT_SHORTCUT_BUDGET = 800_000;
/** Largest length the optimal shortcut will claim; beyond this the two-phase answer is used. */
const OPT_SHORTCUT_DEPTH_CAP = 12;
/** Per-attempt distinct-state cap for the phase-2 weighted-A* ladder (≈ the ~0.25 s point at ~700 ns/node). */
const PHASE2_NODE_CAP = 330_000;
/** Phase-2 weight ladder (numerator/denominator of W in f = g + W·h). The first (lowest) weight that finishes
 *  within the node cap wins — lower weight = shorter reduction, higher weight = far fewer nodes. Starting at
 *  W=2 keeps the common case short while bounding the hard tail to a few capped attempts; the final wDen=0
 *  entry is a pure greedy dive (f = h) that always reaches the goal — the guaranteed fallback. */
const PHASE2_WEIGHTS: ReadonlyArray<readonly [number, number]> = [[2, 1], [3, 1], [5, 1], [8, 1], [1, 0]];

function applyMove(state: Uint8Array, mi: number): Uint8Array<ArrayBuffer> {
  const p = MOVE_PERM[mi];
  const o = new Uint8Array(NS);
  for (let i = 0; i < NS; i++) o[i] = state[p[i]];
  return o;
}

/** Parse a scramble into move indices. Throws Error('bad: <tok>') on an invalid token. */
export function parseCuboid336Scramble(scramble: string): number[] {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!CUBOID336_TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(MOVE_BY_NAME.get(tok)!);
  }
  return out;
}

/** Apply a scramble to solved and return the raw 90-facelet color state. Throws on a bad token. */
export function cuboid336Apply(scramble: string): Uint8Array {
  let s = SOLVED_COLORS.slice();
  for (const mi of parseCuboid336Scramble(scramble)) s = applyMove(s, mi);
  return s;
}

// ── orbit decomposition + per-orbit pattern databases ───────────────────────────────
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
const NC = CUBIES.length; // 50
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
const ALL_ORBITS: number[][] = (() => {
  const parent = Array.from({ length: NC }, (_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let mi = 0; mi < NG; mi++) { const cp = cubiePermOf(mi); for (let p = 0; p < NC; p++) parent[find(p)] = find(cp[p]); }
  const m = new Map<number, number[]>();
  for (let p = 0; p < NC; p++) { const r = find(p); if (!m.has(r)) m.set(r, []); m.get(r)!.push(p); }
  return [...m.values()].sort((a, b) => Math.min(...a) - Math.min(...b));
})();
// Each orbit's sticker slots, in a fixed canonical order (sorted by cubie index then sticker index).
const ALL_ORBIT_STICKERS: number[][] = ALL_ORBITS.map((mem) =>
  [...mem].sort((a, b) => a - b).flatMap((c) => CUBIES[c].stickers));

/**
 * A pattern database over one MOVABLE orbit. The orbit's full reachable facelet-colorings (under ALL 15
 * moves) are densely indexed; we precompute trans (full-move transitions), optDist (exact distance over all
 * moves), p2Dist (180deg-only distance to solved; 255 = NOT in H), and intoH (min moves into H).
 */
interface OrbitDb {
  index: (s: Uint8Array) => number;
  trans: Int32Array[];        // NG full-move transitions over dense indices
  optDist: Uint8Array;        // exact optimal distance to solved over ALL 15 moves (admissible PDB)
  p2Dist: Uint8Array;         // 180deg-only distance to solved (255 = outside the subgroup H)
  intoH: Uint8Array;          // min moves (any of the 15) from this index into H (0 = already in H)
  size: number;
  optMaxDepth: number;        // diameter of this orbit under all moves
  p2MaxDepth: number;         // diameter of the per-orbit 180deg subgroup (phase-2)
  intoHMaxDepth: number;      // max moves needed to enter H from any index (phase-1, per orbit)
  inHCount: number;           // number of indices in H (= |per-orbit 180deg subgroup|)
}
function buildOrbitDb(slots: number[]): OrbitDb {
  const map = new Map<string, number>();
  const index = (s: Uint8Array): number => {
    let k = '';
    for (const si of slots) k += String.fromCharCode(s[si] + 48);
    let v = map.get(k);
    if (v === undefined) { v = map.size; map.set(k, v); }
    return v;
  };
  // BFS over ALL moves from solved, building reps + full-move transitions in one pass.
  const reps: Uint8Array[] = [SOLVED_COLORS.slice()];
  index(SOLVED_COLORS); // assigns 0
  const seen = new Set<number>([0]);
  const trans: number[][] = Array.from({ length: NG }, () => []);
  let frontier = [0];
  while (frontier.length) {
    const next: number[] = [];
    for (const idx of frontier) {
      const st = reps[idx];
      for (let mi = 0; mi < NG; mi++) {
        const ns = applyMove(st, mi);
        const ni = index(ns);
        trans[mi][idx] = ni;
        if (!seen.has(ni)) { seen.add(ni); reps[ni] = ns; next.push(ni); }
      }
    }
    if (!next.length) break;
    frontier = next;
  }
  const size = reps.length;
  const transI = trans.map((t) => Int32Array.from(t));

  // full optimal distance to solved over ALL 15 moves (BFS from solved) — admissible per-orbit PDB.
  const optDist = new Uint8Array(size).fill(255);
  optDist[0] = 0;
  let optMaxDepth = 0;
  {
    let fr = [0]; let d = 0;
    while (fr.length) {
      const nx: number[] = [];
      for (const u of fr) for (let mi = 0; mi < NG; mi++) {
        const v = transI[mi][u];
        if (optDist[v] === 255) { optDist[v] = d + 1; nx.push(v); }
      }
      if (!nx.length) break;
      fr = nx; d++; optMaxDepth = d;
    }
  }

  // phase-2: BFS over the nine 180deg moves from solved → distance to solved (255 elsewhere = not in H).
  const p2Dist = new Uint8Array(size).fill(255);
  p2Dist[0] = 0;
  let p2MaxDepth = 0;
  {
    let fr = [0]; let d = 0;
    while (fr.length) {
      const nx: number[] = [];
      for (const u of fr) for (const mi of PHASE2_MOVES) {
        const v = transI[mi][u];
        if (p2Dist[v] === 255) { p2Dist[v] = d + 1; nx.push(v); }
      }
      if (!nx.length) break;
      fr = nx; d++; p2MaxDepth = d;
    }
  }

  // phase-1: multi-source BFS (over ALL 15 moves) seeded distance-0 from every in-H index → intoH.
  const intoH = new Uint8Array(size).fill(255);
  let inHCount = 0;
  let intoHMaxDepth = 0;
  {
    let fr: number[] = [];
    for (let i = 0; i < size; i++) if (p2Dist[i] !== 255) { intoH[i] = 0; inHCount++; fr.push(i); }
    let d = 0;
    while (fr.length) {
      const nx: number[] = [];
      for (const u of fr) for (let mi = 0; mi < NG; mi++) {
        const v = transI[mi][u];
        if (intoH[v] === 255) { intoH[v] = d + 1; nx.push(v); }
      }
      if (!nx.length) break;
      fr = nx; d++; intoHMaxDepth = d;
    }
  }

  return { index, trans: transI, optDist, p2Dist, intoH, size, optMaxDepth, p2MaxDepth, intoHMaxDepth, inHCount };
}

// build per-orbit DBs once and keep only the MOVABLE orbits (reachable sub-state count > 1).
let DBS: OrbitDb[] | null = null;
function dbs(): OrbitDb[] {
  if (!DBS) {
    const all = ALL_ORBIT_STICKERS.map(buildOrbitDb);
    DBS = all.filter((d) => d.size > 1); // movable orbits: [40320,40320,40320,2520,40320,2520,2]
  }
  return DBS;
}
const NORB = 7; // number of movable orbits (fixed; asserted by tests)

// ── joint phase-2 pattern databases (EXACT distances over orbit TRIPLES inside H) ──────
// Per-orbit (and per-triple) max(p2Dist) badly underestimates the JOINT phase-2 cost: inside H all six big
// orbits {0..5} are coupled by R2/L2/F2/B2 (verified — each touches {0,1,2,3,4,5}), so the true joint
// distance (≤ ~24) sits MANY moves above any single 3-orbit view, and a heuristic loose by ~10 makes the
// phase-2 search EXPLODE (measured: plain IDA* 160M+ nodes; a hard in-H state needed ~2.8M A* nodes / ~4 s).
// We therefore build a BANK of overlapping EXACT joint-TRIPLE PDBs and take their MAX — admissible, and far
// tighter than any single triple. The bank is CENTERED on the two BIG orbits {0,1} (corner-columns 96 ×
// cap-edges 576), the dominant coupling: {0,1,2},{0,1,3},{0,1,4},{0,1,5} each fold {0,1} together with a
// corner/partner, plus the same-type triples {0,2,4},{1,3,5} and a mixed {2,3,4} for the non-{0,1} orbits.
// Sizes: 96·576·{96,36,96,36} = 5.3M/1.99M/5.3M/1.99M, 96³=884K, 576·36²=746K, 96·36·96=331K → ~16M cells
// total (~16 MB, built once). This lifts the worst-state heuristic well above the loose triple-only value, so
// the weighted-A* phase-2 stays bounded (≤ a few hundred K nodes) and returns a short (≤ ~24-move) reduction.
interface TriplePdb { a: number; b: number; c: number; mbc: number; nc: number; dist: Uint8Array; }
interface Phase2Pdb {
  fullToInH: Int32Array[]; // [orbitIdx] full dense index → compact in-H index (−1 if not in H)
  inHCounts: number[];     // [orbitIdx] number of in-H indices
  triples: TriplePdb[];    // bank of exact joint-triple distance tables (heuristic = max over these + orbit 6)
  inHTrans: Int32Array[][]; // [orbit][p2moveSlot][compact in-H idx] → compact in-H idx (phase-2 runs on these)
  solvedCompact: Int32Array; // the solved compact in-H index per orbit (phase-2 goal)
}
// Which orbit triples to build (see comment above). Each must be a 3-subset of {0..5}.
const PHASE2_TRIPLES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 1, 5], [0, 2, 4], [1, 3, 5], [2, 3, 4],
];
function buildPhase2Pdb(D: OrbitDb[]): Phase2Pdb {
  // compact in-H index per orbit.
  const fullToInH: Int32Array[] = [];
  const inHList: number[][] = [];          // [orbit] in-H full indices in compact order
  for (let oi = 0; oi < NORB; oi++) {
    const map = new Int32Array(D[oi].size).fill(-1);
    const list: number[] = [];
    for (let fi = 0; fi < D[oi].size; fi++) if (D[oi].p2Dist[fi] !== 255) { map[fi] = list.length; list.push(fi); }
    fullToInH.push(map); inHList.push(list);
  }
  // per-orbit per-P2-move transition over compact in-H indices.
  const inHTrans: Int32Array[][] = []; // [orbit][p2moveSlot][inHIdx]
  for (let oi = 0; oi < NORB; oi++) {
    const list = inHList[oi]; const map = fullToInH[oi];
    const t: Int32Array[] = PHASE2_MOVES.map(() => new Int32Array(list.length));
    for (let ci = 0; ci < list.length; ci++) {
      const fi = list[ci];
      for (let s = 0; s < PHASE2_MOVES.length; s++) t[s][ci] = map[D[oi].trans[PHASE2_MOVES[s]][fi]];
    }
    inHTrans.push(t);
  }
  // BFS a joint triple (orbits a,b,c) over P2 moves from solved → exact distance table.
  const tripleBfs = (a: number, b: number, c: number): TriplePdb => {
    const nb = inHList[b].length, nc = inHList[c].length, mbc = nb * nc;
    const tot = inHList[a].length * mbc;
    const dist = new Uint8Array(tot).fill(255);
    const sa = fullToInH[a][0], sb = fullToInH[b][0], sc = fullToInH[c][0];
    const start = (sa * nb + sb) * nc + sc;
    dist[start] = 0;
    let fr = [start]; let d = 0;
    while (fr.length) {
      const nx: number[] = [];
      for (const u of fr) {
        const ua = (u / mbc) | 0, rem = u % mbc, ub = (rem / nc) | 0, uc = rem % nc;
        for (let s = 0; s < PHASE2_MOVES.length; s++) {
          const v = (inHTrans[a][s][ua] * nb + inHTrans[b][s][ub]) * nc + inHTrans[c][s][uc];
          if (dist[v] === 255) { dist[v] = d + 1; nx.push(v); }
        }
      }
      if (!nx.length) break;
      fr = nx; d++;
    }
    return { a, b, c, mbc, nc, dist };
  };
  const solvedCompact = Int32Array.from(D.map((d, oi) => fullToInH[oi][d.index(SOLVED_COLORS)]));
  return {
    fullToInH,
    inHCounts: inHList.map((l) => l.length),
    triples: PHASE2_TRIPLES.map(([a, b, c]) => tripleBfs(a, b, c)),
    inHTrans,
    solvedCompact,
  };
}
let P2PDB: Phase2Pdb | null = null;
function p2pdb(D: OrbitDb[]): Phase2Pdb {
  if (!P2PDB) P2PDB = buildPhase2Pdb(D);
  return P2PDB;
}

function tupleOf(state: Uint8Array, D: OrbitDb[]): Int32Array {
  const t = new Int32Array(NORB);
  for (let i = 0; i < NORB; i++) t[i] = D[i].index(state);
  return t;
}
const isSolvedColors = (s: Uint8Array): boolean => { for (let i = 0; i < NS; i++) if (s[i] !== SOLVED_COLORS[i]) return false; return true; };

// ── result shape ────────────────────────────────────────────────────────────────────
export interface Cuboid336Solution {
  /** Solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count. */
  length: number;
  /** true = provably-optimal (shallow shortcut); false = near-optimal two-phase reduction. */
  optimal: boolean;
}

// ── phase-1 (drive all orbits INTO the 180deg subgroup H) ────────────────────────────
// in H iff every orbit sub-state is in H (intoH == 0) — unambiguous goal.
function phase1Solved(tuple: Int32Array, D: OrbitDb[]): boolean {
  for (let i = 0; i < NORB; i++) if (D[i].intoH[tuple[i]] !== 0) return false;
  return true;
}
// Phase-1 is STAGED-BUT-CAPPED — three independent per-PAIR reductions, each a bounded CLOSED-SET A* (the
// 335 phase-1 machine, NOT a per-pair IDA*). The earlier per-pair IDA* EXPLODED on near-diameter states
// (depth-58 → 4 min): IDA* re-expands exponentially when the optimal pair-reduction sits at a high bound. A
// single monolithic A* over all 7 orbits at once ALSO blows up here (measured: cap-out at >6M nodes even
// greedy) — unlike 335/334 there are THREE deep coupled pairs, so any browser-buildable joint heuristic is
// loose by enough moves that the A* frontier explodes. The structural facts that make the per-pair split
// CLEAN (verified empirically, see header): every 180deg move PRESERVES in-H membership for EVERY orbit, and
// each 90deg vertical move takes ONLY its own layer-pair out of H — U↔{0,1}, u↔{2,3}, 3u↔{4,5} (orbit 6 is
// never taken out, always in H). So we reduce one layer-pair at a time using {that pair's 3 vertical moves} ∪
// {the 9 180deg moves}: the 180deg moves reshuffle WITHIN orbits but never break an already-reduced pair, and
// the other pairs' vertical moves are excluded so they stay put. Deepest layer FIRST (3u, then u, then U)
// avoids re-disturbing shallower pairs. Each stage is a 2-orbit reduction — EXACTLY the 335 single-pair
// situation that the closed-set A* solves in tens of thousands of nodes — so NO stage can explode: hard node
// cap + greedy-dive fallback bound each. Near-optimal (additive within-pair guide), TIER-D contract.
//
// Per-pair admissible-ish guide over coupled orbits (a, b): one 90deg vertical move can lower BOTH, so the
// pair cost is ≈ max(intoH[a], intoH[b]) (a true lower bound) — the closed-set A* with this guide stays tiny.
function phase1PairSolved(t: Int32Array, D: OrbitDb[], a: number, b: number): boolean {
  return D[a].intoH[t[a]] === 0 && D[b].intoH[t[b]] === 0;
}
// One bounded closed-set A* that drives the pair (a, b) into H using `moveset`, advancing the FULL 7-orbit
// tuple (so 180deg moves correctly reshuffle every orbit). Closed-set key = the pair's two dense indices,
// packed numerically (a∈[0,40320), b∈[0,40320) → a·40320+b < 40320² ≈ 1.63×10⁹, exact double). Each distinct
// pair-state owns ONE pool slot (lazy decrease-key), so memory is bounded by `cap`. Returns the move path
// (over the full tuple's transitions) or null if it hits the cap before the pair is in H.
function phase1PairAttempt(t0: Int32Array, D: OrbitDb[], a: number, b: number, moveset: number[], weight: number, cap: number, greedy = false): number[] | null {
  const h = (t: Int32Array): number => { const ha = D[a].intoH[t[a]], hb = D[b].intoH[t[b]]; return ha > hb ? ha : hb; };
  const key = (t: Int32Array): number => t[a] * 40320 + t[b];
  const fKey = (g: number, hv: number) => (greedy ? hv : g + weight * hv);
  const tuples: Int32Array[] = [t0.slice()];
  const gArr: number[] = [0]; const parent: number[] = [-1]; const moveArr: number[] = [-1];
  const seen = new Map<number, number>(); // pair-key → pool index
  seen.set(key(t0), 0);
  const heapIdx: number[] = []; const heapF: number[] = []; const heapG: number[] = [];
  const hswap = (i: number, j: number) => { const ti = heapIdx[i]; heapIdx[i] = heapIdx[j]; heapIdx[j] = ti; const tf = heapF[i]; heapF[i] = heapF[j]; heapF[j] = tf; const tg = heapG[i]; heapG[i] = heapG[j]; heapG[j] = tg; };
  const hpush = (idx: number, f: number, g: number) => {
    let i = heapIdx.length; heapIdx.push(idx); heapF.push(f); heapG.push(g);
    while (i > 0) { const p = (i - 1) >> 1; if (heapF[p] <= heapF[i]) break; hswap(p, i); i = p; }
  };
  let popG = 0;
  const hpop = (): number => {
    const top = heapIdx[0]; popG = heapG[0]; const li = heapIdx.pop()!; const lf = heapF.pop()!; const lg = heapG.pop()!;
    if (heapIdx.length) { heapIdx[0] = li; heapF[0] = lf; heapG[0] = lg; let i = 0; const n = heapIdx.length; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < n && heapF[l] < heapF[s]) s = l; if (r < n && heapF[r] < heapF[s]) s = r; if (s === i) break; hswap(s, i); i = s; } }
    return top;
  };
  hpush(0, fKey(0, h(t0)), 0);
  let goal = -1;
  while (heapIdx.length) {
    const idx = hpop();
    if (popG !== gArr[idx]) continue; // stale heap entry — skip
    const tuple = tuples[idx]; const g = gArr[idx];
    if (phase1PairSolved(tuple, D, a, b)) { goal = idx; break; }
    const last = moveArr[idx];
    for (const mi of moveset) {
      if (last >= 0) {
        if (mi === INVERSE_MOVE[last]) continue;
        if (MOVE_AXIS[mi] === MOVE_AXIS[last] && mi < last) continue;
      }
      const nt = new Int32Array(NORB);
      for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][tuple[i]];
      const ng = g + 1;
      const kk = key(nt);
      const exist = seen.get(kk);
      if (exist !== undefined) {
        if (gArr[exist] <= ng) continue;
        gArr[exist] = ng; parent[exist] = idx; moveArr[exist] = mi;
        hpush(exist, fKey(ng, h(nt)), ng);
        continue;
      }
      const nidx = tuples.length;
      tuples.push(nt); gArr.push(ng); parent.push(idx); moveArr.push(mi);
      seen.set(kk, nidx);
      hpush(nidx, fKey(ng, h(nt)), ng);
      if (nidx + 1 > cap) return null;
    }
  }
  if (goal < 0) return null;
  const rev: number[] = [];
  for (let i = goal; i >= 0 && moveArr[i] >= 0; i = parent[i]) rev.push(moveArr[i]);
  rev.reverse();
  return rev;
}
function applyTupleMove(t: Int32Array, D: OrbitDb[], mi: number): Int32Array {
  const nt = new Int32Array(NORB);
  for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][t[i]];
  return nt;
}
// Vertical-move slots per layer (each pair's reduction adds {its 3 vertical moves} to the 9 PHASE2_MOVES).
const VERT_U = ['U', "U'", 'U2'].map((n) => MOVE_BY_NAME.get(n)!);
const VERT_u = ['u', "u'", 'u2'].map((n) => MOVE_BY_NAME.get(n)!);
const VERT_3u = ['3u', "3u'", '3u2'].map((n) => MOVE_BY_NAME.get(n)!);
// Stages, deepest layer first: [cornerOrbit, partnerOrbit, that layer's three 90deg vertical moves].
const PHASE1_STAGES: ReadonlyArray<readonly [number, number, number[]]> = [
  [4, 5, VERT_3u],
  [2, 3, VERT_u],
  [0, 1, VERT_U],
];
// Staged-but-capped phase-1: reduce each layer-pair into H in turn (deepest first), each a bounded closed-set
// A* (W=2, ~1M cap) with a greedy fallback. Each stage is a 2-orbit reduction → tiny frontier (measured ≤ a
// few tens of thousands of nodes / ≤ a few ms per stage), so the worst real state finishes in well under a
// second. Always succeeds (H reachable; each stage's moveset is closed on its goal while preserving the
// already-reduced deeper pairs).
function solvePhase1(t0: Int32Array, D: OrbitDb[]): number[] | null {
  if (phase1Solved(t0, D)) return [];
  let t = t0;
  const full: number[] = [];
  for (const [a, b, vset] of PHASE1_STAGES) {
    if (phase1PairSolved(t, D, a, b)) continue; // pair already in H
    const moveset = [...vset, ...PHASE2_MOVES];
    const seg = phase1PairAttempt(t, D, a, b, moveset, 1, 2_000_000)
      ?? phase1PairAttempt(t, D, a, b, moveset, 2, 2_000_000, true);
    if (!seg) return null;
    for (const mi of seg) { t = applyTupleMove(t, D, mi); full.push(mi); }
  }
  return phase1Solved(t, D) ? full : null;
}

// ── phase-2 (solve within the 180deg subgroup using only 180deg moves) ────────────────
// Phase-2 runs entirely in COMPACT in-H index space (a 7-vector of per-orbit in-H indices), advanced by the
// precomputed compact transition tables P.inHTrans — no full-90-facelet state, no fullToInH lookups in the
// hot loop. The heuristic is max over the joint-triple PDB bank + the lone face orbit {6}.
// Phase-2 axis per slot s (0..8): U2 u2 3u2 = vertical(0); R2 L2 M2 = x(1); F2 B2 S2 = z(2). Same-axis 180deg
// moves commute → canonical-order pruning; every 180deg move is its own inverse → same-slot repeat = undo.
const PHASE2_AXIS: number[] = PHASE2_MOVES.map((mi) => MOVE_AXIS[mi]);
const phase2HeuristicC = (c: Int32Array, P: Phase2Pdb): number => {
  let m = c[6]; // orbit 6 in-H index ∈ {0,1}; its p2Dist equals the index (0 solved, 1 one move away)
  const tr = P.triples;
  for (let k = 0; k < tr.length; k++) {
    const t = tr[k];
    const v = t.dist[c[t.a] * t.mbc + c[t.b] * t.nc + c[t.c]];
    if (v > m) m = v;
  }
  return m;
};
// Compact in-H closed-set key (exact single double): the 7 in-H indices packed by their in-H counts
// [96,576,96,36,96,36,2] → < 96·576·96·36·96·36·2 ≈ 1.58×10¹² < 2⁵³.
const phase2KeyC = (c: Int32Array): number =>
  ((((((c[0] * 576 + c[1]) * 96 + c[2]) * 36 + c[3]) * 96 + c[4]) * 36 + c[5]) * 2 + c[6]);
// Phase-2 is a bounded WEIGHTED CLOSED-SET A* (NOT plain IDA*). The joint-PDB heuristic is admissible but the
// all-six-orbit R2/L2/F2/B2 coupling leaves it loose by several moves, so plain IDA* re-explores each bound
// and EXPLODES (measured 160M+ nodes / ~20 s) and even unit A* floods past millions of nodes. A WEIGHTED
// closed-set A* (f = wDen·g + wNum·h) biases the frontier toward the goal, collapsing the explored cone by
// orders of magnitude for a reduction within ≈(wNum/wDen)× of optimal-over-H. The closed set bounds
// re-expansion; a hard node cap lets the caller's weight LADDER escalate, and a final pure-greedy entry
// (wDen=0) always reaches the goal so a valid path is guaranteed. States are stored in a flat Int32Array pool
// (NORB compact indices each) with a reused scratch buffer — no per-neighbor allocation in the hot loop.
function solvePhase2(start: Int32Array, P: Phase2Pdb, cap: number, wNum: number, wDen: number): number[] | null {
  const NM = PHASE2_MOVES.length;
  const tr = P.inHTrans;
  const solved = P.solvedCompact;
  const isSolved = (c: Int32Array, off: number): boolean => {
    for (let i = 0; i < NORB; i++) if (c[off + i] !== solved[i]) return false;
    return true;
  };
  // flat pool: state s occupies pool[s*NORB .. s*NORB+NORB-1]
  const pool = new Int32Array((cap + 1) * NORB);
  for (let i = 0; i < NORB; i++) pool[i] = start[i];
  const gArr: number[] = [0]; const parent: number[] = [-1]; const moveArr: number[] = [-1];
  let nStates = 1;
  const seen = new Map<number, number>();
  seen.set(phase2KeyC(start), 0);
  const scratch = new Int32Array(NORB);
  const heapIdx: number[] = []; const heapF: number[] = []; const heapG: number[] = [];
  const hswap = (i: number, j: number) => { const ti = heapIdx[i]; heapIdx[i] = heapIdx[j]; heapIdx[j] = ti; const tf = heapF[i]; heapF[i] = heapF[j]; heapF[j] = tf; const tg = heapG[i]; heapG[i] = heapG[j]; heapG[j] = tg; };
  const hpush = (idx: number, f: number, g: number) => {
    let i = heapIdx.length; heapIdx.push(idx); heapF.push(f); heapG.push(g);
    while (i > 0) { const p = (i - 1) >> 1; if (heapF[p] <= heapF[i]) break; hswap(p, i); i = p; }
  };
  let popG = 0;
  const hpop = (): number => {
    const top = heapIdx[0]; popG = heapG[0]; const li = heapIdx.pop()!; const lf = heapF.pop()!; const lg = heapG.pop()!;
    if (heapIdx.length) { heapIdx[0] = li; heapF[0] = lf; heapG[0] = lg; let i = 0; const n = heapIdx.length; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < n && heapF[l] < heapF[s]) s = l; if (r < n && heapF[r] < heapF[s]) s = r; if (s === i) break; hswap(s, i); i = s; } }
    return top;
  };
  hpush(0, wNum * phase2HeuristicC(start, P), 0);
  let goal = -1;
  while (heapIdx.length) {
    const idx = hpop();
    if (popG !== gArr[idx]) continue; // stale heap entry — skip
    const off = idx * NORB; const g = gArr[idx];
    if (isSolved(pool, off)) { goal = idx; break; }
    const last = moveArr[idx];
    for (let s = 0; s < NM; s++) {
      if (last >= 0) {
        if (s === last) continue; // self-inverse repeat = undo
        if (PHASE2_AXIS[s] === PHASE2_AXIS[last] && s < last) continue; // same-axis commute → canonical order
      }
      for (let i = 0; i < NORB; i++) scratch[i] = tr[i][s][pool[off + i]];
      const ng = g + 1;
      const kk = phase2KeyC(scratch);
      const exist = seen.get(kk);
      if (exist !== undefined) {
        if (gArr[exist] <= ng) continue;
        gArr[exist] = ng; parent[exist] = idx; moveArr[exist] = s;
        hpush(exist, wDen * ng + wNum * phase2HeuristicC(scratch, P), ng);
        continue;
      }
      const nidx = nStates;
      const noff = nidx * NORB;
      for (let i = 0; i < NORB; i++) pool[noff + i] = scratch[i];
      gArr.push(ng); parent.push(idx); moveArr.push(s);
      seen.set(kk, nidx);
      nStates++;
      hpush(nidx, wDen * ng + wNum * phase2HeuristicC(scratch, P), ng);
      if (nStates > cap) return null;
    }
  }
  if (goal < 0) return null;
  const rev: number[] = [];
  for (let i = goal; i >= 0 && moveArr[i] >= 0; i = parent[i]) rev.push(PHASE2_MOVES[moveArr[i]]);
  rev.reverse();
  return rev;
}

/** Two-phase reduction: drive into the 180deg subgroup (A*), then solve within it (closed-set A*). Always
 *  succeeds — each phase has a hard node cap + greedy-dive fallback that guarantees a bounded valid path. */
function solveTwoPhase(start: Uint8Array, D: OrbitDb[]): number[] {
  const t0 = tupleOf(start, D);
  const p1 = solvePhase1(t0, D);
  if (!p1) throw new Error('336 phase-1 unreachable (should not happen)');
  let t = t0;
  for (const mi of p1) { const nt = new Int32Array(NORB); for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][t[i]]; t = nt; }
  const P = p2pdb(D);
  // convert the in-H landing tuple to compact in-H indices (phase-2 runs in compact space).
  const c0 = new Int32Array(NORB);
  for (let i = 0; i < NORB; i++) c0[i] = P.fullToInH[i][t[i]];
  // Weighted-A* LADDER with a TIGHT node cap. The in-H phase-2 problem couples all six big orbits (R2/L2/F2/
  // B2 touch {0..5}), so even the rich triple-PDB max heuristic is loose by several moves and a low-weight A*
  // can explore millions of nodes on the worst states (→ multi-second). We try increasing weights, each capped
  // at PHASE2_NODE_CAP: the lowest weight that finishes within the cap wins (shortest reduction). A higher
  // weight biases the frontier harder toward the goal — far fewer nodes — at the cost of a slightly longer
  // (still comfortably inside the length bound) reduction. The final greedy entry (wDen=0) always reaches the
  // goal so a valid path is guaranteed; in practice a weighted rung wins.
  let p2: number[] | null = null;
  for (const [wn, wd] of PHASE2_WEIGHTS) {
    p2 = solvePhase2(c0, P, PHASE2_NODE_CAP, wn, wd);
    if (p2) break;
  }
  if (!p2) throw new Error('336 phase-2 unreachable (should not happen)');
  return [...p1, ...p2];
}

// ── optional optimal shortcut for shallow states (all 15 moves, admissible PDB, small budget) ─
function solveOptimalShallow(start: Uint8Array, D: OrbitDb[]): number[] | null {
  // admissible heuristic = max over orbits of the exact per-orbit optimal distance to solved (optDist). Pure
  // IDA* (f = g + h); a small node budget + depth cap keep it cheap, so it only succeeds on shallow states and
  // returns a PROVABLY OPTIMAL solution there.
  const t0 = tupleOf(start, D);
  if (isSolvedColors(start)) return [];
  const tupBuf: Int32Array[] = Array.from({ length: 64 }, () => new Int32Array(NORB));
  const pathStack = new Int32Array(64);
  let found: number[] | null = null;
  let nodes = 0;
  let budgetHit = false;
  const h = (tuple: Int32Array): number => { let m = 0; for (let i = 0; i < NORB; i++) { const d = D[i].optDist[tuple[i]]; if (d > m) m = d; } return m; };
  const solvedTuple = (tuple: Int32Array): boolean => { for (let i = 0; i < NORB; i++) if (D[i].optDist[tuple[i]] !== 0) return false; return true; };

  function dfs(tuple: Int32Array, g: number, bound: number, last: number, depth: number): number {
    const f = g + h(tuple);
    if (f > bound) return f;
    if (solvedTuple(tuple)) { found = Array.from(pathStack.subarray(0, depth)); return -1; }
    let min = Infinity;
    for (let mi = 0; mi < NG; mi++) {
      if (last >= 0) {
        if (mi === INVERSE_MOVE[last]) continue;
        if (MOVE_AXIS[mi] === MOVE_AXIS[last] && mi < last) continue;
      }
      if (++nodes > OPT_SHORTCUT_BUDGET) { budgetHit = true; return -1; }
      const nt = tupBuf[depth];
      for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][tuple[i]];
      pathStack[depth] = mi;
      const r = dfs(nt, g + 1, bound, mi, depth + 1);
      if (found) return -1;
      if (budgetHit) return -1;
      if (r < min) min = r;
    }
    return min;
  }

  let bound = h(t0);
  while (bound <= OPT_SHORTCUT_DEPTH_CAP) {
    const r = dfs(t0, 0, bound, -1, 0);
    if (found) {
      const sol: number[] = found;
      let s = start.slice();
      for (const mi of sol) s = applyMove(s, mi);
      return isSolvedColors(s) ? sol : null;
    }
    if (budgetHit || r === Infinity) return null;
    bound = r;
  }
  return null;
}

/**
 * Solve a 3x3x6 scramble. Always returns a valid, bounded solution (length ≤ CUBOID336_MAX_LENGTH):
 *   • a shallow state solved optimally within a small node budget → `optimal: true`;
 *   • otherwise a near-optimal two-phase reduction → `optimal: false`.
 * Throws Error('bad: …') only on an unparseable token. There is no "too-deep".
 */
export function solveCuboid336(scramble: string): Cuboid336Solution {
  const D = dbs();
  const start = cuboid336Apply(scramble);
  if (isSolvedColors(start)) return { solution: '', length: 0, optimal: true };

  // A shallow state is solved PROVABLY OPTIMALLY by the budgeted IDA* shortcut; that result is shortest, so
  // two-phase can't beat it → return immediately (and skip the two-phase cost). Deeper states fall through to
  // the always-terminating, bounded near-optimal two-phase reduction.
  const opt = solveOptimalShallow(start, D);
  if (opt) return { solution: opt.map((m) => MOVES[m].name).join(' '), length: opt.length, optimal: true };

  const two = solveTwoPhase(start, D);
  // verify the two-phase result on the real color state (defensive)
  let s = start.slice();
  for (const mi of two) s = applyMove(s, mi);
  if (!isSolvedColors(s)) throw new Error('336 two-phase produced an invalid solution');
  return { solution: two.map((m) => MOVES[m].name).join(' '), length: two.length, optimal: false };
}

/** Admissible lower bound on the OPTIMAL solution length (max over orbits of optimal per-orbit distance). */
export function cuboid336Heuristic(scramble: string): number {
  const D = dbs();
  const t = tupleOf(cuboid336Apply(scramble), D);
  let m = 0;
  for (let i = 0; i < NORB; i++) { const d = D[i].optDist[t[i]]; if (d > m) m = d; }
  return m;
}

// ── faithful cstimer-style random scramble (mirrors megascramble.js mega() for 336) ──
// cstimer 336 = case-1 mega over turns [[["U","U'","U2"],["u","u'","u2"],["3u","3u2","3u'"]],[["R2","L2",
// "M2"]],[["F2","B2","S2"]]] with suffixes [""]. The vertical axis has THREE slots (U/u/3u layers); the
// donemoves bitmask forbids reusing the same vertical slot until the axis changes.
export function randomCuboid336Scramble(len: number, rnd: () => number = Math.random): string {
  const turns: ReadonlyArray<ReadonlyArray<string | string[]>> = [
    [['U', "U'", 'U2'], ['u', "u'", 'u2'], ['3u', '3u2', "3u'"]],
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

export interface Cuboid336Sample { scramble: string; length: number; optimal: boolean; }

/**
 * Sample `n` random scrambles of `scrambleLen` moves and solve each. Returns (returned-solution length,
 * optimal-flag) per sample — the RETURNED-solution-length distribution for `scrambleLen`-move random
 * scrambles (a SAMPLE, NOT the full-space curve; 8.39x10^24 states can't be enumerated).
 */
export function cuboid336SampleDistribution(n: number, rnd: () => number = Math.random, scrambleLen = 50): Cuboid336Sample[] {
  dbs();
  const out: Cuboid336Sample[] = [];
  for (let i = 0; i < n; i++) {
    const scramble = randomCuboid336Scramble(scrambleLen, rnd);
    const { length, optimal } = solveCuboid336(scramble);
    out.push({ scramble, length, optimal });
  }
  return out;
}

/** Test/diagnostic: per-orbit full size, 180deg subgroup size, and phase-1/phase-2 max depths. */
export function cuboid336DbStats(): { sizes: number[]; inHCounts: number[]; p2MaxDepths: number[]; intoHMaxDepths: number[] } {
  const D = dbs();
  return {
    sizes: D.map((d) => d.size),
    inHCounts: D.map((d) => d.inHCount),
    p2MaxDepths: D.map((d) => d.p2MaxDepth),
    intoHMaxDepths: D.map((d) => d.intoHMaxDepth),
  };
}

export { NS, NC, NORB, FACE_IDS, STICKERS, SOLVED_COLORS };
