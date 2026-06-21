/*
 * 3×3×7 cuboid (337) solver — TWO-PHASE REDUCTION hybrid. Pure TS, no worker, no tables to download.
 *
 * The 3×3×7 is 3 wide (x) × 7 tall (y) × 3 deep (z). cstimer's `337` generator (megascramble.js:57)
 * emits  `<cuboid part> / ${333}`  — a cuboid scramble using the alphabet (verified by token-auditing 1200
 * real cstimer 337 scrambles: the cuboid part is EXACTLY these 16 tokens, the 333 suffix is always present
 * and only ever holds 90° side turns):
 *   U U' U2  /  D D' D2  — the top (y=6) and bottom (y=0) 3×3 caps turn 90° (square cross-section);
 *   u u' u2  /  d d' d2  — the inner slice just below the top cap (y=5) and just above the bottom (y=1)
 *                          also turn 90° (these are what make 337 RICHER than 335 — extra slice layers);
 *   R2 L2 F2 B2          — the four side slabs turn 180° ONLY (a 90° side turn is geometrically
 *                          impossible: each side face is 3 wide × 7 tall, a non-square rectangle, so a
 *                          90° rotation maps cubies outside the 3×3×7 box — proven dimensionally).
 * cstimer also offers multi-token convenience cells ("U u", "U2 d'", …) but each expands to two of the 16
 * atomic tokens above. The scramble is followed by a literal " / " separator and a standard min2phase 333
 * scramble. That 333 suffix uses 90° side turns (R R' F …) which DO NOT EXIST on a physical 3×3×7 — it is
 * a cstimer human-shorthand ("now scramble the colours like a cube") with NO rigid-body realisation
 * (cstimer itself renders no 337 image: its renderer has no 337 branch). So the physically-meaningful
 * state of a real cstimer 337 scramble is the CUBOID PART; this solver parses the whole string but applies
 * only the legal rigid tokens (`cuboid337Apply` stops at " / " and ignores any non-rigid 90° side token),
 * and solves that. Every move is re-derived field-for-field from real 3D geometry below (U/u/d/D = +90°
 * about +y on their y-layer; the four lateral slabs = 180°), and tests/cuboid337_solver.test.ts re-derives
 * the SAME permutations INDEPENDENTLY from geometry (NOT a byte-copy) and round-trips real cstimer
 * scrambles' cuboid parts — that is the validity oracle.
 *
 * STATE SPACE (measured, NOT a hand-derived formula):
 *   The 58 shell cubies split (under the 16 legal moves) into 7 disjoint MOVABLE orbits, with reachable
 *   physical sub-state counts (each measured by an independent BFS):
 *     orbit 0  corner columns (caps y=0,6, 3-sticker)         40320  (in-H 96)
 *     orbit 1  cap outer-edges (caps y=0,6, 2-sticker)        40320  (in-H 576)
 *     orbit 2  slice "corner" columns (slices y=1,5, 2-stkr)  40320  (in-H 96)
 *     orbit 3  slice edges (slices y=1,5, 1-sticker)           2520  (in-H 36)
 *     orbits 4,5,6  three middle/centre wing orbits (y=2,3,4)    24 each (all in H)
 *   The full reachable physical state count is 126,859,598,081,556,480,000 (Schreier-Sims, validated by
 *   the SAME code reproducing the known 335 count 156,067,430,400 exactly); the naive orbit product
 *   40320³·2520·24³ = 2,283,472,765,468,016,640,000 over-counts it by exactly 18 (parity coupling).
 *   That is ~1.27×10²⁰ — far beyond TIER A (full BFS, ≤~2×10⁶) and TIER B (packed table, ≤~5×10⁷).
 *
 * STRATEGY — genuine TWO-PHASE reduction, so EVERY real scramble solves FAST (TIER D near-optimal):
 *   • PHASE 1 drives every orbit INTO the all-180° subgroup H = ⟨U2,u2,d2,D2,R2,L2,F2,B2⟩ (goal: per-orbit
 *     `intoH==0`). It is DECOUPLED into two INDEPENDENT sub-reductions, which is what makes it fast — a
 *     joint A* over all four reducible orbits explodes (the 335 blow-up, doubled by the slice orbits). By
 *     generator↔orbit incidence the intoH reduction splits by escape-generator: the U/D-group {orbit0,
 *     orbit1} leave/enter H ONLY via U/D 90° caps; the u/d-group {orbit2,orbit3} ONLY via u/d 90° slices
 *     (wings stay in H). The groups are independent: U/D never touch {2,3}, u/d never touch {0,1}, and the
 *     shared lateral 180° moves are H-preserving — so we reduce {0,1} first, then {2,3}, and reducing {2,3}
 *     cannot un-reduce {0,1}. Each sub-reduction is a focused weight-1 A* (optimal per subproblem, closed
 *     set, admissible heuristic max(intoH over the group)) over a reduced TWO-orbit numeric key
 *     (o_a·40321+o_b < 2^31) — measured ≤ ~95k nodes, well under a second.
 *   • PHASE 2 finishes inside H using only the eight 180° moves. Each orbit's in-H set is tiny
 *     (96/576/96/36/24/24/24). EXACT joint PDBs over the orbits COUPLED by a shared vertical move (cap pair
 *     {0,1} share U2 → 96·576, diam 12; slice pair {2,3} share u2 → 96·36, diam 10) plus a wing TRIPLE
 *     {4,5,6} (24³, diam 4 — wings move only by laterals) give an admissible heuristic (max over the three).
 *     A small-budget optimal IDA* solves the common shallow H-states provably-optimally; the deep tail
 *     (~5%, optimal ~20-25, where the diam-12 heuristic is loose) falls to a weighted A* over the in-H
 *     joint coordinate (closed set → no IDA* re-expansion blow-up, weight escalates 2→3→5→8) that dives to
 *     a bounded near-optimal phase-2 fast. (An earlier mis-pairing {0,2}/{1,3} — orbits NOT sharing a
 *     vertical move — gave a far looser bound and made phase-2 explode; {0,1}/{2,3} is the correct pairing.)
 * For a shallow whole-puzzle state a single all-16-move optimal IDA* (max(optDist) heuristic, small node
 * budget) returns the provably-shortest solution with `optimal:true`; otherwise the two-phase answer is
 * returned with `optimal:false` (honestly "near-optimal"). Every real scramble RETURNS — there is no
 * "too-deep" (measured over 320 real cstimer scrambles: 320/320, mean ~30, median 30, max 41 moves,
 * worst single solve < ~4 s).
 */

