/*
 * Diamond (dmd) optimal solver — pure TS, no worker, no tables to download.
 *
 * The Diamond is an OCTAHEDRON face-turner: 8 triangular faces, each split into 4 small triangular
 * sub-stickers → 32 stickers total. State is a plain 32-element PERMUTATION array (sticker positions);
 * solved = [0,1,…,31]. Sticker `i` lives on face `Math.floor(i/4)` (faces 0..7 = U,R,L,F,D,Bl,Br,B);
 * its solved color is also `Math.floor(i/4)` (8 colors). A face turn rotates that triangular face 120°,
 * so each base generator has ORDER 3 — the `X'` token applies the base generator twice.
 *
 * Move alphabet = EXACTLY 8 tokens (4 faces × 2 powers): `U U' R R' L L' F F'`. The 4 base generators
 * below are the cstimer poly3dlib "dmd" move table (`getFamousPuzzle('dmd')` → `polyParam [8,[-5,0],[],
 * [-5]]` → `makePuzzle`), extracted move-for-move via PolyScrambler's parser; the apply convention is
 * cstimer's `permMult` (compose(a,b)[i] = a[b[i]], state apply newState[i] = state[perm[i]]). `X` = the
 * 90°/120° base generator; `X'` = compose(genX, genX).
 *
 * The whole reachable graph is 138,240 states (== cstimer SchreierSims |G| on the same 4 gens). We BFS
 * it from solved once (memoized) and store, for every reachable state, the move stepping it toward
 * solved — so every solve is a true optimal shortest path. In the face-turn metric (each token incl. X'
 * counts as 1 move) God's number is 10, mean 6.6921. The reachable count, histogram and gen effects are
 * all reproduced from scratch (independent BFS + cstimer round-trip oracle) in tests/diamond_solver.test.ts.
 */

// ── the 4 base face-turn generators (cstimer "dmd" move table) ──────────────────
// Each is a 32-int permutation; apply convention newState[i] = state[gen[i]]. Base order = 3.
const GEN_U = [2, 0, 1, 3, 28, 5, 31, 30, 7, 9, 6, 4, 24, 13, 14, 15, 16, 17, 18, 19, 12, 21, 22, 23, 20, 25, 26, 27, 11, 29, 8, 10];
const GEN_R = [15, 1, 12, 13, 5, 7, 6, 4, 16, 9, 10, 11, 25, 27, 14, 24, 28, 17, 18, 19, 20, 21, 22, 23, 0, 2, 26, 3, 8, 29, 30, 31];
const GEN_L = [20, 21, 2, 23, 30, 5, 6, 7, 11, 8, 10, 9, 1, 3, 0, 15, 16, 4, 18, 19, 14, 12, 22, 13, 24, 25, 26, 27, 28, 29, 17, 31];
const GEN_F = [21, 1, 2, 3, 9, 8, 10, 7, 17, 16, 18, 11, 14, 13, 15, 12, 4, 5, 6, 19, 20, 25, 22, 23, 24, 0, 26, 27, 28, 29, 30, 31];

const N = 32;

/** Compose two perms in cstimer's permMult convention: (a∘b)[i] = a[b[i]]. */
function compose(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number[] {
  const r = new Array<number>(N);
  for (let i = 0; i < N; i++) r[i] = a[b[i]];
  return r;
}

// ── move table (the 8 cstimer tokens, face-turn metric) ─────────────────────────
interface DiamondMove { name: string; perm: ReadonlyArray<number>; inverse: string; }
const BASE: ReadonlyArray<{ name: string; gen: ReadonlyArray<number> }> = [
  { name: 'U', gen: GEN_U },
  { name: 'R', gen: GEN_R },
  { name: 'L', gen: GEN_L },
  { name: 'F', gen: GEN_F },
];
const MOVES: ReadonlyArray<DiamondMove> = BASE.flatMap(({ name, gen }) => {
  // base (X) = 120° one way; X' = the other 120° = applying base twice (order 3 ⇒ base⁻¹ = base²).
  const prime = compose(gen, gen);
  return [
    { name, perm: gen, inverse: `${name}'` },
    { name: `${name}'`, perm: prime, inverse: name },
  ];
});
const MOVE_BY_NAME = new Map<string, DiamondMove>(MOVES.map((mv) => [mv.name, mv]));

/** Valid scramble tokens (the exact cstimer dmd alphabet): U U' R R' L L' F F'. */
export const DIAMOND_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);

/** Solved state: identity permutation [0,1,…,31]. */
export const DIAMOND_SOLVED: ReadonlyArray<number> = Array.from({ length: N }, (_, i) => i);

