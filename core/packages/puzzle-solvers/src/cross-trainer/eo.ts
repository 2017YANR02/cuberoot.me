/*
 * cross-trainer/eo — exact EOCross (ZZ step 1: every edge oriented + the four cross edges home).
 *
 * Coordinate: ordered slots of the 4 cross edges (12·11·10·9 = 11,880) × the 12-bit flip word.
 * Flip parity is even, so the word has 2¹¹ = 2,048 values → 24,330,240 states — the same set as
 * the cross's 190,080 × the other eight flips (2⁷), just factored so both halves are small. The
 * two factors transition independently (positions never see orientation, and the word is indexed
 * by SLOT rather than by piece), so the entire move table is 11,880·18 + 2,048·18 ints, ~0.9 MB.
 *
 * Route (a) wins, measured, not assumed: a full BFS over all 24,330,240 states fills one 24 MB
 * Uint8Array in 1.8–2.5 s (the test logs the number), after which every depth is a ~0.02 ms draw.
 * Route (b) — shallow layers + rejection on an admissible IDA* — matches that up to depth 9
 * (~2 ms) and then falls off a cliff: depth 10 is 140/24,330,240, i.e. ~174k rejections × 0.08 ms
 * ≈ 14 s per scramble. or18's EOCross trainer pays a comparable build, so the table is the better
 * product. Route (b) survives as `eoCrossDistCapped` / `sampleEoCoordByRejection`: it allocates
 * nothing big, and it is the independent oracle the tests hold the table to.
 *
 * The BFS scans in eo-major order (index = eo·11,880 + pos) so each of the 18 destination blocks
 * is 11,880 bytes and stays in L1; the pos-major layout measured ~8 % slower.
 *
 * EO axis: "oriented" is only defined relative to an axis — quarter turns of that axis' two faces
 * flip the four edges they move, nothing else does. kociemba's native `eo` is the F/B axis. A ZZ
 * EOCross needs an axis PERPENDICULAR to the cross face (a D cross admits F/B or L/R; the two
 * differ by a y rotation, hence share the histogram), so a frame defaults to (faceAxis + 2) % 3.
 * That is also why `eoCrossPins` cannot copy the word straight into `eo[]`: fill.ts writes
 * kociemba's F/B convention, and two conventions differ by a fixed per-(piece, slot) bit.
 */

import {
  EDGE_STEP, FACE_EDGES, MOVE_FACE, skipRow, slotRank, slotUnrank, type FaceIdx,
} from './model.js';
import { crossDist, crossNext } from './dist.js';
import { fillState, type Pin } from './fill.js';
import type { CubieCube } from '../kociemba/cube.js';

/** Ordered slots of the four cross edges. */
export const EO_POS_STATES = 11880;
/** Flip words: 12 bits with even parity, so bit 0 is derived. */
export const EO_WORD_STATES = 2048;
export const EOCROSS_STATES = EO_POS_STATES * EO_WORD_STATES;   // 24,330,240
export const EOCROSS_MAX_DEPTH = 10;
/** Layers up to here are cheap to enumerate without the big table (route b). */
const BFS_DEPTH = 5;

/** EO axis: 0 = U/D, 1 = R/L, 2 = F/B. Only quarter turns of this axis flip edges. */
export type EoAxis = 0 | 1 | 2;

/** Axis a face lives on — U/D = 0, R/L = 1, F/B = 2, matching kociemba's face order. */
export const faceAxis = (f: FaceIdx): EoAxis => (f % 3) as EoAxis;
/** Canonical EO axis for a cross on `f`: either perpendicular axis is a real ZZ start. */
export const defaultEoAxis = (f: FaceIdx): EoAxis => (((f % 3) + 2) % 3) as EoAxis;

export interface EoFrame {
  face: FaceIdx;
  /** Must be perpendicular to the cross face; defaults to `defaultEoAxis(face)`. */
  axis?: EoAxis;
}

