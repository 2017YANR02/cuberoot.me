import {
  generateGearByDistance,
  gearDistanceOfScramble,
} from '@cuberoot/puzzle-solvers/gear';
import {
  generateIvyByDistance,
  ivyDistanceOfScramble,
} from '@cuberoot/puzzle-solvers/ivy';
import {
  generatePyramByMetric,
  pyramMetricOf,
  type PyramMetric,
} from '@cuberoot/puzzle-solvers/pyra';
import {
  generateSkewbByDistance,
  skewbDistanceOfScramble,
} from '@cuberoot/puzzle-solvers/skewb';

export type TimerNon222StepPuzzle = 'pyra' | 'skewb' | 'ivy' | 'gear';

export interface TimerNon222ByStepsFilter {
  event: TimerNon222StepPuzzle;
  metric: string;
  lo: number;
  hi: number;
}

export function isTimerNon222StepPuzzle(value: string): value is TimerNon222StepPuzzle {
  return value === 'pyra' || value === 'skewb' || value === 'ivy' || value === 'gear';
}

function supportedMetric(event: TimerNon222StepPuzzle, metric: string): boolean {
  return event === 'pyra'
    ? metric === 'v' || metric === 'cube'
    : event === 'gear'
      ? metric === 'ftm'
      : metric === 'htm';
}

/** Exact metric shared by generated scrambles and retained real-WCA rows. */
export function timerNon222StepMetricOfScramble(
  event: TimerNon222StepPuzzle,
  metric: string,
  scramble: string,
): number | null {
  if (!supportedMetric(event, metric)) return null;
  try {
    if (event === 'pyra') return pyramMetricOf(scramble, metric as PyramMetric);
    if (event === 'skewb') return skewbDistanceOfScramble(scramble);
    if (event === 'ivy') return ivyDistanceOfScramble(scramble);
    return gearDistanceOfScramble(scramble);
  } catch {
    return null;
  }
}

export function timerNon222StepFilterMatchesScramble(
  scramble: string,
  filter: TimerNon222ByStepsFilter,
): boolean {
  const value = timerNon222StepMetricOfScramble(filter.event, filter.metric, scramble);
  return value !== null && value >= filter.lo && value <= filter.hi;
}

/**
 * Generate one exact random-state scramble and independently remeasure it.
 * Worker hosts use this single entry point; adapters never own puzzle logic.
 */
export function generateTimerNon222ByStepsScramble(
  filter: TimerNon222ByStepsFilter,
  random: () => number = Math.random,
): string {
  if (!supportedMetric(filter.event, filter.metric)) {
    throw new Error(`unsupported Timer metric ${filter.event}/${filter.metric}`);
  }

  let scramble: string;
  if (filter.event === 'pyra') {
    scramble = generatePyramByMetric(
      filter.metric as PyramMetric,
      filter.lo,
      filter.hi,
      random,
    );
  } else if (filter.event === 'skewb') {
    scramble = generateSkewbByDistance(filter.lo, filter.hi, random);
  } else if (filter.event === 'ivy') {
    scramble = generateIvyByDistance(filter.lo, filter.hi, random);
  } else {
    scramble = generateGearByDistance(filter.lo, filter.hi, random);
  }

  if (!scramble || !timerNon222StepFilterMatchesScramble(scramble, filter)) {
    throw new Error(`Timer provider returned a non-matching ${filter.event}/${filter.metric} scramble`);
  }
  return scramble;
}

/** Preserve input order while evaluating a real-scramble batch once in a Worker. */
export function filterTimerNon222Scrambles(
  scrambles: readonly string[],
  filter: TimerNon222ByStepsFilter,
): boolean[] {
  return scrambles.map((scramble) => timerNon222StepFilterMatchesScramble(scramble, filter));
}
