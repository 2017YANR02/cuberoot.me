// Optimal cross solver for all 6 colors. Pure TS, no wasm.
//
// State = the 4 edges of the target face, tracked as (slot, orientation). The
// space is 24·22·20·18 = 190,080 states; a full BFS distance table per color
// gives the optimal HTM length in O(1) and the moves via gradient descent.
//
// Move transforms (perm + orientation delta) and the slot layout were dumped
// from cubing.js's 3x3x3 KPuzzle, then the optimal lengths were verified
// against 40,000 WCA scrambles × 6 colors from the C++ analyzer's std.csv
// (zero mismatches). Slot layout: 0=UF 1=UR 2=UB 3=UL 4=DF 5=DR 6=DB 7=DL
// 8=FR 9=FL 10=BR 11=BL. Default scheme U=White D=Yellow F=Green B=Blue R=Red
// L=Orange — so each face's 4 edges are a fixed piece set (no rotation needed).

export type CrossColor = 'White' | 'Yellow' | 'Red' | 'Orange' | 'Blue' | 'Green';

const MOVE_NAMES = ["U", "U'", "U2", "D", "D'", "D2", "F", "F'", "F2", "B", "B'", "B2", "R", "R'", "R2", "L", "L'", "L2"];
const PERM: number[][] = [[1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11], [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], [2, 3, 0, 1, 4, 5, 6, 7, 8, 9, 10, 11], [0, 1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11], [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], [0, 1, 2, 3, 6, 7, 4, 5, 8, 9, 10, 11], [9, 1, 2, 3, 8, 5, 6, 7, 0, 4, 10, 11], [8, 1, 2, 3, 9, 5, 6, 7, 4, 0, 10, 11], [4, 1, 2, 3, 0, 5, 6, 7, 9, 8, 10, 11], [0, 1, 10, 3, 4, 5, 11, 7, 8, 9, 6, 2], [0, 1, 11, 3, 4, 5, 10, 7, 8, 9, 2, 6], [0, 1, 6, 3, 4, 5, 2, 7, 8, 9, 11, 10], [0, 8, 2, 3, 4, 10, 6, 7, 5, 9, 1, 11], [0, 10, 2, 3, 4, 8, 6, 7, 1, 9, 5, 11], [0, 5, 2, 3, 4, 1, 6, 7, 10, 9, 8, 11], [0, 1, 2, 11, 4, 5, 6, 9, 8, 3, 10, 7], [0, 1, 2, 9, 4, 5, 6, 11, 8, 7, 10, 3], [0, 1, 2, 7, 4, 5, 6, 3, 8, 11, 10, 9]];
const ORI: number[][] = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];

const MIDX = new Map(MOVE_NAMES.map((n, i) => [n, i]));
// INV[m][j] = slot a piece at slot j moves to under move m
const INV: number[][] = PERM.map((p) => { const inv = new Array<number>(12); for (let i = 0; i < 12; i++) inv[p[i]] = i; return inv; });

const FACE: Record<CrossColor, number[]> = {
  White: [0, 1, 2, 3],   // U
  Yellow: [4, 5, 6, 7],  // D
  Green: [0, 4, 8, 9],   // F
  Blue: [2, 6, 10, 11],  // B
  Red: [1, 5, 8, 10],    // R
  Orange: [3, 7, 9, 11], // L
};

const N = 190080;

function encode(slots: ArrayLike<number>, oris: ArrayLike<number>): number {
  const avail = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let rank = 0;
  for (let k = 0; k < 4; k++) {
    const pos = avail.indexOf(slots[k]);
    rank = rank * (12 - k) + pos;
    avail.splice(pos, 1);
  }
  return rank * 16 + (oris[0] | (oris[1] << 1) | (oris[2] << 2) | (oris[3] << 3));
}

function decode(idx: number, outS: Int8Array, outO: Int8Array): void {
  const ob = idx & 15;
  let rank = (idx - ob) / 16;
  outO[0] = ob & 1; outO[1] = (ob >> 1) & 1; outO[2] = (ob >> 2) & 1; outO[3] = (ob >> 3) & 1;
  const p3 = rank % 9; rank = (rank - p3) / 9;
  const p2 = rank % 10; rank = (rank - p2) / 10;
  const p1 = rank % 11; rank = (rank - p1) / 11;
  const p0 = rank;
  const avail = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const ps = [p0, p1, p2, p3];
  for (let k = 0; k < 4; k++) { outS[k] = avail[ps[k]]; avail.splice(ps[k], 1); }
}

