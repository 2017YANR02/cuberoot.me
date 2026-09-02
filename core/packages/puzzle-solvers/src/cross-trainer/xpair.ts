/*
 * cross-trainer/xpair — XCross + a free pair (or18's "XCross Pairing"): the cross is solved,
 * one F2L slot is SOLVED, and a second slot's pair is BUILT but not necessarily inserted.
 *
 * It is the two halves we already have, on one cube:
 *   • slot A's goal = both pieces home            → ./xcross's joint tables (exact, single goal)
 *   • slot B's goal = the 17-state pair set       → ./pair's joint tables  (exact, multi-source)
 * Both are exact distances of a relaxation of this problem, so `max` over the four is admissible
 * and the first IDA* iteration that succeeds is the true optimum — the same argument the other
 * stages rest on. Nothing new is enumerated: the coordinate, the uniform draw and the pins are
 * XXCross's (same shape: cross + two corners + two edges).
 *
 * There is no published histogram for this one, so the tests check it the other way round:
 * apply the solution we return and assert the cube really is in the goal set.
 */

import { CORNER_STEP, EDGE_STEP, FACE_EDGES, f2lSlots, skipRow, type FaceIdx } from './model.js';
import { crossNext, encodeCross } from './dist.js';
import { frameData } from './xcross.js';
import { pairFrameData, pairGoals } from './pair.js';
import { randomXXCoord, xxcrossPins, type Pins, type XXCoord, type XXFrame } from './multi.js';

/** or18's cap for the deepest XCross-pair case; used only as a search bound. */
export const XPAIR_MAX_DEPTH = 11;
/** Layers to this depth are enumerated exactly; deeper ones use rejection. */
const BFS_DEPTH = 4;

export interface XPairFrameData {
  face: FaceIdx;
  /** [solved slot, paired slot] — index into f2lSlots(face). */
  slots: [number, number];
  cornerPieces: [number, number];
  edgePieces: [number, number];
  crossPieces: number[];
  crossGoal: number;
  /** Exact dist to (cross solved + slot A home). */
  ccA: Uint8Array; ceA: Uint8Array;
  /** Exact dist to (cross solved + slot B in the pair set). */
  ccB: Uint8Array; ceB: Uint8Array;
  /** Packed goals of slot B (cross*576 + corner*24 + edge). */
  goalSet: Set<number>;
}

const PACK = 576;
const pack = (cross: number, corner: number, edge: number) => cross * PACK + corner * 24 + edge;

const cache = new Map<string, XPairFrameData>();

