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

/* ────────────────────────────────────────────────────────────────────── *
 *  Hard deadline (opt-in via SolveOptions.hardTimeout)
 *
 *  `timeoutMs` 本身只在 phase-1 出解的回调里生效。高度对称的状态可能在某个
 *  深度层里搜很久都不出 phase-1 解,那条回调根本不被调用,于是实际耗时能比
 *  预算高一两个数量级。开 hardTimeout 后在 IDA 节点循环里按节点计数查时钟,
 *  超时置 aborted、层层立即返回 false(不能返回 true —— 那在 search2 里会被
 *  当成"找到解"而吐出错误路径)。
 *  单线程 + 一次只跑一个 solveCube,模块级状态足够,不引入额外参数。
 * ────────────────────────────────────────────────────────────────────── */

let deadline = 0; // epoch ms;0 = 不启用
let nodeTick = 0;
let aborted = false;

function timeUp(): boolean {
  if (aborted) return true;
  if (deadline === 0) return false;
  if ((++nodeTick & 0x3ff) !== 0) return false;
  if (Date.now() > deadline) { aborted = true; return true; }
  return false;
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
    if (aborted) return;
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
  if (timeUp()) return false;
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
    if (aborted) return false;
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
    if (aborted) return null;
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
  if (timeUp()) return false;
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
    if (aborted) return false;
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
  /** Timeout in ms. Default 200. Only checked when a phase-1 solution surfaces
   *  unless `hardTimeout` is set. */
  timeoutMs?: number;
  /** 让 `timeoutMs` 成为真正的上限:在 IDA 节点循环里查时钟。默认关,因为开了
   *  以后超时仍无解就会抛错(现有调用方靠"搜到为止"的宽松语义)。批量求解
   *  一堆状态、必须卡住尾延迟时才开。 */
  hardTimeout?: boolean;
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

  aborted = false;
  nodeTick = 0;
  deadline = opts.hardTimeout ? startTime + timeout : 0;

  let best: number[] | null = null;

  ida1(start, mt, pt, phase1Max, (phase1Sol) => {
    // 软超时只用来"停止继续优化",不能让调用方空手而归 —— 手上还没有任何解就
    // 收工,只会变成 "no solution found"。真正想卡住尾延迟的用 hardTimeout。
    if (best && Date.now() - startTime > timeout) return true;

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

  deadline = 0;
  if (!best) {
    throw new Error(aborted
      ? `Kociemba: timed out after ${timeout}ms`
      : 'Kociemba: no solution found within depth bound');
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
