/**
 * Runtime-neutral "by steps" contract for the timer.
 *
 * The metric registry, range normalization, cache identity and generation
 * orchestration live here so Web, Android and iOS cannot drift. Exact puzzle
 * engines are injected from `@cuberoot/puzzle-solvers`; shared deliberately
 * stays below solver packages in the dependency graph.
 */

import { pocketScrambleForState } from './pocket-scramble';
import {
  DEFAULT_SCRAMBLE_222_MODE,
  type Scramble222Mode,
} from './scramble-222';

export type TimerStepPuzzle = '222' | 'pyra' | 'skewb' | 'ivy' | 'gear';
export type TimerByStepsSource = 'random' | 'wca';
export type Timer222StepMetric = 'face' | 'layer' | 'htm' | 'qtm';

export interface TimerStepMetricSpec {
  key: string;
  zh: string;
  en: string;
  /** Full metric range offered for generated random states. */
  range: readonly [number, number];
  /** Range observed in the real-WCA corpus, when narrower than `range`. */
  wcaRange?: readonly [number, number];
  /** Initial inclusive range shown when the mode is first enabled. */
  band: readonly [number, number];
}

export interface TimerByStepsSettings {
  genByStepsOn: boolean;
  genStepsMetric: string;
  /** Canonical inclusive integer range, for example `[8, 9, 10]`. */
  genSteps: number[];
}

export interface TimerByStepsFilter {
  metric: string;
  lo: number;
  hi: number;
}

export interface TimerByStepsSelection extends TimerByStepsFilter {
  metricSpec: TimerStepMetricSpec;
  min: number;
  max: number;
  steps: number[];
}

export interface Timer222ByStepsEngine {
  generate(
    metric: Timer222StepMetric,
    lo: number,
    hi: number,
    random: () => number,
  ): string;
  measure(scramble: string, metric: Timer222StepMetric): number | null;
}

export const DEFAULT_TIMER_BY_STEPS_SETTINGS: TimerByStepsSettings = {
  genByStepsOn: false,
  genStepsMetric: 'face',
  genSteps: [],
};

/**
 * Exact source of the dropdown labels, complete ranges and default bands.
 * WCA ranges come from `stats/scramble/puzzle_distribution.json`.
 */
export const STEP_METRICS: Readonly<Record<TimerStepPuzzle, readonly TimerStepMetricSpec[]>> = {
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
  skewb: [
    { key: 'htm', zh: '魔方', en: 'Cube', range: [0, 11], wcaRange: [7, 11], band: [8, 10] },
  ],
  ivy: [
    { key: 'htm', zh: '魔方', en: 'Cube', range: [0, 8], band: [5, 7] },
  ],
  gear: [
    { key: 'ftm', zh: '魔方', en: 'Cube', range: [0, 6], band: [4, 5] },
  ],
};

export const TIMER_BY_STEPS_UI_LABELS = {
  bySteps: { zh: '按步数', en: 'By steps' },
  byStepsAriaLabel: { zh: '按步数生成', en: 'Generate by steps' },
  metricAriaLabel: { zh: '度量', en: 'Metric' },
  stepRangeAriaLabel: { zh: '步数范围', en: 'Step range' },
} as const;

const CUBE_222_METRICS = new Set<Timer222StepMetric>(['face', 'layer', 'htm', 'qtm']);

function inclusiveRange(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, index) => lo + index);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** The timer EventId to the by-steps puzzle, or null when no exact metric exists. */
export function stepPuzzleOf(event: string): TimerStepPuzzle | null {
  return event === '222' || event === 'pyra' || event === 'skewb' || event === 'ivy' || event === 'gear'
    ? event
    : null;
}

export function stepMetricsFor(event: string): readonly TimerStepMetricSpec[] | null {
  const puzzle = stepPuzzleOf(event);
  return puzzle ? STEP_METRICS[puzzle] : null;
}

export function stepMetricSpec(event: string, key: string): TimerStepMetricSpec | null {
  return stepMetricsFor(event)?.find((metric) => metric.key === key) ?? null;
}

/**
 * Resolve the visible metric and range without mutating host state. Invalid
 * persisted metrics fall back to the first metric for this puzzle.
 */