/** One EOCross coordinate: ordered cross-edge slots + the packed flip word. */
export interface EoCoord { pos: number; eo: number }

/** Table index. eo-major: the 11,880-byte position block is the BFS's hot working set. */
export const eoPack = (c: EoCoord): number => c.eo * EO_POS_STATES + c.pos;
export const eoUnpack = (idx: number): EoCoord => ({ pos: idx % EO_POS_STATES, eo: (idx / EO_POS_STATES) | 0 });

/** Packed flip index → the full 12-bit word (bit 0 restored from the even-parity invariant). */
export function eoWord(idx: number): number {
  const hi = idx << 1;
  let pc = 0;
  for (let b = 1; b < 12; b++) if (hi & (1 << b)) pc++;
  return hi | (pc & 1);
}

// ── per-axis orientation model ───────────────────────────────────────────────────────────────

/**
 * EDGE_STEP for orientation measured against `axis`: same permutation as the model's, but the
 * flip delta is "a quarter turn of one of this axis' two faces flips its four edges". For axis 2
 * that reproduces kociemba's `eo` bit-for-bit (asserted in the tests) — which is the proof that
 * this rule *is* the orientation convention rather than a look-alike.
 */
export function edgeStepForAxis(axis: EoAxis): Int8Array[] {
  return Array.from({ length: 18 }, (_, m) => {
    const flips = MOVE_FACE[m] % 3 === axis && m % 3 !== 1;   // m%3 === 1 is the half turn
    const t = new Int8Array(24);
    for (let s = 0; s < 12; s++) {
      const dest = EDGE_STEP[m][s * 2] >> 1;                  // permutation with orientation stripped
      const f = flips && dest !== s ? 1 : 0;
      t[s * 2] = dest * 2 + f;
      t[s * 2 + 1] = dest * 2 + (f ^ 1);
    }
    return t;
  });
}

/**
 * delta[piece*12 + slot] — kociemba's `eo` bit XOR this axis' bit for that piece in that slot.
 * Two sticker conventions disagree by a constant on each placement, so the difference depends on
 * (piece, slot) only; a 24-placement BFS per piece reads it off. Needed because our coordinate is
 * the axis word while fill.ts writes kociemba's F/B `eo`.
 */
function buildOriDelta(stepA: readonly Int8Array[]): Uint8Array {
  const out = new Uint8Array(144);
  for (let p = 0; p < 12; p++) {
    const seen = new Int8Array(24).fill(-1);   // key = kociemba coord slot*2+eo, value = axis ori
    seen[p * 2] = 0;
    let frontier = [p * 2];
    while (frontier.length) {
      const nf: number[] = [];
      for (const c of frontier) {
        const oa = seen[c];
        for (let m = 0; m < 18; m++) {
          const nc = EDGE_STEP[m][c];
          const na = stepA[m][(c >> 1) * 2 + oa] & 1;
          if (seen[nc] < 0) {
            seen[nc] = na;
            out[p * 12 + (nc >> 1)] = (nc & 1) ^ na;
            nf.push(nc);
          }
        }
      }
      frontier = nf;
    }
  }
  return out;
}

// ── transition tables ────────────────────────────────────────────────────────────────────────

let posNextCache: Int32Array | null = null;
/** posNext[pos*18 + m]. Universal: where four ordered slots go carries no orientation. */
export function eoPosNext(): Int32Array {
  if (posNextCache) return posNextCache;
  const t = new Int32Array(EO_POS_STATES * 18);
  const slots = new Int8Array(4), ns = new Int8Array(4);
  for (let i = 0; i < EO_POS_STATES; i++) {
    slotUnrank(i, 4, slots);
    for (let m = 0; m < 18; m++) {
      for (let k = 0; k < 4; k++) ns[k] = EDGE_STEP[m][slots[k] * 2] >> 1;
      t[i * 18 + m] = slotRank(ns, 4);
    }
  }
  posNextCache = t;
  return t;
}

