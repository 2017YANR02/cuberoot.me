/*
 * Gear Cube (gear) optimal solver — pure TS, no worker, no tables to download.
 *
 * The Gear Cube IS a 3×3-ish cube, but its edge pieces are GEARS that rotate as the faces turn, so a
 * face turn drags neighbouring gear-edges around. Despite the 3×3 shell, the reachable state space is
 * tiny: it collapses to 4 corners + 3 axis-edge coordinates. We encode the state as the 4-int array
 * `[corner(0..23), e0(0..71), e1(0..71), e2(0..71)]` (cstimer's gearcube model); solved = `[0,0,0,0]`.
 *
 * Move model (cstimer `gearcube.js`): there are 3 axes — U=0, R=1, F=2 — and one axis has period 12
 * (12 base 120°-steps = identity). A scramble TOKEN applies `baseStep(axis)` exactly `(a+1)` times for
 * a∈0..10, i.e. powers 1..11. The 11 suffixes (index = a) are:
 *   ["'", "2'", "3'", "4'", "5'", "6", "5", "4", "3", "2", ""]
 * so `U'` = 1 step, `U6` = 6 steps, plain `U` = 11 steps (= U⁻¹). The full alphabet is exactly 33 tokens
 * = 3 axes × 11 powers, matching cstimer's `gearso` notation move-for-move (verified by a real-engine
 * round-trip oracle in tests/gear_solver.test.ts: 300/300 real scrambles round-trip to solved).
 *
 * baseStep mechanism (cstimer doMove + search loop): from precomputed move tables cmv (24 corner states ×
 * 3 axes) and emv (72 edge states × 3 axes), one base step is
 *   ns[0] = cmv[m][s0];  ns[i] = emv[(m+i-1)%3][s_i]  for i=1..3.
 *
 * The whole reachable graph is 41,472 states. We BFS it from solved once (memoized) over the 33 tokens
 * and store, for every reachable state, the inverse token stepping it toward solved — so every solve is a
 * true optimal shortest path. In the cstimer face-turn metric (each token = 1 move) God's number is 6,
 * mean 4.30317. The reachable count, histogram and move effects are all reproduced from scratch
 * (independent BFS + cstimer round-trip oracle) in tests/gear_solver.test.ts.
 */

