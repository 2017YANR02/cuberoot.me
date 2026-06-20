/*
 * UFO (UFO 魔方) optimal solver — pure TS, no worker, no tables to download.
 *
 * The UFO is a flat disc: 3 balls sit on the rim (at 60° sectors 0,2,4 of a 6-position wheel), each
 * ball cut into 8 octants → 24 movable octant pieces. The two disc layers rotate as a 6-position
 * wheel (the U moves), and each ball can flip 180° (the A/B/C moves). There are exactly **60,480**
 * reachable states (every octant treated as distinct). We BFS the whole graph from solved once
 * (memoized, <50ms) and store, for every reachable state, the move stepping it toward solved — so
 * every solve is an optimal shortest path. God's number is 10 (proven by the full BFS), mean 7.7443.
 *
 * Move model derived from cstimer `scramble/megascramble.js:34`
 *   `"ufo": [[["A"],["B"],["C"],[["U","U'","U2'","U2","U3"]]]]`
 * → the token alphabet is EXACTLY 8 tokens: A B C U U' U2' U2 U3 (suffix ""). A/B/C are the three
 * 180° ball flips (self-inverse); U is a +1 wheel click over a 6-position disc, with U'=-1(=+5),
 * U2=+2, U2'=-2(=+4), U3=+3. The 4 base permutations over 48 home slots (slots 0..7 / 16..23 / 32..39
 * carry the 24 octants of balls A/B/C at solved; the gap slots 8..15 / 24..31 / 40..47 are empty
 * holding positions a piece passes through while the wheel turns) are transcribed verbatim from the
 * measured & confirmed geometry (core/.tmp/ufo). The closure is exactly 60,480 with God number 10 and
 * mean 7.7443 — independently reproduced two ways and locked in tests/ufo_solver.test.ts.
 *
 * Apply convention: a permutation `g` maps "the piece at home i goes to home g[i]", i.e.
 * `next[g[i]] = cur[i]`.
 */

// ── base move permutations (48 home slots) ─────────────────────────────────────
// U wheel: +1 sector. A/B/C: flip ball A/B/C 180° (self-inverse).
const U_PERM: ReadonlyArray<number> = [
  8, 1, 10, 3, 12, 5, 14, 7, 16, 9, 18, 11, 20, 13, 22, 15, 24, 17, 26, 19, 28, 21, 30, 23,
  32, 25, 34, 27, 36, 29, 38, 31, 40, 33, 42, 35, 44, 37, 46, 39, 0, 41, 2, 43, 4, 45, 6, 47,
];
const A_PERM: ReadonlyArray<number> = [
  3, 2, 1, 0, 7, 6, 5, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
];
const B_PERM: ReadonlyArray<number> = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 18, 17, 16, 23, 22, 21, 20,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
];
const C_PERM: ReadonlyArray<number> = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 35, 34, 33, 32, 39, 38, 37, 36, 40, 41, 42, 43, 44, 45, 46, 47,
];

export const UFO_SLOTS = 48;
/** Solved state: octants 0..23 in their home slots (0..7 / 16..23 / 32..39); gaps = -1. */
export const UFO_SOLVED: ReadonlyArray<number> = (() => {
  const c = new Array<number>(48).fill(-1);
  for (let i = 0; i < 8; i++) c[i] = i;
  for (let i = 0; i < 8; i++) c[16 + i] = 8 + i;
  for (let i = 0; i < 8; i++) c[32 + i] = 16 + i;
  return c;
})();

/** Compose two permutations: (compose(g1,g2))[i] = g1[g2[i]] (apply g2 then g1). */
function composePerm(g1: ReadonlyArray<number>, g2: ReadonlyArray<number>): number[] {
  const r = new Array<number>(48);
  for (let i = 0; i < 48; i++) r[i] = g1[g2[i]];
  return r;
}
const U2_PERM = composePerm(U_PERM, U_PERM);
const U3_PERM = composePerm(U2_PERM, U_PERM);
const U4_PERM = composePerm(U3_PERM, U_PERM); // = U2'
const U5_PERM = composePerm(U4_PERM, U_PERM); // = U'

// ── move table (the 8 cstimer tokens, face-turn metric) ────────────────────────
interface UfoMove { name: string; perm: ReadonlyArray<number>; inverse: string; }
const MOVES: ReadonlyArray<UfoMove> = [
  { name: 'U', perm: U_PERM, inverse: "U'" },
  { name: "U'", perm: U5_PERM, inverse: 'U' },
  { name: 'U2', perm: U2_PERM, inverse: "U2'" },
  { name: "U2'", perm: U4_PERM, inverse: 'U2' },
  { name: 'U3', perm: U3_PERM, inverse: 'U3' }, // U3 is its own inverse on a 6-wheel
  { name: 'A', perm: A_PERM, inverse: 'A' },
  { name: 'B', perm: B_PERM, inverse: 'B' },
  { name: 'C', perm: C_PERM, inverse: 'C' },
];
const MOVE_BY_NAME = new Map<string, UfoMove>(MOVES.map((mv) => [mv.name, mv]));

/** Valid scramble tokens (the exact cstimer ufo alphabet). */
export const UFO_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);

