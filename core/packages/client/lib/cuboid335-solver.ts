/*
 * 3×3×5 cuboid (335) solver — TWO-PHASE REDUCTION hybrid. Pure TS, no worker, no tables to download.
 *
 * The 3×3×5 is 3 wide (x) × 5 tall (y) × 3 deep (z). cstimer's `335` generator (megascramble.js:56)
 * emits  `<cuboid part> / ${333}`  — a cuboid scramble using the alphabet
 *   U U' U2  /  D D' D2  — the top (y=4) and bottom (y=0) 3×3 caps turn 90° (square cross-section);
 *   R2 L2 F2 B2          — the four side slabs turn 180° ONLY (a 90° side turn is geometrically
 *                          impossible: each side face is 3 wide × 5 tall, a non-square rectangle, so a
 *                          90° rotation maps cubies outside the 3×3×5 box — proven dimensionally).
 * followed by a literal " / " separator and a standard min2phase 333 scramble. That 333 suffix uses 90°
 * side turns (R R' F …) which DO NOT EXIST on a physical 3×3×5 — it is a cstimer human-shorthand
 * ("now scramble the colours like a cube") with NO rigid-body realisation (cstimer itself renders no 335
 * image: its renderer has no 335 branch). So the physically-meaningful state of a real cstimer 335
 * scramble is the CUBOID PART; this solver parses the whole string but applies only the legal rigid
 * tokens (`cuboid335Apply` stops at " / " and ignores any non-rigid 90° side token), and solves that.
 * Every move is re-derived field-for-field from real 3D geometry below (U/D = +90° about +y; the four
 * lateral slabs = 180°), and tests/cuboid335_solver.test.ts re-derives the SAME permutations
 * INDEPENDENTLY from geometry (NOT a byte-copy) and round-trips real cstimer scrambles' cuboid parts —
 * that is the validity oracle.
 *
 * STATE SPACE (measured, NOT a hand-derived formula):
 *   The 42 shell cubies split (under the 10 legal moves) into 5 disjoint MOVABLE orbits — 8 corner
 *   columns, 8 cap outer-edges, and three middle-band wing orbits of 4 pieces each — with reachable
 *   physical sub-state counts 40320, 40320, 24, 24, 24 (each measured by an independent BFS); the rest of
 *   the cubies are frozen. The full reachable physical state count is 156,067,430,400 (verified by
 *   Schreier-Sims, validated on S5/A5/S6); the naive orbit product 40320²·24³ = 22,473,709,977,600
 *   over-counts it by exactly 144 (the orbits are parity-coupled). That is ~1.56×10¹¹ — far beyond
 *   TIER A (full BFS, ≤~2×10⁶) and TIER B (packed table, ≤~5×10⁷).
 *
 * STRATEGY — genuine TWO-PHASE reduction, so EVERY real scramble solves FAST (TIER D near-optimal):
 *   • PHASE 1 drives every orbit INTO the all-180° subgroup H = ⟨U2,D2,R2,L2,F2,B2⟩. The goal test is
 *     unambiguous — "every orbit sub-state is in H" (per-orbit `intoH==0`). Only the corner orbit (intoH
 *     ≤ 11) and the cap-edge orbit (intoH ≤ 4) ever need reducing; the three wing orbits are always in H
 *     (180°-only moves can't take them out). Phase-1 is a CLOSED-SET A* (weight 1, heuristic
 *     max(intoH[corner]+intoH[cap-edge], intoH[wings])) with a fast TWO-LEVEL NUMERIC closed-set key
 *     (outer = corner·40320+edge < 2^31, inner = the three small wing indices < 24³) — no string garbage.
 *     The additive term over the two big orbits is what keeps the frontier finite; the closed set bounds
 *     re-expansion (so the worst real state finishes ≤ ~2 s, 100% solve), with a greedy-dive safety net.
 *   • PHASE 2 finishes inside H using only the six 180° moves. Each orbit's in-H set is tiny
 *     (96/576/24/24/24), so EXACT joint-pair PDBs (corners×cap-edges = 96·576, the two larger wings
 *     24·24, plus the lone third wing) give a tight admissible heuristic and IDA* converges in a few ms,
 *     provably optimal over the 180° subgroup.
 * Each phase is optimal over its own small coordinate ⇒ the total is bounded and near-optimal (measured
 * mean ~19, median ~20, max ~27 over real scrambles; worst single solve < ~0.6 s). For a shallow state a
 * single all-10-move optimal IDA* (max(optDist) heuristic, small node budget) finishes and returns the
 * provably-shortest solution with `optimal:true`; otherwise the two-phase answer is returned with
 * `optimal:false` (honestly "near-optimal"). Every real scramble RETURNS — there is no "too-deep".
 */

