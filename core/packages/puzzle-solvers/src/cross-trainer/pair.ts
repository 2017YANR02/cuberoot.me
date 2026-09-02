/*
 * cross-trainer/pair — exact "cross solved + one F2L pair READY" generation for a fixed frame.
 *
 * Same coordinate as xcross (cross 190,080 × slot corner 24 × slot edge 16 = 72,990,720); what
 * changes is that the goal is a SET, not a single state. DEFINITIONS.md § Pair Analyzer: the
 * corner+edge of one slot form a Pair iff Setup (NULL / U / U2 / U') followed by Insert (NULL,
 * or one of `L U L'`, `L U' L'`, `B' U B`, `B' U' B` for the BL slot) brings both home.
 *
 * Nothing here is hand-written; both the formulas and the goal set are derived:
 *   • Insert = A · T^±1 · A⁻¹, where T is the top face (opposite the cross) and A is the quarter
 *     turn of one of the slot's two side faces that LIFTS the slot corner into the top layer.
 *     For a D cross + BL slot that resolves to exactly or18's four formulas, in the frame's own
 *     letters; every other slot/cross colour comes out of the same rule for free.
 *   • Goal set = the (corner, edge) coords among 24×24 that some Setup×Insert sends home. 17 of
 *     them — or18's measured depth-0 count for their Free Pair trainer. The ORDER is what makes
 *     it 17: a Setup after the insert would be a trailing top-face turn, which cannot help (it
 *     never touches the finished pair), collapsing the set to the 5 states the inserts alone
 *     reach — measured, see the test file.
 *   • Pseudo = that set closed under the four turns of the CROSS face (the D/D2/D' offset the
 *     Pseudo analyzer allows) → 68 = 4 × 17, no collisions.
 *
 * Exhaustive BFS over all 72,990,720 states (tests, PAIR_FULL_BFS=1) gives
 *   Pair   17, 255, 3102, 35217, 367070, 3184390, 18621816, 41028188, 9746797, 3868   (max 9)
 *   Pseudo 68, 816, 9256, 103681, 1012687, 7689281, 32089788, 30868369, 1216774       (max 8)
 * — the published prefixes, and where PAIR_MAX_DEPTH / PSEUDO_PAIR_MAX_DEPTH come from.
 *
 * Why the candidate scan may start from a solved cross only: a setup is a top-face turn (never
 * touches the cross layer) and every insert is a conjugate A·T^±1·A⁻¹ whose A⁻¹ puts back the one
 * cross edge A lifted, so the whole product acts as the IDENTITY on the cross coordinate. A start
 * with a broken cross therefore ends with a broken cross and can never be a goal — and "cross
 * solved" is part of the stage definition anyway. (This is also why the goal test has to look at
 * the whole cube coordinate, not just the pair: the insert does disturb cross pieces mid-way.)
 *
 * Heuristic: max(dist(cross+corner), dist(cross+edge)), the xcross tables — but rebuilt as
 * MULTI-SOURCE BFS from the PROJECTIONS of the goal set. That is what keeps them admissible: any
 * path s → g with g a goal projects, move for move, onto a path from s's projection to g's
 * projection, and the latter is a BFS source, so the table value is ≤ the true optimal length.
 * (Single-source tables aimed at the fully-inserted pair would over-estimate — an already-ready
 * pair sits several moves from "inserted" — and IDA* would then report a wrong optimum.)
 * The flip side: h === 0 no longer means "goal", it only means "both projections arrived", so the
 * search has to test set membership explicitly.
 */

import {
  CORNER_STEP, EDGE_STEP, FACE_CORNERS, FACE_EDGES, MOVE_FACE, MOVE_NAMES,
  f2lSlots, skipRow, type F2lSlot, type FaceIdx,
} from './model.js';
import { CROSS_STATES, crossNext, decodeCross, encodeCross } from './dist.js';
import { randomXCoord, type XCoord } from './xcross.js';
import type { Pin } from './fill.js';

