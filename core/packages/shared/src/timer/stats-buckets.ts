/**
 * Runtime-neutral date bucket statistics shared by Web and Mobile timers.
 *
 * Boundaries use the device's local calendar, not UTC. Every window is
 * half-open `[from, toExclusive)`, and ISO weeks start on Monday.
 */

import { averageOfN, bestSingle, meanOfAll } from './stats';
import type { Solve } from './types';

export interface TimerBucketStats {
  count: number;
  best: number | null;
  ao5: number | null;
  ao12: number | null;
  mean: number | null;
}

/** Compatibility name used by the existing Web statistics surface. */
export type BucketStats = TimerBucketStats;

export const TIMER_STATS_DATE_RANGES = ['all', '7d', '30d', '90d', '365d'] as const;
export type TimerStatsDateRange = (typeof TIMER_STATS_DATE_RANGES)[number];

const TIMER_STATS_RANGE_DAYS: Record<Exclude<TimerStatsDateRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

/** Preserve the Web timer's rolling-day range semantics exactly. */
export function filterSolvesByStatsDateRange(
  solves: readonly Solve[],
  range: TimerStatsDateRange,
  nowMs = Date.now(),
): Solve[] {
  if (range === 'all') return [...solves];
  const cutoff = nowMs - TIMER_STATS_RANGE_DAYS[range] * 86_400_000;
  return solves.filter((solve) => solve.ts >= cutoff);
}

/** Return solves whose timestamps fall in `[from, toExclusive)`. */
function filterTimerBucketWindow(
  solves: readonly Solve[],
  from: Date,
  toExclusive: Date,
): Solve[] {
  const lowerBound = from.getTime();
  const upperBound = toExclusive.getTime();
  return solves.filter((solve) => solve.ts >= lowerBound && solve.ts < upperBound);
}

/** Compute the Web timer's exact summary for one local-calendar window. */
export function bucketStats(
  solves: readonly Solve[],
  from: Date,
  toExclusive: Date,
): TimerBucketStats {
  const windowSolves = filterTimerBucketWindow(solves, from, toExclusive);
  return {
    count: windowSolves.length,
    best: bestSingle(windowSolves),
    ao5: averageOfN(windowSolves, 5),
    ao12: averageOfN(windowSolves, 12),
    mean: meanOfAll(windowSolves),
  };
}

/** Local-calendar `YYYY-MM-DD`; practice days follow the user's timezone. */
export function dayKeyOf(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Sorted local day keys that contain at least one solve. */
export function solveDayKeys(solves: readonly Solve[]): string[] {
  const seen = new Set<string>();
  for (const solve of solves) seen.add(dayKeyOf(solve.ts));
  return Array.from(seen).sort();
}

/** Largest run of consecutive local-calendar days containing at least one solve. */
export function longestSolveDayStreak(solves: readonly Solve[]): number {
  const days = solveDayKeys(solves).map((key) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year!, month! - 1, day!).getTime();
  });
  if (days.length === 0) return 0;

  let best = 1;
  let current = 1;
  for (let index = 1; index < days.length; index += 1) {
    // Rounding keeps adjacent local dates consecutive across DST transitions.
    const dayDistance = Math.round((days[index]! - days[index - 1]!) / 86_400_000);
    if (dayDistance === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

/** ISO weekday index: Monday = 0, Sunday = 6. */
function isoWeekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export interface TimerBucketBoundaries {
  todayStart: Date;
  tomorrowStart: Date;
  weekStart: Date;
  nextWeekStart: Date;
  monthStart: Date;
  nextMonthStart: Date;
  yearStart: Date;
  nextYearStart: Date;
  yesterdayStart: Date;
  prevWeekStart: Date;
  prevMonthStart: Date;
  prevYearStart: Date;
}

/** Compatibility name used by the existing Web statistics surface. */
export type BucketBoundaries = TimerBucketBoundaries;

/**
 * Compute current and previous local-calendar periods around `now`.
 * Calendar constructors intentionally let JavaScript handle DST/month/year
 * transitions instead of subtracting fixed millisecond durations.
 */
export function bucketBoundaries(now: Date): TimerBucketBoundaries {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const todayStart = new Date(year, month, day, 0, 0, 0);
  const tomorrowStart = new Date(year, month, day + 1, 0, 0, 0);
  const yesterdayStart = new Date(year, month, day - 1, 0, 0, 0);

  const weekday = isoWeekdayIndex(todayStart);
  const weekStart = new Date(year, month, day - weekday, 0, 0, 0);
  const nextWeekStart = new Date(year, month, day - weekday + 7, 0, 0, 0);
  const prevWeekStart = new Date(year, month, day - weekday - 7, 0, 0, 0);

  const monthStart = new Date(year, month, 1, 0, 0, 0);
  const nextMonthStart = new Date(year, month + 1, 1, 0, 0, 0);
  const prevMonthStart = new Date(year, month - 1, 1, 0, 0, 0);

  const yearStart = new Date(year, 0, 1, 0, 0, 0);
  const nextYearStart = new Date(year + 1, 0, 1, 0, 0, 0);
  const prevYearStart = new Date(year - 1, 0, 1, 0, 0, 0);

  return {
    todayStart,
    tomorrowStart,
    weekStart,
    nextWeekStart,
    monthStart,
    nextMonthStart,
    yearStart,
    nextYearStart,
    yesterdayStart,
    prevWeekStart,
    prevMonthStart,
    prevYearStart,
  };
}