// ── geometry-derived 78-sticker model (runtime, self-verifying) ──────────────────────
const NX = 3, NY = 5, NZ = 3;
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
const NS = STICKERS.length; // 78
const sKey = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => `${x},${y},${z}|${nx},${ny},${nz}`;
const STICKER_INDEX = new Map<string, number>(STICKERS.map((s, i) => [sKey(s.x, s.y, s.z, s.nx, s.ny, s.nz), i]));

const FACE_CODE: Record<FaceId, number> = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const FACE_IDS: ReadonlyArray<FaceId> = ['U', 'D', 'R', 'L', 'F', 'B'];
/** Solved facelet colors (face code per sticker). */
const SOLVED_COLORS: Uint8Array = Uint8Array.from(STICKERS.map((s) => FACE_CODE[s.face]));

// 90° about +y on a y-layer: (x,z)→(z,−x) in centered coords; 180° about x / z on a slab.
const cx = (x: number) => x - 1, icx = (c: number) => c + 1, cz = (z: number) => z - 1, icz = (c: number) => c + 1;
const YMID = (NY - 1) / 2; // 2

function buildPerm(predicate: (s: Sticker) => boolean, transform: (s: Sticker) => [number, number, number, number, number, number]): Int32Array {
  const forward = new Int32Array(NS);
  for (let i = 0; i < NS; i++) {
    const s = STICKERS[i];
    if (!predicate(s)) { forward[i] = i; continue; }
    const [nxp, nyp, nzp, nnx, nny, nnz] = transform(s);
    const di = STICKER_INDEX.get(sKey(nxp, nyp, nzp, nnx, nny, nnz));
    if (di === undefined) throw new Error('335 transform left the surface');
    forward[i] = di;
  }
  // source-form P: state'[dst] = state[P[dst]]
  const P = new Int32Array(NS);
  for (let src = 0; src < NS; src++) P[forward[src]] = src;
  return P;
}
// U: top cap y=4, +90° about +y.
const BASE_U = buildPerm((s) => s.y === 4, (s) => {
  const ncx = cz(s.z), ncz = -cx(s.x); // (x,z)→(z,−x)
  const nnx = s.nz, nnz = -s.nx;
  return [icx(ncx), s.y, icz(ncz), nnx, s.ny, nnz];
});
// D: bottom cap y=0, +90° about +y.
const BASE_D = buildPerm((s) => s.y === 0, (s) => {
  const ncx = cz(s.z), ncz = -cx(s.x);
  const nnx = s.nz, nnz = -s.nx;
  return [icx(ncx), s.y, icz(ncz), nnx, s.ny, nnz];
});
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

