/**
 * IDA* two-phase search.
 *
 * Phase 1: bring cube into G1 = <U,D,L2,R2,F2,B2> by zeroing twist+flip and
 * placing slice edges into the slice slots. Heuristic = max of two prune
 * lookups (twist+slice and flip+slice).
 *
 * Phase 2: solve cube within G1 using only G1 moves. Heuristic = max of
 * two prune lookups (cperm+sperm and eperm+sperm).
 *
 * Combining: we don't simply solve phase 1 then phase 2. The classical
 * Kociemba trick is to enumerate phase-1 solutions of increasing length
 * and, for each, run phase 2; total length of (phase1 + phase2) is what
 * we minimize. This commonly yields ≤ 21 STM.
 *
 * For random-state SCRAMBLES the exact optimum doesn't matter — anything
 * around 19-21 STM is fine. We bail out as soon as we find a solution.
 */

import {
  PHASE2_MOVES,
  applyMove,
  cloneCubie,
  invertSequence,
  type CubieCube,
} from './cube';
import {
  coTwistOf,
  eoFlipOf,
  sliceRawOf,
  cpermOf,
  epermOf,
  spermOf,
} from './coords';
import type { MoveTables } from './movetables';
import {
  lookupTwistSlice,
  lookupFlipSlice,
  lookupCpermSperm,
  lookupEpermSperm,
  type PruneTables,
} from './prune';

const N_PHASE1_MOVES = 18;
const N_PHASE2_MOVES = 10;

/** Same-face / same-axis filter to prune trivial sequences.
 *
 *  faceOf[m] = 0..5 (U,R,F,D,L,B)
 *  axisOf[m] = 0..2 (UD, RL, FB)
 *
 *  Disallowed: same face twice in a row; or same axis with the higher face
 *  index (canonicalize R-then-L allowed but L-then-R also allowed once;
 *  L-then-R-then-L disallowed via "no same face after same axis").
 *
 *  Concretely: forbid if face(prev)==face(cur), or (axis(prev)==axis(cur)
 *  and face(prev) > face(cur)) — this canonical form avoids enumerating
 *  R L vs L R as distinct sequences when both come down to the same.
 */

function faceOf(m: number): number {
  return Math.floor(m / 3);
}
const AXIS = [0, 1, 2, 0, 1, 2]; // U,R,F,D,L,B → axis index