export const DIAMOND_TOTAL_STATES = 138240; // reachable states, == cstimer SchreierSims |G|, confirmed by BFS
/** God's number in the face-turn metric (each token incl. X' = 1 move), proven by the full BFS below. */
export const DIAMOND_GODS_NUMBER = 10;
/**
 * Optimal-solution-length distribution over all 138,240 reachable states (index = optimal move count).
 * Locked by tests; surfaced in the UI as flavor. Sum = 138,240, mean 6.6921.
 */
export const DIAMOND_LENGTH_DISTRIBUTION: ReadonlyArray<number> = [
  1, 8, 48, 288, 1632, 8568, 36114, 74799, 16547, 220, 15,
];

// ── apply one move to a 32-int state ────────────────────────────────────────────
function applyMove(cur: ReadonlyArray<number>, mv: DiamondMove): number[] {
  const next = new Array<number>(N);
  for (let i = 0; i < N; i++) next[i] = cur[mv.perm[i]];
  return next;
}

/** Canonical key for a state = the 32 sticker positions joined. */
function keyOf(c: ReadonlyArray<number>): string {
  return c.join(',');
}

// ── precomputed graph (built once, memoized) ───────────────────────────────────
interface DiamondGraph {
  dist: Map<string, number>;       // optimal distance to solved
  toSolved: Map<string, string>;   // move name stepping a state toward solved
  states: string[];                // all reachable state keys in BFS order (index 0 = solved)
}
let GRAPH: DiamondGraph | null = null;

function buildGraph(): DiamondGraph {
  const dist = new Map<string, number>();
  const toSolved = new Map<string, string>();
  const states: string[] = [];
  const solvedKey = keyOf(DIAMOND_SOLVED);
  dist.set(solvedKey, 0);
  states.push(solvedKey);
  let frontier: number[][] = [[...DIAMOND_SOLVED]];
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

function graph(): DiamondGraph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ──────────────────────────────────────────────────────────────
const TOKEN_RE = /^[URLF]'?$/;

/** Parse a scramble into move names. Throws Error('bad: <tok>') on an invalid token. */
export function parseDiamondScramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(tok);
  }
  return out;
}

/** Apply a scramble to the solved puzzle and return its raw 32-int state (for rendering / keys). */
export function diamondApply(scramble: string): number[] {
  let c: number[] = [...DIAMOND_SOLVED];
  for (const tok of parseDiamondScramble(scramble)) {
    c = applyMove(c, MOVE_BY_NAME.get(tok)!);
  }
  return c;
}

export interface DiamondSolution {
  /** Optimal solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/** Optimally solve a Diamond scramble. Throws on an invalid token. */
export function solveDiamond(scramble: string): DiamondSolution {
  const g = graph();
  let c = diamondApply(scramble);
  const solvedKey = keyOf(DIAMOND_SOLVED);
  const names: string[] = [];
  let guard = 0;
  while (keyOf(c) !== solvedKey) {
    const mv = g.toSolved.get(keyOf(c));
    if (mv === undefined || guard++ > DIAMOND_GODS_NUMBER) throw new Error('unsolvable');
    names.push(mv);
    c = applyMove(c, MOVE_BY_NAME.get(mv)!);
  }
  return { solution: names.join(' '), length: names.length };
}

/** Shortest scramble producing state `key` = inverse of its optimal solution (reverse path). */
function keyToScramble(g: DiamondGraph, startKey: string): string {
  if (startKey === g.states[0]) return '';
  let key = startKey;
  const solvedKey = g.states[0];
  const toward: string[] = [];
  let guard = 0;
  while (key !== solvedKey) {
    const mv = g.toSolved.get(key);
    if (mv === undefined || guard++ > DIAMOND_GODS_NUMBER) break;
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
export function diamondExamplesByLength(perBin = 12): Record<number, string[]> {
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
 * space is enumerable (138,240 < 2M), so this is the complete corpus (138,239 non-trivial states; the
 * 138,240th is the identity/solved). Plain in-memory record — no streaming needed at this scale.
 */
export function diamondAllScramblesByLength(): Record<number, string[]> {
  return diamondExamplesByLength(Infinity);
}

/**
 * Every reachable state as `{ depth, scramble }` in BFS order (depth 0 = solved/identity,
 * scramble = ''). Used by the "download all states" CSV; 138,240 rows fits comfortably in a plain Blob.
 */
export function diamondAllStates(): Array<{ depth: number; scramble: string }> {
  const g = graph();
  return g.states.map((k) => {
    const depth = g.dist.get(k)!;
    return { depth, scramble: depth === 0 ? '' : keyToScramble(g, k) };
  });
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function diamondGraphStats(): { total: number; histogram: number[] } {
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
