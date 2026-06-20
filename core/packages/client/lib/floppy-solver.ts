/*
 * 1×3×3 Floppy Cube (1×3×3 花型) optimal solver — pure TS, no worker, no tables to download.
 *
 * The Floppy cube has 4 side faces (R L F B); each face turns only 180° (it is one layer thick),
 * so there are just 4 moves and every move is self-inverse. State space is tiny — exactly 192:
 *   - 4 pieces whose permutation parity is locked to the face-flip parity,
 *   - 4 face "flip" bits (one per move axis).
 * Each move both swaps a fixed pair of pieces AND toggles its own flip bit, so perm-parity XOR
 * flip-popcount-parity is invariant → only 24×16/2 = 192 of the 384 (perm,flip) combos are
 * reachable from solved. God's number is 8. We BFS the whole graph from solved once (memoized)
 * and store, for every reachable state, the move that steps it toward solved — so every solve is
 * an optimal shortest path, computed instantly.
 *
 * Notation + state model copied field-for-field from the vendored cstimer `scramble/1x3x3.js`
 * (the scramble source at /scramble/gen?event=133, `toStr(..., "RLFB", [""])`):
 *   - state idx = (mathlib.getNPerm(perm,4) << 4) + flipBits, flipBits in [0,16)
 *   - doMove(idx, m): acycle(perm, movePieces[m]) [a 2-cycle swap], then flipBits ^= (1 << m)
 *   - movePieces = [[0,1],[2,3],[0,3],[1,2]] for moves R L F B = 0 1 2 3
 *   - a scramble is bare letters R L F B only (each = one 180° turn, no primes/powers)
 * Replicating this bit-for-bit guarantees a cstimer-generated scramble (cstimerScramble('133'))
 * is interpreted as the identical physical state, so our solution actually solves it.
 */

/** Move-axis order R L F B = 0..3 (matches cstimer movePieces indexing). */
const AXIS_LETTER = 'RLFB';

/** The 2-cycle (piece swap) each move applies, from cstimer movePieces. */
export const MOVE_PIECES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // R
  [2, 3], // L
  [0, 3], // F
  [1, 2], // B
];

/** God's number for the 1×3×3 Floppy cube, proven by the full BFS below. */
export const FLOPPY_GODS_NUMBER = 8;

/**
 * Optimal-solution-length distribution over all 192 reachable states (index = optimal move count).
 * Locked by tests; also surfaced in the UI as flavor.
 */
export const FLOPPY_LENGTH_DISTRIBUTION: ReadonlyArray<number> = [
  1, 4, 10, 24, 53, 64, 31, 4, 1,
];

// ── encoding ────────────────────────────────────────────────────────────────
// state idx = permRank(perm of 4) * 16 + flipBits  (exactly cstimer's (getNPerm<<4)+flip).
// Only states whose perm-parity == flip-popcount-parity are reachable; the other half of the
// 384 indices stays unreached (dist = -1) — harmless.
const N_FLIP = 16;
const N_PERM = 24;
const N_INDEX = N_PERM * N_FLIP; // 384
const SOLVED_IDX = 0;

const FACT4 = [1, 1, 2, 6, 24];

/** Lehmer rank of a permutation of {0..n-1} (matches cstimer getNPerm for n=4). */
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
    const fac = FACT4[n - 1 - i];
    const d = Math.floor(r / fac);
    r %= fac;
    p.push(elems[d]);
    elems.splice(d, 1);
  }
  return p;
}

// ── move set ─────────────────────────────────────────────────────────────────
// 4 moves R L F B, each a single 180° turn = its own inverse. inverse(m) = m.
interface FloppyMove { axis: number; name: string; }
const MOVES: ReadonlyArray<FloppyMove> = Array.from({ length: 4 }, (_, m) => ({
  axis: m,
  name: AXIS_LETTER[m],
}));
const MOVE_BY_NAME = new Map<string, number>(MOVES.map((mv, i) => [mv.name, i]));

// ── precomputed graph (built once) ───────────────────────────────────────────
// perm and flip transform independently, so the move is a tiny lookup table.
interface FloppyGraph {
  permTrans: Int32Array[]; // permTrans[m][permRank] = new permRank
  toSolved: Int8Array;     // move index stepping idx toward solved, -1 if unreached
  dist: Int8Array;         // optimal distance to solved, -1 if unreached
}
let GRAPH: FloppyGraph | null = null;

function nextIdx(g: FloppyGraph, idx: number, m: number): number {
  const pr = Math.floor(idx / N_FLIP);
  const flip = idx % N_FLIP;
  return g.permTrans[m][pr] * N_FLIP + (flip ^ (1 << m));
}