function disallowedNext(prev: number, cur: number): boolean {
  if (prev < 0) return false;
  const fp = faceOf(prev);
  const fc = faceOf(cur);
  if (fp === fc) return true;
  if (AXIS[fp] === AXIS[fc] && fp > fc) return true;
  return false;
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Phase 1 IDA*
 * ────────────────────────────────────────────────────────────────────── */

interface Phase1State {
  twist: number;
  flip: number;
  sliceSorted: number;
  sliceRaw: number;
}

function phase1StateOf(c: CubieCube): Phase1State {
  return {
    twist: coTwistOf(c),
    flip: eoFlipOf(c),
    sliceSorted: 0, // updated by sliceSortedOf below
    sliceRaw: sliceRawOf(c),
  };
}

/* Phase-1 doesn't actually need sliceSorted during search; it's only needed
 * at the boundary so phase 2 has the correct initial state. We compute it
 * separately on the cubie cube once a phase-1 solution candidate is found. */

function phase1Heuristic(p: PruneTables, twist: number, flip: number, sliceRaw: number): number {
  const a = lookupTwistSlice(p, twist, sliceRaw);
  const b = lookupFlipSlice(p, flip, sliceRaw);
  return Math.max(a, b);
}

/**
 * Run IDA* on phase 1; for each solution found at depth ≤ phase1MaxDepth,
 * yield it (as an array of move indices). Caller then runs phase 2 from
 * the resulting cube state.
 *
 * We don't use a generator (TS strict + Node compat); instead we accept a
 * callback that returns true to stop the enumeration.
 */
function ida1(
  start: CubieCube,
  mt: MoveTables,
  pt: PruneTables,
  maxDepth: number,
  onSolution: (sol: number[]) => boolean, // return true to stop
): void {
  const startSt = phase1StateOf(start);
  const path = new Int32Array(maxDepth);

  for (let limit = phase1Heuristic(pt, startSt.twist, startSt.flip, startSt.sliceRaw);
       limit <= maxDepth; limit++) {
    if (search1(startSt.twist, startSt.flip, startSt.sliceRaw, 0, limit, -1, path,
                mt, pt, onSolution)) return;
  }
}

function search1(
  twist: number,
  flip: number,
  sliceRaw: number,
  depth: number,
  limit: number,
  prevMove: number,
  path: Int32Array,
  mt: MoveTables,
  pt: PruneTables,
  onSolution: (sol: number[]) => boolean,
): boolean {
  if (depth === limit) {
    // Goal in phase-1 coord space?
    if (twist === 0 && flip === 0 && sliceRaw === 494) {
      // Build move list and report.
      const sol = Array.from(path.subarray(0, depth));
      if (onSolution(sol)) return true;
    }
    return false;
  }
  const h = phase1Heuristic(pt, twist, flip, sliceRaw);
  if (h + depth > limit) return false;

  for (let m = 0; m < N_PHASE1_MOVES; m++) {
    if (disallowedNext(prevMove, m)) continue;
    const newTwist = mt.twist[twist * N_PHASE1_MOVES + m];
    const newFlip = mt.flip[flip * N_PHASE1_MOVES + m];
    const newSliceRaw = mt.sliceRaw[sliceRaw * N_PHASE1_MOVES + m];
    path[depth] = m;
    if (search1(newTwist, newFlip, newSliceRaw, depth + 1, limit, m, path, mt, pt, onSolution))
      return true;
  }
  return false;
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Phase 2 IDA*
 * ────────────────────────────────────────────────────────────────────── */

function phase2Heuristic(p: PruneTables, cperm: number, eperm: number, sperm: number): number {
  const a = lookupCpermSperm(p, cperm, sperm);
  const b = lookupEpermSperm(p, eperm, sperm);
  return Math.max(a, b);
}

/** prevMove is the LAST PHASE-1 MOVE (in 0..17 space) so we can avoid
 *  starting phase 2 with same face / same-axis-prevMove. We adapt the
 *  filter to phase-2 indices by mapping back to face. */
function ida2(
  start: CubieCube,
  mt: MoveTables,
  pt: PruneTables,
  maxDepth: number,
  prevMoveLast: number, // last move from phase 1 (in 0..17), or -1
): number[] | null {
  const cperm = cpermOf(start);
  const eperm = epermOf(start);
  const sperm = spermOf(start);

  const path = new Int32Array(maxDepth); // stores indices into ALL_MOVES (0..17)

  for (let limit = phase2Heuristic(pt, cperm, eperm, sperm);
       limit <= maxDepth; limit++) {
    if (search2(cperm, eperm, sperm, 0, limit, prevMoveLast, path, mt, pt)) {
      return Array.from(path.subarray(0, limit));
    }
  }
  return null;
}

function search2(
  cperm: number,
  eperm: number,
  sperm: number,
  depth: number,
  limit: number,
  prevMove: number,
  path: Int32Array,
  mt: MoveTables,
  pt: PruneTables,
): boolean {
  if (depth === limit) {
    return cperm === 0 && eperm === 0 && sperm === 0;
  }
  const h = phase2Heuristic(pt, cperm, eperm, sperm);
  if (h + depth > limit) return false;

  for (let m2 = 0; m2 < N_PHASE2_MOVES; m2++) {
    const m = PHASE2_MOVES[m2]; // map back to 0..17 for filter
    if (disallowedNext(prevMove, m)) continue;
    const newCperm = mt.cperm[cperm * N_PHASE2_MOVES + m2];
    const newEperm = mt.eperm[eperm * N_PHASE2_MOVES + m2];
    const newSperm = mt.sperm[sperm * N_PHASE2_MOVES + m2];
    path[depth] = m;
    if (search2(newCperm, newEperm, newSperm, depth + 1, limit, m, path, mt, pt))
      return true;
  }
  return false;
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Combined two-phase solver
 * ────────────────────────────────────────────────────────────────────── */

export interface SolveOptions {
  /** Max total length (phase1+phase2). Default 23. */
  maxTotalLen?: number;
  /** Stop searching once a solution of this length or shorter is found. Default 21. */
  targetLen?: number;
  /** Hard timeout in ms (best-effort, checked between IDA depth bumps). */
  timeoutMs?: number;
  /** Search depth bound for phase 1. Default 12. */
  phase1MaxDepth?: number;
  /** Search depth bound for phase 2. Default 18. */
  phase2MaxDepth?: number;
}

export function solveCube(
  start: CubieCube,
  mt: MoveTables,
  pt: PruneTables,
  opts: SolveOptions = {},
): number[] {
  const maxTotal = opts.maxTotalLen ?? 23;
  const phase1Max = opts.phase1MaxDepth ?? 12;
  const phase2Max = opts.phase2MaxDepth ?? 18;
  const targetLen = opts.targetLen ?? 20;
  const startTime = Date.now();
  const timeout = opts.timeoutMs ?? 200;

  let best: number[] | null = null;

  ida1(start, mt, pt, phase1Max, (phase1Sol) => {
    if (Date.now() - startTime > timeout) return true;

    // Apply phase-1 moves to get the starting state for phase 2.
    let cur = cloneCubie(start);
    for (const m of phase1Sol) cur = applyMove(cur, m);

    // Maximum allowed phase-2 length given current best
    const phase2Limit = best
      ? Math.min(phase2Max, best.length - phase1Sol.length - 1)
      : Math.min(phase2Max, maxTotal - phase1Sol.length);
    if (phase2Limit < 0) return false;

    const lastP1 = phase1Sol.length > 0 ? phase1Sol[phase1Sol.length - 1] : -1;
    const phase2Sol = ida2(cur, mt, pt, phase2Limit, lastP1);
    if (phase2Sol) {
      const total = phase1Sol.concat(phase2Sol);
      if (!best || total.length < best.length) {
        best = total;
        // Stop once we hit target length (typical WCA ~19-21).
        if (best.length <= targetLen) return true;
      }
    }
    return false;
  });

  if (!best) {
    throw new Error('Kociemba: no solution found within depth bound');
  }
  return best;
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Public API: solve → scramble (= inverse of solution)
 * ────────────────────────────────────────────────────────────────────── */

export function scrambleFromState(
  state: CubieCube,
  mt: MoveTables,
  pt: PruneTables,
  opts: SolveOptions = {},
): number[] {
  const sol = solveCube(state, mt, pt, opts);
  return invertSequence(sol);
}