export interface AxisData {
  step: readonly Int8Array[];
  /** eoNext[word*18 + m] over the 2,048 packed flip words. */
  next: Int32Array;
  /** Exact optimal length of the flip word alone — a relaxation of EOCross, so admissible. */
  dist: Uint8Array;
  delta: Uint8Array;
}

const axisCache = new Map<EoAxis, AxisData>();

/**
 * Everything that depends on the EO axis alone: the 2,048-word transition table, the exact
 * distance of the flip word by itself (which IS the "pure EO" stage — see ./eoline), and the
 * bridge between this axis' convention and kociemba's.
 */
export function eoAxisData(axis: EoAxis): AxisData {
  const hit = axisCache.get(axis);
  if (hit) return hit;
  const step = edgeStepForAxis(axis);
  const next = new Int32Array(EO_WORD_STATES * 18);
  for (let i = 0; i < EO_WORD_STATES; i++) {
    const word = eoWord(i);
    for (let m = 0; m < 18; m++) {
      let nw = 0;
      for (let s = 0; s < 12; s++) {
        const c = step[m][s * 2 + ((word >> s) & 1)];
        nw |= (c & 1) << (c >> 1);
      }
      next[i * 18 + m] = nw >> 1;
    }
  }
  const dist = new Uint8Array(EO_WORD_STATES).fill(255);
  dist[0] = 0;
  let frontier = [0];
  for (let d = 0; frontier.length; d++) {
    const nf: number[] = [];
    for (const v of frontier) {
      for (let m = 0; m < 18; m++) {
        const nb = next[v * 18 + m];
        if (dist[nb] === 255) { dist[nb] = d + 1; nf.push(nb); }
      }
    }
    frontier = nf;
  }
  const data: AxisData = { step, next, dist, delta: buildOriDelta(step) };
  axisCache.set(axis, data);
  return data;
}

export interface EoFrameData {
  face: FaceIdx;
  axis: EoAxis;
  /** The four cross pieces, ascending — the order `pos` ranks their slots in. */
  pieces: readonly number[];
  posGoal: number;
  posNext: Int32Array;
  eoNext: Int32Array;
  eoDist: Uint8Array;
  delta: Uint8Array;
}

const frameCache = new Map<string, EoFrameData>();

const frameKey = (f: EoFrame): string => `${f.face}:${f.axis ?? defaultEoAxis(f.face)}`;

export function eoFrameData(frame: EoFrame): EoFrameData {
  const key = frameKey(frame);
  const hit = frameCache.get(key);
  if (hit) return hit;
  const axis = frame.axis ?? defaultEoAxis(frame.face);
  if (axis === faceAxis(frame.face)) {
    throw new Error(`EO axis ${axis} is the cross face's own axis — not a ZZ EOCross`);
  }
  const a = eoAxisData(axis);
  const pieces = FACE_EDGES[frame.face];
  const data: EoFrameData = {
    face: frame.face,
    axis,
    pieces,
    posGoal: slotRank(pieces, 4),
    posNext: eoPosNext(),
    eoNext: a.next,
    eoDist: a.dist,
    delta: a.delta,
  };
  frameCache.set(key, data);
  return data;
}

// ── route (a): the full exact table ──────────────────────────────────────────────────────────

interface EoTable {
  dist: Uint8Array;
  hist: number[];
  /** cum[d*(EO_WORD_STATES+1) + b] = states of depth d in flip blocks 0..b-1 (for O(1) draws). */
  cum: Int32Array;
  buildMs: number;
}

const tableCache = new Map<string, EoTable>();