export function timerByStepsSelection(
  event: string,
  source: TimerByStepsSource,
  settings: TimerByStepsSettings,
): TimerByStepsSelection | null {
  const metrics = stepMetricsFor(event);
  const persistedMetric = metrics?.find((metric) => metric.key === settings.genStepsMetric);
  const metricSpec = persistedMetric ?? metrics?.[0];
  if (!metricSpec) return null;
  const [min, max] = source === 'wca'
    ? (metricSpec.wcaRange ?? metricSpec.range)
    : metricSpec.range;
  // Numeric ranges are metric-specific. If the persisted key belongs to the
  // previous active event, ignore its numbers immediately; identity/filter/UI
  // all resolve to the new metric's documented band in the same render.
  const finiteSteps = persistedMetric
    ? settings.genSteps.filter(Number.isSafeInteger)
    : [];
  const rawLo = finiteSteps.length > 0 ? Math.min(...finiteSteps) : metricSpec.band[0];
  const rawHi = finiteSteps.length > 0 ? Math.max(...finiteSteps) : metricSpec.band[1];
  const lo = clamp(rawLo, min, max);
  const hi = clamp(rawHi, min, max);
  return {
    metric: metricSpec.key,
    metricSpec,
    min,
    max,
    lo: Math.min(lo, hi),
    hi: Math.max(lo, hi),
    steps: inclusiveRange(Math.min(lo, hi), Math.max(lo, hi)),
  };
}

/**
 * Canonical controlled value for one event/source. Hosts persist the returned
 * fields directly; this is also the migration rule for stale metric/range data.
 */
export function normalizeTimerByStepsSettings(
  event: string,
  source: TimerByStepsSource,
  settings: TimerByStepsSettings,
): TimerByStepsSettings {
  const persistedSelection = timerByStepsSelection(event, source, settings);
  if (!persistedSelection) return {
    genByStepsOn: false,
    genStepsMetric: settings.genStepsMetric,
    genSteps: [...settings.genSteps],
  };
  const metricChanged = persistedSelection.metric !== settings.genStepsMetric;
  // A range saved for another event/metric has no meaning in this metric.
  // Re-resolve with an empty range so the active metric owns its documented
  // default band instead of accidentally reusing numerically similar steps.
  const selection = metricChanged
    ? timerByStepsSelection(event, source, {
        ...settings,
        genStepsMetric: persistedSelection.metric,
        genSteps: [],
      })!
    : persistedSelection;
  const normalizedSteps = settings.genByStepsOn
    ? selection.steps
    : (metricChanged ? [] : [...settings.genSteps]);
  return {
    genByStepsOn: settings.genByStepsOn,
    genStepsMetric: selection.metric,
    genSteps: normalizedSteps,
  };
}

