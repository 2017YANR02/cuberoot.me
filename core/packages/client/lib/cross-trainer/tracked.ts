/*
 * cross-trainer/tracked — one exact BFS for any "bring THESE corners and THESE edges home,
 * oriented" sub-step. Cross, the 2×2×2 block, the Roux square and the Roux first block are all
 * the same puzzle with a different piece list, so they get the same engine instead of four.
 *
 * Coordinate: ordered placements of the tracked pieces, corner-major.
 *   corners  k pieces → 8·3 · 7·3 · … slots×twists     (k=1 → 24, k=2 → 504)
 *   edges    m pieces → 12·2 · 11·2 · … slots×flips    (m=2 → 528, m=3 → 10,560, m=4 → 190,080)
 * Untracked pieces are quotiented out, which is what keeps every stage here enumerable: the
 * biggest one this file is used for (the 1×2×3 block, 2 corners + 3 edges) is 5,322,240 states,
 * a 5 MB table and one BFS.
 *
 * The edge half is byte-for-byte ./dist's cross coordinate when m = 4, so `edgeNext(4)` returns
 * ./dist's shared 13.7 MB table rather than building a second one — and feeding this engine the
 * four cross edges reproduces `crossHistogram` exactly. That is the point of the shared engine
 * and it is asserted in tests/tracked_block_dist.test.ts, together with ./block's independently
 * written 2×2×2 table: two implementations that agree are worth more than one that is trusted.
 *
 * Not a sampler. The trainer's stages own their own tables (layers, pins, rejection windows);
 * this file answers "how many states are exactly d moves from home", which is what the exhaustive
 * datasets on /scramble/stats need.
 */

import { CORNER_STEP, EDGE_STEP, slotRank, slotUnrank } from './model';
import { crossNext } from './dist';

/** The pieces a sub-step has to bring home. Order fixes the coordinate; any order works. */
export interface TrackedSpec {
  corners: readonly number[];
  edges: readonly number[];
}

const POW3 = [1, 3, 9, 27, 81, 243, 729, 2187];

/** Ordered placements of k distinguishable corners. */
export function cornerStates(k: number): number {
  let n = 1;
  for (let i = 0; i < k; i++) n *= (8 - i) * 3;
  return n;
}

/** Ordered placements of m distinguishable edges. */
export function edgeStates(m: number): number {
  let n = 1;
  for (let i = 0; i < m; i++) n *= (12 - i) * 2;
  return n;
}

/** Size of the whole coordinate space of a spec. */
export const trackedStates = (spec: TrackedSpec): number =>
  cornerStates(spec.corners.length) * edgeStates(spec.edges.length);

// ── coordinate ───────────────────────────────────────────────────────────────────────────────

/** Pack k corner coords (`slot*3 + twist`, in tracked-piece order). */
export function packCorners(coords: ArrayLike<number>, k: number): number {
  const slots = new Int8Array(k);
  let tw = 0;
  for (let i = 0; i < k; i++) {
    slots[i] = (coords[i] / 3) | 0;
    tw += (coords[i] % 3) * POW3[i];
  }
  return slotRank(slots, k, 8) * POW3[k] + tw;
}

export function unpackCorners(idx: number, k: number, out: Int8Array): void {
  const tw = idx % POW3[k];
  slotUnrank((idx - tw) / POW3[k], k, out, 8);
  for (let i = 0; i < k; i++) out[i] = out[i] * 3 + (((tw / POW3[i]) | 0) % 3);
}

/** Pack m edge coords (`slot*2 + flip`, in tracked-piece order). Bit i of the tail is piece i. */
export function packEdges(coords: ArrayLike<number>, m: number): number {
  const slots = new Int8Array(m);
  let fl = 0;
  for (let i = 0; i < m; i++) {
    slots[i] = coords[i] >> 1;
    fl |= (coords[i] & 1) << i;
  }
  return slotRank(slots, m, 12) * (1 << m) + fl;
}

export function unpackEdges(idx: number, m: number, out: Int8Array): void {
  const fl = idx & ((1 << m) - 1);
  slotUnrank((idx - fl) / (1 << m), m, out, 12);
  for (let i = 0; i < m; i++) out[i] = out[i] * 2 + ((fl >> i) & 1);
}