export const PAIR_STATES = 72990720;
/** Published maxima, re-verified by the exhaustive BFS above: Free Pair 9, Pseudo Free Pair 8. */
export const PAIR_MAX_DEPTH = 9;
export const PSEUDO_PAIR_MAX_DEPTH = 8;
/**
 * The whole histograms of one frame, from that BFS (`PAIR_FULL_BFS=1`). Exported because
 * /scramble/stats ships them as an exhaustive dataset and both places must read one number:
 * a prefix that agrees with or18 and a tail that only lived in a comment is not a source.
 */
export const PAIR_HISTOGRAM: readonly number[] =
  [17, 255, 3102, 35217, 367070, 3184390, 18621816, 41028188, 9746797, 3868];
export const PSEUDO_PAIR_HISTOGRAM: readonly number[] =
  [68, 816, 9256, 103681, 1012687, 7689281, 32089788, 30868369, 1216774];
/** Layers up to this depth are enumerated exactly; deeper ones use rejection. */
const BFS_DEPTH = 5;

/** Packing of the full coordinate: cross · 576 + corner · 24 + edge (< 2³¹). */
const PACK = 576;
const pack = (cross: number, corner: number, edge: number) => cross * PACK + corner * 24 + edge;

export interface PairFrame {
  face: FaceIdx;
  /** Index into f2lSlots(face). */
  slot: number;
  /** Allow the cross to sit D-rotated (Pseudo Pair Analyzer). */
  pseudo?: boolean;
}

export interface PairFrameData {
  face: FaceIdx;
  pseudo: boolean;
  cornerPiece: number;
  edgePiece: number;
  crossPieces: number[];
  /** Cross coordinate of the solved cross for this face. */
  crossGoal: number;
  /** The goal SET, packed; 17 for Pair, 68 for Pseudo Pair. */
  goals: Int32Array;
  goalSet: Set<number>;
  /** dist to the projected goal set on (cross, tracked corner), indexed crossIdx*24 + coord. */
  cc: Uint8Array;
  /** dist to the projected goal set on (cross, tracked edge), indexed crossIdx*24 + coord. */
  ce: Uint8Array;
  maxDepth: number;
}

/** One coordinate: cross index + corner coord (slot*3+ori) + edge coord (slot*2+ori). */
export type PairCoord = XCoord;

const mv = (f: number, power: number) => f * 3 + power - 1;
const invMove = (m: number) => MOVE_FACE[m] * 3 + (2 - (m % 3));

// ── Setup × Insert, derived in the frame's own letters ───────────────────────────────────────

/** The two faces of the slot other than the cross face (the slot's "side" faces). */
function slotSides(face: FaceIdx, s: F2lSlot): FaceIdx[] {
  return ([0, 1, 2, 3, 4, 5] as FaceIdx[]).filter((x) => x !== face && FACE_CORNERS[x].includes(s.corner));
}

/**
 * The quarter turn of side face `x` that lifts the slot corner into the top layer. Exactly one of
 * x / x' does: the slot corner is a bottom cubie of x, so one quarter turn takes it up and the
 * other slides it along the cross layer.
 */
function liftMove(face: FaceIdx, x: FaceIdx, cornerPiece: number): number {
  const top = ((face + 3) % 6) as FaceIdx;
  for (const power of [1, 3]) {
    const m = mv(x, power);
    if (FACE_CORNERS[top].includes((CORNER_STEP[m][cornerPiece * 3] / 3) | 0)) return m;
  }
  throw new Error(`no lifting quarter turn for face ${x}`);
}

/** The five Inserts (NULL first) as move-index lists. */
function inserts(face: FaceIdx, s: F2lSlot): number[][] {
  const top = ((face + 3) % 6) as FaceIdx;
  const out: number[][] = [[]];
  for (const x of slotSides(face, s)) {
    const a = liftMove(face, x, s.corner);
    for (const power of [1, 3]) out.push([a, mv(top, power), invMove(a)]);
  }
  return out;
}

