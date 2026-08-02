/*
 * cross-trainer/multi — XXCross (cross + two F2L slots) and the pseudo (D-offset) goal family.
 *
 * All three samplers reuse xcross.ts's recipe: exact per-piece joint BFS tables → admissible
 * max-heuristic IDA* (so the first depth that succeeds IS the optimum — a lower-bound pruning
 * table used as the answer would silently over-sample easy states) → enumerate the shallow
 * layers for a uniform pick, reject on uniform coordinates for the deep ones. Never a reverse
 * random walk: that is provably biased.
 *
 *   xxcross        cross(190,080) × 2 corners(8·7·3² = 504) × 2 edges(8·7·2² = 224)
 *                  = 21,459,271,680. ADJACENT slot pairs (FR+FL) and DIAGONAL ones (FR+BL) are
 *                  genuinely different puzzles — their layer sizes part ways at depth 2 — so a
 *                  frame names both slots, never "how many".
 *   pseudo_cross   the plain cross coordinate with a 4-element goal SET {cross·D^k}: the cross
 *                  is built but allowed to sit D-rotated. Small enough for a full multi-source
 *                  BFS, so every depth is enumerated and sampling is exact and rejection-free.
 *   pseudo_xcross  the xcross coordinate with the same goal set. The tracked corner and edge
 *                  ride along with the D turn — the whole tuple is rotated, not just the cross.
 *
 * Admissibility of the pseudo heuristic: an optimal solution reaches goal_j for some j, hence
 * also drives (cross, piece) into the multi-source goal set, so the multi-source distance is a
 * lower bound. h == 0 still means "solved": the four goal cross coordinates are distinct, so
 * the cross part pins which j the corner and the edge both matched.
 */

import {
  CORNER_STEP, EDGE_STEP, FACE_CORNERS, FACE_EDGES, f2lSlots, skipRow, type FaceIdx,
} from './model';
import { CROSS_STATES, crossNext, decodeCross, encodeCross } from './dist';
import type { Pin } from './fill';
import type { Frame, XCoord } from './xcross';

/** What fill.ts wants: the pinned edges and the pinned corners of a sub-step coordinate. */
export interface Pins { edgePins: Pin[]; cornerPins: Pin[] }

const crossBuf = new Int8Array(4);

// ── shared table builders ────────────────────────────────────────────────────────────────────

const jointCache = new Map<string, Uint8Array>();

/**
 * BFS over (cross coordinate × one tracked piece coordinate) from one or more goals — the
 * `buildJoint` of xcross.ts, generalised to a goal set for the pseudo family. Exact distance
 * to the nearest goal, hence admissible for any problem whose goals are a subset of these.
 */
function buildJointMulti(starts: number[], step: readonly Int8Array[]): Uint8Array {
  const next = crossNext();
  const dist = new Uint8Array(CROSS_STATES * 24).fill(255);
  for (const s of starts) dist[s] = 0;
  let frontier = Int32Array.from(starts);
  for (let d = 0; frontier.length; d++) {
    const out: number[] = [];
    for (let i = 0; i < frontier.length; i++) {
      const idx = frontier[i];
      const c = (idx / 24) | 0, p = idx % 24;
      const base = c * 18;
      for (let m = 0; m < 18; m++) {
        const nb = next[base + m] * 24 + step[m][p];
        if (dist[nb] === 255) { dist[nb] = d + 1; out.push(nb); }
      }
    }
    frontier = Int32Array.from(out);
  }
  return dist;
}

/** Cached joint table. `key` must spell out the whole goal set, not just the piece. */
function joint(key: string, starts: number[], step: readonly Int8Array[]): Uint8Array {
  const hit = jointCache.get(key);
  if (hit) return hit;
  const t = buildJointMulti(starts, step);
  jointCache.set(key, t);
  return t;
}

/** Cross coordinate of the solved cross on face `f`. */
function crossGoalOf(f: FaceIdx): number {
  const home = FACE_EDGES[f];
  return encodeCross(home[0] * 2, home[1] * 2, home[2] * 2, home[3] * 2);
}