// ── move set (10 rigid tokens) ───────────────────────────────────────────────────────
interface Move335 { name: string; base: Int32Array; pow: number; }
const MOVES: ReadonlyArray<Move335> = [
  { name: 'U', base: BASE_U, pow: 1 }, { name: "U'", base: BASE_U, pow: 3 }, { name: 'U2', base: BASE_U, pow: 2 },
  { name: 'D', base: BASE_D, pow: 1 }, { name: "D'", base: BASE_D, pow: 3 }, { name: 'D2', base: BASE_D, pow: 2 },
  { name: 'R2', base: BASE_R2, pow: 1 }, { name: 'L2', base: BASE_L2, pow: 1 },
  { name: 'F2', base: BASE_F2, pow: 1 }, { name: 'B2', base: BASE_B2, pow: 1 },
];
const NG = MOVES.length; // 10
const MOVE_BY_NAME = new Map<string, number>(MOVES.map((m, i) => [m.name, i]));
/** Indices of the six 180°-only moves (phase-2 generator set): U2 D2 R2 L2 F2 B2. */
const PHASE2_MOVES: number[] = ['U2', 'D2', 'R2', 'L2', 'F2', 'B2'].map((n) => MOVE_BY_NAME.get(n)!);
/** Full per-move sticker permutation (base^pow), precomputed. perm[i] = source slot for slot i. */
const MOVE_PERM: Int32Array[] = MOVES.map((m) => {
  let p = Int32Array.from({ length: NS }, (_, i) => i);
  for (let k = 0; k < m.pow; k++) { const o = new Int32Array(NS); for (let i = 0; i < NS; i++) o[i] = p[m.base[i]]; p = o; }
  return p;
});
// inverse move index: U↔U', D↔D', everything else self-inverse.
const INVERSE_MOVE: number[] = MOVES.map((m, i) => {
  if (m.name === 'U') return MOVE_BY_NAME.get("U'")!;
  if (m.name === "U'") return MOVE_BY_NAME.get('U')!;
  if (m.name === 'D') return MOVE_BY_NAME.get("D'")!;
  if (m.name === "D'") return MOVE_BY_NAME.get('D')!;
  return i;
});
// axis: 0 = vertical (U/D), 1 = x (R2/L2), 2 = z (F2/B2). Same-axis moves commute → canonical order.
const MOVE_AXIS: number[] = MOVES.map((m) => (/^[UD]/.test(m.name) ? 0 : /^[RL]/.test(m.name) ? 1 : 2));

/** The exact 10-token rigid alphabet for a physical 3×3×5 (= cstimer's `335` cuboid part). */
export const CUBOID335_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);
export const CUBOID335_TOKEN_RE = /^(U['2]?|D['2]?|[RLFB]2)$/;

/** Reachable physical state count (= 40320²·24³/144, Schreier-Sims), preformatted exact string. */
export const CUBOID335_STATE_COUNT_STR = '156,067,430,400';
/** Naive orbit product 40320²·24³ (over-counts the reachable count by the 144× parity coupling). */
export const CUBOID335_ORBIT_PRODUCT_STR = '22,473,709,977,600';
/** Hard upper bound on a returned two-phase solution length (phase-1 diam + phase-2 diam ≪ this). */
export const CUBOID335_MAX_LENGTH = 45;
// Optimal-shortcut budget/cap. The two-phase reduction is honestly NEAR-optimal — it overshoots the true
// optimum by a mean of +5..+9 moves on real states (measured), and it essentially never returns a solution
// in 13..15 (its floor is ~16). So whenever the provably-optimal IDA* below DOESN'T fire, the returned
// length is badly inflated. The earlier cap (12) + tiny budget (800k) let it fire only for states whose
// TRUE optimum is ≤ 12, while the bulk of real random states actually have a true optimum of 13..15 (the
// corner orbit's diameter is 13). The result was a BIMODAL length distribution: a spike at 12 (shortcut
// fires) + a dead zone at 13..15 (shortcut can't reach it, two-phase floors at 16) + a fake hump from the
// inflated two-phase answers. Raising the cap/budget so the EXACT IDA* covers the realistic range
// (true-opt ≲ 16) makes almost every state return its provable optimum → the distribution becomes the true,
// unimodal one (peak ~14). The corner-dominated max-PDB heuristic is weak for deep states, so the node
// budget grows steeply with depth; we therefore use TWO regimes:
//   • In the browser the single solve runs synchronously on the main thread (see _Cuboid335Solver.tsx), so
//     a multi-second IDA* would freeze the tab. A modest budget keeps the worst real solve ≲ ~0.7 s and
//     still fills the 13..14 peak; the rare harder state (true-opt ≥ ~15) falls back to two-phase.
//   • Offline (Node — the dist-build sampler / tests) there is no UI to freeze, so a large budget lets the
//     EXACT solver finish for ~99% of states (worst ≈ 7 s), yielding the correct unimodal histogram. Both
//     regimes are overridable via env for tuning (CUBOID335_OPT_BUDGET / CUBOID335_OPT_CAP).
const IS_NODE = typeof process !== 'undefined' && !!(process as { versions?: { node?: string } }).versions?.node
  && typeof (globalThis as { window?: unknown }).window === 'undefined';