function buildTable(frame: EoFrame): EoTable {
  const d = eoFrameData(frame);
  const t0 = Date.now();
  const { posNext, eoNext } = d;
  const dist = new Uint8Array(EOCROSS_STATES).fill(255);
  dist[d.posGoal] = 0;                                    // flip word 0 is block 0
  const hist = [1];
  let filled = 1;
  const nb = new Int32Array(18);
  for (let depth = 0; filled < EOCROSS_STATES; depth++) {
    let added = 0;
    for (let eo = 0; eo < EO_WORD_STATES; eo++) {
      const block = eo * EO_POS_STATES, erow = eo * 18;
      for (let m = 0; m < 18; m++) nb[m] = eoNext[erow + m] * EO_POS_STATES;
      for (let pos = 0; pos < EO_POS_STATES; pos++) {
        if (dist[block + pos] !== depth) continue;
        const prow = pos * 18;
        for (let m = 0; m < 18; m++) {
          const t = nb[m] + posNext[prow + m];
          if (dist[t] === 255) { dist[t] = depth + 1; added++; }
        }
      }
    }
    hist.push(added);
    filled += added;
  }

  const stride = EO_WORD_STATES + 1;
  const cum = new Int32Array(hist.length * stride);
  for (let eo = 0; eo < EO_WORD_STATES; eo++) {
    const block = eo * EO_POS_STATES;
    for (let dd = 0; dd < hist.length; dd++) cum[dd * stride + eo + 1] = cum[dd * stride + eo];
    for (let pos = 0; pos < EO_POS_STATES; pos++) cum[dist[block + pos] * stride + eo + 1]++;
  }
  return { dist, hist, cum, buildMs: Date.now() - t0 };
}

function eoTable(frame: EoFrame): EoTable {
  const key = frameKey(frame);
  const hit = tableCache.get(key);
  if (hit) return hit;
  const t = buildTable(frame);
  tableCache.set(key, t);
  return t;
}

/** Exact optimal EOCross length for every coordinate (24 MB, built once per frame). */
export function eoCrossDist(frame: EoFrame): Uint8Array {
  return eoTable(frame).dist;
}

/** Depth histogram (index = optimal length). Sums to 24,330,240. */
export function eoCrossHistogram(frame: EoFrame): number[] {
  return eoTable(frame).hist.slice();
}

/** Milliseconds the frame's table took to build — the number route (a) is judged on. */
export function eoCrossTableMs(frame: EoFrame): number {
  return eoTable(frame).buildMs;
}

/** Exact optimal length of one coordinate, straight off the table. */
export function eoCrossLength(frame: EoFrame, st: EoCoord): number {
  return eoTable(frame).dist[eoPack(st)];
}

// ── route (b): admissible IDA*, no big table ─────────────────────────────────────────────────

const posScratch = new Int8Array(4);

/**
 * kociemba cross coordinate (dist.ts) of an EOCross coordinate. The cross coordinate carries the
 * F/B flips of the four cross edges, so the axis word has to be translated through `delta`.
 */
export function crossIndexOf(d: EoFrameData, st: EoCoord): number {
  slotUnrank(st.pos, 4, posScratch);
  const word = eoWord(st.eo);
  let ori = 0;
  for (let k = 0; k < 4; k++) {
    const slot = posScratch[k];
    ori |= (((word >> slot) & 1) ^ d.delta[d.pieces[k] * 12 + slot]) << k;
  }
  return st.pos * 16 + ori;      // encodeCross packs slotRank*16 + flips, in `pieces` order
}

/**
 * Exact optimal length, searched only as far as `cap`; -1 when it exceeds `cap`.
 * h = max(exact cross distance, exact flip-word distance) — both are relaxations of EOCross,
 * so h is admissible and the first depth that succeeds is the true optimum.
 */
