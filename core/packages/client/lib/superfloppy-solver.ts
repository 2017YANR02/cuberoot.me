/*
 * Super Floppy Cube (超薄花型 / Super Floppy) optimal solver — pure TS, no worker, no tables to
 * download.
 *
 * The Super Floppy is a 3×3×1 flat slab like the regular Floppy (lib/floppy-solver), but its faces
 * turn 90° (not just 180°), so corners can flip up out of the plane and roam. There are exactly
 * 3,041,280 reachable states:
 *   - 4 corner pieces over 12 positions, ordered → P(12,4) = 11,880
 *   - 4 edge pieces, fixed in place, each with 4 orientations → 4⁴ = 256
 *   - 11,880 × 256 = 3,041,280, every combination reachable.
 * We BFS the whole graph from solved once (memoized, ~0.6s on a laptop with the integer-ranked move
 * tables below) and store, for every reachable state, the move that steps it toward solved — so
 * every solve is an optimal shortest path. God's number is 13 (proven by the full BFS), mean 9.0040.
 *
 * Physical / move model derived from the flat-slab geometry and VERIFIED two ways: (a) the BFS
 * closure is exactly 3,041,280 = P(12,4)·4⁴ (jaapsch.net/puzzles/floppy2.htm), and (b) 2000 real
 * cstimer `sfl` scrambles all round-trip (scramble ∘ our optimal solution = solved). Treat the
 * Super Floppy as a 3×3×3 where only the 4 equatorial faces (relative to the slab's flat z axis)
 * ever turn: R/L/U/D. The slab is the z=0 layer; its corners sit at (±1,±1,0) and roam to (±1,0,±1)
 * / (0,±1,±1) when lifted, giving 12 corner slots; its 4 edges stay at (±1,0,0)/(0,±1,0) and only
 * reorient (4 facings each).
 *
 * Notation matches cstimer `scramble/megascramble.js:33` (`"sfl": [[["R","L"],["U","D"]],cubesuff]`,
 * `cubesuff=["","2","'"]`): the full alphabet is the 12 tokens R R2 R' L L2 L' U U2 U' D D2 D', each
 * one face turn = one move. cstimer has no internal sfl solver or image, so any self-consistent move
 * definition with the same closure + alphabet solves every cstimer scramble — and ours does.
 *
 * Corner-slot rotations (single 90° turn), derived by literally rotating the slab's in-layer cubies:
 *   R: 0→4 1→5 4→1 5→0      L: 2→7 3→6 6→2 7→3
 *   U: 0→9 2→8 8→0 9→2      D: 1→10 3→11 10→3 11→1
 * Edges: each face turn reorients only its own edge (+1 mod 4): R→edge0 L→edge1 U→edge2 D→edge3.
 */

// ── slot layout (also consumed by the preview SVG) ────────────────────────────
// Corner slots 0..11. 0..3 = the in-plane home positions (NE SE NW SW), the homes of corners 0..3
// when solved. 4..11 = the lifted "out of plane" slots, two per face (up/down).
//   4 R-up   5 R-down   6 L-up   7 L-down   8 U-up   9 U-down   10 D-up   11 D-down
// Edge slots 0..3 = R L U D, fixed; each carries an orientation 0..3.
export const SUPERFLOPPY_CORNER_SLOTS = 12;
export const SUPERFLOPPY_EDGE_SLOTS = 4;

/** Face order R L U D = 0..3 (matches cstimer axis layout: axis0={R,L}, axis1={U,D}). */
const FACE_LETTER = 'RLUD';

// Per-face corner-slot cycle (one 90° turn). Each is a 4-cycle of slots; applying it as a forward
// map slot→slot moves the occupant of `slot` to `cperm(slot)`.
type SlotPerm = (slot: number) => number;
const CORNER_PERM: ReadonlyArray<SlotPerm> = [
  (s) => (s === 0 ? 4 : s === 1 ? 5 : s === 4 ? 1 : s === 5 ? 0 : s),   // R
  (s) => (s === 2 ? 7 : s === 3 ? 6 : s === 6 ? 2 : s === 7 ? 3 : s),   // L
  (s) => (s === 0 ? 9 : s === 2 ? 8 : s === 8 ? 0 : s === 9 ? 2 : s),   // U
  (s) => (s === 1 ? 10 : s === 3 ? 11 : s === 10 ? 3 : s === 11 ? 1 : s), // D
];

