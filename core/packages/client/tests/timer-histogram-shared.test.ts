import { describe, expect, it } from 'vitest';
import { buildTimerHistogramBuckets } from '@cuberoot/shared/timer/stats';

describe('shared timer histogram', () => {
  it('keeps equal-width boundaries and includes the maximum in the last bucket', () => {
    expect(buildTimerHistogramBuckets([1000, 2000, 2000, 3000, 5000], 4)).toEqual([
      { lo: 1000, hi: 2000, count: 1 },
      { lo: 2000, hi: 3000, count: 2 },
      { lo: 3000, hi: 4000, count: 1 },
      { lo: 4000, hi: 5000, count: 1 },
    ]);
  });
  it('preserves the Web padding for equal values and empty inputs', () => {
    expect(buildTimerHistogramBuckets([1000, 1000], 2)).toEqual([
      { lo: 900, hi: 1000, count: 0 }, { lo: 1000, hi: 1100, count: 2 },
    ]);
    expect(buildTimerHistogramBuckets([], 12)).toEqual([]);
    expect(buildTimerHistogramBuckets([1000], 0)).toEqual([]);
  });
});
