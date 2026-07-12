/*
 * cube222-metric — self-contained 2×2×2 move-count metrics + random-state scramble generation for the timer's
 * "按步数生成 / generate by move count" mode. Home-grown, no shipped tables, no worker.
 *
 * MODEL (identical to scripts/build_2x2_essential.mjs, validated against stats/scramble/2x2_essential.json):
 * 8 corners URF0 UFL1 ULB2 UBR3 DFR4 DLF5 DBL6 DRB7; DBL(6) fixed at slot 6 orientation 0 (gauge). The 7 free
 * corners give 7!·3⁶ = 3,674,160 states. Moves are the 3 faces not touching DBL — U, R, F (each ×1/2/3 = HTM).
 *
 * METRICS (all HTM, one corner fixed, 3 faces — the standard 2×2 convention):
 *   'face'  底面步数  = color-neutral first-face solve distance (make ANY one face solid), 0..5  ← default
 *   'layer' 首层步数  = color-neutral first-layer solve distance (a fully solved 2×2 layer), 0..7
 *   'htm'   整解 HTM  = full-solve optimal length, 0..11
 *   'qtm'   整解 QTM  = full-solve optimal length in quarter turns, 0..14
 *
 * GENERATION: sample a UNIFORM random state (random permutation + valid orientation), evaluate the chosen metric,
 * accept iff in the requested [lo,hi]; on accept, emit a WCA-style scramble = inverse of an HTM-optimal solution of
 * that state (exactly the WCA random-state approach). Rejection is on uniform states so the accepted distribution is
 * exactly the true full-space conditional distribution — NOT the deduped case library. Face/layer distances are tiny
 * depth-limited searches; htm/qtm use IDA* with orientation+permutation pruning tables (both built once, lazily).
 */

// ── corner model ────────────────────────────────────────────────────────────────────────────────
type Move = { p: number[]; o: number[] };
const Q: Record<'U' | 'R' | 'F', Move> = {
  U: { p: [3, 0, 1, 2, 4, 5, 6, 7], o: [0, 0, 0, 0, 0, 0, 0, 0] },
  R: { p: [4, 1, 2, 0, 7, 5, 6, 3], o: [2, 0, 0, 1, 1, 0, 0, 2] },
  F: { p: [1, 5, 2, 3, 0, 4, 6, 7], o: [1, 2, 0, 0, 2, 1, 0, 0] },
};
function compose(a: Move, b: Move): Move {
  const p = new Array(8), o = new Array(8);
  for (let i = 0; i < 8; i++) { p[i] = a.p[b.p[i]]; o[i] = (a.o[b.p[i]] + b.o[i]) % 3; }
  return { p, o };
}
function powMove(m: Move, n: number): Move {
  let r: Move = { p: [0, 1, 2, 3, 4, 5, 6, 7], o: [0, 0, 0, 0, 0, 0, 0, 0] };
  for (let k = 0; k < n; k++) r = compose(r, m);
  return r;
}
// 9 HTM moves in a fixed order; names for scramble strings; axis (face index) for consecutive-face pruning.
const HTM_NAMES: string[] = [];
const HTM: Move[] = [];
const HTM_FACE: number[] = [];
(['U', 'R', 'F'] as const).forEach((f, fi) => {
  [1, 2, 3].forEach((n) => { HTM.push(powMove(Q[f], n)); HTM_NAMES.push(f + (n === 1 ? '' : n === 2 ? '2' : "'")); HTM_FACE.push(fi); });
});
// QTM cost of each HTM move: quarter turn (U/U'/…) = 1, half turn (U2/…) = 2.
const HTM_QCOST = HTM_NAMES.map((n) => (n.endsWith('2') ? 2 : 1));

type State = { cp: Int8Array; co: Int8Array };
function solvedState(): State { return { cp: Int8Array.from([0, 1, 2, 3, 4, 5, 6, 7]), co: new Int8Array(8) }; }
function applyMove(s: State, m: Move): State {
  const cp = new Int8Array(8), co = new Int8Array(8);
  for (let i = 0; i < 8; i++) { cp[i] = s.cp[m.p[i]]; co[i] = (s.co[m.p[i]] + m.o[i]) % 3; }
  return { cp, co };
}