export function xpairFrameData(frame: XXFrame): XPairFrameData {
  const [a, b] = frame.slots;
  const key = `${frame.face}:${a},${b}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (a === b) throw new Error('XCross-pair needs two distinct slots');
  const slots = f2lSlots(frame.face);
  const solved = frameData({ face: frame.face, slot: a });      // slot A: home
  const paired = pairFrameData({ face: frame.face, slot: b });  // slot B: the 17-state pair set
  const crossPieces = FACE_EDGES[frame.face];
  const data: XPairFrameData = {
    face: frame.face,
    slots: [a, b],
    cornerPieces: [slots[a].corner, slots[b].corner],
    edgePieces: [slots[a].edge, slots[b].edge],
    crossPieces,
    crossGoal: encodeCross(crossPieces[0] * 2, crossPieces[1] * 2, crossPieces[2] * 2, crossPieces[3] * 2),
    ccA: solved.cc, ceA: solved.ce,
    ccB: paired.cc, ceB: paired.ce,
    goalSet: new Set(pairGoals({ face: frame.face, slot: b })),
  };
  cache.set(key, data);
  return data;
}

const isGoal = (d: XPairFrameData, st: XXCoord): boolean =>
  st.cross === d.crossGoal
  && st.c0 === d.cornerPieces[0] * 3 && st.e0 === d.edgePieces[0] * 2
  && d.goalSet.has(pack(st.cross, st.c1, st.e1));

/**
 * Exact optimal length, searched only as far as `cap`; -1 above it. h === 0 does NOT imply the
 * goal here (slot B's heuristic only sees projections of a 17-state set), so membership is
 * tested explicitly — the same care ./pair takes.
 */
export function xpairDistCapped(d: XPairFrameData, st: XXCoord, cap: number): number {
  const next = crossNext();
  const { ccA, ceA, ccB, ceB } = d;
  const h = (cross: number, c0: number, c1: number, e0: number, e1: number): number => {
    const b = cross * 24;
    const x = ccA[b + c0], y = ceA[b + e0], z = ccB[b + c1], w = ceB[b + e1];
    return Math.max(x > y ? x : y, z > w ? z : w);
  };
  const h0 = h(st.cross, st.c0, st.c1, st.e0, st.e1);
  if (h0 > cap) return -1;
  if (h0 === 0 && isGoal(d, st)) return 0;

  const search = (cross: number, c0: number, c1: number, e0: number, e1: number, depth: number, prev: number): boolean => {
    const skip = skipRow(prev);
    const base = cross * 18;
    for (let m = 0; m < 18; m++) {
      if (skip[m]) continue;
      const nc = next[base + m];
      const nc0 = CORNER_STEP[m][c0], nc1 = CORNER_STEP[m][c1];
      const ne0 = EDGE_STEP[m][e0], ne1 = EDGE_STEP[m][e1];
      const nh = h(nc, nc0, nc1, ne0, ne1);
      if (nh >= depth) continue;
      if (depth === 1) {
        if (nh === 0 && isGoal(d, { cross: nc, c0: nc0, c1: nc1, e0: ne0, e1: ne1 })) return true;
        continue;
      }
      if (search(nc, nc0, nc1, ne0, ne1, depth - 1, m)) return true;
    }
    return false;
  };

  for (let lim = Math.max(h0, 1); lim <= cap; lim++) {
    if (search(st.cross, st.c0, st.c1, st.e0, st.e1, lim, -1)) return lim;
  }
  return -1;
}

// ── shallow layers ───────────────────────────────────────────────────────────────────────────

const layerCache = new Map<string, number[][][]>();

/** Layers 0..BFS_DEPTH as [cross, c0, c1, e0, e1] tuples (the goal set is the depth-0 layer). */
function shallowLayers(frame: XXFrame): number[][][] {
  const key = `${frame.face}:${frame.slots[0]},${frame.slots[1]}`;
  const hit = layerCache.get(key);
  if (hit) return hit;
  const d = xpairFrameData(frame);
  const next = crossNext();
  const enc = (c: number, c0: number, c1: number, e0: number, e1: number) =>
    `${c},${c0},${c1},${e0},${e1}`;
  const seen = new Set<string>();
  const layers: number[][][] = [];
  let frontier: number[][] = [];
  for (const g of d.goalSet) {
    const e1 = g % 24, c1 = ((g - e1) / 24) % 24, cross = ((g - e1) / 24 - c1) / 24;
    const t = [cross, d.cornerPieces[0] * 3, c1, d.edgePieces[0] * 2, e1];
    if (seen.has(enc(t[0], t[1], t[2], t[3], t[4]))) continue;
    seen.add(enc(t[0], t[1], t[2], t[3], t[4]));
    frontier.push(t);
  }
  layers.push(frontier);
  for (let depth = 1; depth <= BFS_DEPTH; depth++) {
    const out: number[][] = [];
    for (const [cross, c0, c1, e0, e1] of frontier) {
      const base = cross * 18;
      for (let m = 0; m < 18; m++) {
        const t = [next[base + m], CORNER_STEP[m][c0], CORNER_STEP[m][c1], EDGE_STEP[m][e0], EDGE_STEP[m][e1]];
        const k = enc(t[0], t[1], t[2], t[3], t[4]);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
      }
    }
    layers.push(out);
    frontier = out;
  }
  layerCache.set(key, layers);
  return layers;
}

/** Layer sizes 0..BFS_DEPTH — the shape check the tests pin (|layer 0| = 17 goal placements). */
export function xpairShallowHistogram(frame: XXFrame): number[] {
  return shallowLayers(frame).map((l) => l.length);
}

/** A uniform coordinate whose optimal length is in [lo,hi], or null if the budget ran out. */
export function sampleXPairCoord(
  frame: XXFrame, lo: number, hi: number, rng: () => number, maxTries = 200000,
): { coord: XXCoord; depth: number } | null {
  const cappedHi = Math.min(hi, XPAIR_MAX_DEPTH);
  if (lo > cappedHi) return null;
  if (cappedHi <= BFS_DEPTH) {
    const layers = shallowLayers(frame);
    let total = 0;
    for (let x = lo; x <= cappedHi; x++) total += layers[x].length;
    if (!total) return null;
    let r = rng() * total;
    for (let x = lo; x <= cappedHi; x++) {
      r -= layers[x].length;
      if (r < 0) {
        const t = layers[x][(rng() * layers[x].length) | 0];
        return { coord: { cross: t[0], c0: t[1], c1: t[2], e0: t[3], e1: t[4] }, depth: x };
      }
    }
  }
  const d = xpairFrameData(frame);
  for (let t = 0; t < maxTries; t++) {
    const st = randomXXCoord(rng);
    const v = xpairDistCapped(d, st, cappedHi);
    if (v >= lo) return { coord: st, depth: v };
  }
  return null;
}

/** Coordinate → pins (identical shape to XXCross: 4 cross edges + 2 slot edges, 2 corners). */
export function xpairPins(d: XPairFrameData, st: XXCoord): Pins {
  return xxcrossPins(d, st);
}