/**
 * Open-addressing set over packed sub-step coordinates. The XXCross key needs 37 bits, so it
 * lives in a Float64Array (exact for integers < 2^53); -1 marks an empty slot. A Set<number>
 * would cost ~50 B/entry and depth 6 alone inserts 4.2 M keys.
 */
class CoordSet {
  private readonly keys: Float64Array;
  private readonly mask: number;
  constructor(bits: number) {
    this.keys = new Float64Array(1 << bits).fill(-1);
    this.mask = (1 << bits) - 1;
  }
  /** `hi`/`lo` are the key's two int32-safe halves — hashing the double itself loses bits. */
  add(key: number, hi: number, lo: number): boolean {
    let h = Math.imul(hi ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul((h ^ (h >>> 13)) + lo, 0xc2b2ae35);
    let i = (h ^ (h >>> 16)) & this.mask;
    for (;;) {
      const k = this.keys[i];
      if (k < 0) { this.keys[i] = key; return true; }
      if (k === key) return false;
      i = (i + 1) & this.mask;
    }
  }
}

// ═══ 1. XXCross ══════════════════════════════════════════════════════════════════════════════

/** 190,080 crosses × 504 ordered corner pairs × 224 ordered edge pairs. */
export const XXCROSS_STATES = 21459271680;
/**
 * or18's reported diameter. We never enumerate the tail to confirm it — treat it as the cap
 * the samplers refuse to look past, not as a verified fact.
 */
export const XXCROSS_MAX_DEPTH = 13;
/**
 * Layers up to here are enumerated (380,906 states, ~30 MB); deeper ones use rejection.
 * Depth 6 is 4.2 M states — computable on demand for the gate, far too fat to keep cached.
 */
export const XX_BFS_DEPTH = 5;
/** Hard stop for `xxcrossShallowHistogram`: depth 7 would be ~50 M keys. */
const XX_BFS_MAX = 6;

/** or18's exact layer sizes, depth 0..6 — the gate `xxcrossShallowHistogram` must reproduce. */
export const XXCROSS_LAYERS_ADJACENT: readonly number[] = [1, 15, 182, 2286, 28611, 349811, 4169855];
export const XXCROSS_LAYERS_DIAGONAL: readonly number[] = [1, 15, 184, 2306, 29005, 356588, 4265037];

/**
 * Measured, not guessed — 24k uniform draws per cap on the adjacent frame (see the bench in
 * tests/cross_trainer_multi.test.ts). Mean wall time of ONE capped IDA*; a rejection sample at
 * depth d costs this divided by XXCROSS_DEPTH_SHARE[d].
 */
export const XXCROSS_DRAW_COST_MS: Readonly<Record<number, number>> = {
  8: 0.03, 9: 0.35, 10: 1.8, 11: 2.8, 12: 2.7, 13: 2.5,
};
/** Share of the coordinate space per optimal depth, same run (≤7 together are 0.24 %). */
export const XXCROSS_DEPTH_SHARE: Readonly<Record<number, number>> = {
  8: 0.023, 9: 0.183, 10: 0.599, 11: 0.193, 12: 1.1e-4, 13: 0,
};
/**
 * Highest depth a single sample is instant at (≈14 ms). Depth 12 works but costs ~30 s a
 * sample — one draw in 9,000 lands there — and depth 13 never showed up in 24k draws, so
 * rejection cannot serve it at all. Callers should treat 12+ as a "may take a while" tier.
 */
export const XXCROSS_PRACTICAL_MAX = 11;

export interface XXFrame {
  face: FaceIdx;
  /** Two distinct indices into f2lSlots(face). Order is irrelevant — it gets sorted. */
  slots: [number, number];
}

export interface XXFrameData {
  face: FaceIdx;
  /** The frame's slots, ascending; `c0`/`e0` of an XXCoord belong to slots[0]. */
  slots: [number, number];
  cornerPieces: [number, number];
  edgePieces: [number, number];
  crossPieces: number[];
  crossGoal: number;
  /** Exact dist to (cross solved + that piece home), indexed crossIdx*24 + pieceCoord. */
  cc0: Uint8Array; cc1: Uint8Array; ce0: Uint8Array; ce1: Uint8Array;
  /** The two slots share a side face (FR+FL) rather than sitting diagonally (FR+BL). */
  adjacent: boolean;
}

/** One XXCross coordinate. `c*` are slot*3+ori, `e*` are slot*2+ori. */
export interface XXCoord { cross: number; c0: number; c1: number; e0: number; e1: number }

const xxFrameCache = new Map<string, XXFrameData>();

function xxKey(frame: XXFrame): string {
  const [a, b] = frame.slots[0] <= frame.slots[1] ? frame.slots : [frame.slots[1], frame.slots[0]];
  return `${frame.face}:${a},${b}`;
}

export function xxFrameData(frame: XXFrame): XXFrameData {
  const key = xxKey(frame);
  const hit = xxFrameCache.get(key);
  if (hit) return hit;
  const [i0, i1] = frame.slots[0] <= frame.slots[1] ? frame.slots : [frame.slots[1], frame.slots[0]];
  if (i0 === i1) throw new Error('XXCross needs two distinct slots');
  const slots = f2lSlots(frame.face);
  const s0 = slots[i0], s1 = slots[i1];
  const crossGoal = crossGoalOf(frame.face);
  // Adjacency straight from face membership, not from the slot names: two slots are adjacent
  // iff their corners share a face other than the cross face.
  const adjacent = [0, 1, 2, 3, 4, 5].some(
    (g) => g !== frame.face && FACE_CORNERS[g].includes(s0.corner) && FACE_CORNERS[g].includes(s1.corner),
  );
  const data: XXFrameData = {
    face: frame.face,
    slots: [i0, i1],
    cornerPieces: [s0.corner, s1.corner],
    edgePieces: [s0.edge, s1.edge],
    crossPieces: FACE_EDGES[frame.face],
    crossGoal,
    cc0: joint(`x${frame.face}:c${s0.corner}`, [crossGoal * 24 + s0.corner * 3], CORNER_STEP),
    cc1: joint(`x${frame.face}:c${s1.corner}`, [crossGoal * 24 + s1.corner * 3], CORNER_STEP),
    ce0: joint(`x${frame.face}:e${s0.edge}`, [crossGoal * 24 + s0.edge * 2], EDGE_STEP),
    ce1: joint(`x${frame.face}:e${s1.edge}`, [crossGoal * 24 + s1.edge * 2], EDGE_STEP),
    adjacent,
  };
  xxFrameCache.set(key, data);
  return data;
}

/**
 * Exact optimal length, searched only as far as `cap`; -1 when it exceeds `cap`. The heuristic
 * is the max of four EXACT sub-problem distances, so it is admissible and the first successful
 * iteration is the true optimum. h == 0 means all four sub-goals hold at once, i.e. solved.
 */
export function xxcrossDistCapped(d: XXFrameData, st: XXCoord, cap: number): number {
  const next = crossNext();
  const { cc0, cc1, ce0, ce1 } = d;
  const CS = CORNER_STEP, ES = EDGE_STEP;
  const b0 = st.cross * 24;
  const h0 = Math.max(cc0[b0 + st.c0], cc1[b0 + st.c1], ce0[b0 + st.e0], ce1[b0 + st.e1]);
  if (h0 > cap) return -1;
  if (h0 === 0) return 0;

  const search = (cross: number, c0: number, c1: number, e0: number, e1: number, depth: number, prev: number): boolean => {
    const skip = skipRow(prev);
    const base = cross * 18;
    for (let m = 0; m < 18; m++) {
      if (skip[m]) continue;
      const nc = next[base + m];
      const cs = CS[m], es = ES[m];
      const n0 = cs[c0], n1 = cs[c1], f0 = es[e0], f1 = es[e1];
      const nb = nc * 24;
      const h = Math.max(cc0[nb + n0], cc1[nb + n1], ce0[nb + f0], ce1[nb + f1]);
      if (h >= depth) continue;                 // admissible → cannot finish in the remaining plies
      if (h === 0 && depth === 1) return true;
      if (depth > 1 && search(nc, n0, n1, f0, f1, depth - 1, m)) return true;
    }
    return false;
  };

  for (let lim = Math.max(h0, 1); lim <= cap; lim++) {
    if (search(st.cross, st.c0, st.c1, st.e0, st.e1, lim, -1)) return lim;
  }
  return -1;
}

// packed coordinate = cross * PP + ((c0*24 + c1)*24 + e0)*24 + e1, < 2^36
const PP = 24 * 24 * 24 * 24;

interface XXBfs { counts: number[]; layers: (Float64Array | null)[] }

function xxBfs(frame: XXFrame, maxDepth: number, keepDepth: number): XXBfs {
  const d = xxFrameData(frame);
  const next = crossNext();
  const CS = CORNER_STEP, ES = EDGE_STEP;
  // depth 6 inserts 4.55 M keys total; 2^24 slots keeps the load factor at 0.27.
  const set = new CoordSet(maxDepth >= 6 ? 24 : 21);
  const gc0 = d.cornerPieces[0] * 3, gc1 = d.cornerPieces[1] * 3;
  const ge0 = d.edgePieces[0] * 2, ge1 = d.edgePieces[1] * 2;
  const goalPp = ((gc0 * 24 + gc1) * 24 + ge0) * 24 + ge1;
  const goal = d.crossGoal * PP + goalPp;
  set.add(goal, d.crossGoal, goalPp);

  const counts = [1];
  const layers: (Float64Array | null)[] = [Float64Array.of(goal)];
  let frontier = layers[0]!;
  for (let depth = 1; depth <= maxDepth; depth++) {
    // the last layer only has to be counted — materialising depth 6 costs 33 MB for nothing
    const store = depth <= keepDepth || depth < maxDepth;
    const out: number[] = [];
    let n = 0;
    for (let i = 0; i < frontier.length; i++) {
      const v = frontier[i];
      const pp = v % PP;
      const cross = (v - pp) / PP;
      let t = pp;
      const e1 = t % 24; t = (t - e1) / 24;
      const e0 = t % 24; t = (t - e0) / 24;
      const c1 = t % 24; const c0 = (t - c1) / 24;
      const base = cross * 18;
      for (let m = 0; m < 18; m++) {
        const nc = next[base + m];
        const cs = CS[m], es = ES[m];
        const npp = ((cs[c0] * 24 + cs[c1]) * 24 + es[e0]) * 24 + es[e1];
        const nv = nc * PP + npp;
        if (set.add(nv, nc, npp)) { n++; if (store) out.push(nv); }
      }
    }
    counts.push(n);
    const layer = store ? Float64Array.from(out) : null;
    layers.push(layer);
    frontier = layer ?? new Float64Array(0);
  }
  return { counts, layers };
}

const xxLayerCache = new Map<string, XXBfs>();

function xxShallow(frame: XXFrame): XXBfs {
  const key = xxKey(frame);
  const hit = xxLayerCache.get(key);
  if (hit) return hit;
  const res = xxBfs(frame, XX_BFS_DEPTH, XX_BFS_DEPTH);
  xxLayerCache.set(key, res);
  return res;
}

/**
 * Exact layer sizes 0..maxDepth. Up to XX_BFS_DEPTH this is the cached enumeration the sampler
 * uses; depth 6 (the published gate) is recomputed on demand and thrown away again.
 */
export function xxcrossShallowHistogram(frame: XXFrame, maxDepth: number = XX_BFS_DEPTH): number[] {
  if (maxDepth > XX_BFS_MAX) throw new Error(`XXCross BFS stops at depth ${XX_BFS_MAX}`);
  if (maxDepth <= XX_BFS_DEPTH) return xxShallow(frame).counts.slice(0, maxDepth + 1);
  return xxBfs(frame, maxDepth, 0).counts;
}

const freeBuf = new Int8Array(12);

/** Uniform draw from the whole XXCross coordinate space (all fibers of the fill have equal size). */
export function randomXXCoord(rng: () => number): XXCoord {
  const cross = (rng() * CROSS_STATES) | 0;
  decodeCross(cross, crossBuf);
  let mask = 0;
  for (let k = 0; k < 4; k++) mask |= 1 << (crossBuf[k] >> 1);
  let n = 0;
  for (let s = 0; s < 12; s++) if (!(mask & (1 << s))) freeBuf[n++] = s; // n === 8
  // two DISTINCT slots each time: draw the second from the remaining n-1 and shift past the first
  const i0 = (rng() * n) | 0;
  let i1 = (rng() * (n - 1)) | 0; if (i1 >= i0) i1++;
  const j0 = (rng() * 8) | 0;
  let j1 = (rng() * 7) | 0; if (j1 >= j0) j1++;
  return {
    cross,
    c0: j0 * 3 + ((rng() * 3) | 0),
    c1: j1 * 3 + ((rng() * 3) | 0),
    e0: freeBuf[i0] * 2 + (rng() < 0.5 ? 0 : 1),
    e1: freeBuf[i1] * 2 + (rng() < 0.5 ? 0 : 1),
  };
}

function unpackXX(v: number): XXCoord {
  const pp = v % PP;
  const cross = (v - pp) / PP;
  let t = pp;
  const e1 = t % 24; t = (t - e1) / 24;
  const e0 = t % 24; t = (t - e0) / 24;
  const c1 = t % 24; const c0 = (t - c1) / 24;
  return { cross, c0, c1, e0, e1 };
}

/**
 * A uniform XXCross coordinate with optimal length in [lo,hi]. Shallow windows come out of the
 * enumerated layers (depth weighted by its true size, then uniform inside it); deeper ones by
 * rejection on uniform draws. Both routes are exactly uniform over the class.
 */
export function sampleXXCoord(
  frame: XXFrame, lo: number, hi: number, rng: () => number, maxTries = 200000,
): { coord: XXCoord; depth: number } | null {
  const d = xxFrameData(frame);
  const cappedHi = Math.min(hi, XXCROSS_MAX_DEPTH);
  if (lo > cappedHi) return null;

  if (cappedHi <= XX_BFS_DEPTH) {
    const { counts, layers } = xxShallow(frame);
    let total = 0;
    for (let x = lo; x <= cappedHi; x++) total += counts[x];
    if (!total) return null;
    let r = rng() * total;
    for (let x = lo; x <= cappedHi; x++) {
      r -= counts[x];
      if (r < 0) {
        const l = layers[x]!;
        return { coord: unpackXX(l[(rng() * l.length) | 0]), depth: x };
      }
    }
  }

  for (let t = 0; t < maxTries; t++) {
    const st = randomXXCoord(rng);
    const v = xxcrossDistCapped(d, st, cappedHi);
    if (v >= lo) return { coord: st, depth: v };
  }
  return null;
}

/** Pins for fill.ts: the 4 cross edges + the 2 slot edges, and the 2 slot corners. */
export function xxcrossPins(
  d: Pick<XXFrameData, 'crossPieces' | 'edgePieces' | 'cornerPieces'>, st: XXCoord,
): Pins {
  decodeCross(st.cross, crossBuf);
  const edgePins: Pin[] = d.crossPieces.map((piece, k) => ({ piece, slot: crossBuf[k] >> 1, ori: crossBuf[k] & 1 }));
  edgePins.push({ piece: d.edgePieces[0], slot: st.e0 >> 1, ori: st.e0 & 1 });
  edgePins.push({ piece: d.edgePieces[1], slot: st.e1 >> 1, ori: st.e1 & 1 });
  const cornerPins: Pin[] = [
    { piece: d.cornerPieces[0], slot: (st.c0 / 3) | 0, ori: st.c0 % 3 },
    { piece: d.cornerPieces[1], slot: (st.c1 / 3) | 0, ori: st.c1 % 3 },
  ];
  return { edgePins, cornerPins };
}

// ═══ 2. pseudo cross (D-offset) ══════════════════════════════════════════════════════════════

/**
 * Measured, not assumed: the pseudo cross runs to depth 8 like the plain one — the tail is
 * … 81780, 8064, 16. (A 7 here silently dropped those last 16 states into a hole.)
 */
export const PSEUDO_CROSS_MAX_DEPTH = 8;

/** The four goal cross coordinates: solved, and the solved cross turned by f, f2, f'. */
function pseudoCrossGoals(f: FaceIdx): number[] {
  const next = crossNext();
  let g = crossGoalOf(f);
  const goals = [g];
  for (let k = 1; k < 4; k++) { g = next[g * 18 + f * 3]; goals.push(g); }
  return goals;
}

const pcDistCache = new Map<number, Uint8Array>();

/** Exact optimal length to the nearest of the four D-offset crosses, for every coordinate. */
export function pseudoCrossDist(f: FaceIdx): Uint8Array {
  const hit = pcDistCache.get(f);
  if (hit) return hit;
  const next = crossNext();
  const dist = new Uint8Array(CROSS_STATES).fill(255);
  const goals = pseudoCrossGoals(f);
  for (const g of goals) dist[g] = 0;
  let frontier = goals;
  for (let d = 0; frontier.length; d++) {
    const out: number[] = [];
    for (const idx of frontier) {
      const base = idx * 18;
      for (let m = 0; m < 18; m++) {
        const nb = next[base + m];
        if (dist[nb] === 255) { dist[nb] = d + 1; out.push(nb); }
      }
    }
    frontier = out;
  }
  pcDistCache.set(f, dist);
  return dist;
}

const pcLayerCache = new Map<number, Int32Array[]>();

/** Coordinates grouped by exact optimal length. The whole space is covered — no rejection needed. */
export function pseudoCrossLayers(f: FaceIdx): Int32Array[] {
  const hit = pcLayerCache.get(f);
  if (hit) return hit;
  const dist = pseudoCrossDist(f);
  // depth read off the table, never hardcoded: an off-by-one would silently drop the tail
  let max = 0;
  for (let i = 0; i < CROSS_STATES; i++) if (dist[i] > max) max = dist[i];
  const counts = new Array<number>(max + 1).fill(0);
  for (let i = 0; i < CROSS_STATES; i++) counts[dist[i]]++;
  const layers = counts.map((n) => new Int32Array(n));
  const fill = new Array<number>(max + 1).fill(0);
  for (let i = 0; i < CROSS_STATES; i++) { const d = dist[i]; layers[d][fill[d]++] = i; }
  pcLayerCache.set(f, layers);
  return layers;
}

export function pseudoCrossHistogram(f: FaceIdx = 3): number[] {
  return pseudoCrossLayers(f).map((l) => l.length);
}

/** Uniform coordinate whose pseudo-cross length is in [lo,hi]; exact, no rejection. */
export function samplePseudoCross(
  f: FaceIdx, lo: number, hi: number, rng: () => number,
): { coord: number; depth: number } | null {
  const layers = pseudoCrossLayers(f);
  const cappedHi = Math.min(hi, PSEUDO_CROSS_MAX_DEPTH);
  let total = 0;
  for (let d = lo; d <= cappedHi; d++) total += layers[d].length;
  if (total <= 0) return null;
  let r = rng() * total;
  for (let d = lo; d <= cappedHi; d++) {
    r -= layers[d].length;
    if (r < 0) return { coord: layers[d][(rng() * layers[d].length) | 0], depth: d };
  }
  return null;
}

export function pseudoCrossPins(f: FaceIdx, coord: number): Pins {
  decodeCross(coord, crossBuf);
  const pieces = FACE_EDGES[f];
  return {
    edgePins: pieces.map((piece, k) => ({ piece, slot: crossBuf[k] >> 1, ori: crossBuf[k] & 1 })),
    cornerPins: [],
  };
}

// ═══ 3. pseudo XCross ════════════════════════════════════════════════════════════════════════

/** or18's published layer sizes; they sum to the 72,990,720 xcross coordinates. */
export const PSEUDO_XCROSS_HISTOGRAM: readonly number[] =
  [4, 48, 568, 6556, 70495, 693185, 5618257, 27845257, 36570024, 2186315, 11];
export const PSEUDO_XCROSS_MAX_DEPTH = 10;
/** Enumerated layers 0..5 = 770,856 states; depth 6 would be 5.6 M. */
export const PX_BFS_DEPTH = 5;
/**
 * Depth 10 holds ELEVEN of 72,990,720 states (p = 1.5e-7): rejection cannot reach it and
 * `samplePseudoXCoord` will return null there. Everything up to 9 is routine (p ≈ 3 %).
 */
export const PSEUDO_XCROSS_PRACTICAL_MAX = 9;

export interface PseudoXFrameData {
  face: FaceIdx;
  cornerPiece: number;
  edgePiece: number;
  crossPieces: number[];
  /** The four goal tuples, goal_k = goal_0 turned by f^k. */
  goals: XCoord[];
  /** Multi-source dist to (any goal cross + that goal's corner), indexed crossIdx*24 + coord. */
  cc: Uint8Array;
  ce: Uint8Array;
}

const pxFrameCache = new Map<string, PseudoXFrameData>();

export function pseudoXFrameData(frame: Frame): PseudoXFrameData {
  const key = `${frame.face}:${frame.slot}`;
  const hit = pxFrameCache.get(key);
  if (hit) return hit;
  const next = crossNext();
  const s = f2lSlots(frame.face)[frame.slot];
  const qf = frame.face * 3; // the clockwise quarter turn of the cross face
  let g: XCoord = { cross: crossGoalOf(frame.face), corner: s.corner * 3, edge: s.edge * 2 };
  const goals: XCoord[] = [g];
  for (let k = 1; k < 4; k++) {
    g = { cross: next[g.cross * 18 + qf], corner: CORNER_STEP[qf][g.corner], edge: EDGE_STEP[qf][g.edge] };
    goals.push(g);
  }
  const data: PseudoXFrameData = {
    face: frame.face,
    cornerPiece: s.corner,
    edgePiece: s.edge,
    crossPieces: FACE_EDGES[frame.face],
    goals,
    cc: joint(`p${frame.face}:c${s.corner}`, goals.map((q) => q.cross * 24 + q.corner), CORNER_STEP),
    ce: joint(`p${frame.face}:e${s.edge}`, goals.map((q) => q.cross * 24 + q.edge), EDGE_STEP),
  };
  pxFrameCache.set(key, data);
  return data;
}

/** Exact optimal length to the nearest of the four goals, searched only as far as `cap`. */
export function pseudoXcrossDistCapped(d: PseudoXFrameData, st: XCoord, cap: number): number {
  const next = crossNext();
  const { cc, ce } = d;
  const h0 = Math.max(cc[st.cross * 24 + st.corner], ce[st.cross * 24 + st.edge]);
  if (h0 > cap) return -1;
  if (h0 === 0) return 0;

  const search = (cross: number, corner: number, edge: number, depth: number, prev: number): boolean => {
    const skip = skipRow(prev);
    const base = cross * 18;
    for (let m = 0; m < 18; m++) {
      if (skip[m]) continue;
      const nc = next[base + m];
      const ncorner = CORNER_STEP[m][corner];
      const nedge = EDGE_STEP[m][edge];
      const nb = nc * 24;
      const h = Math.max(cc[nb + ncorner], ce[nb + nedge]);
      if (h >= depth) continue;
      if (h === 0 && depth === 1) return true;
      if (depth > 1 && search(nc, ncorner, nedge, depth - 1, m)) return true;
    }
    return false;
  };

  for (let lim = Math.max(h0, 1); lim <= cap; lim++) {
    if (search(st.cross, st.corner, st.edge, lim, -1)) return lim;
  }
  return -1;
}

interface PXBfs { counts: number[]; layers: Int32Array[] }

const pxLayerCache = new Map<string, PXBfs>();

/** Multi-source BFS from the four goals; coordinate packed as cross*576 + corner*24 + edge. */
function pxShallow(frame: Frame): PXBfs {
  const key = `${frame.face}:${frame.slot}`;
  const hit = pxLayerCache.get(key);
  if (hit) return hit;
  const d = pseudoXFrameData(frame);
  const next = crossNext();
  const set = new CoordSet(21); // 770,856 keys at depth 5 → load 0.37
  const pack = (c: number, co: number, e: number) => c * 576 + co * 24 + e;
  const seeds = d.goals.map((g) => pack(g.cross, g.corner, g.edge));
  for (const s of seeds) set.add(s, (s / 576) | 0, s % 576);
  const counts = [seeds.length];
  const layers = [Int32Array.from(seeds)];
  let frontier = layers[0];
  for (let depth = 1; depth <= PX_BFS_DEPTH; depth++) {
    const out: number[] = [];
    for (let i = 0; i < frontier.length; i++) {
      const v = frontier[i];
      const e = v % 24, co = ((v - e) / 24) % 24, c = ((v - e) / 24 - co) / 24;
      const base = c * 18;
      for (let m = 0; m < 18; m++) {
        const nv = pack(next[base + m], CORNER_STEP[m][co], EDGE_STEP[m][e]);
        if (set.add(nv, (nv / 576) | 0, nv % 576)) out.push(nv);
      }
    }
    counts.push(out.length);
    layers.push(Int32Array.from(out));
    frontier = layers[depth];
  }
  const res = { counts, layers };
  pxLayerCache.set(key, res);
  return res;
}

/** Layer sizes 0..PX_BFS_DEPTH — the first six entries of PSEUDO_XCROSS_HISTOGRAM. */
export function pseudoXcrossShallowHistogram(frame: Frame): number[] {
  return pxShallow(frame).counts.slice();
}

/** Uniform pseudo-xcross coordinate with optimal length in [lo,hi]. */
export function samplePseudoXCoord(
  frame: Frame, lo: number, hi: number, rng: () => number, maxTries = 400000,
): { coord: XCoord; depth: number } | null {
  const d = pseudoXFrameData(frame);
  const cappedHi = Math.min(hi, PSEUDO_XCROSS_MAX_DEPTH);
  if (lo > cappedHi) return null;

  if (cappedHi <= PX_BFS_DEPTH) {
    const { counts, layers } = pxShallow(frame);
    let total = 0;
    for (let x = lo; x <= cappedHi; x++) total += counts[x];
    if (!total) return null;
    let r = rng() * total;
    for (let x = lo; x <= cappedHi; x++) {
      r -= counts[x];
      if (r < 0) {
        const v = layers[x][(rng() * layers[x].length) | 0];
        const e = v % 24, co = ((v - e) / 24) % 24, c = ((v - e) / 24 - co) / 24;
        return { coord: { cross: c, corner: co, edge: e }, depth: x };
      }
    }
  }

  for (let t = 0; t < maxTries; t++) {
    const st = randomXCoordLocal(rng);
    const v = pseudoXcrossDistCapped(d, st, cappedHi);
    if (v >= lo) return { coord: st, depth: v };
  }
  return null;
}

/** Uniform draw over the 72,990,720 xcross coordinates (the F2L edge cannot sit in a cross slot). */
function randomXCoordLocal(rng: () => number): XCoord {
  const cross = (rng() * CROSS_STATES) | 0;
  decodeCross(cross, crossBuf);
  let mask = 0;
  for (let k = 0; k < 4; k++) mask |= 1 << (crossBuf[k] >> 1);
  let n = 0;
  for (let s = 0; s < 12; s++) if (!(mask & (1 << s))) freeBuf[n++] = s;
  return { cross, corner: (rng() * 24) | 0, edge: freeBuf[(rng() * n) | 0] * 2 + (rng() < 0.5 ? 0 : 1) };
}

export function pseudoXcrossPins(d: PseudoXFrameData, st: XCoord): Pins {
  decodeCross(st.cross, crossBuf);
  const edgePins: Pin[] = d.crossPieces.map((piece, k) => ({ piece, slot: crossBuf[k] >> 1, ori: crossBuf[k] & 1 }));
  edgePins.push({ piece: d.edgePiece, slot: st.edge >> 1, ori: st.edge & 1 });
  return {
    edgePins,
    cornerPins: [{ piece: d.cornerPiece, slot: (st.corner / 3) | 0, ori: st.corner % 3 }],
  };
}
