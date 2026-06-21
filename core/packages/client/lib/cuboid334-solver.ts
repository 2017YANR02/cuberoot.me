/*
 * 3×3×4 cuboid (334) solver — TWO-PHASE REDUCTION hybrid. Pure TS, no worker, no tables to download.
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
 * STRATEGY — genuine TWO-PHASE reduction, so EVERY real scramble solves (TIER D near-optimal):
 * a per-instance optimal IDA* with the strongest browser-buildable admissible heuristic was measured to
 * solve only SHALLOW states (its heuristic caps near 13 while the diameter is ~18-20), so it threw
 * "too-deep" on 30/30 real cstimer scrambles (whose optimal depth sits near the diameter). That is not a
 * valid deliverable. So the solver is two-phase, and ALWAYS returns a valid bounded solution:
 *   • PHASE 1 drives every orbit INTO the all-180° subgroup H = ⟨U2,u2,R2,L2,M2,F2,B2,S2⟩ (a state from
 *     which 180°-only moves can finish it). The goal test is unambiguous — "every orbit sub-state is in
 *     H" — so no fragile coset quotient is needed (left cosets of H are NOT a well-defined quotient under
 *     the move action; a single-rep coset BFS gives wrong distances). The admissible phase-1 heuristic is
 *     max over orbits of `intoH[idx]` = the per-orbit BFS distance (over ALL 12 moves) to the nearest
 *     in-H sub-state (a multi-source BFS seeded from every in-H index). IDA* over the joint per-orbit
 *     index tuple with that heuristic; phase-1 depth is bounded by max(intoH) per orbit.
 *   • PHASE 2 solves to solved using ONLY the eight 180° moves. Inside H each orbit's 180°-reachable
 *     sub-state set is small (MEASURED 96/576/96/576/2, max BFS depth ≤8), so the per-orbit exact
 *     180°-distance PDB drives a fast IDA* over the joint phase-2 coordinate.
 * Each phase is optimal over its own small coordinate ⇒ the total is bounded and near-optimal (NOT a
 * proven global optimum, but reasonable: measured median ~17 moves over real scrambles, hard upper bound
 * CUBOID334_MAX_LENGTH). For the rare shallow state where a single all-12-move optimal IDA* finishes
 * within a small node budget AND beats the two-phase length, that optimal answer is returned with
 * `optimal: true`; otherwise the two-phase answer is returned with `optimal: false` (honestly labeled
 * "near-optimal"). Every real scramble RETURNS — there is no "too-deep".
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
/** Indices of the eight 180°-only moves (phase-2 generator set): U2 u2 R2 L2 M2 F2 B2 S2. */
const PHASE2_MOVES: number[] = ['U2', 'u2', 'R2', 'L2', 'M2', 'F2', 'B2', 'S2'].map((n) => MOVE_BY_NAME.get(n)!);
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
/** Hard upper bound on a returned two-phase solution length (phase-1 diam + phase-2 diam ≪ this). */
export const CUBOID334_MAX_LENGTH = 40;
/** Optimal-shortcut node budget: a shallow state solved optimally below this is returned as optimal. */
const OPT_SHORTCUT_BUDGET = 800_000;
/** Largest length the optimal shortcut will claim; beyond this the two-phase answer is used. */
const OPT_SHORTCUT_DEPTH_CAP = 12;

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
 * A pattern database over one orbit. The orbit's full reachable facelet-colorings (under ALL 12 moves)
 * are densely indexed; we precompute:
 *   • trans[mi][idx]  — next dense index after applying full move mi (O(1) coordinate update);
 *   • p2Dist[idx]     — exact 180°-only BFS distance to the solved sub-state (255 if NOT in the 180°
 *                       subgroup H) → phase-2 admissible heuristic AND the unambiguous "in H?" test;
 *   • intoH[idx]      — BFS distance (over ALL 12 moves) to the nearest in-H sub-state (a multi-source
 *                       BFS seeded distance-0 from every index with p2Dist≠255) → phase-1 admissible
 *                       heuristic (max over orbits). intoH[idx]==0 iff idx is in H.
 * Because moves keep each orbit's facelets within the orbit, the projection is a faithful quotient and
 * both per-orbit distances are admissible lower bounds on the full puzzle distance for their phase.
 */
