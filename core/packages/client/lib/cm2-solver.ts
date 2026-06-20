/*
 * Cmetrick Mini (Cmetrick Mini / cm2) optimal solver — pure TS, no worker, no tables to download.
 *
 * The Cmetrick Mini is a 2×2 grid of 4 balls (0 = top-left, 1 = top-right, 2 = bottom-left,
 * 3 = bottom-right). Each ball is a sphere showing 6 colors like the faces of a cube → each ball's
 * state is an element of the cube rotation group (order 24). Synchronized gears couple a whole row or
 * column: a row move rolls both balls in that row 90° about the vertical (Y) axis; a column move rolls
 * both balls in that column 90° about the horizontal (X) axis. Solved = all 4 balls in the identity
 * orientation.
 *
 * Move model derived from cstimer `scramble/megascramble.js:29`
 *   `"cm2": [[[["U<","U>","U2"],["D<","D>","D2"]],[["R^","Rv","R2"],["L^","Lv","L2"]]]]`
 *   driven by `mega(value[0], [""], length)`.
 * → token alphabet is EXACTLY 12 tokens: U< U> U2 D< D> D2 R^ Rv R2 L^ Lv L2 (suffix is "").
 *   - axis 0 = ROWS: U = top row (balls 0,1), D = bottom row (balls 2,3); `<` = +90° about Y,
 *     `>` = −90° about Y (inverse of `<`), `2` = 180° about Y (self-inverse).
 *   - axis 1 = COLUMNS: R = right col (balls 1,3), L = left col (balls 0,2); `^` = +90° about X,
 *     `v` = −90° about X (inverse of `^`), `2` = 180° about X (self-inverse).
 *
 * Although a single ball has 24 orientations (24^4 = 331,776 naive states), the synchronized gears
 * impose a parity restriction → exactly **165,888 = 24^4 / 2** reachable states. We BFS the whole graph
 * from solved once (memoized) and store, for every reachable state, the move stepping it toward solved —
 * so every solve is an optimal shortest path. In cstimer's metric (a `2` token counts as ONE move) God's
 * number is 10, mean 7.32576. (In pure quarter-turn metric the figure is 9 per jaapsch.net; cstimer's
 * face-turn-style metric with `2` moves gives the smaller 10-vs-QTM figure shown here.) The reachable
 * count + histogram are independently reproduced by a from-scratch 3D-geometry BFS in
 * tests/cm2_solver.test.ts.
 */

// ── Cube rotation group (order 24) built from 3×3 rotation matrices ─────────────
// Face-axis directions, index 0..5 = +X, −X, +Y, −Y, +Z, −Z.
type Vec3 = readonly [number, number, number];
type Mat3 = readonly [Vec3, Vec3, Vec3];
const DIRS: ReadonlyArray<Vec3> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
function dirIndex(v: Vec3): number {
  for (let i = 0; i < 6; i++) {
    if (DIRS[i][0] === v[0] && DIRS[i][1] === v[1] && DIRS[i][2] === v[2]) return i;
  }
  throw new Error(`bad dir ${v}`);
}
function applyMat(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}
function matMul(a: Mat3, b: Mat3): Mat3 {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r as unknown as Mat3;
}
const I3: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// 90° right-handed rotations.
const RX: Mat3 = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
const RY: Mat3 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
const RZ: Mat3 = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];

// Enumerate the 24 rotation matrices = closure of {RX,RY,RZ} from I3.
const ROT_MATS: Mat3[] = [];
const MAT_IDX = new Map<string, number>();
{
  const key = (m: Mat3) => JSON.stringify(m);
  MAT_IDX.set(key(I3), 0); ROT_MATS.push(I3);
  let frontier: Mat3[] = [I3];
  while (frontier.length) {
    const next: Mat3[] = [];
    for (const m of frontier) {
      for (const g of [RX, RY, RZ]) {
        const m2 = matMul(g, m);
        const k = key(m2);
        if (!MAT_IDX.has(k)) { MAT_IDX.set(k, ROT_MATS.length); ROT_MATS.push(m2); next.push(m2); }
      }
    }
    frontier = next;
  }
}
const ROT_COUNT = ROT_MATS.length; // 24
const matIdx = (m: Mat3) => MAT_IDX.get(JSON.stringify(m))!;
const IDENT = matIdx(I3);

/** Composition table: MUL[g][o] = index of "apply orientation o, then rotate by g" = idx(G·O). */
const MUL: number[][] = ROT_MATS.map((G) => ROT_MATS.map((O) => matIdx(matMul(G, O))));

