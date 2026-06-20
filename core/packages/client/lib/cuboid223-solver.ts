/*
 * 2×2×3 Tower (2×2×3) optimal solver — pure TS, no worker, no tables to download.
 *
 * The 2×2×3 cuboid is the 8 corners of a 2×2×2 sitting on a middle 1×2×2 layer. Its move set is
 * just U, D (90° in all powers) plus R2, F2 (the two long axes only turn 180°, since a 90° turn
 * would not fit the cuboid). State space is small — exactly 241,920:
 *   - 8 corners, free permutation        → 8! = 40,320 states,
 *   - the 3-element middle layer, a permutation → 3! = 6 states,
 *   - 40,320 × 6 = 241,920, every combination reachable.
 * We BFS the whole graph from solved once (memoized) and store, for every reachable state, the
 * move that steps it toward solved — so every solve is an optimal shortest path, computed
 * instantly. God's number is 14 (proven by the full BFS), mean ~9.74.
 *
 * Notation + state model copied field-for-field from the vendored cstimer `scramble/2x2x3.js`
 * (the scramble source at /scramble/gen?event=223):
 *   - corner state idx = mathlib.getNPerm(g, 8) over a permutation g of {0..7}
 *   - edge   state idx = mathlib.getNPerm(g, 3) over a permutation g of {0..2}
 *   - 4 base moves U D R F as corner cycles (initCornerMoveTable):
 *       U: circle(g,0,1,2,3)   D: circle(g,4,5,6,7)
 *       R: circle(g,2,5)(g,3,6)   F: circle(g,0,5)(g,3,4)
 *     and edge cycles (doEdgeMove, m<2 are no-ops): R → circle(g,0,1), F → circle(g,0,2)
 *   - the search emits U/D with 3 powers (`["U","D","R2","F2"][i] + " 2'".charAt(f)`, f=0..2 →
 *     "", "2", "'") and R/F with one power each → R2, F2.
 * Replicating this bit-for-bit guarantees a cstimer-generated scramble (cstimerScramble('223'))
 * is interpreted as the identical physical state, so our solution actually solves it.
 */

const N_CORNER = 40320; // 8!
const N_EDGE = 6;       // 3!
const N_INDEX = N_CORNER * N_EDGE; // 241,920
const SOLVED_IDX = 0;

/** God's number for the 2×2×3 tower, proven by the full BFS below. */
export const CUBOID223_GODS_NUMBER = 14;

/**
 * Optimal-solution-length distribution over all 241,920 reachable states (index = optimal move
 * count). Locked by tests; also surfaced in the UI as flavor.
 */
export const CUBOID223_LENGTH_DISTRIBUTION: ReadonlyArray<number> = [
  1, 8, 35, 157, 678, 2527, 7442, 17088, 31568, 44704, 47216, 49792, 29024, 11104, 576,
];

// ── permutation rank / unrank (matches cstimer getNPerm/setNPerm for n<16) ────
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

/** Lehmer rank of a permutation of {0..n-1} (matches cstimer getNPerm for n<16). */
function permRank(p: number[], n: number): number {
  let r = 0;
  for (let i = 0; i < n; i++) {
    let cnt = 0;
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) cnt++;
    r = r * (n - i) + cnt;
  }
  return r;
}

function permUnrank(rank: number, n: number): number[] {
  const elems: number[] = [];
  for (let i = 0; i < n; i++) elems.push(i);
  const p: number[] = [];
  let r = rank;
  for (let i = 0; i < n; i++) {
    const fac = FACT[n - 1 - i];
    const d = Math.floor(r / fac);
    r %= fac;
    p.push(elems[d]);
    elems.splice(d, 1);
  }
  return p;
}

// cstimer mathlib.circle: forward cycle — temp = arr[last]; arr[args[i]] = arr[args[i-1]] for
// i=last..1; arr[args[0]] = temp.
function circle(arr: number[], ...idx: number[]): void {
  const last = idx.length - 1;
  const temp = arr[idx[last]];
  for (let i = last; i > 0; i--) arr[idx[i]] = arr[idx[i - 1]];
  arr[idx[0]] = temp;
}

// 4 base corner moves U D R F applied to an 8-perm in place.
function cornerApplyBase(g: number[], base: number): void {
  if (base === 0) circle(g, 0, 1, 2, 3);
  else if (base === 1) circle(g, 4, 5, 6, 7);
  else if (base === 2) { circle(g, 2, 5); circle(g, 3, 6); }
  else { circle(g, 0, 5); circle(g, 3, 4); }
}