/** The 20 Setup×Insert products (Setup applied FIRST). */
function setupInsertProducts(face: FaceIdx, s: F2lSlot): number[][] {
  const top = ((face + 3) % 6) as FaceIdx;
  const setups: number[][] = [[], [mv(top, 1)], [mv(top, 2)], [mv(top, 3)]];
  const out: number[][] = [];
  for (const setup of setups) for (const ins of inserts(face, s)) out.push([...setup, ...ins]);
  return out;
}

/** The five Insert formulas of a frame, human-readable ('' = NULL). For tests / UI. */
export function pairInsertNames(frame: PairFrame): string[] {
  const s = f2lSlots(frame.face)[frame.slot];
  return inserts(frame.face, s).map((seq) => seq.map((m) => MOVE_NAMES[m]).join(' '));
}

/**
 * The goal set: every (corner, edge) coord pair, on a solved cross, that some Setup×Insert takes
 * to (cross solved, corner home, edge home). Scanned over all 24×24 coords — including the eight
 * edge coords that cannot coexist with a solved cross; they simply never qualify, because a
 * tracked edge sharing a slot with a cross edge moves in lockstep with it and so returns to that
 * same slot when the cross does.
 */
function deriveGoals(face: FaceIdx, s: F2lSlot, crossGoal: number): number[] {
  const next = crossNext();
  const seqs = setupInsertProducts(face, s);
  const target = pack(crossGoal, s.corner * 3, s.edge * 2);
  const goals: number[] = [];
  for (let c = 0; c < 24; c++) {
    for (let e = 0; e < 24; e++) {
      for (const seq of seqs) {
        let cross = crossGoal, corner = c, edge = e;
        for (const m of seq) {
          cross = next[cross * 18 + m];
          corner = CORNER_STEP[m][corner];
          edge = EDGE_STEP[m][edge];
        }
        if (pack(cross, corner, edge) === target) { goals.push(pack(crossGoal, c, e)); break; }
      }
    }
  }
  return goals;
}

/** Close a goal set under the four turns of the cross face (Pseudo: the cross may sit D-offset). */
function closeUnderCrossTurns(face: FaceIdx, goals: number[]): number[] {
  const next = crossNext();
  const m = mv(face, 1);
  const out = new Set<number>();
  for (const g of goals) {
    let edge = g % 24, corner = ((g - edge) / 24) % 24, cross = ((g - edge) / 24 - corner) / 24;
    for (let k = 0; k < 4; k++) {
      out.add(pack(cross, corner, edge));
      cross = next[cross * 18 + m];
      corner = CORNER_STEP[m][corner];
      edge = EDGE_STEP[m][edge];
    }
  }
  return [...out].sort((a, b) => a - b);
}

// ── tables ───────────────────────────────────────────────────────────────────────────────────

const frameCache = new Map<string, PairFrameData>();
const goalCache = new Map<string, Int32Array>();
const frameKey = (f: PairFrame) => `${f.face}:${f.slot}:${f.pseudo ? 'p' : 'x'}`;

/**
 * The derived goal set, packed as cross*576 + corner*24 + edge. 17 for Pair, 68 for Pseudo.
 * Kept separate from the heuristic tables so asking for the set (UI preview, the 17/68 gate)
 * costs a few hundred move applications instead of two 4.6 MB BFS.
 */
export function pairGoals(frame: PairFrame): Int32Array {
  const key = frameKey(frame);
  const hit = goalCache.get(key);
  if (hit) return hit;
  const s = f2lSlots(frame.face)[frame.slot];
  const crossPieces = FACE_EDGES[frame.face];
  const crossGoal = encodeCross(crossPieces[0] * 2, crossPieces[1] * 2, crossPieces[2] * 2, crossPieces[3] * 2);
  const base = deriveGoals(frame.face, s, crossGoal);
  const goals = Int32Array.from(frame.pseudo ? closeUnderCrossTurns(frame.face, base) : base);
  goalCache.set(key, goals);
  return goals;
}