// Generators (as rotation-group indices).
const Y1 = matIdx(RY);
const Yinv = matIdx(matMul(RY, matMul(RY, RY)));
const Y2 = matIdx(matMul(RY, RY));
const X1 = matIdx(RX);
const Xinv = matIdx(matMul(RX, matMul(RX, RX)));
const X2 = matIdx(matMul(RX, RX));

// ── move table (the 12 cstimer tokens, face-turn metric) ───────────────────────
interface Cm2Move { name: string; balls: ReadonlyArray<number>; g: number; inverse: string; }
const MOVES: ReadonlyArray<Cm2Move> = [
  { name: 'U<', balls: [0, 1], g: Y1, inverse: 'U>' },
  { name: 'U>', balls: [0, 1], g: Yinv, inverse: 'U<' },
  { name: 'U2', balls: [0, 1], g: Y2, inverse: 'U2' },
  { name: 'D<', balls: [2, 3], g: Y1, inverse: 'D>' },
  { name: 'D>', balls: [2, 3], g: Yinv, inverse: 'D<' },
  { name: 'D2', balls: [2, 3], g: Y2, inverse: 'D2' },
  { name: 'R^', balls: [1, 3], g: X1, inverse: 'Rv' },
  { name: 'Rv', balls: [1, 3], g: Xinv, inverse: 'R^' },
  { name: 'R2', balls: [1, 3], g: X2, inverse: 'R2' },
  { name: 'L^', balls: [0, 2], g: X1, inverse: 'Lv' },
  { name: 'Lv', balls: [0, 2], g: Xinv, inverse: 'L^' },
  { name: 'L2', balls: [0, 2], g: X2, inverse: 'L2' },
];
const MOVE_BY_NAME = new Map<string, Cm2Move>(MOVES.map((mv) => [mv.name, mv]));

/** Valid scramble tokens (the exact cstimer cm2 alphabet). */
export const CM2_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);

/** Solved state: all 4 balls in the identity orientation. */
export const CM2_SOLVED: ReadonlyArray<number> = [IDENT, IDENT, IDENT, IDENT];

export const CM2_TOTAL_STATES = 165888; // = 24^4 / 2 (parity-restricted), confirmed by BFS
/** God's number in cstimer's face-turn metric (a `2` token = 1 move), proven by the full BFS below. */
export const CM2_GODS_NUMBER = 10;
/**
 * Optimal-solution-length distribution over all 165,888 reachable states (index = optimal move count).
 * Locked by tests; surfaced in the UI as flavor. Sum = 165,888, mean 7.32576.
 */
export const CM2_LENGTH_DISTRIBUTION: ReadonlyArray<number> = [
  1, 12, 86, 524, 2577, 9564, 26964, 49648, 47712, 23644, 5156,
];

// ── apply one move to a 4-ball state ───────────────────────────────────────────
function applyMove(cur: ReadonlyArray<number>, mv: Cm2Move): number[] {
  const next = cur.slice();
  for (const b of mv.balls) next[b] = MUL[mv.g][cur[b]];
  return next;
}

/** Canonical key for a state = the 4 ball-orientation indices joined. */
function keyOf(c: ReadonlyArray<number>): string {
  return c.join(',');
}

// ── precomputed graph (built once, memoized) ───────────────────────────────────
interface Cm2Graph {
  dist: Map<string, number>;       // optimal distance to solved
  toSolved: Map<string, string>;   // move name stepping a state toward solved
  states: string[];                // all reachable state keys in BFS order (index 0 = solved)
}
let GRAPH: Cm2Graph | null = null;

function buildGraph(): Cm2Graph {
  const dist = new Map<string, number>();
  const toSolved = new Map<string, string>();
  const states: string[] = [];
  const solvedKey = keyOf(CM2_SOLVED);
  dist.set(solvedKey, 0);
  states.push(solvedKey);
  let frontier: number[][] = [[...CM2_SOLVED]];
  let d = 0;
  while (frontier.length) {
    const next: number[][] = [];
    for (const u of frontier) {
      for (const mv of MOVES) {
        const v = applyMove(u, mv);
        const vk = keyOf(v);
        if (!dist.has(vk)) {
          dist.set(vk, d + 1);
          // applyMove(u, mv) = v ⇒ applyMove(v, mv.inverse) = u
          toSolved.set(vk, mv.inverse);
          states.push(vk);
          next.push(v);
        }
      }
    }
    frontier = next;
    d++;
  }
  return { dist, toSolved, states };
}

function graph(): Cm2Graph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ──────────────────────────────────────────────────────────────
const TOKEN_RE = /^(U<|U>|U2|D<|D>|D2|R\^|Rv|R2|L\^|Lv|L2)$/;

/** Parse a scramble into move names. Throws Error('bad: <tok>') on an invalid token. */
export function parseCm2Scramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(tok);
  }
  return out;
}

