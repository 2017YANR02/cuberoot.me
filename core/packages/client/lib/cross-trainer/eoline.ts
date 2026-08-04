/*
 * cross-trainer/eoline — ZZ's two openers, both small enough to enumerate outright.
 *
 *   pure EO   every edge oriented against one axis.        2,048 states.
 *   EOLine    that, plus the two "line" edges home.        2,048 × 132 = 270,336 states.
 *
 * Both are the same factorisation ./eo uses for EOCross (the flip word is indexed by SLOT, so it
 * transitions independently of where the tracked pieces are), just with 2 tracked edges instead of
 * 4 — or none. At this size the whole "sample, measure, reject" apparatus is beside the point: one
 * BFS from the solved state fills the table in milliseconds and every depth, including the
 * deepest, is then an O(1) draw out of an enumerated layer.
 *
 * Frames. Orientation only means something relative to an axis, and a line is two opposite edges
 * of a face along an axis — so a frame is (face, axis) with the axis perpendicular to the face,
 * the same pairing ./eo uses for EOCross. A colour admits BOTH perpendicular axes and the site
 * takes the better of the two (`solver/src/eoline_solver.rs`), so "EOLine, yellow" means the
 * easier of the DF/DB and DL/DR lines — six colours name twelve lines. Pure EO has no line, so
 * its frames collapse onto the axis alone: three of them, however many colours are picked.
 */

import type { CubieCube } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import { EDGE_STEP, FACE_EDGES, slotRank, slotUnrank, type FaceIdx } from './model';
import {
  EO_WORD_STATES, defaultEoAxis, eoAxisData, eoPins, eoWord, type EoAxis,
} from './eo';
import { CANON_FACE, inverseRotation, rotForFaceAxis, rotateState } from './rotate';
import { fillState, type Pin } from './fill';

/** Ordered slots of the two line edges. */
export const LINE_POS_STATES = 12 * 11;              // 132
export const EOLINE_STATES = EO_WORD_STATES * LINE_POS_STATES;   // 270,336

/**
 * Diameters, from the BFS below — exhaustive counts, not search bounds.
 * `tests/cross_trainer_eoline.test.ts` re-derives both, so changing them changes the table.
 */
export const EO_MAX_DEPTH = 7;
export const EOLINE_MAX_DEPTH = 9;

/** The two edges of `face` lying on `axis` — the line of the (colour, axis) frame. */
export function linePieces(face: FaceIdx, axis: EoAxis): number[] {
  const on = [axis, axis + 3];
  return FACE_EDGES[face].filter((e) => on.some((f) => FACE_EDGES[f].includes(e)));
}

/** The canonical EOLine frame every table here is built for: D face, F/B axis → the DF/DB line. */
export const CANON_AXIS: EoAxis = defaultEoAxis(CANON_FACE);
export const CANON_LINE = linePieces(CANON_FACE, CANON_AXIS);
/** The rotation carrying a (colour, axis) EOLine frame onto the canonical one. */
export const rotForLine = (face: FaceIdx, axis: EoAxis): number => {
  // An axis parallel to the face is not a line at all; `rotForFaceAxis` would answer -1 and the
  // rotation would then fail deep inside with an unreadable error. Say so here, like ./eo does.
  if (axis === (face % 3)) throw new Error(`EO axis ${axis} is the face's own axis — not an EOLine`);
  return rotForFaceAxis(face, axis);
};

// ── pure EO ──────────────────────────────────────────────────────────────────────────────────

/** Packed flip word of a state, measured against `axis` (the coordinate, 0..2047). */
export function eoWordOf(state: CubieCube, axis: EoAxis): number {
  const { delta } = eoAxisData(axis);
  let word = 0;
  for (let s = 0; s < 12; s++) word |= (state.eo[s] ^ delta[state.ep[s] * 12 + s]) << s;
  return word >> 1;   // bit 0 is redundant (flip parity is even)
}

/** Exact optimal length of the pure-EO stage, or -1 above `cap`. */
export function eoDistCapped(state: CubieCube, axis: EoAxis, cap: number): number {
  const v = eoAxisData(axis).dist[eoWordOf(state, axis)];
  return v <= cap ? v : -1;
}

const eoLayerCache = new Map<EoAxis, { hist: number[]; layer: Int32Array; start: Int32Array }>();

/** The 2,048 flip words bucketed by optimal length. */
function eoLayers(axis: EoAxis) {
  const hit = eoLayerCache.get(axis);
  if (hit) return hit;
  const { dist } = eoAxisData(axis);
  const hist: number[] = [];
  for (const d of dist) { while (hist.length <= d) hist.push(0); hist[d]++; }
  const start = new Int32Array(hist.length + 1);
  for (let d = 0; d < hist.length; d++) start[d + 1] = start[d] + hist[d];
  const cursor = start.slice();
  const layer = new Int32Array(EO_WORD_STATES);
  for (let i = 0; i < EO_WORD_STATES; i++) layer[cursor[dist[i]]++] = i;
  const out = { hist, layer, start };
  eoLayerCache.set(axis, out);
  return out;
}

/** Layer sizes of pure EO, index = optimal length. Sums to 2,048. */
export const eoHistogram = (axis: EoAxis): number[] => eoLayers(axis).hist.slice();

/** One uniformly random legal cube whose EO against `axis` is exactly `depth` moves. */
export function sampleEoState(
  axis: EoAxis, lo: number, hi: number, rng: () => number,
): { state: CubieCube; depth: number } | null {
  const got = pickLayer(eoLayers(axis), lo, hi, rng);
  if (!got) return null;
  const { delta } = eoAxisData(axis);
  return { state: fillState(eoPins(delta, [], [], eoWord(got.value), rng), [], rng), depth: got.depth };
}

