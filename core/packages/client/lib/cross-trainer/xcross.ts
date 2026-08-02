/*
 * cross-trainer/xcross — exact XCross (cross + one F2L slot) generation for a fixed frame.
 *
 * Coordinate: cross (190,080) × slot corner (24) × slot edge (16 free slots·flips given the
 * cross) = 72,990,720 — or18's number, and far too big to enumerate in a browser (their
 * XCross trainer spends ~14 s and ~630 MB doing exactly that). We never build it:
 *
 *   • heuristic  = max(dist(cross+corner), dist(cross+edge)) — two 4.56 MB BFS tables over the
 *     190,080·24 sub-coordinates. Both are EXACT distances for their sub-goal, hence admissible,
 *     so IDA* returns the true optimal length (a lower-bound pruning table would not).
 *   • shallow d  = multi-source BFS from the goal, giving the layer verbatim (uniform pick).
 *   • deeper d   = rejection on uniform coordinates. A draw costs one IDA* that never searches
 *     past `hi`, so even the 0.05 %-rare depth 10 costs ~2k cheap searches.
 *
 * Both routes are exactly uniform over the states with that optimal length.
 */

import { CORNER_STEP, EDGE_STEP, FACE_EDGES, f2lSlots, skipRow, type FaceIdx } from './model';
import { crossNext, encodeCross, decodeCross, CROSS_STATES } from './dist';

export const XCROSS_STATES = 72990720;
export const XCROSS_MAX_DEPTH = 10;
/** Layers up to this depth are enumerated exactly; deeper ones use rejection. */
const BFS_DEPTH = 5;

export interface Frame {
  face: FaceIdx;
  /** Index into f2lSlots(face). */
  slot: number;
}

export interface FrameData {
  face: FaceIdx;
  cornerPiece: number;
  edgePiece: number;
  crossPieces: number[];
  /** Cross coordinate of the solved cross for this face. */
  crossGoal: number;
  /** dist to (cross solved + tracked corner home), indexed crossIdx*24 + cornerCoord. */
  cc: Uint8Array;
  /** dist to (cross solved + tracked edge home), indexed crossIdx*24 + edgeCoord. */
  ce: Uint8Array;
  /** Edge coords (slot*2+ori) that are legal given a cross coordinate — computed per draw. */
}

const frameCache = new Map<string, FrameData>();