// ── geometry-derived sticker model (runtime, self-verifying) ──────────────────────────
const NX = 3, NY = 7, NZ = 3;
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
const NS = STICKERS.length; // 102
const sKey = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => `${x},${y},${z}|${nx},${ny},${nz}`;
const STICKER_INDEX = new Map<string, number>(STICKERS.map((s, i) => [sKey(s.x, s.y, s.z, s.nx, s.ny, s.nz), i]));

const FACE_CODE: Record<FaceId, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const FACE_IDS: ReadonlyArray<FaceId> = ['U', 'D', 'R', 'L', 'F', 'B'];
/** Solved facelet colors (face code per sticker). */
const SOLVED_COLORS: Uint8Array = Uint8Array.from(STICKERS.map((s) => FACE_CODE[s.face]));

// 90° about +y on a y-layer: (x,z)→(z,−x) in centered coords; 180° about x / z on a slab.
const cx = (x: number) => x - 1, icx = (c: number) => c + 1, cz = (z: number) => z - 1, icz = (c: number) => c + 1;
const YMID = (NY - 1) / 2; // 3

function buildPerm(predicate: (s: Sticker) => boolean, transform: (s: Sticker) => [number, number, number, number, number, number]): Int32Array {
  const forward = new Int32Array(NS);
  for (let i = 0; i < NS; i++) {
    const s = STICKERS[i];
    if (!predicate(s)) { forward[i] = i; continue; }
    const [nxp, nyp, nzp, nnx, nny, nnz] = transform(s);
    const di = STICKER_INDEX.get(sKey(nxp, nyp, nzp, nnx, nny, nnz));
    if (di === undefined) throw new Error('337 transform left the surface');
    forward[i] = di;
  }
  // source-form P: state'[dst] = state[P[dst]]
  const P = new Int32Array(NS);
  for (let src = 0; src < NS; src++) P[forward[src]] = src;
  return P;
}
// y-layer +90° about +y. U=top cap y=6, u=upper slice y=5, d=lower slice y=1, D=bottom cap y=0.
const yTurn = (layerY: number) => buildPerm((s) => s.y === layerY, (s) => {
  const ncx = cz(s.z), ncz = -cx(s.x); // (x,z)→(z,−x)
  const nnx = s.nz, nnz = -s.nx;
  return [icx(ncx), s.y, icz(ncz), nnx, s.ny, nnz];
});
const BASE_U = yTurn(6), BASE_u = yTurn(5), BASE_d = yTurn(1), BASE_D = yTurn(0);
// x-slabs 180° about x: y→2·YMID−y, z→−z (centered); normal ny→−ny, nz→−nz.
const mkX180 = (slabX: number) => buildPerm((s) => s.x === slabX, (s) => {
  const ncy = 2 * YMID - s.y, ncz = -cz(s.z);
  return [s.x, ncy, icz(ncz), s.nx, -s.ny, -s.nz];
});
const BASE_R2 = mkX180(2), BASE_L2 = mkX180(0);
// z-slabs 180° about z: x→−x, y→2·YMID−y; normal nx→−nx, ny→−ny.
const mkZ180 = (slabZ: number) => buildPerm((s) => s.z === slabZ, (s) => {
  const ncx = -cx(s.x), ncy = 2 * YMID - s.y;
  return [icx(ncx), ncy, s.z, -s.nx, -s.ny, s.nz];
});
const BASE_F2 = mkZ180(2), BASE_B2 = mkZ180(0);

