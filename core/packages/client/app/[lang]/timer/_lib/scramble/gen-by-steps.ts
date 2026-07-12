/*
 * gen-by-steps — local "按步数生成" dispatch for the timer's random source. Maps (event, settings) to a
 * pooled generator keyed by metric+range, or null when by-steps isn't active for this event. Keeps the
 * generator choice (2×2 vs pyraminx) and pool-key convention in one place; SoloView just takes the pool.
 */

import { generate222ByMetric, cube222MetricOfScramble, type Cube222Metric } from '@/lib/cube222-metric';
import { generatePyramByMetric, pyramMetricOf, type PyramMetric } from './pyram-metric';
import { stepPuzzleOf, stepMetricSpec } from './step-metrics';

interface ByStepsSettings {
  genByStepsOn: boolean;
  genStepsMetric: string;
  genSteps: number[];
}

/** Clamp the stored [lo,hi] into the metric's real range. */
function bounds(event: string, metric: string, steps: number[]): { lo: number; hi: number } | null {
  const spec = stepMetricSpec(event, metric);
  if (!spec || steps.length === 0) return null;
  const [rMin, rMax] = spec.range;
  const lo = Math.max(steps[0], rMin);
  const hi = Math.min(steps[steps.length - 1], rMax);
  return lo <= hi ? { lo, hi } : null;
}

/** A pooled by-steps generator for `event`, or null when by-steps doesn't apply (off / other event / empty). */
export function genByStepsScramble(
  event: string,
  s: ByStepsSettings,
): { key: string; gen: () => string } | null {
  const puzzle = stepPuzzleOf(event);
  if (!puzzle || !s.genByStepsOn) return null;
  const metric = s.genStepsMetric;
  const b = bounds(event, metric, s.genSteps);
  if (!b) return null;
  const key = `byst|${event}|${metric}|${b.lo}.${b.hi}`;
  if (puzzle === '222') {
    return { key, gen: () => generate222ByMetric(metric as Cube222Metric, b.lo, b.hi, Math.random) };
  }
  return { key, gen: () => generatePyramByMetric(metric as PyramMetric, b.lo, b.hi, Math.random) };
}

/** Stable signature of the by-steps settings for regenerate-on-change (empty when inactive). */
export function genByStepsSig(event: string, s: ByStepsSettings): string {
  const g = genByStepsScramble(event, s);
  return g ? g.key : '';
}

/** The chosen step-metric value of a real scramble string (for the WCA filter), or null if it can't be
 *  measured (wrong event / unparseable). Used to keep only in-range WCA scrambles. */
export function scrambleStepMetric(event: string, metric: string, scramble: string): number | null {
  const puzzle = stepPuzzleOf(event);
  if (!puzzle) return null;
  if (puzzle === '222') return cube222MetricOfScramble(scramble, metric as Cube222Metric);
  return pyramMetricOf(scramble, metric as PyramMetric);
}

/** WCA-filter bounds for this event+settings, or null when the step filter isn't active. */
export function wcaStepFilter(
  event: string,
  s: ByStepsSettings,
): { metric: string; lo: number; hi: number } | null {
  if (!stepPuzzleOf(event) || !s.genByStepsOn) return null;
  const b = bounds(event, s.genStepsMetric, s.genSteps);
  return b ? { metric: s.genStepsMetric, lo: b.lo, hi: b.hi } : null;
}