/** Super Floppy reachable-state count = P(12,4) × 4⁴. */
export const SUPERFLOPPY_TOTAL_STATES = 3041280;
/** God's number for the Super Floppy (cstimer face-turn metric), proven by the full BFS below. */
export const SUPERFLOPPY_GODS_NUMBER = 13;
/**
 * Optimal-solution-length distribution over all 3,041,280 reachable states (index = optimal move
 * count). Locked by tests; surfaced in the UI as flavor. Sum = 3,041,280.
 */
export const SUPERFLOPPY_LENGTH_DISTRIBUTION: ReadonlyArray<number> = [
  1, 12, 90, 584, 3301, 15536, 64935, 226464, 602629, 1027956, 861916, 230224, 7600, 32,
];

// ── encoding ──────────────────────────────────────────────────────────────────
// index = cornerRank (0..11879) * 256 + edgeOri (0..255).
//   cornerRank = ordered placement of 4 distinct corners into 12 slots = P(12,4) (mixed-radix).
//   edgeOri = base-4 of [eo0,eo1,eo2,eo3].
const N_CORNER = 11880; // P(12,4)
const N_EDGE = 256;     // 4^4
const N_INDEX = N_CORNER * N_EDGE; // 3,041,280
const CORNER_MULT = [990, 90, 9, 1]; // 11·10·9, 10·9, 9, 1
const SOLVED_IDX = 0; // corners in homes 0..3, all edge orientations 0

/** Rank an occupancy array (slot→cornerId, -1 = empty) into 0..11879. */
function cornerRank(occ: number[]): number {
  const slotOf = [-1, -1, -1, -1];
  for (let slot = 0; slot < 12; slot++) {
    const c = occ[slot];
    if (c >= 0) slotOf[c] = slot;
  }
  const avail = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let r = 0;
  for (let c = 0; c < 4; c++) {
    const ai = avail.indexOf(slotOf[c]);
    r += ai * CORNER_MULT[c];
    avail.splice(ai, 1);
  }
  return r;
}

/** Inverse of cornerRank → occupancy array (slot→cornerId, -1 = empty). */
function cornerUnrank(rank: number): number[] {
  const avail = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const occ = new Array<number>(12).fill(-1);
  let rem = rank;
  for (let c = 0; c < 4; c++) {
    const ai = Math.floor(rem / CORNER_MULT[c]);
    rem %= CORNER_MULT[c];
    const s = avail[ai];
    avail.splice(ai, 1);
    occ[s] = c;
  }
  return occ;
}

// ── move set (12 scramble variants the alphabet can emit) ──────────────────────
interface SuperFloppyMove { name: string; face: number; pow: number; }
const MOVES: ReadonlyArray<SuperFloppyMove> = (() => {
  const out: SuperFloppyMove[] = [];
  for (let face = 0; face < 4; face++) {
    for (let pow = 1; pow <= 3; pow++) {
      out.push({ name: FACE_LETTER[face] + (pow === 1 ? '' : pow === 2 ? '2' : "'"), face, pow });
    }
  }
  return out;
})();
const MOVE_BY_NAME = new Map<string, number>(MOVES.map((mv, i) => [mv.name, i]));
const INV_POW = [0, 3, 2, 1]; // inverse of a power 1..3

// ── precomputed graph (built once) ─────────────────────────────────────────────
interface SuperFloppyGraph {
  cmv: Int32Array[]; // cmv[face][cornerRank] = new cornerRank (single 90°)
  emv: Int32Array[]; // emv[face][edgeOri]   = new edgeOri    (single 90°)
  toSolvedFace: Int8Array; // face index stepping idx toward solved, -1 if unreached
  toSolvedPow: Int8Array;  // its power
  dist: Int8Array;         // optimal distance to solved, -1 if unreached
}
let GRAPH: SuperFloppyGraph | null = null;

