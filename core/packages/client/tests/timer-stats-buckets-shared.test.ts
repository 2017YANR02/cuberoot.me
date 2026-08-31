import { describe, expect, it } from 'vitest';

import {
  bucketBoundaries as legacyBucketBoundaries,
  bucketStats as legacyBucketStats,
  dayKeyOf as legacyDayKeyOf,
  solveDayKeys as legacySolveDayKeys,
} from '@/app/[lang]/timer/_lib/stats_buckets';
import {
  bucketBoundaries,
  bucketStats,
  dayKeyOf,
  filterSolvesByStatsDateRange,
  longestSolveDayStreak,
  solveDayKeys,
  type Solve,
} from '@cuberoot/shared/timer';

function solve(id: string, timeMs: number, ts: number): Solve {
  return {
    event: '333',
    id,
    penalty: 'ok',
    scramble: '',
    timeMs,
    ts,
  };
}

describe('shared timer calendar buckets', () => {
  it('keeps the retired Web path as identity re-exports, not a second engine', () => {
    expect(legacyBucketBoundaries).toBe(bucketBoundaries);
    expect(legacyBucketStats).toBe(bucketStats);
    expect(legacyDayKeyOf).toBe(dayKeyOf);
    expect(legacySolveDayKeys).toBe(solveDayKeys);
  });

  it('uses half-open windows and the canonical timer statistics engine', () => {
    const from = new Date(2026, 7, 30, 0, 0, 0);
    const toExclusive = new Date(2026, 7, 31, 0, 0, 0);
    const solves = [
      solve('before', 900, from.getTime() - 1),
      solve('one', 1_000, from.getTime()),
      solve('two', 2_000, from.getTime() + 1),
      solve('three', 3_000, from.getTime() + 2),
      solve('four', 4_000, toExclusive.getTime() - 2),
      solve('five', 5_000, toExclusive.getTime() - 1),
      solve('at-upper-bound', 600, toExclusive.getTime()),
    ] as const;

    expect(bucketStats(solves, from, toExclusive)).toEqual({
      count: 5,
      best: 1_000,
      ao5: 3_000,
      ao12: null,
      mean: 3_000,
    });
  });

  it('uses local ISO weeks and calendar constructors across month/year edges', () => {
    // Sunday, 2027-01-03: its ISO week started in the previous calendar year.
    const boundaries = bucketBoundaries(new Date(2027, 0, 3, 18, 25, 0));
    expect(dayKeyOf(boundaries.weekStart.getTime())).toBe('2026-12-28');
    expect(dayKeyOf(boundaries.nextWeekStart.getTime())).toBe('2027-01-04');
    expect(dayKeyOf(boundaries.prevMonthStart.getTime())).toBe('2026-12-01');
    expect(dayKeyOf(boundaries.prevYearStart.getTime())).toBe('2026-01-01');
    expect(dayKeyOf(boundaries.todayStart.getTime())).toBe('2027-01-03');
    expect(boundaries.todayStart.getHours()).toBe(0);
    expect(boundaries.tomorrowStart.getHours()).toBe(0);
  });

  it('deduplicates and sorts only local days that contain solves', () => {
    const solves = [
      solve('late', 1_000, new Date(2026, 7, 4, 23, 30).getTime()),
      solve('first', 2_000, new Date(2026, 7, 1, 9).getTime()),
      solve('early', 3_000, new Date(2026, 7, 4, 0, 5).getTime()),
    ];
    expect(solveDayKeys(solves)).toEqual(['2026-08-01', '2026-08-04']);
  });

  it('preserves the Web modal rolling-day cutoff including its boundary', () => {
    const now = new Date(2026, 7, 30, 12).getTime();
    const cutoff = now - 7 * 86_400_000;
    const solves = [
      solve('old', 1_000, cutoff - 1),
      solve('boundary', 2_000, cutoff),
      solve('new', 3_000, now),
    ];
    expect(filterSolvesByStatsDateRange(solves, '7d', now).map(({ id }) => id))
      .toEqual(['boundary', 'new']);
    expect(filterSolvesByStatsDateRange(solves, 'all', now)).toEqual(solves);
  });

  it('counts the longest consecutive local-day practice streak', () => {
    const solves = [
      solve('a', 1_000, new Date(2026, 2, 7, 20).getTime()),
      solve('b', 1_000, new Date(2026, 2, 8, 3).getTime()),
      solve('b-duplicate', 1_000, new Date(2026, 2, 8, 22).getTime()),
      solve('c', 1_000, new Date(2026, 2, 9, 7).getTime()),
      solve('gap', 1_000, new Date(2026, 2, 12, 7).getTime()),
    ];
    expect(longestSolveDayStreak(solves)).toBe(3);
    expect(longestSolveDayStreak([])).toBe(0);
  });
});
