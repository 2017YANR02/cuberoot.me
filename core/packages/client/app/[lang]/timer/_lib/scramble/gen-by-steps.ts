/*
 * gen-by-steps — local "按步数生成" dispatch for the timer's random source. Maps (event, settings) to a
 * pooled generator keyed by metric+range, or null when by-steps isn't active for this event. Keeps the
 * generator choice (2×2 / pyraminx / Skewb / Ivy / Gear) and pool-key convention in one place;
 * SoloView just takes the pool.
 */

import {
  generate222ByMetric,
  cube222MetricOfScramble,
} from '@cuberoot/puzzle-solvers/cube222';
import {
  generateTimer222ByStepsScramble,
  stepPuzzleOf,
  timer222StepMetricOfScramble,
  timerByStepsFilter,
  timerByStepsIdentity,
  type Timer222ByStepsEngine,
  type TimerByStepsSettings,
  type Scramble222Mode,
} from '@cuberoot/shared/timer';

const CUBE_222_STEPS_ENGINE: Timer222ByStepsEngine = {
  generate: (metric, lo, hi, random) => generate222ByMetric(metric, lo, hi, random),
  measure: cube222MetricOfScramble,
};

/** The legacy synchronous 2x2 adapter. Other puzzles always use the Worker host. */
export function genByStepsScramble(
  event: string,
  s: TimerByStepsSettings,
  scramble222Mode: Scramble222Mode = 'optimal',
): { key: string; gen: () => string } | null {
  const puzzle = stepPuzzleOf(event);
  if (!puzzle || !s.genByStepsOn) return null;
  const filter = timerByStepsFilter(event, 'random', s);
  if (!filter) return null;
  const key = timerByStepsIdentity(event, 'random', s, scramble222Mode);
  if (puzzle !== '222') return null;
  return {
    key,
    gen: () => generateTimer222ByStepsScramble(s, CUBE_222_STEPS_ENGINE, Math.random, scramble222Mode),
  };
}

/** Stable signature of the by-steps settings for regenerate-on-change (empty when inactive). */
export function genByStepsSig(
  event: string,
  s: TimerByStepsSettings,
  scramble222Mode: Scramble222Mode = 'optimal',
): string {
  return timerByStepsIdentity(event, 'random', s, scramble222Mode);
}

/** The chosen step-metric value of a real scramble string (for the WCA filter), or null if it can't be
 *  measured (wrong event / unparseable). Used to keep only in-range WCA scrambles. */
export function scrambleStepMetric(event: string, metric: string, scramble: string): number | null {
  const puzzle = stepPuzzleOf(event);
  if (!puzzle) return null;
  return puzzle === '222'
    ? timer222StepMetricOfScramble(scramble, metric, CUBE_222_STEPS_ENGINE)
    : null;
}

/** WCA-filter bounds for this event+settings, or null when the step filter isn't active. */
export function wcaStepFilter(
  event: string,
  s: TimerByStepsSettings,
): { metric: string; lo: number; hi: number } | null {
  return timerByStepsFilter(event, 'wca', s);
}
