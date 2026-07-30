/**
 * Recognition / execution split per CFOP step — Cubeast's definitions, adopted
 * verbatim so our numbers are comparable with the only other product that
 * publishes any (see SMART_CUBE_RESEARCH.md, "step 级五个时间字段"):
 *
 *   recognition — the step clock starts when the PREVIOUS step's last turn
 *     lands and stops at this step's first non-AUF turn. AUF turns (U-face
 *     adjustments before an alg) count as recognition, not execution.
 *   execution   — first non-AUF turn → last turn of the step.
 *   step time   — recognition + execution, i.e. previous step's last turn →
 *     this step's last turn. The two always partition it exactly.
 *   TPS         — slice turns / EXECUTION time. Dividing by the full step
 *     would dilute hand speed with thinking time, which is the entire point
 *     of the split.
 *
 * The first step has no previous turn, so its clock starts at the solve's
 * first turn — the gap from timer start to that turn is `pickupMs`, its own
 * number (Cubeast draws Pickup as its own segment in the stacked bar, before
 * Cross). Symmetrically `putDownMs` is last turn → timer stop.
 *
 * Decisions Cubeast's public material doesn't settle, fixed here:
 *   - A step consisting ONLY of AUF turns (PLL that is just "U"): there is no
 *     non-AUF turn to hand off at, so recognition runs to the step's FIRST
 *     turn and the AUF itself becomes the execution — it did solve the cube.
 *   - execution of 0 ms (single-turn step): TPS is null, not Infinity.
 *   - Rotations (x/y/z) count 0 turns (STM) and, like AUF, do not end
 *     recognition — a regrip is not the alg starting.
 *
 * Turn counts are STM and are pause-aware BY CONSTRUCTION: smart cubes report
 * quarter turns and we never merge two of them into a U2, so a U2 with a
 * think in the middle is already 2 turns — the behaviour Cubeast documents
 * as "will treat them as separate turns".
 *
 * Everything here is derived from (scramble, moves, timeMs) on demand —
 * nothing new is persisted, so no stored solve needs migrating and a
 * definition fix here retroactively fixes every historical report.
 */

import { computeStageSegments } from './stage_segments';
import type { SolveMove, StageSegments } from './stage_segments';

export type StepKey = 'cross' | 'f2l' | 'oll' | 'pll';

export interface StepMetric {
  step: StepKey;
  /** True when this step was completed by the same move as the previous one
   *  (XCross, OLL skip, PLL skip): zero moves, zero time. */
  skipped: boolean;
  /** Previous step's last turn → this step's first non-AUF turn. null when
   *  the step was skipped or never reached. */
  recognitionMs: number | null;
  /** First non-AUF turn → last turn of the step. */
  executionMs: number | null;
  /** recognition + execution. 0 for skipped steps, null for unreached. */
  stepMs: number | null;
  /** Timer start → this step completed (= ts of the completing move). */
  cumulativeMs: number | null;
  /** STM turn count of the step (rotations 0, everything else 1). */
  turns: number | null;
  /** turns / executionMs. null when executionMs is 0 or the step has none. */
  tps: number | null;
}

export interface StepMetricsResult {
  /** Timer start → first turn. */
  pickupMs: number;
  /** Last turn → timer stop. null when the solve never reached solved
   *  (a DNF has no put-down — the tail is unfinished solving). */
  putDownMs: number | null;
  /** timeMs minus pickup and put-down: time spent actually turning+thinking. */
  solvingMs: number;
  totalRecognitionMs: number;
  totalExecutionMs: number;
  /** STM turns across all steps. */
  totalTurns: number;
  /** totalTurns / totalExecutionMs — hand speed, not diluted by thinking. */
  execTps: number | null;
  /** In solve order: cross, f2l, oll, pll. */
  steps: StepMetric[];
  /** The segment walk this was derived from (with move indices populated). */
  segments: StageSegments;
}

/** AUF = a bare U-face turn: U, U', U2 (and U2' just in case). Wide/lower-case
 *  u moves the E slice too — that is a real turn, not an adjustment. */
