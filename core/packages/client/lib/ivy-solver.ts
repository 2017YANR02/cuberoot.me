/*
 * Ivy Cube (枫叶魔方 / Maple Leaf) optimal solver — pure TS, no worker, no tables to download.
 *
 * The Ivy cube is a corner-turning puzzle (a Skewb with half its corners removed):
 * 4 turning corners + 6 centers. State space is tiny — exactly 29,160 = 81 × 360:
 *   - corners: 4 turning corners, each 3 orientations, no sum constraint → 3^4 = 81
 *   - centers: 6 face centers, only even permutations reachable (each move is a 3-cycle) → 6!/2 = 360
 * God's number is 8 (one move = one 120° corner twist). We BFS the whole graph from solved
 * once (memoized) and store, for every reachable state, the move that steps it toward solved —
 * so every solve is an optimal shortest path, computed instantly.
 *
 * Notation matches cstimer exactly (the scramble source used at /scramble/gen?event=ivy), read
 * from the vendored cstimer `skewb.js` (`getScrambleIvy` / `solvivy`, `toStr(..., "RLDB", "' ")`):
 *   - letters R L D B map to turning corners (axes) 0 1 2 3
 *   - a bare letter (e.g. "R") is power 1 = the base turn applied TWICE;
 *     a primed letter ("R'") is power 0 = the base turn applied ONCE
 *   - base turn of axis m: 3-cycle the centers per `MOVE_CENTERS[m]` and +1 to corner m
 * Replicating this bit-for-bit guarantees a cstimer-generated scramble is interpreted as the
 * identical physical state, so our solution (same notation) actually solves it.
 */

/** Center face order: U R F B L D = 0..5. Each entry is the clockwise (base) 3-cycle of an axis. */
export const MOVE_CENTERS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 3, 1], // axis 0 (R): U → B → R → U
  [0, 2, 4], // axis 1 (L): U → F → L → U
  [1, 5, 2], // axis 2 (D): R → D → F → R
  [3, 4, 5], // axis 3 (B): B → L → D → B
];

const AXIS_LETTER = 'RLDB';

/** God's number for the Ivy cube (each 120° corner twist = 1 move), proven by full BFS below. */
export const IVY_GODS_NUMBER = 8;

/**
 * Optimal-solution-length distribution over all 29,160 states (index = optimal move count).
 * Index 0 = solved. Locked by tests; also surfaced in the UI as flavor.
 */
export const IVY_LENGTH_DISTRIBUTION: ReadonlyArray<number> = [
  1, 8, 48, 288, 1640, 7582, 15262, 4221, 110,
];

// ── encoding ────────────────────────────────────────────────────────────────
// state = centerRank (Lehmer rank of the 6-center permutation, [0,720)) * 81 + cornerBase3
// cornerBase3 = c0 + 3 c1 + 9 c2 + 27 c3, each ci in {0,1,2}. Only even center perms are
// reachable, so half of the 58,320 indices are an unused (odd-perm) component — harmless.
const N_CORNER = 81;
const N_CENTER = 720;
const N_INDEX = N_CENTER * N_CORNER; // 58,320
const SOLVED_IDX = 0;

const FACT = [1, 1, 2, 6, 24, 120, 720];

