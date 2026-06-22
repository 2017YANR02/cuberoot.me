/*
 * Bicube (联体魔方 / Bicube) optimal solver — pure TS, no worker, no tables to download. TIER A
 * (full-graph BFS, PROVABLY OPTIMAL): the reachable closure is exactly 1,108,800 states, small enough
 * to BFS the whole move graph from solved once (memoized) and look up the optimal distance of any state.
 *
 * THE PUZZLE — the Bicube is the original bandaged Rubik's Cube (Uwe Meffert): a 3×3×3 in which a corner
 * and an edge are glued into 2×1×1 blocks, so most face turns are blocked by the bandaging. cstimer
 * models only the four visible faces U/F/L/R (9 stickers each) over a 23-element sticker array, with 12
 * distinct color labels (color 0 = the single "hinge" sticker). A face turns only when it is unbandaged.
 *
 * MOVE MODEL — copied FIELD-FOR-FIELD from cstimer `scramble/utilscramble.js:88` (`bicube`):
 *   faces  = "UFLR" (0=U, 1=F, 2=L, 3=R)
 *   d[face]= the 9 sticker indices of each face, in cycle order (index [8] = the face centre, untouched):
 *     U: [0,1,2,5,8,7,6,3,4]   F: [6,7,8,13,20,19,18,11,12]
 *     L: [0,3,6,11,18,17,16,9,10]   R: [8,5,2,15,22,21,20,13,14]
 *   SOLVED (colors, with repeats = the bandaged 2×1×1 block labels):
 *     [1,1,2,3,3,2,4,4,0,5,6,7,8,9,10,10,5,6,7,8,9,11,11]
 *   doMove(face) = ONE quarter turn: an 8-cycle on the face's 8 non-centre stickers. cstimer's exact code
 *     (positions d[face][0,2,4,6] form one 4-cycle, d[face][1,3,5,7] the other):
 *       t=s[d0]; s[d0]=s[d6]; s[d6]=s[d4]; s[d4]=s[d2]; s[d2]=t;
 *       t=s[d7]; s[d7]=s[d5]; s[d5]=s[d3]; s[d3]=s[d1]; s[d1]=t;
 *     power amount ∈ {1,2,3}.
 *   canMove(state, face) BANDAGING GATE (copied exactly): collect the DISTINCT colors of the face's 9
 *     stickers; the face is legal to turn iff there are EXACTLY 5 distinct colors AND one of them is 0.
 *   TOKEN ALPHABET = exactly 12 tokens: U U' U2 F F' F2 L L' L2 R R' R2. cstimer renders (face, amount)
 *     as move[face] + cubesuff[amount-1] with cubesuff = ["", "2", "'"], so `U`=face once (amount 1),
 *     `U2`=twice (amount 2), `U'`=thrice (amount 3).
 *
 * REACHABILITY — BFS-from-solved completes at exactly 1,108,800 reachable states (independently
 * reproduced by a from-geometry BFS in tests/bic_solver.test.ts). Moves are reversible and the gate is
 * rotation-invariant per face (canMove(A,face) == canMove(turn(A,face),face) always), so the move graph
 * is UNDIRECTED → BFS-from-solved gives exact optimal distances, and a (face,amount) move is reversed by
 * (face,(4-amount)%4). Every solution this solver returns is a true shortest path.
 *
 * METRIC / GOD'S NUMBER — face-turn metric where each (face,amount) token counts as ONE move. God's
 * number is 28 (matching Jaap Scherphuis's published "28 moves" for the bicube, jaapsch.net). [In pure
 * quarter-turn metric it is 58; our metric is the face-turn count, 28.] Mean optimal length ≈ 18.80.
 *
 * PRIOR ART — Bicube = the original bandaged Rubik's Cube (Uwe Meffert). The God's-number-28 figure and
 * configuration analysis are from Jaap Scherphuis (jaapsch.net puzzle pages). The move semantics are
 * copied from cstimer (cs0x7f/cstimer). The reachable count + full per-depth histogram are independently
 * reproduced by a from-scratch geometry BFS in the test; real cstimer `bic` scrambles round-trip 100%.
 */

// ── cstimer bicube model (field-for-field) ─────────────────────────────────────
// d[face] = the 9 sticker indices of each face, cycle order; index [8] = centre (untouched).
const D: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2, 5, 8, 7, 6, 3, 4], // U
  [6, 7, 8, 13, 20, 19, 18, 11, 12], // F
  [0, 3, 6, 11, 18, 17, 16, 9, 10], // L
  [8, 5, 2, 15, 22, 21, 20, 13, 14], // R
];
const FACE_LETTER = 'UFLR';
const STATE_LEN = 23;