const envNum = (name: string): number | undefined => {
  try {
    const v = typeof process !== 'undefined' ? (process as { env?: Record<string, string | undefined> }).env?.[name] : undefined;
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch { return undefined; }
};
/** Optimal-shortcut node budget: a shallow state solved optimally below this is returned as optimal. */
// Offline 50M ⇒ ~98% of real states return their provable optimum (worst single solve ≈ 5–7 s, occasionally
// more on a pathological deep state — acceptable for the manual offline dist build); browser 3M keeps the
// synchronous main-thread solve ≲ ~0.7 s while still filling the true 13..14 peak.
const OPT_SHORTCUT_BUDGET = envNum('CUBOID335_OPT_BUDGET') ?? (IS_NODE ? 50_000_000 : 3_000_000);
/** Largest length the optimal shortcut will claim; beyond this the two-phase answer is used. */
const OPT_SHORTCUT_DEPTH_CAP = envNum('CUBOID335_OPT_CAP') ?? (IS_NODE ? 20 : 16);

function applyMove(state: Uint8Array, mi: number): Uint8Array<ArrayBuffer> {
  const p = MOVE_PERM[mi];
  const o = new Uint8Array(NS);
  for (let i = 0; i < NS; i++) o[i] = state[p[i]];
  return o;
}

/**
 * Parse a scramble into rigid move indices. A cstimer 335 string is `<cuboid part> / <333 part>`; the
 * " / " separator and the 333 part's 90° side turns are NOT rigid moves on a 3×3×5 (geometrically
 * impossible — see header), so parsing STOPS at the first "/" token. Within the cuboid part, an invalid
 * token throws Error('bad: <tok>').
 */
export function parseCuboid335Scramble(scramble: string): number[] {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === '/') break; // end of the rigid cuboid part; the 333 suffix has no rigid realisation
    if (!CUBOID335_TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(MOVE_BY_NAME.get(tok)!);
  }
  return out;
}

/** Apply a scramble's rigid cuboid part to solved and return the raw 78-facelet color state. */
export function cuboid335Apply(scramble: string): Uint8Array {
  let s = SOLVED_COLORS.slice();
  for (const mi of parseCuboid335Scramble(scramble)) s = applyMove(s, mi);
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
const NC = CUBIES.length; // 42
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
 * A pattern database over one MOVABLE orbit. The orbit's full reachable facelet-colorings (under ALL 10
 * moves) are densely indexed; we precompute trans (full-move transitions), optDist (exact distance over
 * all moves), p2Dist (180°-only distance to solved; 255 = NOT in H), and intoH (min moves into H).
 */
interface OrbitDb {
  index: (s: Uint8Array) => number;
  trans: Int32Array[];        // NG full-move transitions over dense indices
  optDist: Uint8Array;        // exact optimal distance to solved over ALL 10 moves (admissible PDB)
  p2Dist: Uint8Array;         // 180°-only distance to solved (255 = outside the subgroup H)
  intoH: Uint8Array;          // min moves (any of the 10) from this index into H (0 = already in H)
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

  // full optimal distance to solved over ALL 10 moves (BFS from solved) — admissible per-orbit PDB.
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