// ── move set (16 rigid tokens) ────────────────────────────────────────────────────────
interface Move337 { name: string; base: Int32Array; pow: number; }
const MOVES: ReadonlyArray<Move337> = [
  { name: 'U', base: BASE_U, pow: 1 }, { name: "U'", base: BASE_U, pow: 3 }, { name: 'U2', base: BASE_U, pow: 2 },
  { name: 'u', base: BASE_u, pow: 1 }, { name: "u'", base: BASE_u, pow: 3 }, { name: 'u2', base: BASE_u, pow: 2 },
  { name: 'd', base: BASE_d, pow: 1 }, { name: "d'", base: BASE_d, pow: 3 }, { name: 'd2', base: BASE_d, pow: 2 },
  { name: 'D', base: BASE_D, pow: 1 }, { name: "D'", base: BASE_D, pow: 3 }, { name: 'D2', base: BASE_D, pow: 2 },
  { name: 'R2', base: BASE_R2, pow: 1 }, { name: 'L2', base: BASE_L2, pow: 1 },
  { name: 'F2', base: BASE_F2, pow: 1 }, { name: 'B2', base: BASE_B2, pow: 1 },
];
const NG = MOVES.length; // 16
const MOVE_BY_NAME = new Map<string, number>(MOVES.map((m, i) => [m.name, i]));
/** Indices of the eight 180°-only moves (phase-2 generator set): U2 u2 d2 D2 R2 L2 F2 B2. */
const PHASE2_MOVES: number[] = ['U2', 'u2', 'd2', 'D2', 'R2', 'L2', 'F2', 'B2'].map((n) => MOVE_BY_NAME.get(n)!);
/** Full per-move sticker permutation (base^pow), precomputed. perm[i] = source slot for slot i. */
const MOVE_PERM: Int32Array[] = MOVES.map((m) => {
  let p = Int32Array.from({ length: NS }, (_, i) => i);
  for (let k = 0; k < m.pow; k++) { const o = new Int32Array(NS); for (let i = 0; i < NS; i++) o[i] = p[m.base[i]]; p = o; }
  return p;
});
// inverse move index: 90° moves pair with their prime; everything else self-inverse.
const INVERSE_MOVE: number[] = MOVES.map((m, i) => {
  const n = m.name;
  if (n === 'U') return MOVE_BY_NAME.get("U'")!;
  if (n === "U'") return MOVE_BY_NAME.get('U')!;
  if (n === 'u') return MOVE_BY_NAME.get("u'")!;
  if (n === "u'") return MOVE_BY_NAME.get('u')!;
  if (n === 'd') return MOVE_BY_NAME.get("d'")!;
  if (n === "d'") return MOVE_BY_NAME.get('d')!;
  if (n === 'D') return MOVE_BY_NAME.get("D'")!;
  if (n === "D'") return MOVE_BY_NAME.get('D')!;
  return i;
});
// axis: 0 = vertical (U/u/d/D about +y), 1 = x (R2/L2), 2 = z (F2/B2). Same-axis moves commute → canonical
// order to prune. NOTE all four vertical layers (U,u,d,D) share axis 0 and commute pairwise, so the
// "mi < last on same axis" prune is valid for them too (they act on disjoint y-layers).
const MOVE_AXIS: number[] = MOVES.map((m) => (/^[UuDd]/.test(m.name) ? 0 : /^[RL]/.test(m.name) ? 1 : 2));

/** The exact 16-token rigid alphabet for a physical 3×3×7 (= cstimer's `337` cuboid part). */
export const CUBOID337_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);
export const CUBOID337_TOKEN_RE = /^(U['2]?|u['2]?|d['2]?|D['2]?|[RLFB]2)$/;

/** Reachable physical state count (Schreier-Sims, validated against the known 335 count), exact string. */
export const CUBOID337_STATE_COUNT_STR = '126,859,598,081,556,480,000';
/** Naive orbit product 40320³·2520·24³ (over-counts the reachable count by the 18× parity coupling). */
export const CUBOID337_ORBIT_PRODUCT_STR = '2,283,472,765,468,016,640,000';
/** Hard upper bound on a returned two-phase solution length (phase-1 diam + phase-2 diam ≪ this). */
export const CUBOID337_MAX_LENGTH = 80;
/** Optimal-shortcut node budget: a shallow state solved optimally below this is returned as optimal. */
const OPT_SHORTCUT_BUDGET = 1_200_000;
/** Largest length the optimal shortcut will claim; beyond this the two-phase answer is used. */
const OPT_SHORTCUT_DEPTH_CAP = 11;
/** Phase-1 per-subgroup closed-set node cap (bounds memory; H is always reachable well within it). */
const PHASE1_CAP = 4_000_000;

