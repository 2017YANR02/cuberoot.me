/**
 * Pruning tables — admissible heuristics for IDA*.
 *
 * Phase-1 tables: keyed by (twist, sliceRaw) and (flip, sliceRaw). 1.08M
 * entries each. Stored as 4-bit nibbles (~540 KB each).
 *
 * Phase-2 tables: keyed by (cperm, sperm) and (eperm, sperm). 967k entries
 * each. Stored as nibbles (~480 KB each).
 *
 * Each entry holds the BFS distance from the goal coord-state, capped at 14
 * (sentinel 0xF means unvisited / unreachable). The lookup gives a lower
 * bound on the cube-space move count, so it's an admissible heuristic.
 *
 * BFS uses an explicit two-list frontier (current depth + next depth)
 * indexed densely.
 */

import {
  N_TWIST,
  N_FLIP,
  N_CPERM,
  N_EPERM,
  N_SPERM,
} from './coords';
import { N_SLICE_RAW, type MoveTables } from './movetables';

const N_PHASE1_MOVES = 18;
const N_PHASE2_MOVES = 10;
const UNVISITED = 0x0F;

/* ────────────────────────────────────────────────────────────────────── *
 *  Nibble array helpers
 * ────────────────────────────────────────────────────────────────────── */

function makeNibbles(size: number): Uint8Array {
  const buf = new Uint8Array((size + 1) >> 1);
  buf.fill(0xFF);
  return buf;
}

export function nibGet(buf: Uint8Array, idx: number): number {
  const byte = buf[idx >> 1];
  return idx & 1 ? byte >> 4 : byte & 0x0F;
}

export function nibSet(buf: Uint8Array, idx: number, val: number): void {
  const i = idx >> 1;
  if (idx & 1) buf[i] = (buf[i] & 0x0F) | ((val & 0x0F) << 4);
  else        buf[i] = (buf[i] & 0xF0) | (val & 0x0F);
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Goal coords (in coord-space, value at solved state)
 * ────────────────────────────────────────────────────────────────────── */

const SLICE_GOAL_RAW = 494; // sliceRawOf(solved) under the formula in coords.ts
const TWIST_GOAL = 0;
const FLIP_GOAL = 0;
const CPERM_GOAL = 0;
const EPERM_GOAL = 0;
const SPERM_GOAL = 0;

/* ────────────────────────────────────────────────────────────────────── *
 *  Generic BFS pruning table builder
 * ────────────────────────────────────────────────────────────────────── */

function bfsPrune(
  sizeA: number,
  sizeB: number,
  moveA: Int32Array,
  moveB: Int32Array,
  nMoves: number,
  goalA: number,
  goalB: number,
): Uint8Array {
  const total = sizeA * sizeB;
  const tab = makeNibbles(total);
  const goalIdx = goalA * sizeB + goalB;
  nibSet(tab, goalIdx, 0);

  // Use a flat depths array (Uint8Array of size `total`) for fast scanning.
  // Then pack into nibbles at the end. Memory: 1MB temp per table — OK.
  const depths = new Uint8Array(total);
  depths.fill(0xFF);
  depths[goalIdx] = 0;

  let frontier = new Int32Array(1);
  frontier[0] = goalIdx;
  let frontierLen = 1;

  let depth = 0;
  while (frontierLen > 0 && depth < 14) {
    const next = new Int32Array(frontierLen * nMoves); // upper bound
    let nextLen = 0;
    const newDepth = depth + 1;
    for (let f = 0; f < frontierLen; f++) {
      const idx = frontier[f];
      const a = Math.floor(idx / sizeB);
      const b = idx - a * sizeB;
      for (let m = 0; m < nMoves; m++) {
        const newA = moveA[a * nMoves + m];
        const newB = moveB[b * nMoves + m];
        const nIdx = newA * sizeB + newB;
        if (depths[nIdx] === 0xFF) {
          depths[nIdx] = newDepth;
          next[nextLen++] = nIdx;
        }
      }
    }
    frontier = next.subarray(0, nextLen);
    frontierLen = nextLen;
    depth = newDepth;
  }

  // Pack depths → nibbles, capping at 14 (15 = unvisited sentinel)
  for (let i = 0; i < total; i++) {
    const d = depths[i];
    nibSet(tab, i, d === 0xFF ? UNVISITED : Math.min(d, 14));
  }
  return tab;
}

export interface PruneTables {
  twistSlice: Uint8Array;
  flipSlice: Uint8Array;
  cpermSperm: Uint8Array;
  epermSperm: Uint8Array;
}

export function buildPruneTables(
  mt: MoveTables,
  progress?: (msg: string) => void,
): PruneTables {
  progress?.('twistSlice');
  const twistSlice = bfsPrune(
    N_TWIST, N_SLICE_RAW, mt.twist, mt.sliceRaw,
    N_PHASE1_MOVES, TWIST_GOAL, SLICE_GOAL_RAW,
  );

  progress?.('flipSlice');
  const flipSlice = bfsPrune(
    N_FLIP, N_SLICE_RAW, mt.flip, mt.sliceRaw,
    N_PHASE1_MOVES, FLIP_GOAL, SLICE_GOAL_RAW,
  );

  progress?.('cpermSperm');
  const cpermSperm = bfsPrune(
    N_CPERM, N_SPERM, mt.cperm, mt.sperm,
    N_PHASE2_MOVES, CPERM_GOAL, SPERM_GOAL,
  );

  progress?.('epermSperm');
  const epermSperm = bfsPrune(
    N_EPERM, N_SPERM, mt.eperm, mt.sperm,
    N_PHASE2_MOVES, EPERM_GOAL, SPERM_GOAL,
  );

  return { twistSlice, flipSlice, cpermSperm, epermSperm };
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Lookup helpers
 * ────────────────────────────────────────────────────────────────────── */

export function lookupTwistSlice(p: PruneTables, twist: number, sliceRaw: number): number {
  return nibGet(p.twistSlice, twist * N_SLICE_RAW + sliceRaw);
}
export function lookupFlipSlice(p: PruneTables, flip: number, sliceRaw: number): number {
  return nibGet(p.flipSlice, flip * N_SLICE_RAW + sliceRaw);
}
export function lookupCpermSperm(p: PruneTables, cperm: number, sperm: number): number {
  return nibGet(p.cpermSperm, cperm * N_SPERM + sperm);
}
export function lookupEpermSperm(p: PruneTables, eperm: number, sperm: number): number {
  return nibGet(p.epermSperm, eperm * N_SPERM + sperm);
}