function permRank(p: number[]): number {
  let r = 0;
  const n = p.length;
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

// ── move set ─────────────────────────────────────────────────────────────────
// 8 moves: for axis m, index 2m = bare letter (base applied twice), 2m+1 = primed (base once).
// inverse(mi) = mi ^ 1 (bare and primed of the same axis are true inverses: 2+1 = 3 turns = id).
interface IvyMove { axis: number; times: number; name: string; }
const MOVES: ReadonlyArray<IvyMove> = Array.from({ length: 8 }, (_, mi) => {
  const axis = mi >> 1;
  const primed = (mi & 1) === 1;
  return { axis, times: primed ? 1 : 2, name: AXIS_LETTER[axis] + (primed ? "'" : '') };
});
const MOVE_BY_NAME = new Map<string, number>(MOVES.map((m, i) => [m.name, i]));

/** Apply axis `m`'s base 3-cycle to the center array in place (content a→b→c→a). */
function acycleCenters(c: number[], m: number): void {
  const [a, b, d] = MOVE_CENTERS[m];
  const va = c[a], vb = c[b], vd = c[d];
  c[b] = va;
  c[d] = vb;
  c[a] = vd;
}

// ── precomputed graph (built once) ───────────────────────────────────────────
// The center permutation and the corner orientations transform independently, so the
// move is factored into two small lookup tables (8×720 centers, 8×81 corners) instead
// of one 8×58,320 table — first-solve graph build is then a few ms.
interface IvyGraph {
  centerTrans: Int32Array[]; // centerTrans[mi][centerRank] = new centerRank
  cornerTrans: Int32Array[]; // cornerTrans[mi][corner] = new corner
  toSolved: Int8Array;       // move index stepping idx toward solved, -1 if unreached
  dist: Int8Array;           // optimal distance to solved, -1 if unreached
}
let GRAPH: IvyGraph | null = null;

const CORNER_PLACE = [1, 3, 9, 27];

function nextIdx(g: IvyGraph, idx: number, mi: number): number {
  return g.centerTrans[mi][Math.floor(idx / N_CORNER)] * N_CORNER + g.cornerTrans[mi][idx % N_CORNER];
}

function buildGraph(): IvyGraph {
  const centerTrans: Int32Array[] = [];
  const cornerTrans: Int32Array[] = [];
  for (let mi = 0; mi < 8; mi++) {
    const { axis, times } = MOVES[mi];
    const ct = new Int32Array(N_CENTER);
    for (let cr = 0; cr < N_CENTER; cr++) {
      const c = permUnrank(cr, 6);
      for (let t = 0; t < times; t++) acycleCenters(c, axis);
      ct[cr] = permRank(c);
    }
    centerTrans.push(ct);
    const place = CORNER_PLACE[axis];
    const kt = new Int32Array(N_CORNER);
    for (let co = 0; co < N_CORNER; co++) {
      const cur = Math.floor(co / place) % 3;
      kt[co] = co + (((cur + times) % 3) - cur) * place;
    }
    cornerTrans.push(kt);
  }

  const toSolved = new Int8Array(N_INDEX).fill(-1);
  const dist = new Int8Array(N_INDEX).fill(-1);
  const g: IvyGraph = { centerTrans, cornerTrans, toSolved, dist };
  dist[SOLVED_IDX] = 0;
  let frontier = [SOLVED_IDX];
  let d = 0;
  while (frontier.length) {
    const next: number[] = [];
    for (const u of frontier) {
      for (let mi = 0; mi < 8; mi++) {
        const v = nextIdx(g, u, mi);
        if (dist[v] === -1) {
          dist[v] = d + 1;
          toSolved[v] = mi ^ 1; // v --inverse(mi)--> u (toward solved)
          next.push(v);
        }
      }
    }
    frontier = next;
    d++;
  }
  return g;
}

function graph(): IvyGraph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ───────────────────────────────────────────────────────────────
const TOKEN_RE = /^([RLDB])('?)$/i;

/** Parse a scramble into move indices. Throws Error('bad: <tok>') on an invalid token. */
export function parseIvyScramble(scramble: string): number[] {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = TOKEN_RE.exec(tok);
    if (!m) throw new Error(`bad: ${tok}`);
    const name = m[1].toUpperCase() + (m[2] ? "'" : '');
    out.push(MOVE_BY_NAME.get(name)!);
  }
  return out;
}

/** Apply a scramble to the solved cube and return its state index. */
export function ivyScrambleToIndex(scramble: string): number {
  const g = graph();
  let idx = SOLVED_IDX;
  for (const mi of parseIvyScramble(scramble)) idx = nextIdx(g, idx, mi);
  return idx;
}

export interface IvySolution {
  /** Optimal solution as space-separated R/L/D/B (with '); empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/** Optimally solve an Ivy scramble. Throws on an invalid token. */
export function solveIvy(scramble: string): IvySolution {
  const g = graph();
  let idx = ivyScrambleToIndex(scramble);
  const names: string[] = [];
  let guard = 0;
  while (idx !== SOLVED_IDX) {
    const mi = g.toSolved[idx];
    if (mi < 0 || guard++ > IVY_GODS_NUMBER) throw new Error('unsolvable');
    names.push(MOVES[mi].name);
    idx = nextIdx(g, idx, mi);
  }
  return { solution: names.join(' '), length: names.length };
}

export interface IvyState {
  /** centers[face] = home-color id (0..5 = U R F B L D) currently sitting at that face. */
  centers: number[];
  /** corners[axis] = orientation 0..2 of turning corner axis (R L D B = 0..3). */
  corners: number[];
}

/** Apply a scramble to the solved cube, returning the raw (centers, corners) state for rendering. */
export function ivyApply(scramble: string): IvyState {
  const centers = [0, 1, 2, 3, 4, 5];
  const corners = [0, 0, 0, 0];
  for (const mi of parseIvyScramble(scramble)) {
    const { axis, times } = MOVES[mi];
    for (let t = 0; t < times; t++) acycleCenters(centers, axis);
    corners[axis] = (corners[axis] + times) % 3;
  }
  return { centers, corners };
}

/** Shortest scramble producing state `idx` = inverse of its optimal solution (reverse + invert). */
function indexToScramble(g: IvyGraph, idx: number): string {
  const sol: number[] = [];
  let cur = idx;
  let guard = 0;
  while (cur !== SOLVED_IDX) {
    const mi = g.toSolved[cur];
    if (mi < 0 || guard++ > IVY_GODS_NUMBER) break;
    sol.push(mi);
    cur = nextIdx(g, cur, mi);
  }
  return sol.reverse().map((mi) => MOVES[mi ^ 1].name).join(' ');
}

/**
 * Generate up to `perBin` example scrambles for each optimal length, by enumerating states at
 * each BFS depth and inverting their optimal solution (so a depth-d state yields a length-d
 * scramble). Deterministic spread sampling — no competition corpus needed, the whole state
 * space is enumerable. Returns { depth: [scramble, …] } for depths 1..8.
 */
export function ivyExamplesByLength(perBin = 12): Record<number, string[]> {
  const g = graph();
  const byDepth: number[][] = [];
  for (let i = 0; i < g.dist.length; i++) {
    const d = g.dist[i];
    if (d <= 0) continue;
    (byDepth[d] ??= []).push(i);
  }
  const out: Record<number, string[]> = {};
  byDepth.forEach((idxs, d) => {
    if (!idxs?.length) return;
    const step = Math.max(1, Math.floor(idxs.length / perBin));
    const picks: string[] = [];
    for (let k = 0; k < idxs.length && picks.length < perBin; k += step) {
      picks.push(indexToScramble(g, idxs[k]));
    }
    out[d] = picks;
  });
  return out;
}

/**
 * Every non-trivial state's shortest scramble, grouped by optimal length (depths 1..8).
 * The full state space is enumerable, so this is the complete corpus (29,159 states; the
 * 29,160th is the identity/solved). Used for the "download all states" buttons.
 */
export function ivyAllScramblesByLength(): Record<number, string[]> {
  return ivyExamplesByLength(Infinity);
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function ivyGraphStats(): { total: number; histogram: number[] } {
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