/** Solved sticker colors (with repeats = the bandaged 2×1×1 block labels). Color 0 = the hinge sticker. */
export const BIC_SOLVED: ReadonlyArray<number> = [
  1, 1, 2, 3, 3, 2, 4, 4, 0, 5, 6, 7, 8, 9, 10, 10, 5, 6, 7, 8, 9, 11, 11,
];

/** The 19 positions that ever move (everything except the 4 face centres 4,10,12,14). Compact-key positions. */
const MOVING_POS: ReadonlyArray<number> = (() => {
  const fixed = new Set<number>([4, 10, 12, 14]);
  const out: number[] = [];
  for (let i = 0; i < STATE_LEN; i++) if (!fixed.has(i)) out.push(i);
  return out;
})();

/** Apply ONE quarter turn of `face` to a sticker array in place (cstimer's exact 8-cycle). */
function quarterTurnInPlace(s: number[], face: number): void {
  const di = D[face];
  let t = s[di[0]];
  s[di[0]] = s[di[6]]; s[di[6]] = s[di[4]]; s[di[4]] = s[di[2]]; s[di[2]] = t;
  t = s[di[7]];
  s[di[7]] = s[di[5]]; s[di[5]] = s[di[3]]; s[di[3]] = s[di[1]]; s[di[1]] = t;
}

/**
 * PERM[face][amount][i] = the source position whose color lands at position `i` after turning `face` by
 * `amount` (1..3) quarter turns. So applying a move is `next[i] = state[PERM[face][amount][i]]`.
 * Built once by tracking where each position's content comes from.
 */
const PERM: number[][][] = (() => {
  const all: number[][][] = [];
  for (let face = 0; face < 4; face++) {
    const byAmt: number[][] = [[], [], [], []]; // index 0 unused (amount 1..3)
    for (let amt = 1; amt <= 3; amt++) {
      // Track a "labelled" array carrying source indices, turn it `amt` times, read where each came from.
      const labels = Array.from({ length: STATE_LEN }, (_, i) => i);
      for (let k = 0; k < amt; k++) quarterTurnInPlace(labels, face);
      byAmt[amt] = labels.slice(); // labels[i] = source position landing at i
    }
    all[face] = byAmt;
  }
  return all;
})();

/** Apply a (face, amount) move to a state, returning a fresh array. */
function applyMove(state: ReadonlyArray<number>, face: number, amount: number): number[] {
  const perm = PERM[face][amount];
  const next = new Array<number>(STATE_LEN);
  for (let i = 0; i < STATE_LEN; i++) next[i] = state[perm[i]];
  return next;
}

/** Bandaging gate: face legal iff its 9 stickers show EXACTLY 5 distinct colors AND one of them is 0. */
function canMove(state: ReadonlyArray<number>, face: number): boolean {
  const di = D[face];
  const seen: number[] = [];
  let hasZero = false;
  for (let i = 0; i < 9; i++) {
    const c = state[di[i]];
    if (!seen.includes(c)) { seen.push(c); if (c === 0) hasZero = true; }
  }
  return seen.length === 5 && hasZero;
}

/** Compact canonical key over the 19 moving positions. */
function keyOf(state: ReadonlyArray<number>): string {
  let s = '';
  for (const p of MOVING_POS) s += String.fromCharCode(state[p]);
  return s;
}

// ── move list (the 12 tokens) ───────────────────────────────────────────────────
interface BicMove { name: string; face: number; amount: number; invName: string; }
const MOVES: ReadonlyArray<BicMove> = (() => {
  const suff = ['', '2', "'"]; // amount 1→"", 2→"2", 3→"'"
  const out: BicMove[] = [];
  for (let face = 0; face < 4; face++) {
    for (let amount = 1; amount <= 3; amount++) {
      const name = FACE_LETTER[face] + suff[amount - 1];
      const invAmount = (4 - amount) % 4; // 1↔3, 2↔2
      const invName = FACE_LETTER[face] + suff[invAmount - 1];
      out.push({ name, face, amount, invName });
    }
  }
  return out;
})();
const MOVE_BY_NAME = new Map<string, BicMove>(MOVES.map((m) => [m.name, m]));

