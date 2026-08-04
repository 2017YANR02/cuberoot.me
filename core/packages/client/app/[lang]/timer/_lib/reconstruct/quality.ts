/**
 * Solve Quality — one 0-100 number for a solve, and the three numbers it is
 * made of. Research doc P0-4: nobody in the category scores a solve, and XC大师
 * has already shown that a single headline number is what makes people come
 * back to a report. So it has to exist, and it has to be defensible.
 *
 * Three axes, each 0-100, deliberately measuring different things:
 *
 *   效率 efficiency — your turns vs the per-stage reference (see reference.ts).
 *     Both sides are HTM: a cube reports quarter turns, so the stream is merged
 *     (htm.ts) before counting or a double turn would read as two moves.
 *     100 at parity or better; 130 points lost per whole unit of ratio, so
 *     ratio 1.0 → 100, 1.2 → 74, 1.5 → 35, ≥1.77 → 0. Null when no stage had
 *     a reference (then the total is renormalised over what's left).
 *
 *   流畅 fluency — what proportion of the solve you spent TURNING rather than
 *     PAUSING. Every gap between two reported quarter turns is one turn's
 *     execution plus however long you stood still first; charge each gap one
 *     turn's worth (turningSplit below) and whatever is left over is a pause.
 *     The score IS the percentage — no curve on top, because the number is
 *     already a share of the solve and a rescaled share is exactly what nobody
 *     can read (a 2026-08-04 report showed 0% for a solve that was turning
 *     roughly 40% of the time; the floor of the old 0.40→0/0.90→100 mapping).
 *     This is the axis that sees the pauses INSIDE F2L, which the per-step
 *     recognition/execution split (step_metrics.ts) structurally cannot: its
 *     recognition is only the four gaps between steps.
 *
 *   无废步 waste-free — wasted time (error_detect.ts) as a share of solving
 *     time, 150 points per whole share. A wasted DETOUR also inflates the turn
 *     count and so is charged twice, deliberately: undoing your own work is the
 *     one mistake worth being loud about. A turn undone immediately (R then R')
 *     is the exception — HTM cancels it, so efficiency never sees it and this
 *     axis is the only one that charges it.
 *
 * Weights 0.40 / 0.40 / 0.20. Calibration target from the research doc was
 * "typical values land 50-95"; the anchors pinned in quality.test.ts put a
 * competent solve near 80, a tight one near 93, and a sloppy one near 48.
 *
 * Scored solves only: an unfinished solve (DNF mid-solve) gets no score at
 * all rather than a flattering one — half a solve has no put-down, no last
 * layer, and no honest denominator.
 */

import type { ErrorDetectResult } from './error_detect';
import type { ReferenceResult } from './reference';
import type { SolveMove } from './stage_segments';
import type { StepMetricsResult } from './step_metrics';

/**
 * Below this a gap is not a human quarter turn: it is two moves that reached us
 * in one BLE packet and got stamped together (move_clock.ts spells out why —
 * the protocols with no device clock fall back to arrival time, and a packet
 * carries several moves at once). Such gaps still count as turning; they are
 * only kept out of the turn-cost ESTIMATE, so one batched pair cannot drag the
 * cost to zero and the whole solve to 0%. 40ms = 25 tps, comfortably above any
 * human quarter turn.
 */
const MIN_TURN_MS = 40;

/**
 * Which of your own gaps counts as "one turn, nothing else in it". The 25th
 * percentile: low enough that it lands inside a burst rather than in the middle
 * of a pause, high enough that a couple of freak samples cannot set it. A mean
 * or a median would fold the pauses into the very thing that is supposed to
 * measure them.
 */
const TURN_COST_QUANTILE = 0.25;

/** Score points lost per unit of (turn ratio - 1). */
const EFFICIENCY_SLOPE = 130;
/** Score points lost per unit of (wasted time / solving time). */
const WASTE_SLOPE = 150;

const WEIGHT_EFFICIENCY = 0.4;
const WEIGHT_FLOW = 0.4;
const WEIGHT_WASTE = 0.2;