// ── perfect-hash coords ───────────────────────────────────────────────────────────────────────────
const FREE = [0, 1, 2, 3, 4, 5, 7];
const PMAP = new Int8Array(8); { let k = 0; for (const p of FREE) PMAP[p] = k++; }
const FACT = [1, 1, 2, 6, 24, 120, 720];
function permRank(cp: Int8Array): number {
  const a = new Int8Array(7);
  for (let i = 0; i < 7; i++) a[i] = PMAP[cp[FREE[i]]];
  let r = 0;
  for (let i = 0; i < 7; i++) { let s = a[i]; for (let j = 0; j < i; j++) if (a[j] < a[i]) s--; r += s * FACT[6 - i]; }
  return r; // 0..5039
}
function oriRank(co: Int8Array): number {
  let r = 0; for (let i = 0; i < 6; i++) r = r * 3 + co[FREE[i]]; return r; // 0..728
}
function isSolved(s: State): boolean {
  for (let i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  return true;
}

// ── color model (validated: showColor uses (j - co), SIGN = -1) ──────────────────────────────────
// faces U0 D1 F2 B3 R4 L5; corner sticker colors in solved facelet order.
const CC = [
  [0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],
  [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3],
];
const FACE_SLOTS: number[][] = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 4, 5], [2, 3, 6, 7], [0, 3, 4, 7], [1, 2, 5, 6]];
// layer adjacency: per face, 4 [slotA, slotB, sharedFace] pairs that must agree for a solved layer.
const ADJ: number[][][] = [
  [[0, 1, 2], [1, 2, 5], [2, 3, 3], [3, 0, 4]],
  [[4, 5, 2], [5, 6, 5], [6, 7, 3], [7, 4, 4]],
  [[0, 1, 0], [1, 5, 5], [5, 4, 1], [4, 0, 4]],
  [[2, 3, 0], [3, 7, 4], [7, 6, 1], [6, 2, 5]],
  [[0, 3, 0], [3, 7, 3], [7, 4, 1], [4, 0, 2]],
  [[1, 2, 0], [2, 6, 3], [6, 5, 1], [5, 1, 2]],
];
function showColor(s: State, slot: number, face: number): number {
  const j = CC[slot].indexOf(face);
  return CC[s.cp[slot]][(((j - s.co[slot]) % 3) + 3) % 3];
}
function anyFaceSolid(s: State): boolean {
  for (let f = 0; f < 6; f++) {
    const sl = FACE_SLOTS[f]; const c = showColor(s, sl[0], f);
    if (showColor(s, sl[1], f) === c && showColor(s, sl[2], f) === c && showColor(s, sl[3], f) === c) return true;
  }
  return false;
}
function anyLayerSolved(s: State): boolean {
  for (let f = 0; f < 6; f++) {
    const sl = FACE_SLOTS[f]; const c = showColor(s, sl[0], f);
    if (!(showColor(s, sl[1], f) === c && showColor(s, sl[2], f) === c && showColor(s, sl[3], f) === c)) continue;
    let ok = true;
    for (const [a, b, sf] of ADJ[f]) if (showColor(s, a, sf) !== showColor(s, b, sf)) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

// ── pruning tables for full-solve IDA* (orientation 729, permutation 5040) ───────────────────────
let PRUNE_ORI: Uint8Array | null = null;
let PRUNE_PERM: Uint8Array | null = null;
function buildPruneTables(): void {
  if (PRUNE_ORI && PRUNE_PERM) return;
  // orientation coord graph: 729 nodes, edges = the 9 HTM moves acting on the orientation vector only.
  PRUNE_ORI = new Uint8Array(729).fill(255);
  {
    const start = solvedState();
    PRUNE_ORI[oriRank(start.co)] = 0;
    let frontier: State[] = [start]; let d = 0;
    while (frontier.length) {
      const next: State[] = [];
      for (const s of frontier) for (const m of HTM) {
        const o = applyMove(s, m); const r = oriRank(o.co);
        if (PRUNE_ORI[r] === 255) { PRUNE_ORI[r] = d + 1; next.push(o); }
      }
      frontier = next; d++;
    }
  }
  // permutation coord graph: 5040 nodes.
  PRUNE_PERM = new Uint8Array(5040).fill(255);
  {
    const start = solvedState();
    PRUNE_PERM[permRank(start.cp)] = 0;
    let frontier: State[] = [start]; let d = 0;
    while (frontier.length) {
      const next: State[] = [];
      for (const s of frontier) for (const m of HTM) {
        const o = applyMove(s, m); const r = permRank(o.cp);
        if (PRUNE_PERM[r] === 255) { PRUNE_PERM[r] = d + 1; next.push(o); }
      }
      frontier = next; d++;
    }
  }
}
function hFull(s: State): number {
  return Math.max(PRUNE_ORI![oriRank(s.co)], PRUNE_PERM![permRank(s.cp)]);
}

// ── solvers (IDA*) ──────────────────────────────────────────────────────────────────────────────
/** HTM-optimal solution (list of HTM move indices) of state s. Empty if solved. */
function solveHTM(s: State): number[] {
  buildPruneTables();
  if (isSolved(s)) return [];
  const path: number[] = [];
  for (let bound = hFull(s); bound <= 11; bound++) {
    if (dfsHTM(s, bound, -1, path)) return path;
    path.length = 0;
  }
  return path; // unreachable for valid states
}
function dfsHTM(s: State, bound: number, lastFace: number, path: number[]): boolean {
  const h = hFull(s);
  if (h === 0) return isSolved(s);
  if (path.length + h > bound) return false;
  for (let mi = 0; mi < 9; mi++) {
    if (HTM_FACE[mi] === lastFace) continue; // no two consecutive moves on the same face
    const ns = applyMove(s, HTM[mi]);
    path.push(mi);
    if (dfsHTM(ns, bound, HTM_FACE[mi], path)) return true;
    path.pop();
  }
  return false;
}

/** QTM-optimal solution length of state s (quarter-turn metric). Searches the 9 HTM moves with QTM cost, so a half
 *  turn (cost 2) and "U then U" (two quarters) are both reachable; hFull (HTM count ≤ QTM cost) is admissible. */
function distQTM(s: State): number {
  buildPruneTables();
  if (isSolved(s)) return 0;
  for (let bound = hFull(s); bound <= 14; bound++) {
    if (dfsQTM(s, bound, -1, 0)) return bound;
  }
  return 14;
}
function dfsQTM(s: State, bound: number, lastFace: number, cost: number): boolean {
  const h = hFull(s); // HTM lower bound ≤ remaining QTM cost → admissible
  // cost prune MUST precede the solved check: a half turn (cost +2) can reach solved at cost = bound+1.
  if (cost + h > bound) return false;
  if (h === 0) return isSolved(s);
  for (let mi = 0; mi < 9; mi++) {
    if (HTM_FACE[mi] === lastFace) continue; // consecutive same-face HTM moves are redundant (valid for QTM cost too)
    if (dfsQTM(applyMove(s, HTM[mi]), bound, HTM_FACE[mi], cost + HTM_QCOST[mi])) return true;
  }
  return false;
}

/** Color-neutral distance to a sub-goal predicate via iterative-deepening DFS (max 8). */
function subgoalDist(s: State, goal: (x: State) => boolean, cap: number): number {
  if (goal(s)) return 0;
  for (let bound = 1; bound <= cap; bound++) {
    if (dfsGoal(s, bound, -1, 0, goal)) return bound;
  }
  return cap;
}
function dfsGoal(s: State, bound: number, lastFace: number, depth: number, goal: (x: State) => boolean): boolean {
  if (depth === bound) return goal(s);
  // prune: cannot reach a solved face/layer with fewer remaining moves than pieces out of place — cheap check omitted;
  // depth ≤ 5/7 keeps the tree small even without a heuristic.
  for (let mi = 0; mi < 9; mi++) {
    if (HTM_FACE[mi] === lastFace) continue;
    if (dfsGoal(applyMove(s, HTM[mi]), bound, HTM_FACE[mi], depth + 1, goal)) return true;
  }
  return false;
}

// ── metrics ─────────────────────────────────────────────────────────────────────────────────────
export type Cube222Metric = 'face' | 'layer' | 'htm' | 'qtm';
export const CUBE222_METRIC_RANGE: Record<Cube222Metric, [number, number]> = {
  face: [0, 5],
  layer: [0, 7],
  htm: [0, 11],
  qtm: [0, 14],
};
function metricOf(s: State, metric: Cube222Metric): number {
  switch (metric) {
    case 'face': return subgoalDist(s, anyFaceSolid, 5);
    case 'layer': return subgoalDist(s, anyLayerSolved, 7);
    case 'htm': return solveHTM(s).length;
    case 'qtm': return distQTM(s);
  }
}

// ── uniform random state + scramble string ───────────────────────────────────────────────────────
function randomState(rng: () => number): State {
  // random permutation of the 7 free pieces over the 7 free slots (Fisher–Yates), DBL(6) fixed.
  const pieces = [0, 1, 2, 3, 4, 5, 7];
  for (let i = pieces.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
  const cp = new Int8Array(8); cp[6] = 6;
  for (let i = 0; i < 7; i++) cp[FREE[i]] = pieces[i];
  // random orientation: 6 free oris uniform, 7th forced so total twist ≡ 0 mod 3.
  const co = new Int8Array(8); let sum = 0;
  for (let i = 0; i < 6; i++) { const t = Math.floor(rng() * 3); co[FREE[i]] = t; sum += t; }
  co[6] = 0; co[7] = ((3 - (sum % 3)) % 3);
  return { cp, co };
}
function scrambleFor(s: State): string {
  // scramble = inverse of an HTM-optimal solution → a WCA-style move sequence reaching state s.
  const sol = solveHTM(s);
  if (sol.length === 0) return '';
  const inv: string[] = [];
  for (let i = sol.length - 1; i >= 0; i--) {
    const name = HTM_NAMES[sol[i]]; // U / U2 / U'
    inv.push(name.endsWith('2') ? name : name.endsWith("'") ? name.slice(0, -1) : `${name}'`);
  }
  return inv.join(' ');
}

/**
 * Generate a WCA-style 2×2 scramble whose chosen metric value lies in [lo, hi], sampled uniformly from the full
 * 3,674,160-state space (rejection sampling on uniform states). Returns a fallback (nearest accepted, or a plain
 * random state) if no in-range state is found within `maxTries` — never throws, never blocks indefinitely.
 */
export function generate222ByMetric(
  metric: Cube222Metric,
  lo: number,
  hi: number,
  rng: () => number,
  maxTries = 20000,
): string {
  let best: { s: State; d: number } | null = null;
  for (let t = 0; t < maxTries; t++) {
    const s = randomState(rng);
    const d = metricOf(s, metric);
    if (d >= lo && d <= hi) return scrambleFor(s);
    // track nearest-to-range as a graceful fallback
    const dist = d < lo ? lo - d : d - hi;
    if (!best || dist < best.d) best = { s, d: dist };
  }
  return best ? scrambleFor(best.s) : scrambleFor(randomState(rng));
}

/** Apply a scramble string (U/R/F tokens, the only faces WCA 2×2 scrambles use) to solved. Returns null if
 *  a token isn't on the U/R/F gauge (can't be measured in this fixed-DBL model — never happens for WCA 2×2). */
function stateFromScramble(scramble: string): State | null {
  let s = solvedState();
  for (const tok of scramble.trim().split(/\s+/).filter(Boolean)) {
    const f = tok[0];
    if (f !== 'U' && f !== 'R' && f !== 'F') return null;
    const n = tok.length === 1 ? 1 : tok[1] === '2' ? 2 : 3;
    for (let i = 0; i < n; i++) s = applyMove(s, Q[f as 'U' | 'R' | 'F']);
  }
  return s;
}

/** The chosen metric's value for a 2×2 scramble string, or null if it isn't a U/R/F-only 2×2 scramble. */
export function cube222MetricOfScramble(scramble: string, metric: Cube222Metric): number | null {
  const s = stateFromScramble(scramble);
  return s ? metricOf(s, metric) : null;
}

// ── offline batch evaluator (stats pipeline / node scripts ONLY) ─────────────────────────────────
// Builds full-space BFS distance tables over all 3,674,160 states (a few seconds, ~15MB), then every
// scramble is an O(1) lookup — used by scripts/build_puzzle_metrics.mts to precompute the WCA corpus
// (440k scrambles in seconds vs hours of per-scramble IDA*). NEVER call from browser code: the
// per-sample IDA* path above is the UI path precisely because it needs no table build.
export interface Cube222Metrics { face: number; layer: number; htm: number; qtm: number }

/** Inverse of permRank (Lehmer decode over the 7 free pieces; DBL stays at slot 6). */
function unrankPerm(r: number): Int8Array {
  const cp = new Int8Array(8); cp[6] = 6;
  const avail = [0, 1, 2, 3, 4, 5, 6];
  for (let i = 0; i < 7; i++) {
    const f = FACT[6 - i];
    const s = Math.floor(r / f); r %= f;
    cp[FREE[i]] = FREE[avail[s]];
    avail.splice(s, 1);
  }
  return cp;
}
/** Inverse of oriRank; co[7] is forced by total-twist ≡ 0 (mod 3), which all valid states satisfy. */
function unrankOri(r: number): Int8Array {
  const co = new Int8Array(8);
  let sum = 0;
  for (let i = 5; i >= 0; i--) { const t = r % 3; r = (r - t) / 3; co[FREE[i]] = t; sum += t; }
  co[7] = (3 - (sum % 3)) % 3;
  return co;
}

export function create222MetricEvaluator(): (scramble: string) => Cube222Metrics | null {
  const N = 5040 * 729; // 3,674,160
  // perm and ori coordinates evolve independently under a fixed move (cp'[i]=cp[m.p[i]],
  // co'[i]=co[m.p[i]]+m.o[i]), so full-state transitions factor into two small move tables.
  const permMove = new Int16Array(5040 * 9);
  for (let p = 0; p < 5040; p++) {
    const s: State = { cp: unrankPerm(p), co: new Int8Array(8) };
    for (let m = 0; m < 9; m++) permMove[p * 9 + m] = permRank(applyMove(s, HTM[m]).cp);
  }
  const oriMove = new Int16Array(729 * 9);
  for (let o = 0; o < 729; o++) {
    const s: State = { cp: Int8Array.from([0, 1, 2, 3, 4, 5, 6, 7]), co: unrankOri(o) };
    for (let m = 0; m < 9; m++) oriMove[o * 9 + m] = oriRank(applyMove(s, HTM[m]).co);
  }
  // BFS from a seed set (dist 0 pre-marked, 255 elsewhere) over a move subset. The move set is
  // inverse-closed, so distance FROM the seed set equals min moves INTO it (= subgoalDist/solveHTM).
  const bfs = (dist: Uint8Array, moves: number[]): void => {
    const queue = new Int32Array(N);
    let head = 0, tail = 0;
    for (let i = 0; i < N; i++) if (dist[i] === 0) queue[tail++] = i;
    while (head < tail) {
      const idx = queue[head++];
      const d = dist[idx] + 1;
      const p = (idx / 729) | 0, o = idx - p * 729;
      for (const m of moves) {
        const n = permMove[p * 9 + m] * 729 + oriMove[o * 9 + m];
        if (dist[n] === 255) { dist[n] = d; queue[tail++] = n; }
      }
    }
  };
  // seed face/layer with every state already satisfying the (color-neutral) predicate
  const faceDist = new Uint8Array(N).fill(255);
  const layerDist = new Uint8Array(N).fill(255);
  const cos: Int8Array[] = [];
  for (let o = 0; o < 729; o++) cos.push(unrankOri(o));
  const st: State = { cp: new Int8Array(8), co: new Int8Array(8) };
  for (let p = 0; p < 5040; p++) {
    st.cp = unrankPerm(p);
    const base = p * 729;
    for (let o = 0; o < 729; o++) {
      st.co = cos[o];
      if (anyFaceSolid(st)) faceDist[base + o] = 0;
      if (anyLayerSolved(st)) layerDist[base + o] = 0;
    }
  }
  const htmDist = new Uint8Array(N).fill(255);
  const qtmDist = new Uint8Array(N).fill(255);
  htmDist[0] = 0; qtmDist[0] = 0; // solved ranks to index 0
  const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  // QTM distance = plain BFS over the 6 quarter turns: U2 = U·U (cost 2), and merging consecutive
  // same-face quarters never lengthens a word — identical to distQTM's HTM-move + QTM-cost search.
  const QUARTER = ALL.filter((m) => HTM_QCOST[m] === 1);
  bfs(faceDist, ALL);
  bfs(layerDist, ALL);
  bfs(htmDist, ALL);
  bfs(qtmDist, QUARTER);
  return (scramble: string): Cube222Metrics | null => {
    const s = stateFromScramble(scramble);
    if (!s) return null;
    const idx = permRank(s.cp) * 729 + oriRank(s.co);
    return { face: faceDist[idx], layer: layerDist[idx], htm: htmDist[idx], qtm: qtmDist[idx] };
  };
}

// ── test/diagnostic exports (used by tests to verify metrics against the essential-case oracle) ──
export const _test = {
  solvedState, applyMove, randomState, metricOf,
  bottomFaceDist: (s: State) => subgoalDist(s, anyFaceSolid, 5),
  firstLayerDist: (s: State) => subgoalDist(s, anyLayerSolved, 7),
  solveHTMLen: (s: State) => solveHTM(s).length,
  distQTM,
  /** apply a U/R/F scramble string to solved, return the resulting state. */
  applyScramble: (alg: string): State => {
    let s = solvedState();
    for (const tok of alg.trim().split(/\s+/).filter(Boolean)) {
      const f = tok[0] as 'U' | 'R' | 'F';
      const n = tok.length === 1 ? 1 : tok[1] === '2' ? 2 : 3;
      for (let i = 0; i < n; i++) s = applyMove(s, Q[f]);
    }
    return s;
  },
  isSolved,
};