// ── transitions ──────────────────────────────────────────────────────────────────────────────

const cornerNextCache = new Map<number, Int32Array>();
const edgeNextCache = new Map<number, Int32Array>();

/** cornerNext(k)[idx*18 + m] — the corner half after move m. */
export function cornerNext(k: number): Int32Array {
  const hit = cornerNextCache.get(k);
  if (hit) return hit;
  const n = cornerStates(k);
  const t = new Int32Array(n * 18);
  const cur = new Int8Array(k);
  const nx = new Int8Array(k);
  for (let i = 0; i < n; i++) {
    unpackCorners(i, k, cur);
    for (let m = 0; m < 18; m++) {
      const step = CORNER_STEP[m];
      for (let j = 0; j < k; j++) nx[j] = step[cur[j]];
      t[i * 18 + m] = packCorners(nx, k);
    }
  }
  cornerNextCache.set(k, t);
  return t;
}

/** edgeNext(m)[idx*18 + mv] — the edge half after move mv. m = 4 is ./dist's shared table. */
export function edgeNext(m: number): Int32Array {
  if (m === 4) return crossNext();
  const hit = edgeNextCache.get(m);
  if (hit) return hit;
  const n = edgeStates(m);
  const t = new Int32Array(n * 18);
  const cur = new Int8Array(m);
  const nx = new Int8Array(m);
  for (let i = 0; i < n; i++) {
    unpackEdges(i, m, cur);
    for (let mv = 0; mv < 18; mv++) {
      const step = EDGE_STEP[mv];
      for (let j = 0; j < m; j++) nx[j] = step[cur[j]];
      t[i * 18 + mv] = packEdges(nx, m);
    }
  }
  edgeNextCache.set(m, t);
  return t;
}

// ── the exact table ──────────────────────────────────────────────────────────────────────────

export interface TrackedTable {
  /** Optimal HTM length of every coordinate. */
  dist: Uint8Array;
  /** Layer sizes, index = optimal length. Sums to trackedStates(spec). */
  hist: number[];
}

const tableCache = new Map<string, TrackedTable>();
const specKey = (spec: TrackedSpec) => `${spec.corners.join(',')}|${spec.edges.join(',')}`;

/**
 * Full BFS from the solved coordinate — every state, no cap, no sampling, so `hist` is the
 * exact depth distribution of the whole space.
 */
export function trackedTable(spec: TrackedSpec): TrackedTable {
  const key = specKey(spec);
  const hit = tableCache.get(key);
  if (hit) return hit;

  const k = spec.corners.length;
  const m = spec.edges.length;
  const cn = cornerNext(k);
  const en = edgeNext(m);
  const ne = edgeStates(m);
  const total = cornerStates(k) * ne;

  const goal = packCorners(spec.corners.map((c) => c * 3), k) * ne
    + packEdges(spec.edges.map((e) => e * 2), m);

  const dist = new Uint8Array(total).fill(255);
  // One flat queue rather than per-depth arrays: at 5.3 M states the frontier lists alone would
  // churn tens of MB of garbage, and the queue doubles as the enumeration order.
  const queue = new Int32Array(total);
  dist[goal] = 0;
  queue[0] = goal;
  const hist: number[] = [1];
  let head = 0;
  let tail = 1;
  let depth = 0;
  let levelEnd = 1;

  while (head < tail) {
    const v = queue[head++];
    const c = (v / ne) | 0;
    const e = v - c * ne;
    const crow = c * 18;
    const erow = e * 18;
    for (let mv = 0; mv < 18; mv++) {
      const t = cn[crow + mv] * ne + en[erow + mv];
      if (dist[t] === 255) {
        dist[t] = depth + 1;
        queue[tail++] = t;
      }
    }
    if (head === levelEnd) {
      // The level just drained; everything pushed since is exactly one move deeper.
      if (tail > head) hist.push(tail - head);
      levelEnd = tail;
      depth++;
    }
  }

  const out = { dist, hist };
  tableCache.set(key, out);
  return out;
}

/** Depth histogram of a spec's whole coordinate space, index = optimal length. */
export const trackedHistogram = (spec: TrackedSpec): number[] => trackedTable(spec).hist.slice();