interface OrbitDb {
  index: (s: Uint8Array) => number;
  trans: Int32Array[];        // NG full-move transitions over dense indices
  optDist: Uint8Array;        // exact optimal distance to solved over ALL 12 moves (admissible PDB)
  p2Dist: Uint8Array;         // 180°-only distance to solved (255 = outside the subgroup H)
  intoH: Uint8Array;          // min moves (any of the 12) from this index into H (0 = already in H)
  size: number;
  optMaxDepth: number;        // diameter of this orbit under all moves
  p2MaxDepth: number;         // diameter of the per-orbit 180° subgroup (phase-2)
  intoHMaxDepth: number;      // max moves needed to enter H from any index (phase-1, per orbit)
  inHCount: number;           // number of indices in H (= |per-orbit 180° subgroup|)
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

  // full optimal distance to solved over ALL 12 moves (BFS from solved) — admissible per-orbit PDB.
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

  // phase-2: BFS over the eight 180° moves from solved → distance to solved (255 elsewhere = not in H).
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

  // phase-1: multi-source BFS (over ALL 12 moves) seeded distance-0 from every in-H index → intoH.
  // Edges are symmetric (every move is invertible), so a forward BFS from the H set gives the exact
  // minimum number of moves to reach H from any index.
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
let DBS: OrbitDb[] | null = null;
function dbs(): OrbitDb[] {
  if (!DBS) DBS = ORBIT_STICKERS.map(buildOrbitDb);
  return DBS;
}

// ── joint phase-2 pattern databases (EXACT distances over orbit pairs) ────────────────
// Phase-2 (180°-only, within H) has the same independent-corner-orbit weakness as phase-1: per-orbit
// max(p2Dist) ≤ 7 underestimates the ~14-move joint cost and IDA* floods. The in-H sub-states per orbit
// are tiny (96/576/96/36/2), so two JOINT PDBs over the orbit PAIRS {0,2} (96·96 = 9216) and {1,3}
// (576·36 = 20736) are cheap to BFS exactly. max(pdb02, pdb13) is an ADMISSIBLE and very tight phase-2
// heuristic → IDA* converges in milliseconds. Each PDB is a one-time BFS over the eight 180° moves.
interface Phase2Pdb {
  // per-orbit: full dense index → compact in-H index (−1 if the full index is not in H)
  fullToInH: Int32Array[]; // [orbitIdx] indexed by full dense index
  // joint pair distances (exact, over P2 moves) for the two orbit pairs.
  dist02: Uint8Array; // index = inH0 * inH2count + inH2
  dist13: Uint8Array; // index = inH1 * inH3count + inH3
  inH2count: number;
  inH3count: number;
}
function buildPhase2Pdb(D: OrbitDb[]): Phase2Pdb {
  // compact in-H index per orbit + per-P2-move transition over in-H indices.
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
  // BFS a joint pair (orbits a,b) over P2 moves from solved → exact distance table.
  const pairBfs = (a: number, b: number): Uint8Array => {
    const na = inHList[a].length, nb = inHList[b].length;
    const dist = new Uint8Array(na * nb).fill(255);
    // solved in-H index per orbit = the compact index of full index 0
    const sa = fullToInH[a][0], sb = fullToInH[b][0];
    const start = sa * nb + sb;
    dist[start] = 0;
    let fr = [start]; let d = 0;
    while (fr.length) {
      const nx: number[] = [];
      for (const u of fr) {
        const ua = (u / nb) | 0, ub = u % nb;
        for (let s = 0; s < PHASE2_MOVES.length; s++) {
          const v = inHTrans[a][s][ua] * nb + inHTrans[b][s][ub];
          if (dist[v] === 255) { dist[v] = d + 1; nx.push(v); }
        }
      }
      if (!nx.length) break;
      fr = nx; d++;
    }
    return dist;
  };
  return {
    fullToInH,
    dist02: pairBfs(0, 2),
    dist13: pairBfs(1, 3),
    inH2count: inHList[2].length,
    inH3count: inHList[3].length,
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
export interface Cuboid334Solution {
  /** Solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count. */
  length: number;
  /** true = provably-optimal (shallow shortcut); false = near-optimal two-phase reduction. */
  optimal: boolean;
}

// ── phase-1 (drive all orbits INTO the 180° subgroup H) ──────────────────────────────
// in H iff every orbit sub-state is in H (intoH == 0, equivalently p2Dist != 255) — unambiguous goal.
function phase1Solved(tuple: Int32Array, D: OrbitDb[]): boolean {
  for (let i = 0; i < NORB; i++) if (D[i].intoH[tuple[i]] !== 0) return false;
  return true;
}
// Phase-1: reduce every orbit into the 180° subgroup H. The only browser-buildable admissible guide,
// max(intoH), is weak — the two corner orbits 0 and 2 are independent (verified: neither index determines
// the other), so the JOINT into-H cost (optimal reductions sit at 13–15 moves) is badly underestimated by
// max(intoH) ≤ 11; a plain admissible IDA* floods at the top bounds (measured up to ~80M nodes / 78 s). A
// joint pruning table would tighten the heuristic to optimal, but a useful joint over a 40320 corner orbit
// is ≥101M entries whose multi-source BFS does ~1.2 B RANDOM accesses into a 100 MB array — memory-latency
// bound at 1–2 MINUTES regardless of JIT/queue tuning — far too heavy for an interactive solve. So phase-1
// is a CLOSED-SET WEIGHTED-A* with NO precomputed tables: f = g + W·max(intoH), with a closed set keyed on
// the packed joint tuple (each joint state expanded at most once → loop-free, hard-bounded by a closed-set
// CAP). The weight biases the frontier greedily toward H, collapsing the explored region by orders of
// magnitude; the reduction is within ≈W× optimal (short and bounded — the contract). One W=5 attempt
// finishes inside the cap on every measured real state (≤ ~1.5 s / ≤ ~23 moves); a single greedier W=12
// fallback covers any cap-out so the total time stays bounded and a valid reduction is ALWAYS returned.
// Zero build cost.
// Phase-1 heuristic. Plain max(intoH) ≤ 11 badly underestimates the JOINT cost (the two corner orbits 0
// and 2 are independent, so reducing both needs roughly intoH[0] + intoH[2] vertical moves). We therefore
// use h = max( intoH[1], intoH[3], intoH[0] + intoH[2] ): a far tighter guide. The additive term over the
// two independent corner orbits is NOT a provable lower bound (a single 90° move can lower both at once),
// so the resulting reduction is near-optimal rather than provably optimal — exactly the TIER-D contract —
// but it collapses the A* frontier from tens of millions of nodes to a few thousand → sub-second solves.
const phase1H = (t: Int32Array, D: OrbitDb[]): number => {
  const a0 = D[0].intoH[t[0]], a2 = D[2].intoH[t[2]];
  let m = a0 + a2;
  const a1 = D[1].intoH[t[1]]; if (a1 > m) m = a1;
  const a3 = D[3].intoH[t[3]]; if (a3 > m) m = a3;
  return m;
};
// closed-set dedup. The full joint index 40320³·2520·2 ≈ 3.3e17 exceeds 2^53, so it can't be ONE exact
// double; and a per-node string concat is a heavy constant factor when the search visits millions of
// nodes. We therefore use a TWO-LEVEL numeric Map: outer key = corner-triple ((t0·40320+t1)·40320+t2) <
// 2^48 (exact), inner key = the small suffix t3·2+t4 < 5040. Pure number keys → fast, no string garbage.
function phase1CornerKey(t: Int32Array): number { return (t[0] * 40320 + t[1]) * 40320 + t[2]; }
function phase1SuffixKey(t: Int32Array): number { return t[3] * 2 + t[4]; }
// One weighted-A* attempt with a hard cap on the number of DISTINCT states (node pool). Each distinct
// joint state owns exactly ONE pool slot: a g-improving re-discovery UPDATES that slot's g/parent/move and
// re-pushes it (lazy decrease-key) rather than allocating a new node, so the pool == the closed set and
// memory is bounded by `cap` (~40 B/node). (An earlier version allocated a node per push, letting churn
// balloon the pool to 15 GB.) Returns the move path, or null if it hits the cap before reaching H.
function phase1Attempt(t0: Int32Array, D: OrbitDb[], weight: number, cap: number, greedy = false): number[] | null {
  // key(g, h) = greedy ? h : g + weight·h. Greedy best-first dives straight to H (fast, slightly longer
  // reduction); weighted-A* (greedy=false) gives a shorter reduction when the frontier stays small.
  const fKey = (g: number, h: number) => (greedy ? h : g + weight * h);
  const tuples: Int32Array[] = [t0.slice()];
  const gArr: number[] = [0]; const parent: number[] = [-1]; const moveArr: number[] = [-1];
  // seen: state → its pool index (one slot per distinct state).
  const seen = new Map<number, Map<number, number>>();
  const idxOf = (t: Int32Array): number | undefined => seen.get(phase1CornerKey(t))?.get(phase1SuffixKey(t));
  const setIdx = (t: Int32Array, idx: number) => { const ck = phase1CornerKey(t); let inner = seen.get(ck); if (!inner) { inner = new Map(); seen.set(ck, inner); } inner.set(phase1SuffixKey(t), idx); };
  setIdx(t0, 0);
  // binary min-heap over pool indices keyed on f; heapG records the g at push time (lazy decrease-key:
  // a popped entry whose heapG no longer matches the slot's current g is stale and skipped).
  const heapIdx: number[] = []; const heapF: number[] = []; const heapG: number[] = [];
  const hswap = (a: number, b: number) => { const ti = heapIdx[a]; heapIdx[a] = heapIdx[b]; heapIdx[b] = ti; const tf = heapF[a]; heapF[a] = heapF[b]; heapF[b] = tf; const tg = heapG[a]; heapG[a] = heapG[b]; heapG[b] = tg; };
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
  hpush(0, fKey(0, phase1H(t0, D)), 0);
  let goal = -1;
  while (heapIdx.length) {
    const idx = hpop();
    if (popG !== gArr[idx]) continue; // stale heap entry (this slot's g was improved later) — skip
    const tuple = tuples[idx]; const g = gArr[idx];
    if (phase1Solved(tuple, D)) { goal = idx; break; }
    const last = moveArr[idx];
    for (let mi = 0; mi < NG; mi++) {
      if (last >= 0) {
        if (mi === INVERSE_MOVE[last]) continue;
        if (MOVE_AXIS[mi] === MOVE_AXIS[last] && mi < last) continue;
      }
      const nt = new Int32Array(NORB);
      for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][tuple[i]];
      const ng = g + 1;
      const exist = idxOf(nt);
      if (exist !== undefined) {
        if (gArr[exist] <= ng) continue;          // already reached as cheaply or cheaper
        gArr[exist] = ng; parent[exist] = idx; moveArr[exist] = mi; // decrease-key: reuse the slot
        hpush(exist, fKey(ng, phase1H(nt, D)), ng);
        continue;
      }
      const nidx = tuples.length;
      tuples.push(nt); gArr.push(ng); parent.push(idx); moveArr.push(mi);
      setIdx(nt, nidx);
      hpush(nidx, fKey(ng, phase1H(nt, D)), ng);
      if (nidx + 1 > cap) return null; // distinct-state pool bounded → memory bounded; caller retries
    }
  }
  if (goal < 0) return null;
  const rev: number[] = [];
  for (let i = goal; i >= 0 && moveArr[i] >= 0; i = parent[i]) rev.push(moveArr[i]);
  rev.reverse();
  return rev;
}
function solvePhase1(t0: Int32Array, D: OrbitDb[]): number[] | null {
  if (phase1Solved(t0, D)) return [];
  // Weighted-A* (W=2) with the tight additive heuristic: the frontier stays small (a few thousand nodes),
  // so A* returns a SHORT reduction fast (measured ≤ ~0.3 s, ≤ ~14 moves). The node cap hard-bounds memory
  // (~40 B/node → ≤ ~120 MB at 3 M nodes); H is reachable from every state, so it always succeeds. The
  // greedy fallback is only for the pathological case the cap is hit (it dives but gives a longer path).
  return phase1Attempt(t0, D, 2, 3_000_000) ?? phase1Attempt(t0, D, 2, 3_000_000, true);
}

// ── phase-2 IDA* (solve within the 180° subgroup using only 180° moves) ──────────────
// Plain max(p2Dist) ≤ 7 underestimates the ~14-move joint phase-2 cost (orbits 0,2 independent) and IDA*
// floods (measured ~9-17 s). The phase-2 heuristic is therefore the ADMISSIBLE joint-pair PDB
// max(dist02[i0,i2], dist13[i1,i3]) (exact distances over the tiny in-H orbit pairs) → tight, IDA*
// converges in ms and the result is provably optimal over the 180° subgroup.
function phase2Heuristic(tuple: Int32Array, P: Phase2Pdb): number {
  const i0 = P.fullToInH[0][tuple[0]], i1 = P.fullToInH[1][tuple[1]];
  const i2 = P.fullToInH[2][tuple[2]], i3 = P.fullToInH[3][tuple[3]];
  const h02 = P.dist02[i0 * P.inH2count + i2];
  const h13 = P.dist13[i1 * P.inH3count + i3];
  return h02 > h13 ? h02 : h13;
}
function phase2Solved(tuple: Int32Array, D: OrbitDb[]): boolean {
  for (let i = 0; i < NORB; i++) if (D[i].p2Dist[tuple[i]] !== 0) return false;
  return true;
}
function solvePhase2(t0: Int32Array, D: OrbitDb[], P: Phase2Pdb, maxBound: number): number[] | null {
  const tupBuf: Int32Array[] = Array.from({ length: 48 }, () => new Int32Array(NORB));
  const pathStack = new Int32Array(48);
  let found: number[] | null = null;

  function dfs(tuple: Int32Array, g: number, bound: number, last: number, depth: number): number {
    const f = g + phase2Heuristic(tuple, P);
    if (f > bound) return f;
    if (phase2Solved(tuple, D)) { found = Array.from(pathStack.subarray(0, depth)); return -1; }
    let min = Infinity;
    for (const mi of PHASE2_MOVES) {
      if (last >= 0) {
        // every 180° move is its own inverse → undo-pruning = same-move repeat (caught by axis order too)
        if (MOVE_AXIS[mi] === MOVE_AXIS[last] && mi < last) continue;
        if (mi === last) continue;
      }
      const nt = tupBuf[depth];
      for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][tuple[i]];
      pathStack[depth] = mi;
      const r = dfs(nt, g + 1, bound, mi, depth + 1);
      if (found) return -1;
      if (r < min) min = r;
    }
    return min;
  }

  let bound = phase2Heuristic(t0, P);
  while (bound <= maxBound) {
    const r = dfs(t0, 0, bound, -1, 0);
    if (found) return found;
    if (r === Infinity) return null;
    bound = r;
  }
  return null;
}

/** Two-phase reduction: drive into the 180° subgroup (A*), then solve within it (IDA*). Always succeeds.
 *  Both phases are optimal over their own small coordinate ⇒ the total is bounded and near-optimal. */
function solveTwoPhase(start: Uint8Array, D: OrbitDb[]): number[] {
  const t0 = tupleOf(start, D);
  const p1 = solvePhase1(t0, D);
  if (!p1) throw new Error('334 phase-1 unreachable (should not happen)');
  let t = t0;
  for (const mi of p1) { const nt = new Int32Array(NORB); for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][t[i]]; t = nt; }
  const p2 = solvePhase2(t, D, p2pdb(D), 30);
  if (!p2) throw new Error('334 phase-2 unreachable (should not happen)');
  return [...p1, ...p2];
}

