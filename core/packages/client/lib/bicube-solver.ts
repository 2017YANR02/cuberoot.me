/*
 * Bicube (联体魔方 / Bicube) optimal solver — pure TS. TIER B (offline precomputed exact-distance table).
 * The reachable closure is exactly 1,108,800 states (< 2M), BUT the in-browser full-graph string-keyed BFS
 * cost ~6.4s / ~510MB peak (measured) — fatal on mobile tabs (the site must work at <480px) and it froze
 * the UI ~7-10s. So per solver/NONWCA_PUZZLE_LOOP.md §0.0 #10 + §0.5 this is TIER B, NOT TIER A:
 *   • OFFLINE: a build script (packages/scramble-stats-build/src/build_bic_table.ts) BFS-es the closure ONCE
 *     and emits stats/scramble/opt_bic.bin.gz = gzip of an EXACT optimal-distance table addressed by a
 *     deterministic injective RANK (no Date.now / Math.random in the output).
 *   • BROWSER: lazily fetch + inflate (DecompressionStream) → hold as TYPED ARRAYS (~10MB resident:
 *     Float64Array of 1.1M sorted ranks + Uint8Array of 1.1M dist bytes), then solve by GRADIENT DESCENT
 *     (from the scrambled state pick the legal neighbour whose looked-up optimal distance is current−1).
 *     Still PROVABLY OPTIMAL (the table holds exact optimal distances). No in-browser BFS, no 510MB Map.
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
 * REACHABILITY / RANK — BFS-from-solved reaches exactly 1,108,800 states. The 19 moving positions split
 * into exactly TWO move-orbits, each carrying ALL-DISTINCT solved colors (measured): an 8-position orbit
 * (a clean permutation of 8 labels) and an 11-position orbit (a clean permutation of 11 labels). So a state
 * ⇔ a pair (perm₈, perm₁₁) and the COMBINED LEHMER RANK  rank = lehmer(perm₈)·11! + lehmer(perm₁₁)
 * (∈ [0, 8!·11!) ≈ 1.61×10¹²  < 2^53, so it is an exact Float64) is INJECTIVE over reachable states
 * (verified in tests). The table stores the reachable ranks SORTED + a parallel dist byte; lookup = binary
 * search the rank then read the dist. Moves are reversible and the gate is rotation-invariant per face
 * (canMove(A,face) == canMove(turn(A,face),face)), so the move graph is UNDIRECTED → BFS-from-solved gives
 * exact optimal distances and gradient descent yields a true shortest path.
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

import { statsUrl } from './stats-base';

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

// ── injective combined Lehmer rank (state ⇔ rank), the table's address key ──────────────────────
// The 19 moving positions split into exactly two move-orbits, each carrying ALL-DISTINCT solved colors
// (so each orbit is a clean permutation). 8-orbit (labels A..H) and 11-orbit (labels A..K). Verified by
// tests/bic_solver.test.ts (rank is injective over the 1,108,800 reachable states).
const ORBIT8: ReadonlyArray<number> = [0, 2, 6, 8, 16, 18, 20, 22];
const ORBIT11: ReadonlyArray<number> = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
/** color label → its 0-based index within each orbit (from the solved state). */
const C8: ReadonlyArray<number> = (() => { const m: number[] = []; ORBIT8.forEach((p, i) => { m[BIC_SOLVED[p]] = i; }); return m; })();
const C11: ReadonlyArray<number> = (() => { const m: number[] = []; ORBIT11.forEach((p, i) => { m[BIC_SOLVED[p]] = i; }); return m; })();
const FACT: ReadonlyArray<number> = (() => { const f = [1]; for (let i = 1; i <= 12; i++) f[i] = f[i - 1] * i; return f; })();
const FACT11 = FACT[11]; // 39,916,800
/** Total combined-coordinate space (states are a sparse subset). 8!·11! = 1,609,445,376,000 < 2^53. */
export const BIC_RANK_SPACE = FACT[8] * FACT[11];

