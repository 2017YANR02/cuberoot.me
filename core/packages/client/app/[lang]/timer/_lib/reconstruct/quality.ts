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
 *   流畅 flow — "if you never stopped, this solve would have taken X". X is
 *     your turn count divided by YOUR OWN peak turn rate (the fastest 8-turn
 *     burst in this solve), so a 30-second beginner and a 7-second pro are
 *     each measured against their own hands rather than a global TPS table.
 *     flowFraction = X / solving time; mapped 0.40 → 0, 0.90 → 100.
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
 * competent solve near 75, a tight one near 90, and a sloppy one near 45.
 *
 * Scored solves only: an unfinished solve (DNF mid-solve) gets no score at
 * all rather than a flattering one — half a solve has no put-down, no last
 * layer, and no honest denominator.
 */

import type { ErrorDetectResult } from './error_detect';
import { htmMoves } from './htm';
import type { ReferenceResult } from './reference';
import type { SolveMove } from './stage_segments';
import type { StepMetricsResult } from './step_metrics';

/** Turns in the burst used to measure peak turn rate. Long enough that one
 *  lucky fast pair of quarter turns can't set the pace, short enough that
 *  every real solve contains at least one. */
const PEAK_WINDOW = 8;

/** flowFraction mapped to 0-100 between these bounds. */
const FLOW_FLOOR = 0.40;
const FLOW_CEIL = 0.90;

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
  /** Fastest sustained turn rate in this solve (turns/s). */
  peakTps: number | null;
  /** Turn count ÷ peak rate: how long the hands alone would have taken. */
  idealMs: number | null;
  /** First turn → last turn (the denominator for flow and waste). */
  solvingMs: number;
  wastedMs: number;
}

function clamp100(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v;
}

/**
 * Fastest sustained turn rate: the best (window turns / elapsed) over every
 * span of `PEAK_WINDOW` consecutive turns, falling back to the whole stream
 * when the solve is shorter than one window. Null when every timestamp is
 * identical (a stream with no timing information).
 */
export function peakTurnRate(moves: SolveMove[], window = PEAK_WINDOW): number | null {
  if (!moves || moves.length < 2) return null;
  const span = Math.min(window, moves.length - 1);
  let best: number | null = null;
  for (let i = 0; i + span < moves.length; i++) {
    const elapsed = moves[i + span].ts - moves[i].ts;
    if (elapsed <= 0) continue;
    const tps = span / (elapsed / 1000);
    if (best === null || tps > best) best = tps;
  }
  return best;
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

  // Measured on MERGED moves, because metrics.totalTurns is HTM: mixing the
  // two units here would understate idealMs and quietly drag flow down for
  // anyone who turns double turns (i.e. everyone).
  const peakTps = peakTurnRate(htmMoves(moves));
  const idealMs = peakTps !== null && peakTps > 0
    ? (metrics.totalTurns / peakTps) * 1000
    : null;
  const flow = idealMs !== null
    ? clamp100(((idealMs / solvingMs) - FLOW_FLOOR) / (FLOW_CEIL - FLOW_FLOOR) * 100)
    : null;

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
    peakTps,
    idealMs,
    solvingMs,
    wastedMs,
  };
}