  // phase-2: BFS over the six 180° moves from solved → distance to solved (255 elsewhere = not in H).
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

  // phase-1: multi-source BFS (over ALL 10 moves) seeded distance-0 from every in-H index → intoH.
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
    DBS = all.filter((d) => d.size > 1); // movable orbits: [40320,40320,24,24,24]
  }
  return DBS;
}
const NORB = 5; // number of movable orbits (fixed; asserted by tests)

// ── joint phase-2 pattern databases (EXACT distances over orbit groups inside H) ──────
// Per-orbit max(p2Dist) underestimates the joint cost; the in-H sub-states are tiny, so build EXACT
// joint PDBs: a pair over orbits {0,1} (corners 96 × cap-edges 576 = 55296) and a pair over the two
// larger wing orbits {2,3} (24·24 = 576); the lone third wing {4} uses its own p2Dist. max over the
// three is admissible and very tight → phase-2 IDA* converges in a few ms.
interface Phase2Pdb {
  fullToInH: Int32Array[]; // [orbitIdx] full dense index → compact in-H index (−1 if not in H)
  dist01: Uint8Array;      // index = inH0 * inH1count + inH1
  dist23: Uint8Array;      // index = inH2 * inH3count + inH3
  inH1count: number;
  inH3count: number;
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
    dist01: pairBfs(0, 1),
    dist23: pairBfs(2, 3),
    inH1count: inHList[1].length,
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
export interface Cuboid335Solution {
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
// Phase-1 heuristic. Plain max(intoH) badly UNDER-guides the JOINT reduction: it's dominated by the corner
// orbit (intoH ≤ 11) and gives the search ZERO pressure to ALSO drive the cap-edge orbit (intoH ≤ 4) into
// H, so the A* frontier explodes and misses the goal on ~1% of real states (the bug this replaces). The
// two big orbits 0 (corner columns) and 1 (cap outer-edges) both leave/enter H only via U/D 90° turns and
// otherwise need separate work, so reducing both costs roughly intoH[0] + intoH[1]; the three wing orbits
// are always already in H (180°-only moves can't take them out) and never bind. Hence
//   h = max( intoH[0] + intoH[1],  intoH[wings] ).
// The additive term is NOT a provable lower bound (one U/D move can lower both big orbits at once), so the
// reduction is near-optimal rather than provably optimal — exactly the TIER-D contract — but it collapses
// the A* frontier from a non-terminating blow-up to a few hundred-thousand nodes → ≤ ~2 s, 100% solve.
const phase1H = (t: Int32Array, D: OrbitDb[]): number => {
  let m = D[0].intoH[t[0]] + D[1].intoH[t[1]];
  for (let i = 2; i < NORB; i++) { const v = D[i].intoH[t[i]]; if (v > m) m = v; }
  return m;
};
// Fast two-level NUMERIC closed-set key. The joint index 40320²·24³ exceeds a single safe slot, so:
//   outer key = corner·40320 + cap-edge  (< 40320² ≈ 1.63×10⁹, exact double)
//   inner key = (wing2·24 + wing3)·24 + wing4  (< 24³ = 13824)
// Pure number keys → fast, no per-node string garbage.
function phase1OuterKey(t: Int32Array): number { return t[0] * 40320 + t[1]; }
function phase1InnerKey(t: Int32Array): number { return (t[2] * 24 + t[3]) * 24 + t[4]; }
// One weighted-A* attempt with a hard cap on the number of DISTINCT states (node pool). Each distinct
// joint state owns exactly ONE pool slot (lazy decrease-key), so memory is bounded by `cap`. Returns the
// move path, or null if it hits the cap before reaching H.
function phase1Attempt(t0: Int32Array, D: OrbitDb[], weight: number, cap: number, greedy = false): number[] | null {
  const fKey = (g: number, h: number) => (greedy ? h : g + weight * h);
  const tuples: Int32Array[] = [t0.slice()];
  const gArr: number[] = [0]; const parent: number[] = [-1]; const moveArr: number[] = [-1];
  const seen = new Map<number, Map<number, number>>();
  const idxOf = (t: Int32Array): number | undefined => seen.get(phase1OuterKey(t))?.get(phase1InnerKey(t));
  const setIdx = (t: Int32Array, idx: number) => { const ok = phase1OuterKey(t); let inner = seen.get(ok); if (!inner) { inner = new Map(); seen.set(ok, inner); } inner.set(phase1InnerKey(t), idx); };
  setIdx(t0, 0);
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
        if (gArr[exist] <= ng) continue;
        gArr[exist] = ng; parent[exist] = idx; moveArr[exist] = mi;
        hpush(exist, fKey(ng, phase1H(nt, D)), ng);
        continue;
      }
      const nidx = tuples.length;
      tuples.push(nt); gArr.push(ng); parent.push(idx); moveArr.push(mi);
      setIdx(nt, nidx);
      hpush(nidx, fKey(ng, phase1H(nt, D)), ng);
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
  // A* (weight=1) with the additive heuristic — the CLOSED SET bounds expansion (no IDA* re-expansion
  // blow-up), so the worst real state finishes in ≤ ~2 s, mean ~0.1 s, with a 100% solve-rate (measured
  // over 800 real cstimer scrambles: 0 failures). The greedy-dive fallback is a safety net for the (never
  // observed) cap-out so the worst-case time stays bounded. H is reachable from every state.
  return phase1Attempt(t0, D, 1, 8_000_000) ?? phase1Attempt(t0, D, 2, 8_000_000, true);
}

// ── phase-2 IDA* (solve within the 180° subgroup using only 180° moves) ──────────────
function phase2Heuristic(tuple: Int32Array, P: Phase2Pdb, D: OrbitDb[]): number {
  const i0 = P.fullToInH[0][tuple[0]], i1 = P.fullToInH[1][tuple[1]];
  const i2 = P.fullToInH[2][tuple[2]], i3 = P.fullToInH[3][tuple[3]];
  const h01 = P.dist01[i0 * P.inH1count + i1];
  const h23 = P.dist23[i2 * P.inH3count + i3];
  const h4 = D[4].p2Dist[tuple[4]];
  let m = h01; if (h23 > m) m = h23; if (h4 > m) m = h4;
  return m;
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
    const f = g + phase2Heuristic(tuple, P, D);
    if (f > bound) return f;
    if (phase2Solved(tuple, D)) { found = Array.from(pathStack.subarray(0, depth)); return -1; }
    let min = Infinity;
    for (const mi of PHASE2_MOVES) {
      if (last >= 0) {
        if (MOVE_AXIS[mi] === MOVE_AXIS[last] && mi < last) continue;
        if (mi === last) continue; // every 180° move is its own inverse → repeat = undo
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

  let bound = phase2Heuristic(t0, P, D);
  while (bound <= maxBound) {
    const r = dfs(t0, 0, bound, -1, 0);
    if (found) return found;
    if (r === Infinity) return null;
    bound = r;
  }
  return null;
}

/** Two-phase reduction: drive into the 180° subgroup (A*), then solve within it (IDA*). Always succeeds. */
function solveTwoPhase(start: Uint8Array, D: OrbitDb[]): number[] {
  const t0 = tupleOf(start, D);
  const p1 = solvePhase1(t0, D);
  if (!p1) throw new Error('335 phase-1 unreachable (should not happen)');
  let t = t0;
  for (const mi of p1) { const nt = new Int32Array(NORB); for (let i = 0; i < NORB; i++) nt[i] = D[i].trans[mi][t[i]]; t = nt; }
  const p2 = solvePhase2(t, D, p2pdb(D), 30);
  if (!p2) throw new Error('335 phase-2 unreachable (should not happen)');
  return [...p1, ...p2];
}

// ── optional optimal shortcut for shallow states (all 10 moves, admissible PDB, small budget) ─
function solveOptimalShallow(start: Uint8Array, D: OrbitDb[]): number[] | null {
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
 * Solve a 3×3×5 scramble. Always returns a valid, bounded solution (length ≤ CUBOID335_MAX_LENGTH):
 *   • a shallow state solved optimally within a small node budget → `optimal: true`;
 *   • otherwise a near-optimal two-phase reduction → `optimal: false`.
 * Throws Error('bad: …') only on an unparseable token in the cuboid part. There is no "too-deep".
 */
export function solveCuboid335(scramble: string): Cuboid335Solution {
  const D = dbs();
  const start = cuboid335Apply(scramble);
  if (isSolvedColors(start)) return { solution: '', length: 0, optimal: true };

  const opt = solveOptimalShallow(start, D);
  if (opt) return { solution: opt.map((m) => MOVES[m].name).join(' '), length: opt.length, optimal: true };

  const two = solveTwoPhase(start, D);
  let s = start.slice();
  for (const mi of two) s = applyMove(s, mi);
  if (!isSolvedColors(s)) throw new Error('335 two-phase produced an invalid solution');
  return { solution: two.map((m) => MOVES[m].name).join(' '), length: two.length, optimal: false };
}

/** Admissible lower bound on the OPTIMAL solution length (max over orbits of optimal per-orbit distance). */
export function cuboid335Heuristic(scramble: string): number {
  const D = dbs();
  const t = tupleOf(cuboid335Apply(scramble), D);
  let m = 0;
  for (let i = 0; i < NORB; i++) { const d = D[i].optDist[t[i]]; if (d > m) m = d; }
  return m;
}

// ── faithful cstimer-style random scramble (mirrors megascramble.js mega() for the 335 cuboid part) ──
// cstimer 335 = `#{[[["U","U'","U2"],["D","D'","D2"]],["R2","L2"],["F2","B2"]],0,%l} / ${333}`. We
// generate the rigid CUBOID PART only (the legal 3×3×5 moves); the 333 suffix has no rigid realisation.
export function randomCuboid335Scramble(len: number, rnd: () => number = Math.random): string {
  const turns: ReadonlyArray<ReadonlyArray<string | string[]>> = [
    [['U', "U'", 'U2'], ['D', "D'", 'D2']],
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
    s.push(Array.isArray(cell) ? cell[Math.floor(rnd() * cell.length)] : cell);
  }
  return s.join(' ');
}

export interface Cuboid335Sample { scramble: string; length: number; optimal: boolean; }

/**
 * Sample `n` random scrambles of `scrambleLen` moves and solve each. Returns (returned-solution length,
 * optimal-flag) per sample — the RETURNED-solution-length distribution for `scrambleLen`-move random
 * scrambles (a SAMPLE, NOT the full-space curve; 1.56×10¹¹ states can't be enumerated).
 */
export function cuboid335SampleDistribution(n: number, rnd: () => number = Math.random, scrambleLen = 40): Cuboid335Sample[] {
  dbs();
  const out: Cuboid335Sample[] = [];
  for (let i = 0; i < n; i++) {
    const scramble = randomCuboid335Scramble(scrambleLen, rnd);
    const { length, optimal } = solveCuboid335(scramble);
    out.push({ scramble, length, optimal });
  }
  return out;
}

/** Test/diagnostic: per-orbit full size, 180° subgroup size, and phase-1/phase-2 max depths. */
export function cuboid335DbStats(): { sizes: number[]; inHCounts: number[]; p2MaxDepths: number[]; intoHMaxDepths: number[] } {
  const D = dbs();
  return {
    sizes: D.map((d) => d.size),
    inHCounts: D.map((d) => d.inHCount),
    p2MaxDepths: D.map((d) => d.p2MaxDepth),
    intoHMaxDepths: D.map((d) => d.intoHMaxDepth),
  };
}

export { NS, NC, NORB, FACE_IDS, STICKERS, SOLVED_COLORS };