function buildGraph(): FloppyGraph {
  const permTrans: Int32Array[] = [];
  for (let m = 0; m < 4; m++) {
    const [a, b] = MOVE_PIECES[m];
    const pt = new Int32Array(N_PERM);
    for (let pr = 0; pr < N_PERM; pr++) {
      const p = permUnrank(pr, 4);
      const t = p[a]; p[a] = p[b]; p[b] = t; // acycle 2-cycle = swap
      pt[pr] = permRank(p);
    }
    permTrans.push(pt);
  }

  const toSolved = new Int8Array(N_INDEX).fill(-1);
  const dist = new Int8Array(N_INDEX).fill(-1);
  const g: FloppyGraph = { permTrans, toSolved, dist };
  dist[SOLVED_IDX] = 0;
  let frontier = [SOLVED_IDX];
  let d = 0;
  while (frontier.length) {
    const next: number[] = [];
    for (const u of frontier) {
      for (let m = 0; m < 4; m++) {
        const v = nextIdx(g, u, m);
        if (dist[v] === -1) {
          dist[v] = d + 1;
          toSolved[v] = m; // each move is self-inverse: v --m--> u (toward solved)
          next.push(v);
        }
      }
    }
    frontier = next;
    d++;
  }
  return g;
}

function graph(): FloppyGraph {
  if (!GRAPH) GRAPH = buildGraph();
  return GRAPH;
}

// ── public API ───────────────────────────────────────────────────────────────
const TOKEN_RE = /^([RLFB])$/i;

/** Parse a scramble into move indices. Throws Error('bad: <tok>') on an invalid token. */
export function parseFloppyScramble(scramble: string): number[] {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = TOKEN_RE.exec(tok);
    if (!m) throw new Error(`bad: ${tok}`);
    out.push(MOVE_BY_NAME.get(m[1].toUpperCase())!);
  }
  return out;
}

/** Apply a scramble to the solved cube and return its state index. */
export function floppyScrambleToIndex(scramble: string): number {
  const g = graph();
  let idx = SOLVED_IDX;
  for (const m of parseFloppyScramble(scramble)) idx = nextIdx(g, idx, m);
  return idx;
}

export interface FloppySolution {
  /** Optimal solution as space-separated R/L/F/B; empty when already solved. */
  solution: string;
  /** Move count (= optimal distance); 0 when already solved. */
  length: number;
}

/** Optimally solve a Floppy scramble. Throws on an invalid token. */
export function solveFloppy(scramble: string): FloppySolution {
  const g = graph();
  let idx = floppyScrambleToIndex(scramble);
  const names: string[] = [];
  let guard = 0;
  while (idx !== SOLVED_IDX) {
    const m = g.toSolved[idx];
    if (m < 0 || guard++ > FLOPPY_GODS_NUMBER) throw new Error('unsolvable');
    names.push(MOVES[m].name);
    idx = nextIdx(g, idx, m);
  }
  return { solution: names.join(' '), length: names.length };
}

export interface FloppyState {
  /** pieces[pos] = home id (0..3) of the piece currently at position pos. */
  pieces: number[];
  /** flips[axis] = 0|1 flip parity of face axis (R L F B = 0..3). */
  flips: number[];
}

/** Apply a scramble to the solved cube, returning the raw (pieces, flips) state for rendering. */
export function floppyApply(scramble: string): FloppyState {
  const pieces = [0, 1, 2, 3];
  const flips = [0, 0, 0, 0];
  for (const m of parseFloppyScramble(scramble)) {
    const [a, b] = MOVE_PIECES[m];
    const t = pieces[a]; pieces[a] = pieces[b]; pieces[b] = t;
    flips[m] ^= 1;
  }
  return { pieces, flips };
}

/** Shortest scramble producing state `idx` = inverse of its optimal solution (reverse path). */
function indexToScramble(g: FloppyGraph, idx: number): string {
  const sol: number[] = [];
  let cur = idx;
  let guard = 0;
  while (cur !== SOLVED_IDX) {
    const m = g.toSolved[cur];
    if (m < 0 || guard++ > FLOPPY_GODS_NUMBER) break;
    sol.push(m);
    cur = nextIdx(g, cur, m);
  }
  // each move is self-inverse, so the scramble = the toward-solved path reversed.
  return sol.reverse().map((m) => MOVES[m].name).join(' ');
}

/**
 * Generate up to `perBin` example scrambles for each optimal length, by enumerating states at
 * each BFS depth and inverting their optimal solution (so a depth-d state yields a length-d
 * scramble). Deterministic spread sampling — no competition corpus needed, the whole state
 * space is enumerable. Returns { depth: [scramble, …] } for depths 1..8.
 */
export function floppyExamplesByLength(perBin = 12): Record<number, string[]> {
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
 * The full state space is enumerable, so this is the complete corpus (191 states; the
 * 192nd is the identity/solved). Used for the "download all states" buttons.
 */
export function floppyAllScramblesByLength(): Record<number, string[]> {
  return floppyExamplesByLength(Infinity);
}

/** Test/diagnostic only: full reachable-state count + optimal-length histogram. */
export function floppyGraphStats(): { total: number; histogram: number[] } {
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
