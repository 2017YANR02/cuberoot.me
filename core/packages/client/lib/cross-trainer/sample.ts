/*
 * cross-trainer/sample — draw a cube state whose cross is exactly N optimal HTM moves.
 *
 * Two semantics, both exactly uniform over the cube states they claim (see fill.ts for why
 * uniform coordinate × uniform fill = uniform over the class):
 *
 *   fixed  — one cross colour. The layer is fully enumerated (crossLayers), so we pick a
 *            depth weighted by its true size and then a state uniformly inside it: O(1),
 *            every depth 0..8 reachable, no rejection at all.
 *   best   — colour-neutral over a subset (the site's WCA-difficulty semantics: the metric is
 *            the BEST cross among the chosen colours). The six per-colour coordinates of one
 *            cube are dependent, so there is no layer to enumerate; instead we reject on
 *            uniform edge configurations. A draw costs a shuffle + |subset| table lookups
 *            (~1 µs), so even the rarest bin (min = 0 or 7, p ≈ 3e-5) settles in ~30 ms.
 */

import type { CubieCube } from '@/app/[lang]/timer/_lib/scramble/kociemba/cube';
import { FACE_EDGES, type FaceIdx } from './model';
import { crossDist, crossLayers, decodeCross, encodeCross } from './dist';
import { fillState, type Pin } from './fill';

export interface CrossSpec {
  /** Allowed cross faces. One face = fixed-colour trainer; more = best-of-subset. */
  faces: FaceIdx[];
  /** Inclusive optimal-length window. */
  lo: number;
  hi: number;
}

const scratch = new Int8Array(4);

/** Pick a depth in [lo,hi] with probability proportional to its layer size. */
function pickDepth(layers: Int32Array[], lo: number, hi: number, rng: () => number): number {
  let total = 0;
  for (let d = lo; d <= hi && d < layers.length; d++) total += layers[d].length;
  if (total === 0) return -1;
  let r = rng() * total;
  for (let d = lo; d <= hi && d < layers.length; d++) {
    r -= layers[d].length;
    if (r < 0) return d;
  }
  return hi;
}

/** One uniform state whose cross on `face` is exactly `depth` moves. */
function sampleFixed(face: FaceIdx, lo: number, hi: number, rng: () => number): CubieCube | null {
  const layers = crossLayers(face);
  const d = pickDepth(layers, lo, hi, rng);
  if (d < 0) return null;
  const layer = layers[d];
  const coord = layer[(rng() * layer.length) | 0];
  decodeCross(coord, scratch);
  const pieces = FACE_EDGES[face];
  const pins: Pin[] = pieces.map((piece, k) => ({ piece, slot: scratch[k] >> 1, ori: scratch[k] & 1 }));
  return fillState(pins, [], rng);
}

/** Random legal edge configuration (uniform), returned as pins for all 12 edges. */
function randomEdgePins(rng: () => number): Pin[] {
  const pieces = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (let i = 11; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = pieces[i]; pieces[i] = pieces[j]; pieces[j] = t; }
  const pins: Pin[] = [];
  let sum = 0;
  for (let slot = 0; slot < 12; slot++) {
    const ori = slot < 11 ? (rng() < 0.5 ? 0 : 1) : (sum & 1);
    if (slot < 11) sum += ori;
    pins.push({ piece: pieces[slot], slot, ori });
  }
  return pins;
}

/** Cross length of `pins` (a full 12-edge configuration) for face `f`. */
function crossLenOf(pins: Pin[], f: FaceIdx, dist: Uint8Array): number {
  const at = new Array<Pin>(12);
  for (const p of pins) at[p.piece] = p;
  const home = FACE_EDGES[f];
  const c = home.map((piece) => at[piece].slot * 2 + at[piece].ori);
  return dist[encodeCross(c[0], c[1], c[2], c[3])];
}

/** Best-of-subset: reject uniform edge configurations until min over `faces` lands in range. */
function sampleBest(faces: FaceIdx[], lo: number, hi: number, rng: () => number, maxTries: number): CubieCube | null {
  const tables = faces.map((f) => crossDist(f));
  for (let t = 0; t < maxTries; t++) {
    const pins = randomEdgePins(rng);
    let best = 99;
    for (let i = 0; i < faces.length; i++) {
      const v = crossLenOf(pins, faces[i], tables[i]);
      if (v < best) best = v;
      if (best < lo) break; // already below the window — reject early
    }
    if (best >= lo && best <= hi) return fillState(pins, [], rng);
  }
  return null;
}

/**
 * A uniformly random cube state whose cross metric falls in [lo,hi].
 * Returns null when the window is unreachable (or the rejection budget ran out).
 */
export function sampleCrossState(spec: CrossSpec, rng: () => number = Math.random, maxTries = 400000): CubieCube | null {
  const { faces, lo, hi } = spec;
  if (!faces.length || lo > hi) return null;
  return faces.length === 1
    ? sampleFixed(faces[0], lo, hi, rng)
    : sampleBest(faces, lo, hi, rng, maxTries);
}

/** Exact distribution of the best-of-subset cross metric, by Monte-Carlo (tests / slider bounds). */
export function crossSubsetHistogram(faces: FaceIdx[], samples: number, rng: () => number = Math.random): number[] {
  const tables = faces.map((f) => crossDist(f));
  const hist = new Array<number>(9).fill(0);
  for (let i = 0; i < samples; i++) {
    const pins = randomEdgePins(rng);
    let best = 99;
    for (let k = 0; k < faces.length; k++) best = Math.min(best, crossLenOf(pins, faces[k], tables[k]));
    hist[best]++;
  }
  return hist;
}