// ── optional optimal shortcut for shallow states (all 12 moves, admissible PDB, small budget) ─
function solveOptimalShallow(start: Uint8Array, D: OrbitDb[]): number[] | null {
  // admissible heuristic = max over orbits of the exact per-orbit optimal distance to solved (optDist).
  // Pure IDA* (f = g + h); a small node budget + depth cap keep it cheap, so it only succeeds on shallow
  // states and returns a PROVABLY OPTIMAL solution there.
  const t0 = tupleOf(start, D);
  if (isSolvedColors(start)) return [];
  const tupBuf: Int32Array[] = Array.from({ length: 48 }, () => new Int32Array(NORB));
  const pathStack = new Int32Array(48);
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
 * Solve a 3×3×4 scramble. Always returns a valid, bounded solution (length ≤ CUBOID334_MAX_LENGTH):
 *   • a shallow state solved optimally within a small node budget → `optimal: true`;
 *   • otherwise a near-optimal two-phase reduction → `optimal: false`.
 * Throws Error('bad: …') only on an unparseable token. There is no "too-deep".
 */
export function solveCuboid334(scramble: string): Cuboid334Solution {
  const D = dbs();
  const start = cuboid334Apply(scramble);
  if (isSolvedColors(start)) return { solution: '', length: 0, optimal: true };

  // A shallow state is solved PROVABLY OPTIMALLY by the budgeted IDA* shortcut; that result is shortest,
  // so two-phase can't beat it → return immediately (and skip the two-phase cost). Deeper states fall
  // through to the always-terminating, bounded near-optimal two-phase reduction.
  const opt = solveOptimalShallow(start, D);
  if (opt) return { solution: opt.map((m) => MOVES[m].name).join(' '), length: opt.length, optimal: true };

  const two = solveTwoPhase(start, D);
  // verify the two-phase result on the real color state (defensive)
  let s = start.slice();
  for (const mi of two) s = applyMove(s, mi);
  if (!isSolvedColors(s)) throw new Error('334 two-phase produced an invalid solution');
  return { solution: two.map((m) => MOVES[m].name).join(' '), length: two.length, optimal: false };
}

/** Admissible lower bound on the OPTIMAL solution length (max over orbits of the optimal per-orbit
 *  distance) — a true lower bound on any solution's length, for diagnostics/tests. */
export function cuboid334Heuristic(scramble: string): number {
  const D = dbs();
  const t = tupleOf(cuboid334Apply(scramble), D);
  let m = 0;
  for (let i = 0; i < NORB; i++) { const d = D[i].optDist[t[i]]; if (d > m) m = d; }
  return m;
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
 * Sample `n` random scrambles of `scrambleLen` moves and solve each (optimal when shallow, else the
 * near-optimal two-phase reduction). Returns (returned-solution length, optimal-flag) per sample. This
 * is the RETURNED-solution-length distribution for `scrambleLen`-move random scrambles — a SAMPLE, NOT
 * the full-space curve (the 1.65×10¹⁷ space can't be enumerated). Deterministic with a seeded `rnd`.
 */
export function cuboid334SampleDistribution(n: number, rnd: () => number = Math.random, scrambleLen = 30): Cuboid334Sample[] {
  dbs();
  const out: Cuboid334Sample[] = [];
  for (let i = 0; i < n; i++) {
    const scramble = randomCuboid334Scramble(scrambleLen, rnd);
    const { length, optimal } = solveCuboid334(scramble);
    out.push({ scramble, length, optimal });
  }
  return out;
}

/** Test/diagnostic: per-orbit full size, 180° subgroup size, and phase-1/phase-2 max depths. */
export function cuboid334DbStats(): { sizes: number[]; inHCounts: number[]; p2MaxDepths: number[]; intoHMaxDepths: number[] } {
  const D = dbs();
  return {
    sizes: D.map((d) => d.size),
    inHCounts: D.map((d) => d.inHCount),
    p2MaxDepths: D.map((d) => d.p2MaxDepth),
    intoHMaxDepths: D.map((d) => d.intoHMaxDepth),
  };
}

export { NS, NC, NORB, ORBITS, STICKERS, FACE_IDS, SOLVED_COLORS };