/** Lehmer rank of a permutation given as an array of small 0..n-1 ints. */
function lehmerRank(items: number[]): number {
  const n = items.length;
  let r = 0;
  const seen = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    let smaller = 0;
    for (let j = 0; j < items[i]; j++) if (!seen[j]) smaller++;
    r = r * (n - i) + smaller;
    seen[items[i]] = true;
  }
  return r;
}

/**
 * Deterministic injective rank of a reachable Bicube state (combined Lehmer over the two orbits).
 * Result is an integer in [0, 8!·11!) ≈ 1.61×10¹², exactly representable as a Float64 (< 2^53).
 */
export function bicRank(state: ReadonlyArray<number>): number {
  const a8: number[] = []; for (const p of ORBIT8) a8.push(C8[state[p]]);
  const a11: number[] = []; for (const p of ORBIT11) a11.push(C11[state[p]]);
  return lehmerRank(a8) * FACT11 + lehmerRank(a11);
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

// ── exact-distance table (rank-addressed): sorted ranks + parallel dist bytes ────────────────────
/** Path of the precomputed table (fetched lazily in the browser). */
export const BIC_TABLE_PATH = '/stats/scramble/opt_bic.bin.gz';
/** Binary format magic (4 ASCII bytes) — bump if the layout changes. */
const BIC_TABLE_MAGIC = 'BIC1';

/** The resident table: parallel sorted ranks (Float64) + dist bytes (Uint8). ~10MB total, NOT a Map. */
export interface BicTable {
  /** Sorted reachable ranks (ascending). Float64 is exact for values < 2^53. */
  ranks: Float64Array;
  /** dist[i] = optimal distance of the state whose rank is ranks[i]. */
  dist: Uint8Array;
  /** Reachable state count (== ranks.length). */
  count: number;
}

/**
 * BUILD the full table by BFS-from-solved over the legal-move closure (the OFFLINE path; also used by the
 * test to build in-Node). Returns parallel sorted ranks + dist. Same BFS the old TIER-A `buildGraph` ran,
 * but it stores only the compact rank coordinate (not a 510MB string Map of full states).
 */
export function bicBuildTable(): BicTable {
  // rank → dist over the closure. We key the visited set on the injective rank (a JS number).
  const distByRank = new Map<number, number>();
  distByRank.set(bicRank(BIC_SOLVED), 0);
  let frontier: number[][] = [[...BIC_SOLVED]];
  let d = 0;
  while (frontier.length) {
    const next: number[][] = [];
    for (const u of frontier) {
      for (let face = 0; face < 4; face++) {
        if (!canMove(u, face)) continue;
        for (let amount = 1; amount <= 3; amount++) {
          const v = applyMove(u, face, amount);
          const vr = bicRank(v);
          if (!distByRank.has(vr)) { distByRank.set(vr, d + 1); next.push(v); }
        }
      }
    }
    frontier = next;
    d++;
  }
  const count = distByRank.size;
  const ranks = new Float64Array(count);
  let i = 0;
  for (const r of distByRank.keys()) ranks[i++] = r;
  ranks.sort(); // ascending numeric (Float64Array.sort is numeric)
  const dist = new Uint8Array(count);
  for (let j = 0; j < count; j++) dist[j] = distByRank.get(ranks[j])!;
  return { ranks, dist, count };
}

/**
 * SERIALIZE a table to the on-disk byte layout (gzip applied by the build script):
 *   [0..4)  magic "BIC1"
 *   [4..8)  uint32 LE count
 *   [8..12) uint32 LE rankStreamLen (bytes of the delta-varint rank stream)
 *   [12 .. 12+rankStreamLen)  sorted ranks, delta-encoded as unsigned LEB128 varints
 *   [.. +count)  dist bytes (parallel to the sorted ranks)
 * Deterministic — no Date.now / Math.random.
 */
export function serializeBicTable(t: BicTable): Uint8Array {
  // delta-varint the sorted ranks (deltas are small → tiny after gzip).
  const varints: number[] = [];
  let prev = 0;
  for (let i = 0; i < t.count; i++) {
    let delta = t.ranks[i] - prev; // exact integer subtraction (< 2^53)
    prev = t.ranks[i];
    // unsigned LEB128 over a JS-number-safe integer.
    while (delta >= 0x80) {
      varints.push((delta % 0x80) | 0x80);
      delta = Math.floor(delta / 0x80);
    }
    varints.push(delta);
  }
  const header = 12;
  const out = new Uint8Array(header + varints.length + t.count);
  for (let i = 0; i < 4; i++) out[i] = BIC_TABLE_MAGIC.charCodeAt(i);
  const dv = new DataView(out.buffer);
  dv.setUint32(4, t.count, true);
  dv.setUint32(8, varints.length, true);
  out.set(varints, header);
  out.set(t.dist, header + varints.length);
  return out;
}

/** DESERIALIZE the on-disk byte layout (after gunzip) back into resident typed arrays. */
export function deserializeBicTable(bytes: Uint8Array): BicTable {
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== BIC_TABLE_MAGIC.charCodeAt(i)) throw new Error('bic table: bad magic');
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = dv.getUint32(4, true);
  const rankStreamLen = dv.getUint32(8, true);
  const ranks = new Float64Array(count);
  let p = 12;
  let prev = 0;
  for (let i = 0; i < count; i++) {
    // decode one unsigned LEB128 varint.
    let delta = 0, shift = 1, b: number;
    do { b = bytes[p++]; delta += (b & 0x7f) * shift; shift *= 0x80; } while (b & 0x80);
    prev += delta;
    ranks[i] = prev;
  }
  if (p !== 12 + rankStreamLen) throw new Error(`bic table: rank stream length mismatch (${p - 12} vs ${rankStreamLen})`);
  const dist = bytes.subarray(p, p + count);
  if (dist.length !== count) throw new Error('bic table: dist length mismatch');
  return { ranks, dist: new Uint8Array(dist), count };
}