/** Minimal patch needed to make one controlled value canonical. */
export function timerByStepsNormalizationPatch(
  event: string,
  source: TimerByStepsSource,
  settings: TimerByStepsSettings,
): Partial<TimerByStepsSettings> | null {
  const normalized = normalizeTimerByStepsSettings(event, source, settings);
  const patch: Partial<TimerByStepsSettings> = {};
  if (normalized.genByStepsOn !== settings.genByStepsOn) patch.genByStepsOn = normalized.genByStepsOn;
  if (normalized.genStepsMetric !== settings.genStepsMetric) patch.genStepsMetric = normalized.genStepsMetric;
  if (!sameNumbers(normalized.genSteps, settings.genSteps)) patch.genSteps = normalized.genSteps;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Active normalized filter, or null when the switch/event does not enable it. */
export function timerByStepsFilter(
  event: string,
  source: TimerByStepsSource,
  settings: TimerByStepsSettings,
): TimerByStepsFilter | null {
  if (!settings.genByStepsOn) return null;
  const selection = timerByStepsSelection(event, source, settings);
  return selection ? { metric: selection.metric, lo: selection.lo, hi: selection.hi } : null;
}

/** Stable identity for queues, caches, in-flight requests and stale-result guards. */
export function timerByStepsIdentity(
  event: string,
  source: TimerByStepsSource,
  settings: TimerByStepsSettings,
  scramble222Mode: Scramble222Mode = DEFAULT_SCRAMBLE_222_MODE,
): string {
  const filter = timerByStepsFilter(event, source, settings);
  if (!filter) return '';
  const style = event === '222' && source === 'random' ? `|${scramble222Mode}` : '';
  return `byst|${event}|${filter.metric}|${filter.lo}.${filter.hi}${style}`;
}

export function isTimer222StepMetric(value: string): value is Timer222StepMetric {
  return CUBE_222_METRICS.has(value as Timer222StepMetric);
}

export function timer222StepMetricOfScramble(
  scramble: string,
  metric: string,
  engine: Pick<Timer222ByStepsEngine, 'measure'>,
): number | null {
  return isTimer222StepMetric(metric) ? engine.measure(scramble, metric) : null;
}

export function timer222StepFilterMatchesScramble(
  scramble: string,
  filter: TimerByStepsFilter | null | undefined,
  engine: Pick<Timer222ByStepsEngine, 'measure'>,
): boolean {
  if (!filter || !isTimer222StepMetric(filter.metric)) return !filter;
  const value = engine.measure(scramble, filter.metric);
  return value !== null && value >= filter.lo && value <= filter.hi;
}

function randomReduced222Scramble(length: number, random: () => number): string {
  const faces = ['U', 'R', 'F'] as const;
  const suffixes = ['', '2', "'"] as const;
  const moves: string[] = [];
  let previousFace = -1;
  for (let index = 0; index < length; index++) {
    const draw = Math.floor(random() * (previousFace < 0 ? 3 : 2));
    const face = previousFace < 0 || draw < previousFace ? draw : draw + 1;
    moves.push(`${faces[face]}${suffixes[Math.floor(random() * suffixes.length)]}`);
    previousFace = face;
  }
  return moves.join(' ');
}

/**
 * Exact shared 2x2 generation orchestration for a random-source by-steps
 * request. The injected engine is the same puzzle-solvers implementation on
 * every host; only Worker scheduling differs.
 *
 * The injected solver owns exact generation (including rare full-cube metric
 * shells). This wrapper treats its output as untrusted and always remeasures
 * it, so no host can accept a nearest-but-wrong fallback. Metric zero uses a
 * non-empty identity algorithm because timer hosts reserve `''` for an async
 * loading slot.
 */
export function generateTimer222ByStepsScramble(
  settings: TimerByStepsSettings,
  engine: Timer222ByStepsEngine,
  random: () => number = Math.random,
  mode: Scramble222Mode = DEFAULT_SCRAMBLE_222_MODE,
): string {
  const filter = timerByStepsFilter('222', 'random', settings);
  if (!filter || !isTimer222StepMetric(filter.metric)) {
    throw new Error('2x2 by-steps generation requires an active valid metric');
  }
  if (filter.lo === 0 && filter.hi === 0
    && (filter.metric === 'htm' || filter.metric === 'qtm')) {
    const identity = mode === 'wca' ? pocketScrambleForState('', mode) : "U U'";
    if (identity && timer222StepFilterMatchesScramble(identity, filter, engine)) return identity;
    throw new Error(`unable to express solved 2x2 state in ${mode} style`);
  }

  const finalize = (candidate: string): string | null => {
    const styled = pocketScrambleForState(candidate, mode);
    return styled && timer222StepFilterMatchesScramble(styled, filter, engine) ? styled : null;
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const candidate = engine.generate(filter.metric, filter.lo, filter.hi, random);
      const styled = finalize(candidate);
      if (styled) return styled;
    } catch {
      // A bounded provider may miss a rare shell. Keep trying and then use the
      // independent measured-word path below; never return an unverified value.
    }
  }

  for (let attempt = 0; attempt < 50_000; attempt++) {
    const target = filter.lo + Math.floor(random() * (filter.hi - filter.lo + 1));
    const length = filter.metric === 'qtm'
      ? Math.max(1, Math.ceil(target / 2))
      : Math.max(1, Math.min(target, 11));
    const candidate = randomReduced222Scramble(length, random);
    const styled = finalize(candidate);
    if (styled) return styled;
  }
  throw new Error(`unable to generate 2x2 ${filter.metric} in ${filter.lo}..${filter.hi}`);
}
