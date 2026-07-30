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
 * Turn counts are HTM: a cube reports quarter turns only, so a double turn
 * arrives as two notifications and `htm.ts` merges each run of same-face turns
 * back into one move. Without that, these counts can't be compared with a
 * solver's — which is the whole job of reference.ts — and every double turn
 * reads as a wasted move.
 *
 * This is a DELIBERATE divergence from Cubeast, which documents that it "will
 * treat them as separate turns" when you pause mid-double-turn. Their rule
 * makes a move count depend on hesitation; ours doesn't, because HTM is a
 * property of the sequence and the pause is already charged — by the flow axis
 * in quality.ts, which exists to see exactly that.
 *
 * Everything here is derived from (scramble, moves, timeMs) on demand —
 * nothing new is persisted, so no stored solve needs migrating and a
 * definition fix here retroactively fixes every historical report.
 */

import { computeStageSegments } from './stage_segments';
import { htmMoves } from './htm';
import type { HtmMove } from './htm';
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
  /** HTM turn count of the step: same-face quarter turns merged, rotations 0. */
  turns: number | null;
  /** Turns from the execution start onwards — i.e. `turns` minus the leading
   *  AUF/regrip. This is the alg the hands actually ran, which is what a
   *  last-layer alg reference is comparable with (an alg carries no AUF). */
  execTurns: number | null;
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
  /** HTM turns across all steps. */
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

/** Counted moves whose first quarter turn falls in [from, to], rotations
 *  excluded (they are 0 turns in every metric here). */
function countRange(counted: HtmMove[], from: number, to: number): number {
  let n = 0;
  for (const h of counted) {
    if (h.startIdx >= from && h.startIdx <= to && stmWeight(h.m) > 0) n += 1;
  }
  return n;
}

/**
 * The moves of `[from, to]` written the way a cuber would write them.
 *
 * Same attribution rule as `countRange` — a move belongs to the range its FIRST
 * quarter turn fell in — so the sequence printed for a step always has exactly
 * as many turns as that step's turn count, and a run straddling a boundary is
 * never shown twice.
 *
 * Two things deliberately survive that the turn count drops, because the point
 * of showing the sequence is to explain the count rather than to restate it:
 * whole-cube rotations (0 moves in every metric, but the cuber did them and
 * they are where a regrip went), and runs that cancelled — `htmMoves` emits
 * nothing for an `R R'`, so its quarters are uncovered here and print raw. A
 * step whose sequence reads longer than its turn count is a step with wasted
 * work in it, which is worth seeing.
 */
export function tokensForRange(
  moves: SolveMove[],
  counted: HtmMove[],
  from: number,
  to: number,
): string[] {
  const startsAt = new Map<number, string>();
  const covered = new Set<number>();
  for (const h of counted) {
    if (h.startIdx >= from && h.startIdx <= to) startsAt.set(h.startIdx, h.m);
    for (let i = h.startIdx; i <= h.endIdx; i++) covered.add(i);
  }
  const out: string[] = [];
  const lo = Math.max(0, from);
  const hi = Math.min(to, moves.length - 1);
  for (let i = lo; i <= hi; i++) {
    const merged = startsAt.get(i);
    if (merged) { out.push(merged); continue; }
    // A later quarter of a move already emitted, or of one attributed to the
    // previous step. Either way it is not this step's to print.
    if (covered.has(i)) continue;
    const raw = (moves[i]?.m ?? '').trim();
    if (raw) out.push(raw);
  }
  return out;
}

/** The five numbers a contiguous run of moves produces. */
export interface RangeMetric {
  recognitionMs: number;
  executionMs: number;
  stepMs: number;
  cumulativeMs: number;
  turns: number;
  execTurns: number;
  tps: number | null;
}

/**
 * Recognition / execution / turns for `moves(prevEndIdx, endIdx]`.
 *
 * Extracted so `f2l_slots.ts` can split F2L into four pairs using exactly this
 * definition instead of a second copy of it. A slot IS a step; the only thing
 * that differs is where the boundaries come from.
 *
 * `prevEndTs` is the previous step's last turn — the moment this step's clock
 * starts. It is a parameter rather than derived from `prevEndIdx` because the
 * first step's clock starts at the solve's first turn, not at a previous move.
 */
export function metricForRange(
  moves: SolveMove[],
  counted: HtmMove[],
  prevEndIdx: number,
  prevEndTs: number,
  endIdx: number,
): RangeMetric {
  const stepMoves = moves.slice(prevEndIdx + 1, endIdx + 1);
  const firstTs = stepMoves.length > 0 ? stepMoves[0].ts : moves[endIdx].ts;
  const endTs = moves[endIdx].ts;
  // First turn that isn't an adjustment — where execution begins. A step
  // that is all AUF/rotations falls back to its literal first turn.
  const execStartAt = stepMoves.findIndex(mv => endsRecognition(mv.m));
  const execStartTs = execStartAt >= 0 ? stepMoves[execStartAt].ts : firstTs;

  const recognitionMs = Math.max(0, execStartTs - prevEndTs);
  const executionMs = Math.max(0, endTs - execStartTs);
  // Counted in HTM, so a double turn the cube reported as two quarter turns
  // is one move — otherwise these numbers can't be compared with a solver's
  // (reference.ts does exactly that). Attribution is by where each move
  // STARTED, which is why the merge runs over the whole stream once rather
  // than per step: a run straddling a step boundary belongs to the step the
  // cuber was still in when they began turning.
  const turns = countRange(counted, prevEndIdx + 1, endIdx);
  const execTurns = countRange(
    counted,
    prevEndIdx + 1 + (execStartAt >= 0 ? execStartAt : 0),
    endIdx,
  );

  return {
    recognitionMs,
    executionMs,
    stepMs: recognitionMs + executionMs,
    cumulativeMs: endTs,
    turns,
    execTurns,
    tps: executionMs > 0 && turns > 0 ? turns / (executionMs / 1000) : null,
  };
}

export function computeStepMetrics(
  scramble: string,
  moves: SolveMove[],
  totalMs: number,
): StepMetricsResult | null {
  if (!moves || moves.length === 0) return null;
  const segments = computeStageSegments(scramble, moves, totalMs);
  if (!segments) return null;

  // Merged once for the whole stream; every per-step count is a slice of this.
  const counted = htmMoves(moves);

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
        stepMs: null, cumulativeMs: null, turns: null, execTurns: null, tps: null });
      continue;
    }
    if (endIdx === prevEndIdx) {
      // Completed by the same move as the previous step — skipped.
      steps.push({ step, skipped: true, recognitionMs: null, executionMs: null,
        stepMs: 0, cumulativeMs: moves[endIdx].ts, turns: 0, execTurns: 0, tps: null });
      continue;
    }

    const m = metricForRange(moves, counted, prevEndIdx, prevEndTs, endIdx);
    steps.push({ step, skipped: false, ...m });
    prevEndIdx = endIdx;
    prevEndTs = m.cumulativeMs;
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