export const UFO_TOTAL_STATES = 60480;
/** God's number for the UFO (cstimer face-turn metric), proven by the full BFS below. */
export const UFO_GODS_NUMBER = 10;
/**
 * Optimal-solution-length distribution over all 60,480 reachable states (index = optimal move count).
 * Locked by tests; surfaced in the UI as flavor. Sum = 60,480, mean 7.7443.
 */
export const UFO_LENGTH_DISTRIBUTION: ReadonlyArray<number> = [
  1, 8, 33, 151, 577, 1924, 5733, 13778, 21715, 14241, 2319,
];

// ── apply one base permutation to a 48-array in place-free fashion ──────────────
function applyPerm(cur: ReadonlyArray<number>, g: ReadonlyArray<number>): number[] {
  const next = new Array<number>(48).fill(-1);
  for (let i = 0; i < 48; i++) next[g[i]] = cur[i];
  return next;
}

/** Canonical key for a state = the occupied (label-bearing) slots only, in slot order. */
function keyOf(c: ReadonlyArray<number>): string {
  // Only 24 slots ever hold a label; the rest cycle gaps. Hash the full 48-array compactly.
  return c.join(',');
}

// ── precomputed graph (built once, memoized) ───────────────────────────────────
interface UfoGraph {
  dist: Map<string, number>;       // optimal distance to solved
  toSolved: Map<string, string>;   // move name stepping a state toward solved
  states: string[];                // all reachable state keys in BFS order (index 0 = solved)
}
let GRAPH: UfoGraph | null = null;

function buildGraph(): UfoGraph {
  const dist = new Map<string, number>();
  const toSolved = new Map<string, string>();
  const states: string[] = [];
  const solvedKey = keyOf(UFO_SOLVED);
  dist.set(solvedKey, 0);
  states.push(solvedKey);
  let frontier: number[][] = [[...UFO_SOLVED]];
  let d = 0;
  while (frontier.length) {
    const next: number[][] = [];
    for (const u of frontier) {
      for (const mv of MOVES) {
        const v = applyPerm(u, mv.perm);
        const vk = keyOf(v);
        if (!dist.has(vk)) {
          dist.set(vk, d + 1);
          // apply(u, mv) = v ⇒ apply(v, mv.inverse) = u
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

function graph(): UfoGraph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ──────────────────────────────────────────────────────────────
const TOKEN_RE = /^(A|B|C|U|U'|U2|U2'|U3)$/;

/** Parse a scramble into move names. Throws Error('bad: <tok>') on an invalid token. */
export function parseUfoScramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(tok);
  }
  return out;
}

/** Apply a scramble to the solved disc and return its raw 48-slot state (for rendering / keys). */
export function ufoApply(scramble: string): number[] {
  let c: number[] = [...UFO_SOLVED];
  for (const tok of parseUfoScramble(scramble)) {
    c = applyPerm(c, MOVE_BY_NAME.get(tok)!.perm);
  }
  return c;
}

export interface UfoSolution {
  /** Optimal solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/** Optimally solve a UFO scramble. Throws on an invalid token. */
export function solveUfo(scramble: string): UfoSolution {
  const g = graph();
  let c = ufoApply(scramble);
  const solvedKey = keyOf(UFO_SOLVED);
  const names: string[] = [];
  let guard = 0;
  while (keyOf(c) !== solvedKey) {
    const mv = g.toSolved.get(keyOf(c));
    if (mv === undefined || guard++ > UFO_GODS_NUMBER) throw new Error('unsolvable');
    names.push(mv);
    c = applyPerm(c, MOVE_BY_NAME.get(mv)!.perm);
  }
  return { solution: names.join(' '), length: names.length };
}

/** Shortest scramble producing state `key` = inverse of its optimal solution (reverse path). */
function keyToScramble(g: UfoGraph, startKey: string): string {
  if (startKey === g.states[0]) return '';
  let key = startKey;
  const solvedKey = g.states[0];
  const toward: string[] = [];
  let guard = 0;
  while (key !== solvedKey) {
    const mv = g.toSolved.get(key);
    if (mv === undefined || guard++ > UFO_GODS_NUMBER) break;
    toward.push(mv);
    // step toward solved
    let c = key.split(',').map(Number);
    c = applyPerm(c, MOVE_BY_NAME.get(mv)!.perm);
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
export function ufoExamplesByLength(perBin = 12): Record<number, string[]> {
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
 * space is enumerable (60,480 < 2M), so this is the complete corpus (60,479 non-trivial states; the
 * 60,480th is the identity/solved). Plain in-memory record — no streaming needed at this scale.
 */
export function ufoAllScramblesByLength(): Record<number, string[]> {
  return ufoExamplesByLength(Infinity);
}

/**
 * Every reachable state as `{ depth, scramble }` in BFS order (depth 0 = solved/identity,
 * scramble = ''). Used by the "download all states" CSV; 60,480 rows fits comfortably in a plain Blob.
 */
export function ufoAllStates(): Array<{ depth: number; scramble: string }> {
  const g = graph();
  return g.states.map((k) => {
    const depth = g.dist.get(k)!;
    return { depth, scramble: depth === 0 ? '' : keyToScramble(g, k) };
  });
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function ufoGraphStats(): { total: number; histogram: number[] } {
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