function stepBase(g: SuperFloppyGraph, idx: number, face: number, pow: number): number {
  let c = Math.floor(idx / N_EDGE);
  let e = idx % N_EDGE;
  for (let k = 0; k < pow; k++) {
    c = g.cmv[face][c];
    e = g.emv[face][e];
  }
  return c * N_EDGE + e;
}

function buildGraph(): SuperFloppyGraph {
  const cmv: Int32Array[] = [];
  for (let face = 0; face < 4; face++) {
    const perm = CORNER_PERM[face];
    const t = new Int32Array(N_CORNER);
    for (let r = 0; r < N_CORNER; r++) {
      const occ = cornerUnrank(r);
      const next = new Array<number>(12).fill(-1);
      for (let slot = 0; slot < 12; slot++) {
        const corner = occ[slot];
        if (corner >= 0) next[perm(slot)] = corner;
      }
      t[r] = cornerRank(next);
    }
    cmv.push(t);
  }
  const emv: Int32Array[] = [];
  for (let face = 0; face < 4; face++) {
    const t = new Int32Array(N_EDGE);
    for (let e = 0; e < N_EDGE; e++) {
      const eo = [e & 3, (e >> 2) & 3, (e >> 4) & 3, (e >> 6) & 3];
      eo[face] = (eo[face] + 1) & 3;
      t[e] = eo[0] + eo[1] * 4 + eo[2] * 16 + eo[3] * 64;
    }
    emv.push(t);
  }

  const dist = new Int8Array(N_INDEX).fill(-1);
  const toSolvedFace = new Int8Array(N_INDEX).fill(-1);
  const toSolvedPow = new Int8Array(N_INDEX).fill(-1);
  const g: SuperFloppyGraph = { cmv, emv, toSolvedFace, toSolvedPow, dist };
  dist[SOLVED_IDX] = 0;
  let frontier: number[] = [SOLVED_IDX];
  let d = 0;
  while (frontier.length) {
    const next: number[] = [];
    for (const u of frontier) {
      for (let face = 0; face < 4; face++) {
        for (let pow = 1; pow <= 3; pow++) {
          const v = stepBase(g, u, face, pow);
          if (dist[v] === -1) {
            dist[v] = d + 1;
            toSolvedFace[v] = face;       // apply(u, face^pow) = v ⇒ apply(v, face^inv) = u
            toSolvedPow[v] = INV_POW[pow];
            next.push(v);
          }
        }
      }
    }
    frontier = next;
    d++;
  }
  return g;
}