export interface SolveQuality {
  /** 0-100, rounded. The weighted mean of the components that exist. */
  total: number;
  efficiency: number | null;
  flow: number | null;
  wasteFree: number;
  /** userTurns / refTurns; null when no stage had a reference. */
  turnRatio: number | null;
  /** Of `solvingMs`, how much was spent turning. Null without move timings. */
  turningMs: number | null;
  /** The rest of `solvingMs`: standing still, looking. */
  pausingMs: number | null;
  /** What one quarter turn costs these hands (ms) — the split's yardstick. */
  turnMs: number | null;
  /** First turn → last turn (the denominator for fluency and waste). */
  solvingMs: number;
  wastedMs: number;
}

function clamp100(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v;
}

export interface TurningSplit {
  /** Of the solve, the part spent turning. */
  turningMs: number;
  /** The rest: pauses (recognition, lookahead, hesitation). */
  pausingMs: number;
  /** One quarter turn, as these hands do it. */
  turnMs: number;
}

/**
 * Split the solve into turning and pausing.
 *
 * The cube reports one timestamp per quarter turn, so the gap between two of
 * them is `turnMs` of execution plus however long the solver stood still first.
 * Charge every gap one `turnMs` and the leftovers are the pauses:
 *
 *     pausingMs = Σ max(0, gap − turnMs)
 *     turningMs = solvingMs − pausingMs
 *
 * Measured on RAW quarter turns, not on merged HTM moves: every physical turn
 * costs about the same, whereas a merged R2 is one move that legitimately took
 * two turns' time and would be charged as a pause.
 *
 * Null when there is no usable timing (fewer than two moves, or every timestamp
 * identical).
 */
export function turningSplit(moves: SolveMove[], solvingMs: number): TurningSplit | null {
  if (!moves || moves.length < 2 || solvingMs <= 0) return null;
  const gaps: number[] = [];
  for (let i = 1; i < moves.length; i++) {
    const gap = moves[i].ts - moves[i - 1].ts;
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return null;

  const human = gaps.filter(g => g >= MIN_TURN_MS);
  const sorted = (human.length > 0 ? human : gaps).slice().sort((a, b) => a - b);
  const turnMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * TURN_COST_QUANTILE))];

  let pausingMs = 0;
  for (const gap of gaps) if (gap > turnMs) pausingMs += gap - turnMs;
  if (pausingMs > solvingMs) pausingMs = solvingMs;
  return { turningMs: solvingMs - pausingMs, pausingMs, turnMs };
}

export function computeSolveQuality(
  moves: SolveMove[],
  metrics: StepMetricsResult,
  reference: ReferenceResult | null,
  waste: ErrorDetectResult | null,
): SolveQuality | null {
  // Unfinished solves are not scored: putDownMs is null exactly when the cube
  // never reached solved, which is also when the last layer, the reference and
  // the denominator are all missing.
  if (metrics.putDownMs === null) return null;
  if (metrics.totalTurns <= 0) return null;

  const solvingMs = metrics.solvingMs;
  if (solvingMs <= 0) return null;

  const split = turningSplit(moves, solvingMs);
  const flow = split !== null ? clamp100((split.turningMs / solvingMs) * 100) : null;

  const turnRatio = reference && reference.refTurns !== null && reference.refTurns > 0
      && reference.userTurns !== null
    ? reference.userTurns / reference.refTurns
    : null;
  const efficiency = turnRatio !== null
    ? clamp100(100 - EFFICIENCY_SLOPE * (turnRatio - 1))
    : null;

  const wastedMs = waste?.totalWastedMs ?? 0;
  const wasteFree = clamp100(100 - WASTE_SLOPE * (wastedMs / solvingMs));

  let weighted = WEIGHT_WASTE * wasteFree;
  let weight = WEIGHT_WASTE;
  if (efficiency !== null) { weighted += WEIGHT_EFFICIENCY * efficiency; weight += WEIGHT_EFFICIENCY; }
  if (flow !== null) { weighted += WEIGHT_FLOW * flow; weight += WEIGHT_FLOW; }

  return {
    total: Math.round(weighted / weight),
    efficiency,
    flow,
    wasteFree,
    turnRatio,
    turningMs: split?.turningMs ?? null,
    pausingMs: split?.pausingMs ?? null,
    turnMs: split?.turnMs ?? null,
    solvingMs,
    wastedMs,
  };
}