/** Valid scramble tokens (the exact cstimer bic alphabet, 12 tokens). */
export const BIC_MOVE_NAMES: ReadonlyArray<string> = MOVES.map((m) => m.name);

/** Reachable state count (full BFS-from-solved, verified). Fits a JS number (< 2^53). */
export const BIC_STATE_COUNT = 1108800;
/** God's number in the face-turn metric (each token = 1 move), proven by the full BFS; matches jaapsch.net. */
export const BIC_GODS_NUMBER = 28;
/**
 * Optimal-solution-length distribution over all 1,108,800 reachable states (index = optimal move count).
 * Locked by tests; sum = 1,108,800, mean ≈ 18.80. Cited figure: jaapsch.net (God 28).
 */
export const BIC_DIST_HISTOGRAM: ReadonlyArray<number> = [
  1, 9, 24, 54, 102, 168, 296, 583, 996, 1817, 3196, 5739, 9785, 17075, 29279,
  48552, 77828, 115384, 155444, 179617, 172952, 133159, 82486, 43199, 19613,
  7781, 2833, 747, 81,
];

// ── precomputed graph (built once, memoized; ~7s in Node, ~550MB peak — dist-only) ─────────────
interface BicGraph { dist: Map<string, number>; }
let GRAPH: BicGraph | null = null;

function buildGraph(): BicGraph {
  const dist = new Map<string, number>();
  const solvedKey = keyOf(BIC_SOLVED);
  dist.set(solvedKey, 0);
  let frontier: number[][] = [[...BIC_SOLVED]];
  let d = 0;
  while (frontier.length) {
    const next: number[][] = [];
    for (const u of frontier) {
      for (let face = 0; face < 4; face++) {
        if (!canMove(u, face)) continue;
        for (let amount = 1; amount <= 3; amount++) {
          const v = applyMove(u, face, amount);
          const vk = keyOf(v);
          if (!dist.has(vk)) { dist.set(vk, d + 1); next.push(v); }
        }
      }
    }
    frontier = next;
    d++;
  }
  return { dist };
}

