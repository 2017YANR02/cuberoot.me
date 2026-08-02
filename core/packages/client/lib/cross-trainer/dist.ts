/*
 * cross-trainer/dist — exact optimal-length tables for the cross coordinate.
 *
 * The cross coordinate tracks four *specific* edge pieces by (slot, orientation):
 *   12·11·10·9 ordered slots × 2⁴ flips = 190,080 states — the whole space, no pruning.
 * A full BFS therefore yields the EXACT optimal HTM length for every state, which is what
 * "generate a scramble whose cross is N moves" needs: filtering on a lower-bound pruning
 * table would silently over-sample easy states.
 *
 * The transition table is universal (it acts on the coordinate, not on piece identity), so
 * one 13.7 MB Int32Array serves all six colours; each colour then costs one 190 KB byte
 * array. Depth histogram of the resulting table is asserted against the published one in
 * tests/cross_trainer_dist.test.ts — {1,15,158,1394,9809,46381,97254,34966,102}, max 8.
 */

import { EDGE_STEP, FACE_EDGES, slotRank, slotUnrank, type FaceIdx } from './model';

export const CROSS_STATES = 190080;
export const CROSS_MAX_DEPTH = 8;

/** Encode four tracked edges given as `slot*2+ori` coords. */
export function encodeCross(c0: number, c1: number, c2: number, c3: number): number {
  const slots = [c0 >> 1, c1 >> 1, c2 >> 1, c3 >> 1];
  const ori = (c0 & 1) | ((c1 & 1) << 1) | ((c2 & 1) << 2) | ((c3 & 1) << 3);
  return slotRank(slots, 4) * 16 + ori;
}

const scratch = new Int8Array(4);
/** Decode into four `slot*2+ori` coords. */
export function decodeCross(idx: number, out: Int8Array): void {
  const ori = idx & 15;
  slotUnrank((idx - ori) / 16, 4, scratch);
  for (let k = 0; k < 4; k++) out[k] = scratch[k] * 2 + ((ori >> k) & 1);
}

let univ: Int32Array | null = null;
/** univ[idx*18 + m] — the coordinate after move m. Built once (~120 ms), shared by all colours. */
export function crossNext(): Int32Array {
  if (univ) return univ;
  const t = new Int32Array(CROSS_STATES * 18);
  const cur = new Int8Array(4);
  for (let idx = 0; idx < CROSS_STATES; idx++) {
    decodeCross(idx, cur);
    for (let m = 0; m < 18; m++) {
      const s = EDGE_STEP[m];
      t[idx * 18 + m] = encodeCross(s[cur[0]], s[cur[1]], s[cur[2]], s[cur[3]]);
    }
  }
  univ = t;
  return t;
}

const distCache = new Map<number, Uint8Array>();
/** Exact optimal cross length for every coordinate, for the cross on face `f`. */
export function crossDist(f: FaceIdx): Uint8Array {
  const hit = distCache.get(f);
  if (hit) return hit;
  const next = crossNext();
  const dist = new Uint8Array(CROSS_STATES).fill(255);
  const home = FACE_EDGES[f];
  const goal = encodeCross(home[0] * 2, home[1] * 2, home[2] * 2, home[3] * 2);
  dist[goal] = 0;
  let frontier = [goal];
  for (let d = 0; frontier.length; d++) {
    const nf: number[] = [];
    for (const idx of frontier) {
      const base = idx * 18;
      for (let m = 0; m < 18; m++) {
        const nb = next[base + m];
        if (dist[nb] === 255) { dist[nb] = d + 1; nf.push(nb); }
      }
    }
    frontier = nf;
  }
  distCache.set(f, dist);
  return dist;
}

const layerCache = new Map<number, Int32Array[]>();
/** Coordinates grouped by exact optimal length — layers[d] lists every state solved in d. */
export function crossLayers(f: FaceIdx): Int32Array[] {
  const hit = layerCache.get(f);
  if (hit) return hit;
  const dist = crossDist(f);
  const counts = new Array<number>(CROSS_MAX_DEPTH + 1).fill(0);
  for (let i = 0; i < CROSS_STATES; i++) counts[dist[i]]++;
  const layers = counts.map((n) => new Int32Array(n));
  const fill = new Array<number>(CROSS_MAX_DEPTH + 1).fill(0);
  for (let i = 0; i < CROSS_STATES; i++) { const d = dist[i]; layers[d][fill[d]++] = i; }
  layerCache.set(f, layers);
  return layers;
}

/** Depth histogram of the cross coordinate (index = optimal length). */
export function crossHistogram(f: FaceIdx = 3): number[] {
  return crossLayers(f).map((l) => l.length);
}
