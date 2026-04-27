/**
 * Move tables — for each (coord, move) precompute the resulting coord.
 *
 * Phase-1 tables use all 18 moves; phase-2 tables only the 10 G1 moves
 * (U,U2,U',D,D2,D',R2,F2,L2,B2). Phase-2 tables are indexed by
 * PHASE2_MOVES position (0..9), not by the original 0..17 face-power index.
 */

import {
  applyMove,
  PHASE2_MOVES,
  solvedCubie,
  type CubieCube,
} from './cube';
import {
  N_TWIST,
  N_FLIP,
  N_SLICE_SORTED,
  N_CPERM,
  N_EPERM,
  N_SPERM,
  coTwistOf,
  coTwistSet,
  eoFlipOf,
  eoFlipSet,
  sliceSortedOf,
  sliceSortedSet,
  sliceRawOf,
  cpermOf,
  cpermSet,
  epermOf,
  epermSet,
  spermOf,
  spermSet,
} from './coords';
import { N_SLICE_RAW as N_SLICE_RAW_IMPORT } from './coords';

export const N_SLICE_RAW = N_SLICE_RAW_IMPORT;

const N_PHASE1_MOVES = 18;
const N_PHASE2_MOVES = 10;

/** Build a phase-1 move table (all 18 moves). */
function buildPhase1Move(
  size: number,
  setter: (c: CubieCube, idx: number) => void,
  getter: (c: CubieCube) => number,
): Int32Array {
  const out = new Int32Array(size * N_PHASE1_MOVES);
  for (let i = 0; i < size; i++) {
    const c = solvedCubie();
    setter(c, i);
    for (let m = 0; m < N_PHASE1_MOVES; m++) {
      out[i * N_PHASE1_MOVES + m] = getter(applyMove(c, m));
    }
  }
  return out;
}

/** Build a phase-2 move table (only 10 G1 moves). */
function buildPhase2Move(
  size: number,
  setter: (c: CubieCube, idx: number) => void,
  getter: (c: CubieCube) => number,
): Int32Array {
  const out = new Int32Array(size * N_PHASE2_MOVES);
  for (let i = 0; i < size; i++) {
    const c = solvedCubie();
    setter(c, i);
    for (let m = 0; m < N_PHASE2_MOVES; m++) {
      out[i * N_PHASE2_MOVES + m] = getter(applyMove(c, PHASE2_MOVES[m]));
    }
  }
  return out;
}

export interface MoveTables {
  // Phase 1 (18-wide)
  twist: Int32Array;       // [N_TWIST * 18]
  flip: Int32Array;        // [N_FLIP * 18]
  sliceSorted: Int32Array; // [N_SLICE_SORTED * 18]
  sliceRaw: Int32Array;    // [N_SLICE_RAW * 18]
  // Phase 2 (10-wide)
  cperm: Int32Array;       // [N_CPERM * 10]
  eperm: Int32Array;       // [N_EPERM * 10]
  sperm: Int32Array;       // [N_SPERM * 10]
}

export function buildMoveTables(
  progress?: (msg: string) => void,
): MoveTables {
  progress?.('twist');
  const twist = buildPhase1Move(N_TWIST, coTwistSet, coTwistOf);

  progress?.('flip');
  const flip = buildPhase1Move(N_FLIP, eoFlipSet, eoFlipOf);

  progress?.('sliceSorted');
  const sliceSorted = buildPhase1Move(N_SLICE_SORTED, sliceSortedSet, sliceSortedOf);

  progress?.('sliceRaw');
  // Build by collapsing sliceSorted: take representative idx = sRaw*24, apply
  // move, read back sliceRaw of result. The mapping is well-defined because
  // moves act on POSITIONS of slice edges (not their identities).
  const sliceRaw = new Int32Array(N_SLICE_RAW * N_PHASE1_MOVES);
  for (let sRaw = 0; sRaw < N_SLICE_RAW; sRaw++) {
    const c = solvedCubie();
    sliceSortedSet(c, sRaw * 24);
    for (let m = 0; m < N_PHASE1_MOVES; m++) {
      sliceRaw[sRaw * N_PHASE1_MOVES + m] = sliceRawOf(applyMove(c, m));
    }
  }

  progress?.('cperm');
  const cperm = buildPhase2Move(N_CPERM, cpermSet, cpermOf);

  progress?.('eperm');
  const eperm = buildPhase2Move(N_EPERM, epermSet, epermOf);

  progress?.('sperm');
  const sperm = buildPhase2Move(N_SPERM, spermSet, spermOf);

  return { twist, flip, sliceSorted, sliceRaw, cperm, eperm, sperm };
}

/* ────────────────────────────────────────────────────────────────────── *
 *  "slice unsorted" coord helpers (re-exported from coords for convenience)
 * ────────────────────────────────────────────────────────────────────── */

export function sliceRawFromSorted(sorted: number): number {
  return Math.floor(sorted / 24);
}