// ── cstimer gearcube move tables (cmv: 24×3 corner, emv: 72×3 edge) ──────────────
// Rebuilt verbatim from gearcube.js (acycle / setNPerm / getNPerm / cornerMove / edgeMove).
function acycle(arr: number[], perm: ReadonlyArray<number>): void {
  const plen = perm.length;
  const tmp: number[] = [];
  for (let i = 0; i < plen; i++) tmp[i] = arr[perm[i]];
  for (let i = 0; i < plen; i++) { const j = (i + 1) % plen; arr[perm[j]] = tmp[i]; }
}
function fact(n: number): number { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function setNPerm(arr: number[], idx: number, n: number): number[] {
  let vall = 0x76543210, valh = 0xfedcba98;
  for (let i = 0; i < n - 1; i++) {
    const p = fact(n - 1 - i); let v = Math.floor(idx / p); idx %= p; v <<= 2;
    if (v >= 32) { v -= 32; arr[i] = (valh >> v) & 0xf; const m = (1 << v) - 1; valh = (valh & m) + ((valh >> 4) & ~m); }
    else { arr[i] = (vall >> v) & 0xf; const m = (1 << v) - 1; vall = (vall & m) + ((vall >>> 4) & ~m) + (valh << 28); valh >>= 4; }
  }
  arr[n - 1] = vall & 0xf;
  return arr;
}
function getNPerm(arr: ReadonlyArray<number>, n: number): number {
  let idx = 0, vall = 0x76543210, valh = 0xfedcba98;
  for (let i = 0; i < n - 1; i++) {
    const v = arr[i] << 2; idx *= n - i;
    if (v >= 32) { idx += (valh >> (v - 32)) & 0xf; valh -= 0x11111110 << (v - 32); }
    else { idx += (vall >> v) & 0xf; valh -= 0x11111111; vall -= 0x11111110 << v; }
  }
  return idx;
}
const MOVE_EDGES: ReadonlyArray<ReadonlyArray<number>> = [[0, 3, 2, 1], [0, 1], [0, 3]];
function cornerMoveOne(arr: number[], m: number): void { acycle(arr, [0, m + 1]); }
function edgeMoveOne(idx: number, m: number): number {
  const arr = setNPerm([], Math.floor(idx / 3), 4);
  acycle(arr, MOVE_EDGES[m]);
  return getNPerm(arr, 4) * 3 + ((idx % 3) + (m === 0 ? 1 : 0)) % 3;
}
function buildCmv(): number[][] {
  const cmv: number[][] = [[], [], []];
  for (let m = 0; m < 3; m++) for (let s = 0; s < 24; s++) { const a = setNPerm([], s, 4); cornerMoveOne(a, m); cmv[m][s] = getNPerm(a, 4); }
  return cmv;
}
function buildEmv(): number[][] {
  const emv: number[][] = [[], [], []];
  for (let m = 0; m < 3; m++) for (let s = 0; s < 72; s++) emv[m][s] = edgeMoveOne(s, m);
  return emv;
}
const CMV = buildCmv();
const EMV = buildEmv();

/** Apply ONE 120° gear step of axis `m` to a 4-int state (cstimer doMove convention). */
function baseStep(state: ReadonlyArray<number>, m: number): number[] {
  const ns = state.slice();
  ns[0] = CMV[m][ns[0]];
  for (let i = 1; i < 4; i++) ns[i] = EMV[(m + i - 1) % 3][ns[i]];
  return ns;
}

// ── token model (the 33 axis-power tokens) ───────────────────────────────────────
const AXES = ['U', 'R', 'F'] as const;
const AXIS_IDX: Record<string, number> = { U: 0, R: 1, F: 2 };
// suffix index a (0..10) → token applies baseStep (a+1) times (powers 1..11).
const SUFFIX: ReadonlyArray<string> = ["'", "2'", "3'", "4'", "5'", "6", "5", "4", "3", "2", ""];

interface GearMove { name: string; axis: number; steps: number; inverse: string; }
const MOVES: GearMove[] = [];
for (const ax of AXES) {
  for (let a = 0; a < 11; a++) {
    const steps = a + 1;                       // 1..11
    const invSteps = (12 - steps) % 12;        // 11..1
    const invA = invSteps - 1;
    MOVES.push({ name: ax + SUFFIX[a], axis: AXIS_IDX[ax], steps, inverse: ax + SUFFIX[invA] });
  }
}
const MOVE_BY_NAME = new Map<string, GearMove>(MOVES.map((mv) => [mv.name, mv]));

/** Valid scramble tokens (the exact cstimer gear alphabet): 33 = 3 axes × 11 powers. */
export const GEAR_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);

/** Solved state: [corner, e0, e1, e2] = [0,0,0,0]. */
export const GEAR_SOLVED: ReadonlyArray<number> = [0, 0, 0, 0];

export const GEAR_TOTAL_STATES = 41472; // reachable states, confirmed by BFS + cstimer round-trip oracle
/** God's number in the cstimer face-turn metric (each token = 1 move), proven by the full BFS below. */
export const GEAR_GODS_NUMBER = 6;
/**
 * Optimal-solution-length distribution over all 41,472 reachable states (index = optimal move count).
 * Locked by tests; surfaced in the UI as flavor. Sum = 41,472, mean 4.30317.
 */
export const GEAR_LENGTH_DISTRIBUTION: ReadonlyArray<number> = [
  1, 33, 579, 5921, 18072, 13977, 2889,
];

/** Apply a token (= baseStep `steps` times on its axis). */
function applyMove(cur: ReadonlyArray<number>, mv: GearMove): number[] {
  let s = cur.slice();
  for (let k = 0; k < mv.steps; k++) s = baseStep(s, mv.axis);
  return s;
}

/** Numeric canonical key: c[0]*373248 + c[1]*5184 + c[2]*72 + c[3] (24·72·72·72 = 8,957,952 < 2^53). */
function keyOf(c: ReadonlyArray<number>): number {
  return c[0] * 373248 + c[1] * 5184 + c[2] * 72 + c[3];
}
function decodeKey(k: number): number[] {
  const c0 = Math.floor(k / 373248); k -= c0 * 373248;
  const c1 = Math.floor(k / 5184); k -= c1 * 5184;
  const c2 = Math.floor(k / 72); const c3 = k - c2 * 72;
  return [c0, c1, c2, c3];
}

// ── precomputed graph (built once, memoized) ───────────────────────────────────
interface GearGraph {
  dist: Map<number, number>;       // optimal distance to solved
  toSolved: Map<number, string>;   // move name stepping a state toward solved
  states: number[];                // all reachable state keys in BFS order (index 0 = solved)
}
let GRAPH: GearGraph | null = null;