// ── EOLine ───────────────────────────────────────────────────────────────────────────────────

/** posNext[pos*18 + m] over the 132 ordered slot pairs. Orientation never enters it. */
let posNextCache: Int32Array | null = null;
function linePosNext(): Int32Array {
  if (posNextCache) return posNextCache;
  const t = new Int32Array(LINE_POS_STATES * 18);
  const slots = new Int8Array(2), ns = new Int8Array(2);
  for (let i = 0; i < LINE_POS_STATES; i++) {
    slotUnrank(i, 2, slots);
    for (let m = 0; m < 18; m++) {
      for (let k = 0; k < 2; k++) ns[k] = EDGE_STEP[m][slots[k] * 2] >> 1;
      t[i * 18 + m] = slotRank(ns, 2);
    }
  }
  posNextCache = t;
  return t;
}

/** Table index. eo-major, so the 132-byte position block is the BFS's whole working set. */
const linePack = (eo: number, pos: number): number => eo * LINE_POS_STATES + pos;

interface LineTable { dist: Uint8Array; hist: number[]; layer: Int32Array; start: Int32Array }
let lineCache: LineTable | null = null;

function buildLine(): LineTable {
  const posNext = linePosNext();
  const { next: eoNext } = eoAxisData(CANON_AXIS);
  const goal = linePack(0, slotRank(CANON_LINE, 2));
  const dist = new Uint8Array(EOLINE_STATES).fill(255);
  dist[goal] = 0;
  const hist = [1];
  let frontier = [goal];
  let filled = 1;
  for (let depth = 0; filled < EOLINE_STATES; depth++) {
    const nf: number[] = [];
    for (const v of frontier) {
      const pos = v % LINE_POS_STATES, eo = (v / LINE_POS_STATES) | 0;
      const prow = pos * 18, erow = eo * 18;
      for (let m = 0; m < 18; m++) {
        const t = eoNext[erow + m] * LINE_POS_STATES + posNext[prow + m];
        if (dist[t] === 255) { dist[t] = depth + 1; nf.push(t); }
      }
    }
    hist.push(nf.length);
    filled += nf.length;
    frontier = nf;
  }
  const start = new Int32Array(hist.length + 1);
  for (let d = 0; d < hist.length; d++) start[d + 1] = start[d] + hist[d];
  const cursor = start.slice();
  const layer = new Int32Array(EOLINE_STATES);
  for (let i = 0; i < EOLINE_STATES; i++) layer[cursor[dist[i]]++] = i;
  return { dist, hist, layer, start };
}

const lineTable = (): LineTable => (lineCache ??= buildLine());

/** Layer sizes of EOLine, index = optimal length. Sums to 270,336. */
export const eoLineHistogram = (): number[] => lineTable().hist.slice();

/** Every canonical-frame coordinate at exactly `depth` — /scramble/stats lists a layer whole. */
export function eoLineLayer(depth: number): number[] {
  const { layer, start, hist } = lineTable();
  if (depth < 0 || depth >= hist.length) return [];
  return Array.from(layer.slice(start[depth], start[depth + 1]));
}

/** A canonical-frame coordinate as twelve edge pins (the line placed, the rest shuffled by `rng`). */
export function eoLinePins(coord: number, rng: () => number): Pin[] {
  const slots = new Int8Array(2);
  slotUnrank(coord % LINE_POS_STATES, 2, slots);
  const { delta } = eoAxisData(CANON_AXIS);
  return eoPins(delta, CANON_LINE, slots, eoWord((coord / LINE_POS_STATES) | 0), rng);
}

/** The canonical frame's EOLine coordinate of a state already rotated into that frame. */
export function eoLineCoordOf(state: CubieCube): number {
  const slots = new Int8Array(2);
  for (let k = 0; k < 2; k++) slots[k] = state.ep.indexOf(CANON_LINE[k]);
  return linePack(eoWordOf(state, CANON_AXIS), slotRank(slots, 2));
}

/** Exact EOLine length for one (colour, axis) frame, or -1 above `cap`. */
export function eoLineDist(state: CubieCube, face: FaceIdx, axis: EoAxis, cap: number): number {
  const v = lineTable().dist[eoLineCoordOf(rotateState(state, rotForLine(face, axis)))];
  return v <= cap ? v : -1;
}

/** One uniformly random legal cube whose EOLine for that frame is exactly `depth` moves. */
export function sampleEoLineState(
  face: FaceIdx, axis: EoAxis, lo: number, hi: number, rng: () => number,
): { state: CubieCube; depth: number } | null {
  const got = pickLayer(lineTable(), lo, hi, rng);
  if (!got) return null;
  const state = fillState(eoLinePins(got.value, rng), [], rng);
  return { state: rotateState(state, inverseRotation(rotForLine(face, axis))), depth: got.depth };
}

// ── shared: uniform draw out of enumerated layers ────────────────────────────────────────────

/** A uniform member of layers [lo,hi], weighted by true layer size. Null when the window is empty. */
function pickLayer(
  t: { hist: number[]; layer: Int32Array; start: Int32Array }, lo: number, hi: number, rng: () => number,
): { value: number; depth: number } | null {
  const top = Math.min(hi, t.hist.length - 1);
  if (lo > top || lo < 0) return null;
  let total = 0;
  for (let d = lo; d <= top; d++) total += t.hist[d];
  if (!total) return null;
  // Clamped for the same reason as ./block's draw: for an `exactLayers` stage a null is read as
  // proof that the difficulty does not exist, so an rng returning exactly 1 must not produce one.
  let r = Math.min((rng() * total) | 0, total - 1);
  for (let d = lo; d <= top; d++) {
    if (r < t.hist[d]) return { value: t.layer[t.start[d] + r], depth: d };
    r -= t.hist[d];
  }
  return null;
}