// edge (middle layer) move: U/D no-op; R → circle(g,0,1); F → circle(g,0,2) on a 3-perm.
function edgeApplyBase(e: number, base: number): number {
  if (base < 2) return e;
  const g = permUnrank(e, 3);
  if (base === 2) circle(g, 0, 1);
  else circle(g, 0, 2);
  return permRank(g, 3);
}

// ── move set (8 variants the scramble can emit) ───────────────────────────────
// U, U2, U', D, D2, D', R2, F2. inverse(): U↔U', U2 self; D↔D', D2 self; R2/F2 self.
interface Cuboid223Move { name: string; base: number; pow: number; }
const MOVES: ReadonlyArray<Cuboid223Move> = [
  { name: 'U', base: 0, pow: 1 },
  { name: 'U2', base: 0, pow: 2 },
  { name: "U'", base: 0, pow: 3 },
  { name: 'D', base: 1, pow: 1 },
  { name: 'D2', base: 1, pow: 2 },
  { name: "D'", base: 1, pow: 3 },
  { name: 'R2', base: 2, pow: 1 },
  { name: 'F2', base: 3, pow: 1 },
];
const MOVE_BY_NAME = new Map<string, number>(MOVES.map((mv, i) => [mv.name, i]));
const INVERSE_MOVE = [2, 1, 0, 5, 4, 3, 6, 7]; // index → index of inverse move

// ── precomputed graph (built once) ───────────────────────────────────────────
interface Cuboid223Graph {
  cmv: Int32Array[]; // cmv[base][cornerRank] = new cornerRank (4 base moves)
  emv: Int32Array[]; // emv[base][edgeRank] = new edgeRank
  toSolved: Int8Array; // move index stepping idx toward solved, -1 if unreached
  dist: Int8Array;     // optimal distance to solved, -1 if unreached
}
let GRAPH: Cuboid223Graph | null = null;

// Apply move variant m (one of the 8) to a full index.
function nextIdx(g: Cuboid223Graph, idx: number, m: number): number {
  const mv = MOVES[m];
  let c = Math.floor(idx / N_EDGE);
  let e = idx % N_EDGE;
  for (let k = 0; k < mv.pow; k++) {
    c = g.cmv[mv.base][c];
    e = g.emv[mv.base][e];
  }
  return c * N_EDGE + e;
}

function buildGraph(): Cuboid223Graph {
  const cmv: Int32Array[] = [];
  for (let base = 0; base < 4; base++) {
    const t = new Int32Array(N_CORNER);
    for (let i = 0; i < N_CORNER; i++) {
      const g = permUnrank(i, 8);
      cornerApplyBase(g, base);
      t[i] = permRank(g, 8);
    }
    cmv.push(t);
  }
  const emv: Int32Array[] = [];
  for (let base = 0; base < 4; base++) {
    const t = new Int32Array(N_EDGE);
    for (let e = 0; e < N_EDGE; e++) t[e] = edgeApplyBase(e, base);
    emv.push(t);
  }

  const toSolved = new Int8Array(N_INDEX).fill(-1);
  const dist = new Int8Array(N_INDEX).fill(-1);
  const g: Cuboid223Graph = { cmv, emv, toSolved, dist };
  dist[SOLVED_IDX] = 0;
  let frontier = [SOLVED_IDX];
  let d = 0;
  while (frontier.length) {
    const next: number[] = [];
    for (const u of frontier) {
      for (let m = 0; m < MOVES.length; m++) {
        const v = nextIdx(g, u, m);
        if (dist[v] === -1) {
          dist[v] = d + 1;
          toSolved[v] = INVERSE_MOVE[m]; // apply(u,m)=v ⇒ apply(v, inverse(m)) = u (toward solved)
          next.push(v);
        }
      }
    }
    frontier = next;
    d++;
  }
  return g;
}