export function isAufToken(raw: string): boolean {
  return /^U['2]{0,2}$/.test(raw.trim());
}

/** STM weight of a token: whole-cube rotations are 0 turns, all else 1. */
export function stmWeight(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  return /^[xyz]/i.test(t) ? 0 : 1;
}

/** A turn that ends recognition: not an AUF, not a rotation. */
function endsRecognition(raw: string): boolean {
  return stmWeight(raw) > 0 && !isAufToken(raw);
}

export function computeStepMetrics(
  scramble: string,
  moves: SolveMove[],
  totalMs: number,
): StepMetricsResult | null {
  if (!moves || moves.length === 0) return null;
  const segments = computeStageSegments(scramble, moves, totalMs);
  if (!segments) return null;

  const ends: Array<{ step: StepKey; endIdx: number | null }> = [
    { step: 'cross', endIdx: segments.crossEndIdx ?? null },
    { step: 'f2l',   endIdx: segments.f2lEndIdx   ?? null },
    { step: 'oll',   endIdx: segments.ollEndIdx   ?? null },
    { step: 'pll',   endIdx: segments.solvedEndIdx ?? null },
  ];

  const steps: StepMetric[] = [];
  // The first step's clock starts at the solve's first turn (pickup is its
  // own segment, before it), so prevEndTs starts there — NOT at 0.
  let prevEndIdx = -1;
  let prevEndTs = moves[0].ts;

  for (const { step, endIdx } of ends) {
    if (endIdx === null) {
      // Never reached (DNF / mid-solve abort). Everything after is null too,
      // but keep emitting rows so the caller sees all four steps.
      steps.push({ step, skipped: false, recognitionMs: null, executionMs: null,
        stepMs: null, cumulativeMs: null, turns: null, tps: null });
      continue;
    }
    if (endIdx === prevEndIdx) {
      // Completed by the same move as the previous step — skipped.
      steps.push({ step, skipped: true, recognitionMs: null, executionMs: null,
        stepMs: 0, cumulativeMs: moves[endIdx].ts, turns: 0, tps: null });
      continue;
    }

    const stepMoves = moves.slice(prevEndIdx + 1, endIdx + 1);
    const firstTs = stepMoves[0].ts;
    const endTs = moves[endIdx].ts;
    // First turn that isn't an adjustment — where execution begins. A step
    // that is all AUF/rotations falls back to its literal first turn.
    const execStart = stepMoves.find(mv => endsRecognition(mv.m));
    const execStartTs = execStart ? execStart.ts : firstTs;

    const recognitionMs = Math.max(0, execStartTs - prevEndTs);
    const executionMs = Math.max(0, endTs - execStartTs);
    const turns = stepMoves.reduce((acc, mv) => acc + stmWeight(mv.m), 0);

    steps.push({
      step,
      skipped: false,
      recognitionMs,
      executionMs,
      stepMs: recognitionMs + executionMs,
      cumulativeMs: endTs,
      turns,
      tps: executionMs > 0 && turns > 0 ? turns / (executionMs / 1000) : null,
    });
    prevEndIdx = endIdx;
    prevEndTs = endTs;
  }

  const pickupMs = Math.max(0, moves[0].ts);
  const solvedEndIdx = segments.solvedEndIdx ?? null;
  const putDownMs = solvedEndIdx !== null
    ? Math.max(0, totalMs - moves[solvedEndIdx].ts)
    : null;
  const solvingMs = Math.max(0, totalMs - pickupMs - (putDownMs ?? 0));

  let totalRecognitionMs = 0;
  let totalExecutionMs = 0;
  let totalTurns = 0;
  for (const s of steps) {
    totalRecognitionMs += s.recognitionMs ?? 0;
    totalExecutionMs += s.executionMs ?? 0;
    totalTurns += s.turns ?? 0;
  }

  return {
    pickupMs,
    putDownMs,
    solvingMs,
    totalRecognitionMs,
    totalExecutionMs,
    totalTurns,
    execTps: totalExecutionMs > 0 && totalTurns > 0
      ? totalTurns / (totalExecutionMs / 1000)
      : null,
    steps,
    segments,
  };
}