/** Multi-source BFS over (cross coordinate × one tracked piece coordinate). */
function buildJoint(sources: Iterable<number>, step: readonly Int8Array[]): Uint8Array {
  const next = crossNext();
  const dist = new Uint8Array(CROSS_STATES * 24).fill(255);
  const seeds: number[] = [];
  for (const s of sources) if (dist[s] === 255) { dist[s] = 0; seeds.push(s); }
  let frontier = Int32Array.from(seeds);
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

export function pairFrameData(frame: PairFrame): PairFrameData {
  const key = frameKey(frame);
  const hit = frameCache.get(key);
  if (hit) return hit;
  const s = f2lSlots(frame.face)[frame.slot];
  const crossPieces = FACE_EDGES[frame.face];
  const crossGoal = encodeCross(crossPieces[0] * 2, crossPieces[1] * 2, crossPieces[2] * 2, crossPieces[3] * 2);
  const goals = pairGoals(frame);

  // Projections: (cross, corner) and (cross, edge) of every goal — the BFS sources.
  const cSrc = new Set<number>(), eSrc = new Set<number>();
  for (const g of goals) {
    const edge = g % 24, corner = ((g - edge) / 24) % 24, cross = ((g - edge) / 24 - corner) / 24;
    cSrc.add(cross * 24 + corner);
    eSrc.add(cross * 24 + edge);
  }

  const data: PairFrameData = {
    face: frame.face,
    pseudo: !!frame.pseudo,
    cornerPiece: s.corner,
    edgePiece: s.edge,
    crossPieces,
    crossGoal,
    goals,
    goalSet: new Set(goals),
    cc: buildJoint(cSrc, CORNER_STEP),
    ce: buildJoint(eSrc, EDGE_STEP),
    maxDepth: frame.pseudo ? PSEUDO_PAIR_MAX_DEPTH : PAIR_MAX_DEPTH,
  };
  frameCache.set(key, data);
  return data;
}

// ── exact distance ───────────────────────────────────────────────────────────────────────────

/**
 * Exact optimal length, searched only as far as `cap`. Returns -1 when it exceeds `cap`.
 * h is admissible, so the first depth at which the search succeeds is the true optimum; but h
 * only sees projections, so reaching h === 0 must still be confirmed against the goal set.
 */
export function pairDistCapped(d: PairFrameData, st: PairCoord, cap: number): number {
  const next = crossNext();
  const { cc, ce, goalSet } = d;
  const h0 = Math.max(cc[st.cross * 24 + st.corner], ce[st.cross * 24 + st.edge]);
  if (h0 > cap) return -1;
  if (h0 === 0 && goalSet.has(pack(st.cross, st.corner, st.edge))) return 0;

  const search = (cross: number, corner: number, edge: number, depth: number, prev: number): boolean => {
    const skip = skipRow(prev);
    const base = cross * 18;
    for (let m = 0; m < 18; m++) {
      if (skip[m]) continue;
      const nc = next[base + m];
      const ncorner = CORNER_STEP[m][corner];
      const nedge = EDGE_STEP[m][edge];
      const h = Math.max(cc[nc * 24 + ncorner], ce[nc * 24 + nedge]);
      if (h >= depth) continue;               // admissible → cannot finish in the remaining plies
      if (depth === 1) {
        if (h === 0 && goalSet.has(pack(nc, ncorner, nedge))) return true;
        continue;
      }
      if (search(nc, ncorner, nedge, depth - 1, m)) return true;
    }
    return false;
  };

  for (let lim = Math.max(h0, 1); lim <= cap; lim++) {
    if (search(st.cross, st.corner, st.edge, lim, -1)) return lim;
  }
  return -1;
}

// ── shallow layers: multi-source BFS out of the goal set ─────────────────────────────────────

const layerCache = new Map<string, Int32Array[]>();

/**
 * Exact layers 0..BFS_DEPTH. A 13.7 MB bitset marks `seen` — the layers get into the millions.
 * Needs only the goal set, not the heuristic tables, so a shallow request never pays for them.
 */
function shallowLayers(frame: PairFrame): Int32Array[] {
  const key = frameKey(frame);
  const hit = layerCache.get(key);
  if (hit) return hit;
  const goals = pairGoals(frame);
  const next = crossNext();
  const seen = new Uint32Array((CROSS_STATES * PACK + 31) >>> 5);
  const mark = (v: number): boolean => {
    const w = v >>> 5, b = 1 << (v & 31);
    if (seen[w] & b) return false;
    seen[w] |= b;
    return true;
  };
  for (let i = 0; i < goals.length; i++) mark(goals[i]);
  const layers: Int32Array[] = [goals.slice()];
  let frontier = layers[0];
  for (let depth = 1; depth <= BFS_DEPTH; depth++) {
    const out: number[] = [];
    for (let i = 0; i < frontier.length; i++) {
      const v = frontier[i];
      const e = v % 24, co = ((v - e) / 24) % 24, c = ((v - e) / 24 - co) / 24;
      const base = c * 18;
      for (let m = 0; m < 18; m++) {
        const nv = next[base + m] * PACK + CORNER_STEP[m][co] * 24 + EDGE_STEP[m][e];
        if (mark(nv)) out.push(nv);
      }
    }
    frontier = new Int32Array(out);
    layers.push(frontier);
  }
  layerCache.set(key, layers);
  return layers;
}

/** Layer sizes 0..BFS_DEPTH — asserted against or18's published histograms in the tests. */
export function pairShallowHistogram(frame: PairFrame): number[] {
  return shallowLayers(frame).map((l) => l.length);
}

// ── sampling ─────────────────────────────────────────────────────────────────────────────────

/** Uniform draw from the whole 72,990,720-state coordinate space (shared with xcross). */
export const randomPairCoord = randomXCoord;

/**
 * A uniform coordinate with optimal length in [lo,hi] for this frame.
 * Shallow windows come out of the enumerated layers; deeper ones by rejection on uniform draws.
 * Both routes are exactly uniform over the states with that optimal length.
 */
export function samplePairCoord(
  frame: PairFrame, lo: number, hi: number, rng: () => number, maxTries = 200000,
): { coord: PairCoord; depth: number } | null {
  const cappedHi = Math.min(hi, frame.pseudo ? PSEUDO_PAIR_MAX_DEPTH : PAIR_MAX_DEPTH);
  if (lo > cappedHi) return null;

  // Only the rejection route needs the heuristic; a shallow request must not trigger its build.
  if (cappedHi <= BFS_DEPTH) {
    const layers = shallowLayers(frame);
    let total = 0;
    for (let x = lo; x <= cappedHi; x++) total += layers[x].length;
    if (!total) return null;
    let r = rng() * total;
    for (let x = lo; x <= cappedHi; x++) {
      r -= layers[x].length;
      if (r < 0) {
        const l = layers[x];
        const v = l[(rng() * l.length) | 0];
        const e = v % 24, co = ((v - e) / 24) % 24, c = ((v - e) / 24 - co) / 24;
        return { coord: { cross: c, corner: co, edge: e }, depth: x };
      }
    }
  }

  const d = pairFrameData(frame);
  for (let t = 0; t < maxTries; t++) {
    const st = randomPairCoord(rng);
    const v = pairDistCapped(d, st, cappedHi);
    if (v >= lo) return { coord: st, depth: v };
  }
  return null;
}

const crossScratch = new Int8Array(4);

/** Coordinate → the pinned pieces fillState() needs (4 cross edges + the slot's corner & edge). */
export function pairPins(d: PairFrameData, coord: PairCoord): { edgePins: Pin[]; cornerPins: Pin[] } {
  decodeCross(coord.cross, crossScratch);
  const edgePins: Pin[] = d.crossPieces.map((piece, k) => ({
    piece, slot: crossScratch[k] >> 1, ori: crossScratch[k] & 1,
  }));
  edgePins.push({ piece: d.edgePiece, slot: coord.edge >> 1, ori: coord.edge & 1 });
  const cornerPins: Pin[] = [{ piece: d.cornerPiece, slot: (coord.corner / 3) | 0, ori: coord.corner % 3 }];
  return { edgePins, cornerPins };
}
