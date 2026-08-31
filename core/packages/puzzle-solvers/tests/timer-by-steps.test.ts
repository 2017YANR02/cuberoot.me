import { describe, expect, it } from 'vitest';

import { generatePyramByMetric, pyramMetricOf } from '../src/pyra';
import {
  filterTimerNon222Scrambles,
  generateTimerNon222ByStepsScramble,
  timerNon222StepFilterMatchesScramble,
  timerNon222StepMetricOfScramble,
  type TimerNon222ByStepsFilter,
} from '../src/timer-by-steps';

const EXACT_SHELLS: readonly TimerNon222ByStepsFilter[] = [
  ...Array.from({ length: 8 }, (_, distance) => ({
    event: 'pyra' as const,
    metric: 'v',
    lo: distance,
    hi: distance,
  })),
  ...Array.from({ length: 12 }, (_, distance) => ({
    event: 'pyra' as const,
    metric: 'cube',
    lo: distance,
    hi: distance,
  })),
  ...Array.from({ length: 12 }, (_, distance) => ({
    event: 'skewb' as const,
    metric: 'htm',
    lo: distance,
    hi: distance,
  })),
  ...Array.from({ length: 9 }, (_, distance) => ({
    event: 'ivy' as const,
    metric: 'htm',
    lo: distance,
    hi: distance,
  })),
  ...Array.from({ length: 7 }, (_, distance) => ({
    event: 'gear' as const,
    metric: 'ftm',
    lo: distance,
    hi: distance,
  })),
];

describe('runtime-neutral non-2x2 Timer by-steps engine', () => {
  it('generates and independently remeasures every exact metric shell', () => {
    for (const filter of EXACT_SHELLS) {
      const scramble = generateTimerNon222ByStepsScramble(filter, () => 0);
      expect(scramble, `${filter.event}/${filter.metric}/${filter.lo}`).not.toBe('');
      expect(
        timerNon222StepMetricOfScramble(filter.event, filter.metric, scramble),
        `${filter.event}/${filter.metric}/${filter.lo}: ${scramble}`,
      ).toBe(filter.lo);
    }
  }, 30_000);

  it('keeps rare Pyraminx shells exact when rejection sampling is exhausted', () => {
    for (const metric of ['v', 'cube'] as const) {
      const max = metric === 'v' ? 7 : 11;
      for (let distance = 0; distance <= max; distance++) {
        const scramble = generatePyramByMetric(metric, distance, distance, () => 0, 0);
        expect(pyramMetricOf(scramble, metric), `${metric}/${distance}: ${scramble}`).toBe(distance);
      }
    }
  });

  it('filters real rows in input order with the same exact predicate', () => {
    const filter: TimerNon222ByStepsFilter = {
      event: 'gear',
      metric: 'ftm',
      lo: 4,
      hi: 5,
    };
    const inside = generateTimerNon222ByStepsScramble(filter, () => 0.5);
    const outside = generateTimerNon222ByStepsScramble({ ...filter, lo: 6, hi: 6 }, () => 0);
    expect(filterTimerNon222Scrambles([outside, inside, 'bad token'], filter)).toEqual([
      false,
      true,
      false,
    ]);
    expect(timerNon222StepFilterMatchesScramble(inside, filter)).toBe(true);
  });

  it.each([
    { event: 'pyra' as const, metric: 'cube', accepted: 8, rejected: 5 },
    { event: 'skewb' as const, metric: 'htm', accepted: 9, rejected: 7 },
  ])('uses the generated-state predicate for real WCA $event rows', ({
    event,
    metric,
    accepted,
    rejected,
  }) => {
    const inside = generateTimerNon222ByStepsScramble({
      event, metric, lo: accepted, hi: accepted,
    }, () => 0);
    const outside = generateTimerNon222ByStepsScramble({
      event, metric, lo: rejected, hi: rejected,
    }, () => 0);
    expect(filterTimerNon222Scrambles([outside, inside], {
      event,
      metric,
      lo: accepted,
      hi: accepted,
    })).toEqual([false, true]);
  });

  it('fails closed for forged metric names', () => {
    expect(timerNon222StepMetricOfScramble('skewb', 'ftm', "R R'")).toBeNull();
    expect(() => generateTimerNon222ByStepsScramble({
      event: 'ivy',
      metric: 'cube',
      lo: 0,
      hi: 1,
    }, () => 0)).toThrow('unsupported Timer metric ivy/cube');
  });
});