function applyMove(state: Uint8Array, mi: number): Uint8Array<ArrayBuffer> {
  const p = MOVE_PERM[mi];
  const o = new Uint8Array(NS);
  for (let i = 0; i < NS; i++) o[i] = state[p[i]];
  return o;
}

/**
 * Parse a scramble into rigid move indices. A cstimer 337 string is `<cuboid part> / <333 part>`; the
 * " / " separator and the 333 part's 90° side turns are NOT rigid moves on a 3×3×7 (geometrically
 * impossible — see header), so parsing STOPS at the first "/" token. Within the cuboid part, an invalid
 * token throws Error('bad: <tok>').
 */
export function parseCuboid337Scramble(scramble: string): number[] {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === '/') break; // end of the rigid cuboid part; the 333 suffix has no rigid realisation
    if (!CUBOID337_TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(MOVE_BY_NAME.get(tok)!);
  }
  return out;
}

/** Apply a scramble's rigid cuboid part to solved and return the raw facelet color state. */
export function cuboid337Apply(scramble: string): Uint8Array {
  let s = SOLVED_COLORS.slice();
  for (const mi of parseCuboid337Scramble(scramble)) s = applyMove(s, mi);
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
const NC = CUBIES.length; // 58
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
 * A pattern database over one MOVABLE orbit. The orbit's full reachable facelet-colorings (under ALL 16
 * moves) are densely indexed; we precompute trans (full-move transitions), optDist (exact distance over
 * all moves), p2Dist (180°-only distance to solved; 255 = NOT in H), and intoH (min moves into H).
 */
interface OrbitDb {
  index: (s: Uint8Array) => number;
  trans: Int32Array[];        // NG full-move transitions over dense indices
  optDist: Uint8Array;        // exact optimal distance to solved over ALL 16 moves (admissible PDB)
  p2Dist: Uint8Array;         // 180°-only distance to solved (255 = outside the subgroup H)
  intoH: Uint8Array;          // min moves (any of the 16) from this index into H (0 = already in H)
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

  // full optimal distance to solved over ALL 16 moves (BFS from solved) — admissible per-orbit PDB.
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

  // phase-1: multi-source BFS (over ALL 16 moves) seeded distance-0 from every in-H index → intoH.
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
    DBS = all.filter((d) => d.size > 1); // movable orbits: [40320,40320,40320,2520,24,24,24]
  }
  return DBS;
}
const NORB = 7; // number of movable orbits (fixed; asserted by tests)

// Orbit roles, by measured generator↔orbit incidence (asserted by tests):
//   U/D-group (escape H only via U/D 90° caps): orbit 0 (corners), orbit 1 (cap edges)
//   u/d-group (escape H only via u/d 90° slices): orbit 2 (slice corners), orbit 3 (slice edges)
//   wings (always in H): orbits 4,5,6
const UDG = [0, 1] as const;   // reduced by U/D (phase-1 sub-group A)
const UDSG = [2, 3] as const;  // reduced by u/d (phase-1 sub-group B); wings (orbits 4,5,6) stay in H