function graph(): SuperFloppyGraph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ──────────────────────────────────────────────────────────────
const TOKEN_RE = /^([RLUD]['2]?)$/;

/** Parse a scramble into move indices. Throws Error('bad: <tok>') on an invalid token. */
export function parseSuperFloppyScramble(scramble: string): number[] {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(MOVE_BY_NAME.get(tok)!);
  }
  return out;
}

/** Apply a scramble to the solved cube and return its state index. */
export function superFloppyScrambleToIndex(scramble: string): number {
  const g = graph();
  let idx = SOLVED_IDX;
  for (const m of parseSuperFloppyScramble(scramble)) {
    const mv = MOVES[m];
    idx = stepBase(g, idx, mv.face, mv.pow);
  }
  return idx;
}

export interface SuperFloppySolution {
  /** Optimal solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/** Optimally solve a Super Floppy scramble. Throws on an invalid token. */
export function solveSuperFloppy(scramble: string): SuperFloppySolution {
  const g = graph();
  let idx = superFloppyScrambleToIndex(scramble);
  const names: string[] = [];
  let guard = 0;
  while (idx !== SOLVED_IDX) {
    const face = g.toSolvedFace[idx];
    const pow = g.toSolvedPow[idx];
    if (face < 0 || guard++ > SUPERFLOPPY_GODS_NUMBER) throw new Error('unsolvable');
    names.push(FACE_LETTER[face] + (pow === 1 ? '' : pow === 2 ? '2' : "'"));
    idx = stepBase(g, idx, face, pow);
  }
  return { solution: names.join(' '), length: names.length };
}

export interface SuperFloppyState {
  /** corners[slot] = home id (0..3) of the corner at slot (0..11), or -1 if empty. */
  corners: number[];
  /** edges[face] = orientation 0..3 of the fixed edge on face (R L U D = 0..3). */
  edges: number[];
}

/** Apply a scramble to the solved cube, returning the raw (corners, edges) state for rendering. */
export function superFloppyApply(scramble: string): SuperFloppyState {
  const corners = [0, 1, 2, 3, -1, -1, -1, -1, -1, -1, -1, -1];
  const edges = [0, 0, 0, 0];
  for (const m of parseSuperFloppyScramble(scramble)) {
    const mv = MOVES[m];
    for (let k = 0; k < mv.pow; k++) {
      const perm = CORNER_PERM[mv.face];
      const next = new Array<number>(12).fill(-1);
      for (let slot = 0; slot < 12; slot++) {
        if (corners[slot] >= 0) next[perm(slot)] = corners[slot];
      }
      for (let i = 0; i < 12; i++) corners[i] = next[i];
      edges[mv.face] = (edges[mv.face] + 1) & 3;
    }
  }
  return { corners, edges };
}

/** Shortest scramble producing state `idx` = inverse of its optimal solution (reverse path). */
function indexToScramble(g: SuperFloppyGraph, idx: number): string {
  const path: { face: number; pow: number }[] = [];
  let cur = idx;
  let guard = 0;
  while (cur !== SOLVED_IDX) {
    const face = g.toSolvedFace[cur];
    const pow = g.toSolvedPow[cur];
    if (face < 0 || guard++ > SUPERFLOPPY_GODS_NUMBER) break;
    path.push({ face, pow });
    cur = stepBase(g, cur, face, pow);
  }
  // scramble = inverse of the toward-solved path, in reverse order.
  return path
    .reverse()
    .map(({ face, pow }) => {
      const ip = INV_POW[pow];
      return FACE_LETTER[face] + (ip === 1 ? '' : ip === 2 ? '2' : "'");
    })
    .join(' ');
}

/**
 * Generate up to `perBin` example scrambles for each optimal length, by spread-sampling states at
 * each BFS depth and inverting their optimal solution (a depth-d state yields a length-d scramble).
 * Deterministic spread sampling — the whole state space is enumerable, no competition corpus
 * needed. Returns { depth: [scramble, …] } for depths 1..13.
 */
export function superFloppyExamplesByLength(perBin = 12): Record<number, string[]> {
  const g = graph();
  const counts: number[] = [];
  for (let i = 0; i < g.dist.length; i++) {
    const d = g.dist[i];
    if (d > 0) counts[d] = (counts[d] ?? 0) + 1;
  }
  const wantInf = !Number.isFinite(perBin);
  const step: number[] = [];
  counts.forEach((c, d) => { step[d] = wantInf ? 1 : Math.max(1, Math.floor(c / perBin)); });
  const seen: number[] = [];
  const out: Record<number, string[]> = {};
  for (let i = 0; i < g.dist.length; i++) {
    const d = g.dist[i];
    if (d <= 0) continue;
    if (!wantInf && (out[d]?.length ?? 0) >= perBin) continue;
    const k = seen[d] = (seen[d] ?? 0) + 1;
    if (wantInf || (k - 1) % step[d] === 0) (out[d] ??= []).push(indexToScramble(g, i));
  }
  return out;
}

/**
 * Every non-trivial state's shortest scramble, grouped by optimal length (depths 1..13). The full
 * state space is enumerable, so this is the complete corpus (3,041,279 states; the 3,041,280th is
 * the identity/solved). Used for the "download all states" buttons — over ~3M lines, so the UI
 * builds it lazily / on demand.
 */
export function superFloppyAllScramblesByLength(): Record<number, string[]> {
  return superFloppyExamplesByLength(Infinity);
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function superFloppyGraphStats(): { total: number; histogram: number[] } {
  const { dist } = graph();
  const histogram: number[] = [];
  let total = 0;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (d < 0) continue;
    total++;
    histogram[d] = (histogram[d] ?? 0) + 1;
  }
  return { total, histogram };
}