function buildGraph(): GearGraph {
  const dist = new Map<number, number>();
  const toSolved = new Map<number, string>();
  const states: number[] = [];
  const solvedKey = keyOf(GEAR_SOLVED);
  dist.set(solvedKey, 0);
  states.push(solvedKey);
  let frontier: number[][] = [[...GEAR_SOLVED]];
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

function graph(): GearGraph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ──────────────────────────────────────────────────────────────
const TOKEN_RE = /^[URF](?:[2-6]?'|[2-6])?$/;

/** Parse a scramble into move names. Throws Error('bad: <tok>') on an invalid token. */
export function parseGearScramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(tok);
  }
  return out;
}

/** Apply a scramble to the solved puzzle and return its raw [c,e0,e1,e2] state (for rendering / keys). */
export function gearApply(scramble: string): number[] {
  let c: number[] = [...GEAR_SOLVED];
  for (const tok of parseGearScramble(scramble)) {
    c = applyMove(c, MOVE_BY_NAME.get(tok)!);
  }
  return c;
}

export interface GearSolution {
  /** Optimal solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/** Optimally solve a Gear Cube scramble. Throws on an invalid token. */
export function solveGear(scramble: string): GearSolution {
  const g = graph();
  let c = gearApply(scramble);
  const solvedKey = keyOf(GEAR_SOLVED);
  const names: string[] = [];
  let guard = 0;
  while (keyOf(c) !== solvedKey) {
    const mv = g.toSolved.get(keyOf(c));
    if (mv === undefined || guard++ > GEAR_GODS_NUMBER) throw new Error('unsolvable');
    names.push(mv);
    c = applyMove(c, MOVE_BY_NAME.get(mv)!);
  }
  return { solution: names.join(' '), length: names.length };
}

/** Shortest scramble producing state `key` = inverse of its optimal solution (reverse path). */
function keyToScramble(g: GearGraph, startKey: number): string {
  if (startKey === g.states[0]) return '';
  let key = startKey;
  const solvedKey = g.states[0];
  const toward: string[] = [];
  let guard = 0;
  while (key !== solvedKey) {
    const mv = g.toSolved.get(key);
    if (mv === undefined || guard++ > GEAR_GODS_NUMBER) break;
    toward.push(mv);
    // step toward solved
    let c = decodeKey(key);
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
 * Returns { depth: [scramble, …] } for depths 1..6.
 */
export function gearExamplesByLength(perBin = 12): Record<number, string[]> {
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
 * Every reachable state's shortest scramble, grouped by optimal length (depths 1..6). The full state
 * space is enumerable (41,472 < 2M), so this is the complete corpus (41,471 non-trivial states; the
 * 41,472nd is the identity/solved). Plain in-memory record — no streaming needed at this scale.
 */
export function gearAllScramblesByLength(): Record<number, string[]> {
  return gearExamplesByLength(Infinity);
}

/**
 * Every reachable state as `{ depth, scramble }` in BFS order (depth 0 = solved/identity,
 * scramble = ''). Used by the "download all states" CSV; 41,472 rows fits comfortably in a plain Blob.
 */
export function gearAllStates(): Array<{ depth: number; scramble: string }> {
  const g = graph();
  return g.states.map((k) => {
    const depth = g.dist.get(k)!;
    return { depth, scramble: depth === 0 ? '' : keyToScramble(g, k) };
  });
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function gearGraphStats(): { total: number; histogram: number[] } {
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

/**
 * A uniform random-state scramble (cstimer `gearo` semantics): pick one of the 41,471
 * non-trivial reachable states uniformly and return its shortest scramble (≤ 6 tokens,
 * U/R/F alphabet). Used by /sim's gear scramble button.
 */
export function randomGearScramble(): string {
  const g = graph();
  for (;;) {
    const k = g.states[Math.floor(Math.random() * g.states.length)];
    if (k !== g.states[0]) return keyToScramble(g, k);
  }
}

/** Apply ONE scramble token to a 4-int state (oracle use — /sim's piece-level state
 *  model locks itself against this in tests/gear_state.test.ts). */
export function gearApplyToken(state: ReadonlyArray<number>, token: string): number[] {
  const mv = MOVE_BY_NAME.get(token);
  if (!mv) throw new Error(`bad: ${token}`);
  return applyMove(state, mv);
}