export function eoCrossDistCapped(d: EoFrameData, st: EoCoord, cap: number): number {
  const cn = crossNext();
  const cd = crossDist(d.face);
  const eoNext = d.eoNext, eoDist = d.eoDist;
  const cross0 = crossIndexOf(d, st);
  const h0 = Math.max(cd[cross0], eoDist[st.eo]);
  if (h0 > cap) return -1;
  if (h0 === 0) return 0;

  const search = (cross: number, eo: number, depth: number, prev: number): boolean => {
    const skip = skipRow(prev);
    const cbase = cross * 18, ebase = eo * 18;
    for (let m = 0; m < 18; m++) {
      if (skip[m]) continue;
      const nc = cn[cbase + m], ne = eoNext[ebase + m];
      const h = Math.max(cd[nc], eoDist[ne]);
      if (h >= depth) continue;                 // admissible → cannot finish in the plies left
      if (h === 0 && depth === 1) return true;  // h === 0 ⟺ cross home and every edge oriented
      if (depth > 1 && search(nc, ne, depth - 1, m)) return true;
    }
    return false;
  };

  for (let lim = Math.max(h0, 1); lim <= cap; lim++) {
    if (search(cross0, st.eo, lim, -1)) return lim;
  }
  return -1;
}

/** Uniform draw from the whole 24,330,240-state space (every (pos, word) pair is legal). */
export function randomEoCoord(rng: () => number): EoCoord {
  return { pos: (rng() * EO_POS_STATES) | 0, eo: (rng() * EO_WORD_STATES) | 0 };
}

const shallowCache = new Map<string, number[][]>();

/** Exact layers 0..BFS_DEPTH by multi-source BFS from the goal — route (b)'s shallow half. */
function shallowLayers(frame: EoFrame): number[][] {
  const key = frameKey(frame);
  const hit = shallowCache.get(key);
  if (hit) return hit;
  const d = eoFrameData(frame);
  const seen = new Set<number>([d.posGoal]);
  const layers: number[][] = [[d.posGoal]];
  let frontier = [d.posGoal];
  for (let depth = 1; depth <= BFS_DEPTH; depth++) {
    const out: number[] = [];
    for (const v of frontier) {
      const pos = v % EO_POS_STATES, eo = (v / EO_POS_STATES) | 0;
      const prow = pos * 18, erow = eo * 18;
      for (let m = 0; m < 18; m++) {
        const nv = d.eoNext[erow + m] * EO_POS_STATES + d.posNext[prow + m];
        if (!seen.has(nv)) { seen.add(nv); out.push(nv); }
      }
    }
    layers.push(out);
    frontier = out;
  }
  shallowCache.set(key, layers);
  return layers;
}

/** Layer sizes 0..BFS_DEPTH from route (b) alone — must agree with the table's histogram. */
export function eoCrossShallowHistogram(frame: EoFrame): number[] {
  return shallowLayers(frame).map((l) => l.length);
}

/**
 * Route (b) sampler: enumerated shallow layers, rejection above them. Uniform either way, but
 * the deep tail is what kills it — depth 10 is 140/24,330,240, i.e. ~170k IDA* runs per draw.
 */
export function sampleEoCoordByRejection(
  frame: EoFrame, lo: number, hi: number, rng: () => number, maxTries = 200000,
): { coord: EoCoord; depth: number } | null {
  const d = eoFrameData(frame);
  const cappedHi = Math.min(hi, EOCROSS_MAX_DEPTH);
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
        const l = layers[x];
        return { coord: eoUnpack(l[(rng() * l.length) | 0]), depth: x };
      }
    }
  }

  for (let t = 0; t < maxTries; t++) {
    const st = randomEoCoord(rng);
    const v = eoCrossDistCapped(d, st, cappedHi);
    if (v >= lo) return { coord: st, depth: v };
  }
  return null;
}

// ── sampling (route a: O(1) at every depth) ──────────────────────────────────────────────────

/**
 * A uniform EOCross coordinate with optimal length in [lo,hi]. The depth is drawn with weight
 * equal to its true layer size, then the r-th state of that layer is located through the
 * per-block cumulative counts — no rejection, so depth 10 costs the same as depth 8.
 */
