/*
 * step-metrics — registry of the "按步数 / by move count" metrics per puzzle, shared by the config UI
 * (GenStepsConfig), the local generator dispatch (SoloView), and the WCA real-scramble filter (wca_pool).
 * Single source of truth so the dropdown options, the slider bounds, and the actual filtering never drift.
 *
 * Ranges come from the exact enumerations: 2×2 stats/scramble/2x2_essential.json, pyraminx pyram_essential.json.
 */

export type StepPuzzle = '222' | 'pyra';

export interface StepMetricSpec {
  key: string;
  zh: string;
  en: string;
  /** slider bounds [min, max] — the metric's full value range (random-generation source) */
  range: [number, number];
  /** observed range in the WCA real-scramble corpus; the low end is bounded by TNoodle's minimum
   *  scramble-length policy (e.g. no real 2×2 solves in ≤3 HTM), so the slider only offers steps that
   *  actually occur. Omit when it equals `range`. Source of truth = stats/scramble/puzzle_distribution.json
   *  metrics.<key>.dist.{min,max}; if the pipeline ever shows a new extreme, update here. */
  wcaRange?: [number, number];
  /** default band the slider opens on for this metric (mid-difficulty) */
  band: [number, number];
}

export const STEP_METRICS: Record<StepPuzzle, StepMetricSpec[]> = {
  '222': [
    { key: 'face', zh: '底面', en: 'First face', range: [0, 5], band: [3, 4] },
    { key: 'layer', zh: '底层', en: 'First layer', range: [0, 7], band: [4, 6] },
    { key: 'htm', zh: '魔方', en: 'Cube', range: [0, 11], wcaRange: [4, 11], band: [8, 10] },
    { key: 'qtm', zh: 'QTM', en: 'QTM', range: [0, 14], wcaRange: [4, 14], band: [10, 12] },
  ],
  pyra: [
    { key: 'v', zh: 'V', en: 'V', range: [0, 7], band: [3, 5] },
    { key: 'cube', zh: '魔方', en: 'Cube', range: [0, 11], wcaRange: [2, 11], band: [6, 9] },
  ],
};

/** The timer EventId → step-metric puzzle, or null if this event has no by-steps mode. */
export function stepPuzzleOf(event: string): StepPuzzle | null {
  return event === '222' ? '222' : event === 'pyra' ? 'pyra' : null;
}
export function stepMetricsFor(event: string): StepMetricSpec[] | null {
  const p = stepPuzzleOf(event);
  return p ? STEP_METRICS[p] : null;
}
export function stepMetricSpec(event: string, key: string): StepMetricSpec | null {
  return stepMetricsFor(event)?.find((m) => m.key === key) ?? null;
}