/** Binary-search the sorted ranks for `rank`; returns its dist, or -1 if not present (unreachable). */
function distOfRank(t: BicTable, rank: number): number {
  let lo = 0, hi = t.count - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = t.ranks[mid];
    if (v === rank) return t.dist[mid];
    if (v < rank) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}
/** Optimal distance of a full state (binary search via its rank). -1 if unreachable. */
function distOfState(t: BicTable, state: ReadonlyArray<number>): number {
  return distOfRank(t, bicRank(state));
}

// ── browser table loader (lazy fetch + native gunzip → typed arrays) ─────────────────────────────
let TABLE: BicTable | null = null;
let TABLE_PROMISE: Promise<BicTable> | null = null;

const GZIP_MAGIC0 = 0x1f, GZIP_MAGIC1 = 0x8b; // gzip member header
const MAGIC0 = BIC_TABLE_MAGIC.charCodeAt(0);  // 'B' — our plaintext table header

/** Inflate gzip bytes using the platform's native DecompressionStream (browsers; modern runtimes). */
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DS = (globalThis as any).DecompressionStream;
  if (typeof DS !== 'function') throw new Error('DecompressionStream unavailable (gzip table cannot be inflated)');
  const stream = new Response(new Blob([bytes as BlobPart])).body!.pipeThrough(new DS('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Lazily fetch + inflate + decode the exact-distance table (cached). On failure throws a clear error —
 * there is NO fallback to an in-browser 510MB BFS (that is exactly what TIER B removes).
 *
 * Robust to server-side gzip: if a host serves opt_bic.bin.gz with `Content-Encoding: gzip` the browser
 * already inflated it (bytes start with our 'B' magic), so we skip the JS gunzip; otherwise we inflate the
 * raw gzip member (bytes start with 1f 8b). Works on dev (raw .gz) and any prod host.
 */
export async function loadBicTable(): Promise<BicTable> {
  if (TABLE) return TABLE;
  if (TABLE_PROMISE) return TABLE_PROMISE;
  TABLE_PROMISE = (async () => {
    const url = statsUrl(BIC_TABLE_PATH);
    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(`无法加载 Bicube 距离表 / failed to fetch the Bicube table: ${String((e as Error)?.message ?? e)}`);
    }
    if (!res.ok) throw new Error(`无法加载 Bicube 距离表 (HTTP ${res.status}) / failed to fetch the Bicube table (HTTP ${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let raw: Uint8Array;
    if (bytes[0] === GZIP_MAGIC0 && bytes[1] === GZIP_MAGIC1) raw = await gunzip(bytes); // raw gzip → inflate
    else if (bytes[0] === MAGIC0) raw = bytes; // server already content-decoded → use as-is
    else raw = await gunzip(bytes); // unknown: best-effort inflate (deserialize will validate the magic)
    const t = deserializeBicTable(raw);
    TABLE = t;
    return t;
  })();
  try {
    return await TABLE_PROMISE;
  } catch (e) {
    TABLE_PROMISE = null; // allow retry on a later call
    throw e;
  }
}

/** Test/diagnostic only: inject an already-built table (skips fetch). */
export function _setBicTableForTest(t: BicTable | null): void {
  TABLE = t;
  TABLE_PROMISE = null;
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
 * GRADIENT DESCENT down the exact-distance table: from a state, repeatedly pick a legal neighbour whose
 * optimal distance (table lookup) is exactly one less, until solved. Returns the list of move NAMES taken
 * (the provably optimal solution).
 */
function solvePathFromState(t: BicTable, start: ReadonlyArray<number>): string[] {
  let cur = [...start];
  let d = distOfState(t, cur);
  if (d < 0) throw new Error('unreachable state');
  const names: string[] = [];
  while (d > 0) {
    let stepped = false;
    for (let face = 0; face < 4 && !stepped; face++) {
      if (!canMove(cur, face)) continue;
      for (let amount = 1; amount <= 3; amount++) {
        const v = applyMove(cur, face, amount);
        const dv = distOfState(t, v);
        if (dv === d - 1) {
          names.push(MOVES.find((m) => m.face === face && m.amount === amount)!.name);
          cur = v; d = dv; stepped = true; break;
        }
      }
    }
    if (!stepped) throw new Error('descent stuck'); // impossible if the table is correct
  }
  return names;
}

/**
 * Optimally solve a Bicube scramble given an already-loaded table (synchronous core). Throws on an invalid
 * token. Provably shortest (length == the table's exact optimal distance).
 */
export function solveBicWithTable(t: BicTable, scramble: string): BicSolution {
  const start = bicApply(scramble);
  const names = solvePathFromState(t, start);
  return { solution: names.join(' '), length: names.length };
}

/**
 * Optimally solve a Bicube scramble (async: lazily fetches + inflates the table on first call, then solves
 * by gradient descent). Throws on an invalid token or a table-load failure. Provably shortest.
 */
export async function solveBic(scramble: string): Promise<BicSolution> {
  // Validate tokens eagerly (a bad scramble should reject without fetching the table).
  parseBicScramble(scramble);
  const t = await loadBicTable();
  return solveBicWithTable(t, scramble);
}

// ── example / download helpers (table-driven, no BFS) ────────────────────────────────────────────
/** Reconstruct a full 23-element state from its rank (inverse Lehmer over the two orbits). */
function stateFromRank(rank: number): number[] {
  const r8 = Math.floor(rank / FACT11);
  const r11 = rank - r8 * FACT11;
  const perm8 = unrank(r8, 8);
  const perm11 = unrank(r11, 11);
  const st = [...BIC_SOLVED];
  for (let i = 0; i < 8; i++) st[ORBIT8[i]] = BIC_SOLVED[ORBIT8[perm8[i]]];
  for (let i = 0; i < 11; i++) st[ORBIT11[i]] = BIC_SOLVED[ORBIT11[perm11[i]]];
  return st;
}
/** Inverse Lehmer: rank → permutation array of 0..n-1 (perm[i] = which original index sits at position i). */
function unrank(rank: number, n: number): number[] {
  const avail: number[] = []; for (let i = 0; i < n; i++) avail.push(i);
  const perm: number[] = [];
  let r = rank;
  for (let i = 0; i < n; i++) {
    const f = FACT[n - 1 - i];
    const idx = Math.floor(r / f);
    r -= idx * f;
    perm.push(avail.splice(idx, 1)[0]);
  }
  return perm;
}

/** Shortest scramble producing a state = inverse of its optimal solution (reverse path). */
function stateToScramble(t: BicTable, start: ReadonlyArray<number>): string {
  const solving = solvePathFromState(t, start);
  return solving.reverse().map((nm) => MOVE_BY_NAME.get(nm)!.invName).join(' ');
}

/**
 * Generate up to `perBin` example scrambles for each optimal length, by spread-sampling the table's ranks
 * at each depth and inverting their optimal solution (a depth-d state yields a length-d scramble).
 * Deterministic spread over the enumerable rank list — no competition corpus needed. Requires a loaded
 * table (await loadBicTable() first). Returns { depth: [scramble, …] } for depths 1..28.
 */
export function bicExamplesByLengthFromTable(t: BicTable, perBin = 12): Record<number, string[]> {
  // group table indices by depth.
  const byDepth: Map<number, number[]> = new Map();
  for (let i = 0; i < t.count; i++) {
    const d = t.dist[i];
    if (d === 0) continue;
    (byDepth.get(d) ?? byDepth.set(d, []).get(d)!).push(i);
  }
  const wantInf = !Number.isFinite(perBin);
  const out: Record<number, string[]> = {};
  for (const [d, idxs] of byDepth) {
    const step = wantInf ? 1 : Math.max(1, Math.floor(idxs.length / perBin));
    const picked: number[] = [];
    for (let i = 0; i < idxs.length && (wantInf || picked.length < perBin); i += step) picked.push(idxs[i]);
    out[d] = picked.map((i) => stateToScramble(t, stateFromRank(t.ranks[i])));
  }
  return out;
}

/** Async convenience: load the table then enumerate examples per length. */
export async function bicExamplesByLength(perBin = 12): Promise<Record<number, string[]>> {
  const t = await loadBicTable();
  return bicExamplesByLengthFromTable(t, perBin);
}

/**
 * Stream every reachable state as { depth, scramble } in ascending-depth order (depth 0 = solved,
 * scramble = ''). Generator so the "download all states" CSV can be built without holding 1.1M scramble
 * strings plus a giant joined string at once. Requires a loaded table.
 */
export function* streamBicScramblesFromTable(t: BicTable): Generator<{ depth: number; scramble: string }> {
  const byDepth: Map<number, number[]> = new Map();
  for (let i = 0; i < t.count; i++) (byDepth.get(t.dist[i]) ?? byDepth.set(t.dist[i], []).get(t.dist[i])!).push(i);
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  for (const d of depths) {
    for (const i of byDepth.get(d)!) {
      yield { depth: d, scramble: d === 0 ? '' : stateToScramble(t, stateFromRank(t.ranks[i])) };
    }
  }
}

/** Stream every shortest scramble whose optimal length == `depth` (one per line). Requires a loaded table. */
export function* bicScramblesForLengthFromTable(t: BicTable, depth: number): Generator<string> {
  for (let i = 0; i < t.count; i++) {
    if (t.dist[i] !== depth || depth === 0) continue;
    yield stateToScramble(t, stateFromRank(t.ranks[i]));
  }
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