function graph(): BicGraph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ──────────────────────────────────────────────────────────────
const TOKEN_RE = /^[UFLR](2|')?$/;

/** Parse a scramble into move names. Throws Error('bad: <tok>') on an invalid token. */
export function parseBicScramble(scramble: string): string[] {
  const out: string[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    if (!TOKEN_RE.test(tok) || !MOVE_BY_NAME.has(tok)) throw new Error(`bad: ${tok}`);
    out.push(tok);
  }
  return out;
}

/** Apply a scramble to the solved puzzle and return its raw 23-element sticker state (for rendering / keys). */
export function bicApply(scramble: string): number[] {
  let c: number[] = [...BIC_SOLVED];
  for (const tok of parseBicScramble(scramble)) {
    const mv = MOVE_BY_NAME.get(tok)!;
    c = applyMove(c, mv.face, mv.amount);
  }
  return c;
}

export interface BicSolution {
  /** Optimal solution as space-separated moves; empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/**
 * Greedy descent down the distance map: from a state, repeatedly pick a legal neighbour whose optimal
 * distance is exactly one less, until solved. Returns the list of move NAMES taken (the optimal solution).
 */
function solvePathFromState(g: BicGraph, start: ReadonlyArray<number>): string[] {
  let cur = [...start];
  let d = g.dist.get(keyOf(cur));
  if (d === undefined) throw new Error('unreachable state');
  const names: string[] = [];
  while (d > 0) {
    let stepped = false;
    for (let face = 0; face < 4 && !stepped; face++) {
      if (!canMove(cur, face)) continue;
      for (let amount = 1; amount <= 3; amount++) {
        const v = applyMove(cur, face, amount);
        const dv = g.dist.get(keyOf(v));
        if (dv === d - 1) {
          names.push(MOVES.find((m) => m.face === face && m.amount === amount)!.name);
          cur = v; d = dv; stepped = true; break;
        }
      }
    }
    if (!stepped) throw new Error('descent stuck'); // impossible if dist is correct
  }
  return names;
}

/** Optimally solve a Bicube scramble. Throws on an invalid token. Provably shortest (length == distance). */
export function solveBic(scramble: string): BicSolution {
  const g = graph();
  const start = bicApply(scramble);
  const names = solvePathFromState(g, start);
  return { solution: names.join(' '), length: names.length };
}

/** Shortest scramble producing state `key` = inverse of its optimal solution (reverse path). */
function stateToScramble(g: BicGraph, start: ReadonlyArray<number>): string {
  const solving = solvePathFromState(g, start);
  // scramble = inverse of the solving path, reversed.
  return solving.reverse().map((nm) => MOVE_BY_NAME.get(nm)!.invName).join(' ');
}

/**
 * Generate up to `perBin` example scrambles for each optimal length, by spread-sampling reachable states
 * at each BFS depth and inverting their optimal solution (a depth-d state yields a length-d scramble).
 * Deterministic spread sampling over the enumerable state space — no competition corpus needed.
 * Returns { depth: [scramble, …] } for depths 1..28.
 */
export function bicExamplesByLength(perBin = 12): Record<number, string[]> {
  const g = graph();
  // group reachable state keys by depth.
  const byDepth: Map<number, string[]> = new Map();
  for (const [k, d] of g.dist) {
    if (d === 0) continue;
    (byDepth.get(d) ?? byDepth.set(d, []).get(d)!).push(k);
  }
  const wantInf = !Number.isFinite(perBin);
  const out: Record<number, string[]> = {};
  for (const [d, keys] of byDepth) {
    const step = wantInf ? 1 : Math.max(1, Math.floor(keys.length / perBin));
    const picked: string[] = [];
    for (let i = 0; i < keys.length && (wantInf || picked.length < perBin); i += step) {
      picked.push(keys[i]);
    }
    out[d] = picked.map((k) => stateToScramble(g, keyToState(k)));
  }
  return out;
}

/** Reconstruct a full 23-element state from a compact 19-position key (centres take their solved value). */
function keyToState(key: string): number[] {
  const st = [...BIC_SOLVED];
  for (let j = 0; j < MOVING_POS.length; j++) st[MOVING_POS[j]] = key.charCodeAt(j);
  return st;
}

/**
 * Every reachable state's shortest scramble, grouped by optimal length (depths 1..28). The full state
 * space is enumerable (1,108,800 < 2M), so this is the complete corpus (1,108,799 non-trivial states).
 */
export function bicAllScramblesByLength(): Record<number, string[]> {
  return bicExamplesByLength(Infinity);
}

/**
 * Stream every reachable state as { depth, scramble } in ascending-depth order (depth 0 = solved,
 * scramble = ''). Generator so the "download all states" CSV can be built without holding 1.1M scramble
 * strings plus a giant joined string at once.
 */
export function* streamBicScrambles(): Generator<{ depth: number; scramble: string }> {
  const g = graph();
  // collect keys by depth so output is deterministic ascending order.
  const byDepth: Map<number, string[]> = new Map();
  for (const [k, d] of g.dist) (byDepth.get(d) ?? byDepth.set(d, []).get(d)!).push(k);
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  for (const d of depths) {
    for (const k of byDepth.get(d)!) {
      yield { depth: d, scramble: d === 0 ? '' : stateToScramble(g, keyToState(k)) };
    }
  }
}

/** Stream every shortest scramble whose optimal length == `depth` (one per line). */
export function* bicScramblesForLength(depth: number): Generator<string> {
  const g = graph();
  for (const [k, d] of g.dist) {
    if (d !== depth || d === 0) continue;
    yield stateToScramble(g, keyToState(k));
  }
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function bicGraphStats(): { total: number; histogram: number[] } {
  const g = graph();
  const histogram: number[] = [];
  let total = 0;
  for (const d of g.dist.values()) { total++; histogram[d] = (histogram[d] ?? 0) + 1; }
  return { total, histogram };
}

/** A random legal-move walk from solved of `len` moves (deterministic via the passed rng) — test helper. */
export function bicRandomWalkState(len: number, rng: () => number): { scramble: string; state: number[] } {
  let cur = [...BIC_SOLVED];
  const names: string[] = [];
  for (let i = 0; i < len; i++) {
    const legal: BicMove[] = [];
    for (let face = 0; face < 4; face++) if (canMove(cur, face)) {
      for (let amount = 1; amount <= 3; amount++) legal.push({ name: FACE_LETTER[face] + ['', '2', "'"][amount - 1], face, amount, invName: '' });
    }
    if (legal.length === 0) break;
    const mv = legal[Math.floor(rng() * legal.length)];
    cur = applyMove(cur, mv.face, mv.amount);
    names.push(mv.name);
  }
  return { scramble: names.join(' '), state: cur };
}