/** BFS over (cross coordinate × one tracked piece coordinate); exact distance to both home. */
function buildJoint(crossGoal: number, pieceGoal: number, step: readonly Int8Array[]): Uint8Array {
  const next = crossNext();
  const dist = new Uint8Array(CROSS_STATES * 24).fill(255);
  const start = crossGoal * 24 + pieceGoal;
  dist[start] = 0;
  let frontier = new Int32Array([start]);
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

export function frameData(frame: Frame): FrameData {
  const key = `${frame.face}:${frame.slot}`;
  const hit = frameCache.get(key);
  if (hit) return hit;
  const slots = f2lSlots(frame.face);
  const s = slots[frame.slot];
  const crossPieces = FACE_EDGES[frame.face];
  const crossGoal = encodeCross(crossPieces[0] * 2, crossPieces[1] * 2, crossPieces[2] * 2, crossPieces[3] * 2);
  const data: FrameData = {
    face: frame.face,
    cornerPiece: s.corner,
    edgePiece: s.edge,
    crossPieces,
    crossGoal,
    cc: buildJoint(crossGoal, s.corner * 3, CORNER_STEP),
    ce: buildJoint(crossGoal, s.edge * 2, EDGE_STEP),
  };
  frameCache.set(key, data);
  return data;
}

/** One xcross coordinate: cross index + corner coord (slot*3+ori) + edge coord (slot*2+ori). */
export interface XCoord { cross: number; corner: number; edge: number }

const dfsScratch = new Int8Array(4);

/**
 * Exact optimal length, searched only as far as `cap`. Returns -1 when it exceeds `cap`
 * (that is all a rejection loop needs, and it keeps the deep tail affordable).
 */
export function xcrossDistCapped(d: FrameData, st: XCoord, cap: number): number {
  const next = crossNext();
  const h0 = Math.max(d.cc[st.cross * 24 + st.corner], d.ce[st.cross * 24 + st.edge]);
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
      const h = Math.max(d.cc[nc * 24 + ncorner], d.ce[nc * 24 + nedge]);
      if (h >= depth) continue;               // admissible → cannot finish in the remaining plies
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

/** Edge coords legal for a given cross coordinate (the F2L edge cannot sit in a cross slot). */
function freeEdgeCoords(crossIdx: number, out: Int8Array): number {
  decodeCross(crossIdx, dfsScratch);
  let mask = 0;
  for (let k = 0; k < 4; k++) mask |= 1 << (dfsScratch[k] >> 1);
  let n = 0;
  for (let s = 0; s < 12; s++) {
    if (mask & (1 << s)) continue;
    out[n++] = s * 2; out[n++] = s * 2 + 1;
  }
  return n; // always 16
}

const freeBuf = new Int8Array(24);

/** Uniform draw from the whole 72,990,720-state coordinate space. */
export function randomXCoord(rng: () => number): XCoord {
  const cross = (rng() * CROSS_STATES) | 0;
  const n = freeEdgeCoords(cross, freeBuf);
  return { cross, corner: (rng() * 24) | 0, edge: freeBuf[(rng() * n) | 0] };
}

// ── shallow layers: multi-source BFS from the goal ────────────────────────────────────────────

const layerCache = new Map<string, Map<number, number[]>>();

/** Exact layers 0..BFS_DEPTH for a frame, keyed by depth; coordinate packed as cross*576+c*24+e. */
function shallowLayers(frame: Frame, d: FrameData): Map<number, number[]> {
  const key = `${frame.face}:${frame.slot}`;
  const hit = layerCache.get(key);
  if (hit) return hit;
  const next = crossNext();
  const pack = (c: number, co: number, e: number) => c * 576 + co * 24 + e;
  const goal = pack(d.crossGoal, d.cornerPiece * 3, d.edgePiece * 2);
  const seen = new Set<number>([goal]);
  const layers = new Map<number, number[]>([[0, [goal]]]);
  let frontier = [goal];
  for (let depth = 1; depth <= BFS_DEPTH; depth++) {
    const out: number[] = [];
    for (const v of frontier) {
      const e = v % 24, co = ((v - e) / 24) % 24, c = ((v - e) / 24 - co) / 24;
      const base = c * 18;
      for (let m = 0; m < 18; m++) {
        const nv = pack(next[base + m], CORNER_STEP[m][co], EDGE_STEP[m][e]);
        if (!seen.has(nv)) { seen.add(nv); out.push(nv); }
      }
    }
    layers.set(depth, out);
    frontier = out;
  }
  layerCache.set(key, layers);
  return layers;
}

/** Layer sizes 0..BFS_DEPTH — asserted against or18's published histogram in the tests. */
export function xcrossShallowHistogram(frame: Frame): number[] {
  const d = frameData(frame);
  const layers = shallowLayers(frame, d);
  return Array.from({ length: BFS_DEPTH + 1 }, (_, i) => layers.get(i)!.length);
}

/**
 * A uniform xcross coordinate with optimal length in [lo,hi] for this frame.
 * Shallow windows come out of the enumerated layers; deeper ones by rejection.
 */
export function sampleXCoord(frame: Frame, lo: number, hi: number, rng: () => number, maxTries = 200000): { coord: XCoord; depth: number } | null {
  const d = frameData(frame);
  const cappedHi = Math.min(hi, XCROSS_MAX_DEPTH);
  if (lo > cappedHi) return null;

  // Entirely inside the enumerated range → pick the depth by true layer size, then uniformly.
  if (cappedHi <= BFS_DEPTH) {
    const layers = shallowLayers(frame, d);
    let total = 0;
    for (let x = lo; x <= cappedHi; x++) total += layers.get(x)!.length;
    if (!total) return null;
    let r = rng() * total;
    for (let x = lo; x <= cappedHi; x++) {
      r -= layers.get(x)!.length;
      if (r < 0) {
        const l = layers.get(x)!;
        const v = l[(rng() * l.length) | 0];
        const e = v % 24, co = ((v - e) / 24) % 24, c = ((v - e) / 24 - co) / 24;
        return { coord: { cross: c, corner: co, edge: e }, depth: x };
      }
    }
  }

  for (let t = 0; t < maxTries; t++) {
    const st = randomXCoord(rng);
    const v = xcrossDistCapped(d, st, cappedHi);
    if (v >= lo) return { coord: st, depth: v };
  }
  return null;
}