function graph(): Cuboid223Graph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ───────────────────────────────────────────────────────────────
const TOKEN_RE = /^([UD]['2]?|[RF]2)$/;

/** Parse a scramble into move indices. Throws Error('bad: <tok>') on an invalid token. */
export function parseCuboid223Scramble(scramble: string): number[] {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(MOVE_BY_NAME.get(tok)!);
  }
  return out;
}

/** Apply a scramble to the solved cube and return its state index. */
export function cuboid223ScrambleToIndex(scramble: string): number {
  const g = graph();
  let idx = SOLVED_IDX;
  for (const m of parseCuboid223Scramble(scramble)) idx = nextIdx(g, idx, m);
  return idx;
}

export interface Cuboid223Solution {
  /** Optimal solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/** Optimally solve a 2×2×3 scramble. Throws on an invalid token. */
export function solveCuboid223(scramble: string): Cuboid223Solution {
  const g = graph();
  let idx = cuboid223ScrambleToIndex(scramble);
  const names: string[] = [];
  let guard = 0;
  while (idx !== SOLVED_IDX) {
    const m = g.toSolved[idx];
    if (m < 0 || guard++ > CUBOID223_GODS_NUMBER) throw new Error('unsolvable');
    names.push(MOVES[m].name);
    idx = nextIdx(g, idx, m);
  }
  return { solution: names.join(' '), length: names.length };
}

export interface Cuboid223State {
  /** corners[pos] = home id (0..7) of the corner currently at position pos. */
  corners: number[];
  /** mids[pos] = home id (0..2) of the middle-layer piece currently at position pos. */
  mids: number[];
}

/** Apply a scramble to the solved cube, returning the raw (corners, mids) state for rendering. */
export function cuboid223Apply(scramble: string): Cuboid223State {
  const corners = [0, 1, 2, 3, 4, 5, 6, 7];
  const mids = [0, 1, 2];
  for (const m of parseCuboid223Scramble(scramble)) {
    const mv = MOVES[m];
    for (let k = 0; k < mv.pow; k++) {
      cornerApplyBase(corners, mv.base);
      if (mv.base >= 2) {
        if (mv.base === 2) circle(mids, 0, 1);
        else circle(mids, 0, 2);
      }
    }
  }
  return { corners, mids };
}

/** Shortest scramble producing state `idx` = inverse of its optimal solution (reverse path). */
function indexToScramble(g: Cuboid223Graph, idx: number): string {
  const sol: number[] = [];
  let cur = idx;
  let guard = 0;
  while (cur !== SOLVED_IDX) {
    const m = g.toSolved[cur];
    if (m < 0 || guard++ > CUBOID223_GODS_NUMBER) break;
    sol.push(m);
    cur = nextIdx(g, cur, m);
  }
  // scramble = inverse of the toward-solved path, in reverse order.
  return sol.reverse().map((m) => MOVES[INVERSE_MOVE[m]].name).join(' ');
}

/**
 * Generate up to `perBin` example scrambles for each optimal length, by sampling states at each
 * BFS depth and inverting their optimal solution (so a depth-d state yields a length-d scramble).
 * Deterministic spread sampling — the whole state space is enumerable, no competition corpus
 * needed. Returns { depth: [scramble, …] } for depths 1..14.
 */
export function cuboid223ExamplesByLength(perBin = 12): Record<number, string[]> {
  const g = graph();
  // Two passes: first count per depth so we can spread-sample without materialising every bucket
  // (241,920 states × the largest bins is fine, but spread sampling keeps examples evenly spaced).
  const counts: number[] = [];
  for (let i = 0; i < g.dist.length; i++) {
    const d = g.dist[i];
    if (d > 0) counts[d] = (counts[d] ?? 0) + 1;
  }
  const want = perBin;
  const wantInf = !Number.isFinite(perBin);
  const step: number[] = [];
  counts.forEach((c, d) => { step[d] = wantInf ? 1 : Math.max(1, Math.floor(c / want)); });
  const seen: number[] = [];
  const out: Record<number, string[]> = {};
  for (let i = 0; i < g.dist.length; i++) {
    const d = g.dist[i];
    if (d <= 0) continue;
    if (!wantInf && (out[d]?.length ?? 0) >= want) continue;
    const k = seen[d] = (seen[d] ?? 0) + 1;
    if (wantInf || (k - 1) % step[d] === 0) (out[d] ??= []).push(indexToScramble(g, i));
  }
  return out;
}

/**
 * Every non-trivial state's shortest scramble, grouped by optimal length (depths 1..14).
 * The full state space is enumerable, so this is the complete corpus (241,919 states; the
 * 241,920th is the identity/solved). Used for the "download all states" buttons.
 */
export function cuboid223AllScramblesByLength(): Record<number, string[]> {
  return cuboid223ExamplesByLength(Infinity);
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function cuboid223GraphStats(): { total: number; histogram: number[] } {
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