// universal transition table over the 190,080 encoded states (same for every color)
let univNext: Int32Array | null = null;
function buildUniv(): Int32Array {
  if (univNext) return univNext;
  const t = new Int32Array(N * 18);
  const s = new Int8Array(4), o = new Int8Array(4), ns = new Int8Array(4), no = new Int8Array(4);
  for (let idx = 0; idx < N; idx++) {
    decode(idx, s, o);
    for (let m = 0; m < 18; m++) {
      const inv = INV[m], ori = ORI[m];
      for (let k = 0; k < 4; k++) { const slot = inv[s[k]]; ns[k] = slot; no[k] = (o[k] + ori[slot]) & 1; }
      t[idx * 18 + m] = encode(ns, no);
    }
  }
  univNext = t;
  return t;
}

const distCache = new Map<CrossColor, Uint8Array>();
function buildDist(color: CrossColor): Uint8Array {
  const cached = distCache.get(color);
  if (cached) return cached;
  const next = buildUniv();
  const dist = new Uint8Array(N).fill(255);
  const src = encode(FACE[color], [0, 0, 0, 0]);
  dist[src] = 0;
  let frontier = [src];
  let d = 0;
  while (frontier.length) {
    const nextFrontier: number[] = [];
    for (const idx of frontier) {
      const base = idx * 18;
      for (let m = 0; m < 18; m++) {
        const nb = next[base + m];
        if (dist[nb] === 255) { dist[nb] = d + 1; nextFrontier.push(nb); }
      }
    }
    frontier = nextFrontier;
    d++;
  }
  distCache.set(color, dist);
  return dist;
}

/** Parse a scramble into move indices, or null if it contains a non-HTM token (wide move / rotation). */
function parseScramble(scramble: string): number[] | null {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const i = MIDX.get(tok);
    if (i === undefined) return null;
    out.push(i);
  }
  return out;
}

/** True if every token is a face HTM move (no wide moves / rotations). */
export function isHtmScramble(scramble: string): boolean {
  return parseScramble(scramble) !== null;
}

export interface CrossSolution {
  length: number;
  moves: string[];
}

/** Optimal cross solution for `color` on `scramble`. Returns null for non-HTM input. */
export function solveCross(scramble: string, color: CrossColor): CrossSolution | null {
  const moves = parseScramble(scramble);
  if (moves === null) return null;
  const dist = buildDist(color);
  const next = univNext!;
  let cur = encode(FACE[color], [0, 0, 0, 0]);
  for (const m of moves) cur = next[cur * 18 + m];
  let d = dist[cur];
  const out: string[] = [];
  while (d > 0) {
    const base = cur * 18;
    for (let m = 0; m < 18; m++) {
      const nb = next[base + m];
      if (dist[nb] === d - 1) { out.push(MOVE_NAMES[m]); cur = nb; d--; break; }
    }
  }
  return { length: out.length, moves: out };
}

/** Optimal cross length for `color`, or null for non-HTM input. */
export function crossLength(scramble: string, color: CrossColor): number | null {
  const moves = parseScramble(scramble);
  if (moves === null) return null;
  const dist = buildDist(color);
  const next = univNext!;
  let cur = encode(FACE[color], [0, 0, 0, 0]);
  for (const m of moves) cur = next[cur * 18 + m];
  return dist[cur];
}

export const CROSS_COLORS: CrossColor[] = ['White', 'Yellow', 'Red', 'Orange', 'Blue', 'Green'];

/** Optimal cross length for all 6 colors, or null for non-HTM input. */
export function allCrossLengths(scramble: string): Record<CrossColor, number> | null {
  const moves = parseScramble(scramble);
  if (moves === null) return null;
  const next = buildUniv();
  const result = {} as Record<CrossColor, number>;
  for (const color of CROSS_COLORS) {
    const dist = buildDist(color);
    let cur = encode(FACE[color], [0, 0, 0, 0]);
    for (const m of moves) cur = next[cur * 18 + m];
    result[color] = dist[cur];
  }
  return result;
}
