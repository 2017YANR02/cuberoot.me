/**
 * Date-bucket statistics — group solves into "today / this week / this month /
 * this year" windows (and the previous period of each, for delta comparison).
 *
 * Boundaries are computed in **local time**. ISO 8601 week (Monday = first day).
 * All windows are half-open [from, toExclusive).
 */

import type { Solve } from './types';
import { averageOfN, bestSingle, meanOfAll } from './stats';

export interface BucketStats {
  count: number;
  best: number | null;
  ao5: number | null;
  ao12: number | null;
  mean: number | null;
}

/** Returns solves with ts in [from, toExclusive). */
function filterWindow(solves: Solve[], from: Date, toExclusive: Date): Solve[] {
  const lo = from.getTime();
  const hi = toExclusive.getTime();
  return solves.filter(s => s.ts >= lo && s.ts < hi);
}

/** Compute count / best / ao5 / ao12 / mean for the half-open window. */
export function bucketStats(solves: Solve[], from: Date, toExclusive: Date): BucketStats {
  const inWin = filterWindow(solves, from, toExclusive);
  return {
    count: inWin.length,
    best: bestSingle(inWin),
    ao5: averageOfN(inWin, 5),
    ao12: averageOfN(inWin, 12),
    mean: meanOfAll(inWin),
  };
}

/** ISO 8601 weekday: Mon=0 .. Sun=6 (JS getDay returns Sun=0..Sat=6). */
function isoWeekdayIndex(d: Date): number {
  const js = d.getDay(); // 0=Sun..6=Sat
  return (js + 6) % 7;   // 0=Mon..6=Sun
}

export interface BucketBoundaries {
  todayStart: Date; tomorrowStart: Date;
  weekStart: Date;  nextWeekStart: Date;
  monthStart: Date; nextMonthStart: Date;
  yearStart: Date;  nextYearStart: Date;
  // Previous-period for "vs last" comparison
  yesterdayStart: Date;
  prevWeekStart: Date;
  prevMonthStart: Date;
  prevYearStart: Date;
}

/**
 * Compute all bucket boundaries (current and previous period) anchored at `now`.
 * All Date instances are constructed via `new Date(y, m, d, 0, 0, 0)` so that
 * DST / month / year transitions are handled correctly by the JS engine.
 */
export function bucketBoundaries(now: Date): BucketBoundaries {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const todayStart    = new Date(y, m, d, 0, 0, 0);
  const tomorrowStart = new Date(y, m, d + 1, 0, 0, 0);
  const yesterdayStart = new Date(y, m, d - 1, 0, 0, 0);

  // ISO week — Monday is first day.
  const wd = isoWeekdayIndex(todayStart);
  const weekStart      = new Date(y, m, d - wd, 0, 0, 0);
  const nextWeekStart  = new Date(y, m, d - wd + 7, 0, 0, 0);
  const prevWeekStart  = new Date(y, m, d - wd - 7, 0, 0, 0);

  const monthStart     = new Date(y, m, 1, 0, 0, 0);
  const nextMonthStart = new Date(y, m + 1, 1, 0, 0, 0);
  const prevMonthStart = new Date(y, m - 1, 1, 0, 0, 0);

  const yearStart      = new Date(y, 0, 1, 0, 0, 0);
  const nextYearStart  = new Date(y + 1, 0, 1, 0, 0, 0);
  const prevYearStart  = new Date(y - 1, 0, 1, 0, 0, 0);

  return {
    todayStart, tomorrowStart,
    weekStart, nextWeekStart,
    monthStart, nextMonthStart,
    yearStart, nextYearStart,
    yesterdayStart,
    prevWeekStart,
    prevMonthStart,
    prevYearStart,
  };
}