/** Apply a scramble to the solved puzzle and return its raw 4-ball state (for rendering / keys). */
export function cm2Apply(scramble: string): number[] {
  let c: number[] = [...CM2_SOLVED];
  for (const tok of parseCm2Scramble(scramble)) {
    c = applyMove(c, MOVE_BY_NAME.get(tok)!);
  }
  return c;
}

export interface Cm2Solution {
  /** Optimal solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/** Optimally solve a Cmetrick Mini scramble. Throws on an invalid token. */
export function solveCm2(scramble: string): Cm2Solution {
  const g = graph();
  let c = cm2Apply(scramble);
  const solvedKey = keyOf(CM2_SOLVED);
  const names: string[] = [];
  let guard = 0;
  while (keyOf(c) !== solvedKey) {
    const mv = g.toSolved.get(keyOf(c));
    if (mv === undefined || guard++ > CM2_GODS_NUMBER) throw new Error('unsolvable');
    names.push(mv);
    c = applyMove(c, MOVE_BY_NAME.get(mv)!);
  }
  return { solution: names.join(' '), length: names.length };
}

/** Shortest scramble producing state `key` = inverse of its optimal solution (reverse path). */
function keyToScramble(g: Cm2Graph, startKey: string): string {
  if (startKey === g.states[0]) return '';
  let key = startKey;
  const solvedKey = g.states[0];
  const toward: string[] = [];
  let guard = 0;
  while (key !== solvedKey) {
    const mv = g.toSolved.get(key);
    if (mv === undefined || guard++ > CM2_GODS_NUMBER) break;
    toward.push(mv);
    // step toward solved
    let c = key.split(',').map(Number);
    c = applyMove(c, MOVE_BY_NAME.get(mv)!);
    key = keyOf(c);
  }
  // scramble = inverse of the toward-solved path, reversed.
  return toward
    .reverse()
    .map((mv) => MOVE_BY_NAME.get(mv)!.inverse)
    .join(' ');
}

/**
 * Generate up to `perBin` example scrambles for each optimal length, by spread-sampling states at
 * each BFS depth and inverting their optimal solution (a depth-d state yields a length-d scramble).
 * Deterministic spread sampling — the whole state space is enumerable, no competition corpus needed.
 * Returns { depth: [scramble, …] } for depths 1..10.
 */
export function cm2ExamplesByLength(perBin = 12): Record<number, string[]> {
  const g = graph();
  const counts: number[] = [];
  for (const k of g.states) { const d = g.dist.get(k)!; if (d > 0) counts[d] = (counts[d] ?? 0) + 1; }
  const wantInf = !Number.isFinite(perBin);
  const step: number[] = [];
  counts.forEach((c, d) => { step[d] = wantInf ? 1 : Math.max(1, Math.floor(c / perBin)); });
  const seen: number[] = [];
  const out: Record<number, string[]> = {};
  for (const k of g.states) {
    const d = g.dist.get(k)!;
    if (d <= 0) continue;
    if (!wantInf && (out[d]?.length ?? 0) >= perBin) continue;
    const i = seen[d] = (seen[d] ?? 0) + 1;
    if (wantInf || (i - 1) % step[d] === 0) (out[d] ??= []).push(keyToScramble(g, k));
  }
  return out;
}

/**
 * Every reachable state's shortest scramble, grouped by optimal length (depths 1..10). The full state
 * space is enumerable (165,888 < 2M), so this is the complete corpus (165,887 non-trivial states; the
 * 165,888th is the identity/solved). Plain in-memory record — no streaming needed at this scale.
 */
export function cm2AllScramblesByLength(): Record<number, string[]> {
  return cm2ExamplesByLength(Infinity);
}

/**
 * Every reachable state as `{ depth, scramble }` in BFS order (depth 0 = solved/identity,
 * scramble = ''). Used by the "download all states" CSV; 165,888 rows fits comfortably in a plain Blob.
 */
export function cm2AllStates(): Array<{ depth: number; scramble: string }> {
  const g = graph();
  return g.states.map((k) => {
    const depth = g.dist.get(k)!;
    return { depth, scramble: depth === 0 ? '' : keyToScramble(g, k) };
  });
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function cm2GraphStats(): { total: number; histogram: number[] } {
  const g = graph();
  const histogram: number[] = [];
  let total = 0;
  for (const k of g.states) {
    const d = g.dist.get(k)!;
    total++;
    histogram[d] = (histogram[d] ?? 0) + 1;
  }
  return { total, histogram };
}

/** Exposed for the test's geometry cross-check (rotation count must be 24). */
export const CM2_ROTATION_COUNT = ROT_COUNT;