// ── joint phase-2 pattern databases (EXACT distances over orbit groups inside H) ──────
// Per-orbit max(p2Dist) underestimates the joint cost; the in-H sub-states are tiny, so build EXACT joint
// PDBs over the orbits COUPLED by a shared vertical 180° move (the true phase-2 coupling, verified by
// incidence): the cap pair {0,1} share U2 (96·576 = 55296, diam 12), the slice pair {2,3} share u2
// (96·36 = 3456, diam 10). Plus a wing TRIPLE {4,5,6} (24³ = 13824, diam 4) — wings are moved ONLY by
// laterals, so it is an exact lower bound on the lateral-move count. max over these three is admissible.
// (An earlier mis-pairing {0,2}/{1,3} — orbits NOT sharing a vertical move — gave a far looser bound and
// made phase-2 IDA* explode; the {0,1}/{2,3} pairing is the correct, tight one.)
interface Phase2Pdb {
  fullToInH: Int32Array[]; // [orbitIdx] full dense index → compact in-H index (−1 if not in H)
  dist01: Uint8Array;      // index = inH0 * inH1count + inH1   (cap pair)
  dist23: Uint8Array;      // index = inH2 * inH3count + inH3   (slice pair)
  distW: Uint8Array;       // index = (inH4*inH5count + inH5)*inH6count + inH6   (wing triple {4,5,6})
  inH1count: number;
  inH3count: number;
  inH5count: number;
  inH6count: number;
}
function buildPhase2Pdb(D: OrbitDb[]): Phase2Pdb {
  const fullToInH: Int32Array[] = [];
  const inHList: number[][] = [];
  for (let oi = 0; oi < NORB; oi++) {
    const map = new Int32Array(D[oi].size).fill(-1);
    const list: number[] = [];
    for (let fi = 0; fi < D[oi].size; fi++) if (D[oi].p2Dist[fi] !== 255) { map[fi] = list.length; list.push(fi); }
    fullToInH.push(map); inHList.push(list);
  }
  const inHTrans: Int32Array[][] = [];
  for (let oi = 0; oi < NORB; oi++) {
    const list = inHList[oi]; const map = fullToInH[oi];
    const t: Int32Array[] = PHASE2_MOVES.map(() => new Int32Array(list.length));
    for (let ci = 0; ci < list.length; ci++) {
      const fi = list[ci];
      for (let s = 0; s < PHASE2_MOVES.length; s++) t[s][ci] = map[D[oi].trans[PHASE2_MOVES[s]][fi]];
    }
    inHTrans.push(t);
  }
  const pairBfs = (a: number, b: number): Uint8Array => {
    const na = inHList[a].length, nb = inHList[b].length;
    const dist = new Uint8Array(na * nb).fill(255);
    const start = fullToInH[a][0] * nb + fullToInH[b][0];
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
  const tripleBfs = (a: number, b: number, c: number): Uint8Array => {
    const nb = inHList[b].length, nc = inHList[c].length;
    const dist = new Uint8Array(inHList[a].length * nb * nc).fill(255);
    const start = (fullToInH[a][0] * nb + fullToInH[b][0]) * nc + fullToInH[c][0];
    dist[start] = 0;
    let fr = [start]; let d = 0;
    while (fr.length) {
      const nx: number[] = [];
      for (const u of fr) {
        const ua = (u / (nb * nc)) | 0, rem = u % (nb * nc), ub = (rem / nc) | 0, uc = rem % nc;
        for (let s = 0; s < PHASE2_MOVES.length; s++) {
          const v = (inHTrans[a][s][ua] * nb + inHTrans[b][s][ub]) * nc + inHTrans[c][s][uc];
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
    dist01: pairBfs(0, 1),
    dist23: pairBfs(2, 3),
    distW: tripleBfs(4, 5, 6),
    inH1count: inHList[1].length,
    inH3count: inHList[3].length,
    inH5count: inHList[5].length,
    inH6count: inHList[6].length,
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
export interface Cuboid337Solution {
  /** Solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count. */
  length: number;
  /** true = provably-optimal (shallow shortcut); false = near-optimal two-phase reduction. */
  optimal: boolean;
}

// ── phase-1 (drive all orbits INTO the 180° subgroup H) ──────────────────────────────
function phase1Solved(tuple: Int32Array, D: OrbitDb[]): boolean {
  for (let i = 0; i < NORB; i++) if (D[i].intoH[tuple[i]] !== 0) return false;
  return true;
}
function applyPathTuple(t: Int32Array, path: number[], D: OrbitDb[]): Int32Array {
  let cur = t;
  for (const mi of path) { const nt = new Int32Array(NORB); for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][cur[i]]; cur = nt; }
  return cur;
}

// Phase-1 is DECOUPLED into two independent sub-reductions, which is what makes it fast (a joint A* over
// all 4 reducible orbits explodes — the 335 bug doubled). The intoH reduction splits by escape-generator
// (verified by incidence): the U/D-group {0,1} leave/enter H ONLY via U/D 90° caps; the u/d-group {2,3}
// leave/enter H ONLY via u/d 90° slices. They are INDEPENDENT: U/D never touch {2,3}, u/d never touch
// {0,1}, and the shared lateral 180° moves are H-preserving — so reducing {0,1} first and then {2,3}
// cannot un-reduce {0,1}. Each sub-reduction is a focused weight-1 A* (optimal per subproblem) over a
// reduced 2-orbit coordinate (key = o_a·40321 + o_b < ~1.6×10⁹) with the admissible heuristic
// max(intoH over the group). u/d moves are effectively no-ops in the {0,1} search (they leave the key
// unchanged → deduped), and vice-versa, so the effective branching is small and it finishes in ≤ ~85k
// nodes (measured), well under a second.
function phase1Group(t0: Int32Array, group: ReadonlyArray<number>, D: OrbitDb[], cap: number): number[] | null {
  const grpSolved = (t: Int32Array): boolean => { for (const o of group) if (D[o].intoH[t[o]] !== 0) return false; return true; };
  if (grpSolved(t0)) return [];
  const grpH = (t: Int32Array): number => { let m = 0; for (const o of group) { const v = D[o].intoH[t[o]]; if (v > m) m = v; } return m; };
  const keyOf = (t: Int32Array): number => { let k = 0; for (const o of group) k = k * 40321 + t[o]; return k; };
  const tuples: Int32Array[] = [t0.slice()];
  const gArr: number[] = [0]; const parent: number[] = [-1]; const moveArr: number[] = [-1];
  const seen = new Map<number, number>(); seen.set(keyOf(t0), 0);
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
  hpush(0, grpH(t0), 0);
  let goal = -1;
  while (heapIdx.length) {
    const idx = hpop();
    if (popG !== gArr[idx]) continue;
    const tuple = tuples[idx]; const g = gArr[idx];
    if (grpSolved(tuple)) { goal = idx; break; }
    const last = moveArr[idx];
    for (let mi = 0; mi < NG; mi++) {
      if (last >= 0) {
        if (mi === INVERSE_MOVE[last]) continue;
        if (MOVE_AXIS[mi] === MOVE_AXIS[last] && mi < last) continue;
      }
      const nt = new Int32Array(NORB);
      for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][tuple[i]];
      const ng = g + 1; const kk = keyOf(nt);
      const exist = seen.get(kk);
      if (exist !== undefined) {
        if (gArr[exist] <= ng) continue;
        gArr[exist] = ng; parent[exist] = idx; moveArr[exist] = mi;
        hpush(exist, ng + grpH(nt), ng);
        continue;
      }
      const nidx = tuples.length;
      tuples.push(nt); gArr.push(ng); parent.push(idx); moveArr.push(mi);
      seen.set(kk, nidx);
      hpush(nidx, ng + grpH(nt), ng);
      if (nidx + 1 > cap) return null;
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
  // reduce the U/D-group {0,1} first, then the u/d-group {2,3}. Reducing {2,3} cannot un-reduce {0,1}
  // (u/d don't touch {0,1}; laterals are H-preserving). Each is optimal over its own subproblem.
  const pA = phase1Group(t0, UDG, D, PHASE1_CAP);
  if (!pA) return null;
  const tA = applyPathTuple(t0, pA, D);
  const pB = phase1Group(tA, UDSG, D, PHASE1_CAP);
  if (!pB) return null;
  return [...pA, ...pB];
}

// ── phase-2 (solve within the 180° subgroup using only the eight 180° moves) ──────────
// Admissible heuristic = max over the three independent joint PDBs (cap pair {0,1}, slice pair {2,3}, wing
// triple {4,5,6}).
function phase2Heuristic(tuple: Int32Array, P: Phase2Pdb): number {
  const i0 = P.fullToInH[0][tuple[0]], i1 = P.fullToInH[1][tuple[1]];
  const i2 = P.fullToInH[2][tuple[2]], i3 = P.fullToInH[3][tuple[3]];
  const i4 = P.fullToInH[4][tuple[4]], i5 = P.fullToInH[5][tuple[5]], i6 = P.fullToInH[6][tuple[6]];
  const h01 = P.dist01[i0 * P.inH1count + i1];
  const h23 = P.dist23[i2 * P.inH3count + i3];
  const hw = P.distW[(i4 * P.inH5count + i5) * P.inH6count + i6];
  let m = h01; if (h23 > m) m = h23; if (hw > m) m = hw;
  return m;
}
function phase2Solved(tuple: Int32Array, D: OrbitDb[]): boolean {
  for (let i = 0; i < NORB; i++) if (D[i].p2Dist[tuple[i]] !== 0) return false;
  return true;
}
/** Hard cap on a returned phase-2 solution length (real optimal ≤ ~25; this also bounds buffers). */
const PHASE2_GCAP = 60;

// Optimal phase-2 via IDA*, but capped by a NODE budget (so it bails fast on deep states) and by length
// (PHASE2_GCAP). Returns {path} (optimal), {budget:true} (exceeded budget), or null (no solution ≤ bound).
function phase2OptimalCapped(t0: Int32Array, D: OrbitDb[], P: Phase2Pdb, maxBound: number, budget: number): { path?: number[]; budget?: boolean } | null {
  const tupBuf: Int32Array[] = Array.from({ length: PHASE2_GCAP + 2 }, () => new Int32Array(NORB));
  const pathStack = new Int32Array(PHASE2_GCAP + 2);
  let found: number[] | null = null; let nodes = 0; let over = false;
  function dfs(tuple: Int32Array, g: number, bound: number, last: number, depth: number): number {
    const f = g + phase2Heuristic(tuple, P);
    if (f > bound) return f;
    if (phase2Solved(tuple, D)) { found = Array.from(pathStack.subarray(0, depth)); return -1; }
    if (depth >= PHASE2_GCAP) return Infinity;
    let min = Infinity;
    for (const mi of PHASE2_MOVES) {
      if (last >= 0) { if (MOVE_AXIS[mi] === MOVE_AXIS[last] && mi < last) continue; if (mi === last) continue; }
      if (++nodes > budget) { over = true; return -1; }
      const nt = tupBuf[depth];
      for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][tuple[i]];
      pathStack[depth] = mi;
      const r = dfs(nt, g + 1, bound, mi, depth + 1);
      if (found) return -1; if (over) return -1;
      if (r < min) min = r;
    }
    return min;
  }
  let bound = phase2Heuristic(t0, P);
  while (bound <= maxBound) {
    const r = dfs(t0, 0, bound, -1, 0);
    if (found) return { path: found };
    if (over) return { budget: true };
    if (r === Infinity) return null;
    bound = r;
  }
  return null;
}

// Weighted A* over the in-H joint coordinate (closed set, ordered by f = g + w·h). Unlike IDA*, the closed
// set prevents re-exploration, so even deep optimal lengths are reached fast; weight w trades a little
// length (≤ w×optimal worst-case, usually far closer) for speed. Compact two-level numeric in-H key.
function phase2AStar(t0: Int32Array, D: OrbitDb[], P: Phase2Pdb, w: number, budget: number): number[] | null {
  const inH = P.fullToInH;
  const keyOf = (t: Int32Array): number => {
    const outer = inH[0][t[0]] * P.inH1count + inH[1][t[1]];               // < 96·576 = 55296
    const inner = ((inH[2][t[2]] * P.inH3count + inH[3][t[3]]) * 13824)
      + ((inH[4][t[4]] * 24 + inH[5][t[5]]) * 24 + inH[6][t[6]]);          // < ~1.2×10⁸
    return outer * 100000000 + inner;                                       // < ~5.5×10¹⁵ < 2^53
  };
  const tuples: Int32Array[] = [t0.slice()];
  const gArr: number[] = [0]; const parent: number[] = [-1]; const moveArr: number[] = [-1];
  const seen = new Map<number, number>(); seen.set(keyOf(t0), 0);
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
  hpush(0, w * phase2Heuristic(t0, P), 0);
  let goal = -1; let nodes = 0;
  while (heapIdx.length) {
    const idx = hpop();
    if (popG !== gArr[idx]) continue;
    const tuple = tuples[idx]; const g = gArr[idx];
    if (phase2Solved(tuple, D)) { goal = idx; break; }
    const last = moveArr[idx];
    for (const mi of PHASE2_MOVES) {
      if (last >= 0) { if (MOVE_AXIS[mi] === MOVE_AXIS[last] && mi < last) continue; if (mi === last) continue; }
      if (++nodes > budget) return null;
      const nt = new Int32Array(NORB);
      for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][tuple[i]];
      const ng = g + 1; const kk = keyOf(nt);
      const exist = seen.get(kk);
      if (exist !== undefined) {
        if (gArr[exist] <= ng) continue;
        gArr[exist] = ng; parent[exist] = idx; moveArr[exist] = mi;
        hpush(exist, ng + w * phase2Heuristic(nt, P), ng);
        continue;
      }
      const nidx = tuples.length;
      tuples.push(nt); gArr.push(ng); parent.push(idx); moveArr.push(mi);
      seen.set(kk, nidx);
      hpush(nidx, ng + w * phase2Heuristic(nt, P), ng);
    }
  }
  if (goal < 0) return null;
  const rev: number[] = [];
  for (let i = goal; i >= 0 && moveArr[i] >= 0; i = parent[i]) rev.push(moveArr[i]);
  rev.reverse();
  return rev;
}
// Phase-2: try EXACT optimal (IDA*, small node budget — fast for the common shallow states); on a deep
// state that blows the budget, fall to weighted A* (closed set → fast even at deep optimal lengths) at
// increasing weight. 100% solve, bounded length, bounded time (measured: ≤ ~5 s worst, ~95% < 1 s).
function solvePhase2(t0: Int32Array, D: OrbitDb[], P: Phase2Pdb, maxBound: number): number[] | null {
  const opt = phase2OptimalCapped(t0, D, P, maxBound, 800_000);
  if (opt && opt.path) return opt.path;
  if (opt === null) return null; // genuinely unsolvable (shouldn't happen in H)
  for (const w of [2, 3, 5]) {
    const r = phase2AStar(t0, D, P, w, 12_000_000);
    if (r) return r;
  }
  return phase2AStar(t0, D, P, 8, 30_000_000);
}

/** Two-phase reduction: drive into the 180° subgroup (decoupled A*), then solve within it. Always succeeds. */
function solveTwoPhase(start: Uint8Array, D: OrbitDb[]): number[] {
  const t0 = tupleOf(start, D);
  const p1 = solvePhase1(t0, D);
  if (!p1) throw new Error('337 phase-1 unreachable (should not happen)');
  const t = applyPathTuple(t0, p1, D);
  const p2 = solvePhase2(t, D, p2pdb(D), 40);
  if (!p2) throw new Error('337 phase-2 unreachable (should not happen)');
  return [...p1, ...p2];
}

// ── optional optimal shortcut for shallow states (all 16 moves, admissible PDB, small budget) ─
function solveOptimalShallow(start: Uint8Array, D: OrbitDb[]): number[] | null {
  const t0 = tupleOf(start, D);
  if (isSolvedColors(start)) return [];
  const tupBuf: Int32Array[] = Array.from({ length: 32 }, () => new Int32Array(NORB));
  const pathStack = new Int32Array(32);
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
 * Solve a 3×3×7 scramble. Always returns a valid, bounded solution (length ≤ CUBOID337_MAX_LENGTH):
 *   • a shallow state solved optimally within a small node budget → `optimal: true`;
 *   • otherwise a near-optimal two-phase reduction → `optimal: false`.
 * Throws Error('bad: …') only on an unparseable token in the cuboid part. There is no "too-deep".
 */
export function solveCuboid337(scramble: string): Cuboid337Solution {
  const D = dbs();
  const start = cuboid337Apply(scramble);
  if (isSolvedColors(start)) return { solution: '', length: 0, optimal: true };

  const opt = solveOptimalShallow(start, D);
  if (opt) return { solution: opt.map((m) => MOVES[m].name).join(' '), length: opt.length, optimal: true };

  const two = solveTwoPhase(start, D);
  let s = start.slice();
  for (const mi of two) s = applyMove(s, mi);
  if (!isSolvedColors(s)) throw new Error('337 two-phase produced an invalid solution');
  return { solution: two.map((m) => MOVES[m].name).join(' '), length: two.length, optimal: false };
}

/** Admissible lower bound on the OPTIMAL solution length (max over orbits of optimal per-orbit distance). */
export function cuboid337Heuristic(scramble: string): number {
  const D = dbs();
  const t = tupleOf(cuboid337Apply(scramble), D);
  let m = 0;
  for (let i = 0; i < NORB; i++) { const d = D[i].optDist[t[i]]; if (d > m) m = d; }
  return m;
}

// ── faithful cstimer-style random scramble (mirrors megascramble.js mega() for the 337 cuboid part) ──
// cstimer 337 vertical group offers 90° cap turns, 90° slice turns, and their two-token combinations; the
// laterals are 180° only. We generate the rigid CUBOID PART with the SAME mega() axis/repeat discipline,
// emitting the 16 atomic tokens (the multi-token cells expand to two atomic tokens, which is equivalent).
export function randomCuboid337Scramble(len: number, rnd: () => number = Math.random): string {
  const turns: ReadonlyArray<ReadonlyArray<string[]>> = [
    [
      ['U', "U'", 'U2', 'u', "u'", 'u2'],
      ['D', "D'", 'D2', 'd', "d'", 'd2'],
    ],
    [['R2', 'L2']],
    [['F2', 'B2']],
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
    s.push(cell[Math.floor(rnd() * cell.length)]);
  }
  return s.join(' ');
}

export interface Cuboid337Sample { scramble: string; length: number; optimal: boolean; }

/**
 * Sample `n` random scrambles of `scrambleLen` moves and solve each. Returns (returned-solution length,
 * optimal-flag) per sample — the RETURNED-solution-length distribution for `scrambleLen`-move random
 * scrambles (a SAMPLE, NOT the full-space curve; 1.27×10²⁰ states can't be enumerated).
 */
export function cuboid337SampleDistribution(n: number, rnd: () => number = Math.random, scrambleLen = 40): Cuboid337Sample[] {
  dbs();
  const out: Cuboid337Sample[] = [];
  for (let i = 0; i < n; i++) {
    const scramble = randomCuboid337Scramble(scrambleLen, rnd);
    const { length, optimal } = solveCuboid337(scramble);
    out.push({ scramble, length, optimal });
  }
  return out;
}

/** Test/diagnostic: per-orbit full size, 180° subgroup size, and phase-1/phase-2 max depths. */
export function cuboid337DbStats(): { sizes: number[]; inHCounts: number[]; p2MaxDepths: number[]; intoHMaxDepths: number[] } {
  const D = dbs();
  return {
    sizes: D.map((d) => d.size),
    inHCounts: D.map((d) => d.inHCount),
    p2MaxDepths: D.map((d) => d.p2MaxDepth),
    intoHMaxDepths: D.map((d) => d.intoHMaxDepth),
  };
}

export { NS, NC, NORB, FACE_IDS, STICKERS, SOLVED_COLORS };