export function sampleEoCoord(
  frame: EoFrame, lo: number, hi: number, rng: () => number = Math.random,
): { coord: EoCoord; depth: number } | null {
  const { hist, dist, cum } = eoTable(frame);
  const cappedHi = Math.min(hi, hist.length - 1);
  if (lo > cappedHi || lo < 0) return null;

  let total = 0;
  for (let d = lo; d <= cappedHi; d++) total += hist[d];
  if (!total) return null;
  let r = rng() * total;
  let depth = cappedHi;
  for (let d = lo; d <= cappedHi; d++) { r -= hist[d]; if (r < 0) { depth = d; break; } }

  const stride = EO_WORD_STATES + 1;
  const row = depth * stride;
  let want = (rng() * hist[depth]) | 0;
  // binary search for the flip block holding the want-th state of this layer
  let lb = 0, ub = EO_WORD_STATES;
  while (lb + 1 < ub) {
    const mid = (lb + ub) >> 1;
    if (cum[row + mid] <= want) lb = mid; else ub = mid;
  }
  want -= cum[row + lb];
  const block = lb * EO_POS_STATES;
  for (let pos = 0; pos < EO_POS_STATES; pos++) {
    if (dist[block + pos] !== depth) continue;
    if (want-- === 0) return { coord: { pos, eo: lb }, depth };
  }
  return null;   // unreachable: cum said this block holds it
}

// ── coordinate → cube ────────────────────────────────────────────────────────────────────────

/**
 * All twelve edge pins for a coordinate. The coordinate pins the ORIENTATION of every slot but
 * the POSITION of only four pieces, so the eight free pieces are permuted here (uniformly) and
 * handed to fill.ts already oriented — fill.ts derives the last free flip from parity, which
 * would overwrite an orientation we own. Flip parity stays even because the axis word is even
 * and the convention shift cancels over a full permutation, so the result is legal.
 */
export function eoCrossPins(frame: EoFrame, st: EoCoord, rng: () => number): Pin[] {
  const d = eoFrameData(frame);
  const slots = new Int8Array(4);
  slotUnrank(st.pos, 4, slots);
  return eoPins(d.delta, d.pieces, slots, eoWord(st.eo), rng);
}

/**
 * The same job for any number of tracked edges (0 for pure EO, 2 for EOLine, 4 for EOCross):
 * `pieces[k]` goes to `slots[k]`, the rest are shuffled into what is left, and every slot's flip
 * comes from `word` translated out of the axis convention by `delta`.
 */
export function eoPins(
  delta: Uint8Array, pieces: readonly number[], slots: ArrayLike<number>, word: number,
  rng: () => number,
): Pin[] {
  const oriOf = (piece: number, slot: number) => ((word >> slot) & 1) ^ delta[piece * 12 + slot];
  const used = new Uint8Array(12);
  const pins: Pin[] = [];
  for (let k = 0; k < pieces.length; k++) {
    const piece = pieces[k], slot = slots[k];
    used[slot] = 1;
    pins.push({ piece, slot, ori: oriOf(piece, slot) });
  }
  const freeSlots: number[] = [], freePieces: number[] = [];
  for (let s = 0; s < 12; s++) if (!used[s]) freeSlots.push(s);
  for (let p = 0; p < 12; p++) if (!pieces.includes(p)) freePieces.push(p);
  for (let i = freePieces.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = freePieces[i]; freePieces[i] = freePieces[j]; freePieces[j] = t;
  }
  for (let i = 0; i < freeSlots.length; i++) {
    pins.push({ piece: freePieces[i], slot: freeSlots[i], ori: oriOf(freePieces[i], freeSlots[i]) });
  }
  return pins;
}

/** One uniformly random legal cube whose EOCross for this frame is exactly `depth` moves. */
export function sampleEoCrossState(
  frame: EoFrame, lo: number, hi: number, rng: () => number = Math.random,
): { state: CubieCube; depth: number } | null {
  const got = sampleEoCoord(frame, lo, hi, rng);
  if (!got) return null;
  return { state: fillState(eoCrossPins(frame, got.coord, rng), [], rng), depth: got.depth };
}
