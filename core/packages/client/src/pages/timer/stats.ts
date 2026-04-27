/**
 * Stats engine — pure functions over Solve[].
 *
 * Conventions: time values are post-penalty effective ms; DNF = Infinity.
 * "Last N" means the most recent N solves in chronological order (so the array
 * passed in must already be ordered oldest → newest).
 */

import type { Solve } from './types';
import { effectiveMs } from './types';

/** WCA trim count: ceil(n/20), but at least 1 for n in [3,20]. */
function trimCount(n: number): number {
  if (n < 3) return 0;
  return Math.max(1, Math.ceil(n / 20));
}

/**
 * Per WCA Regulations 9f9: average is invalid (DNF) if more than ONE solve in
 * the window is DNF for ao5/ao12. For larger windows we use a more lenient
 * "trim count" cap consistent with most timers (cstimer / DCTimer behavior).
 */
function maxDnfsAllowed(n: number): number {
  return n <= 12 ? 1 : trimCount(n);
}

/** Trimmed mean over an array of effective-ms numbers (Infinity = DNF). */
function trimmedMean(times: number[]): number {
  const n = times.length;
  if (n < 3) return mean(times);
  const trim = trimCount(n);
  const sorted = [...times].sort((a, b) => a - b);
  const dnfCount = sorted.filter(t => t === Infinity).length;
  if (dnfCount > maxDnfsAllowed(n)) return Infinity;
  const middle = sorted.slice(trim, n - trim);
  return mean(middle);
}

function mean(times: number[]): number {
  if (times.length === 0) return NaN;
  if (times.some(t => t === Infinity)) return Infinity;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

/**
 * Truncate to centiseconds (10ms) — WCA standard for averages and means
 * (Regulations 9f3 / 9f7). Single-time values are reported as-is (no trunc).
 */
function truncToCs(ms: number): number {
  if (!Number.isFinite(ms)) return ms;
  return Math.floor(ms / 10) * 10;
}

/**
 * Average of N over the last N solves. Returns null when fewer than N exist.
 *
 * For N = 3, 5, 12, 25, 50, 100, ... uses the WCA "average" definition: drop
 * top and bottom 5% (rounded up to at least 1), mean the rest. For N = 1 we
 * return the single time. We treat "mean of N" the same as average for our
 * purposes — single-DNF tolerance only.
 */
export function averageOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const last = solves.slice(-n).map(effectiveMs);
  if (n === 1) return last[0];
  return truncToCs(trimmedMean(last));
}

/** Best avg of N across the entire solve history. */
export function bestAverageOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  let best = Infinity;
  for (let i = 0; i + n <= solves.length; i++) {
    const window = solves.slice(i, i + n).map(effectiveMs);
    const avg = n === 1 ? window[0] : trimmedMean(window);
    if (avg < best) best = avg;
  }
  return Number.isFinite(best) ? truncToCs(best) : best;
}

/** Best single (lowest effective time, ignoring DNFs unless all are DNF). */
export function bestSingle(solves: Solve[]): number | null {
  if (solves.length === 0) return null;
  let best = Infinity;
  for (const s of solves) {
    const e = effectiveMs(s);
    if (e < best) best = e;
  }
  return best === Infinity ? Infinity : best;
}

/** Worst single (highest effective time, treating DNF as worst). */
export function worstSingle(solves: Solve[]): number | null {
  if (solves.length === 0) return null;
  let worst = -1;
  for (const s of solves) {
    const e = effectiveMs(s);
    if (e === Infinity) return Infinity;
    if (e > worst) worst = e;
  }
  return worst;
}

/** Mean of all times (Infinity if any DNF). */
export function meanOfAll(solves: Solve[]): number | null {
  if (solves.length === 0) return null;
  const times = solves.map(effectiveMs);
  if (times.some(t => t === Infinity)) return Infinity;
  return truncToCs(times.reduce((a, b) => a + b, 0) / times.length);
}

/** Number of solves (incl. DNF). */
export function countAll(solves: Solve[]): number {
  return solves.length;
}

/** Format ms as "1:23.45" or "12.34". DNF/Infinity → "DNF". */
export function formatMs(ms: number | null, precision: 2 | 3 = 2): string {
  if (ms === null) return '-';
  if (!Number.isFinite(ms)) return 'DNF';
  if (ms < 0) ms = 0;
  const totalMs = Math.round(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const fracStr = precision === 3
    ? millis.toString().padStart(3, '0')
    : Math.floor(millis / 10).toString().padStart(2, '0');
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${fracStr}`;
  }
  return `${seconds}.${fracStr}`;
}

/** Compute a row of stats. Returns formatted strings ready for display. */
export interface StatsSummary {
  count: number;
  best: string;
  worst: string;
  mean: string;
  ao5: string;
  ao12: string;
  ao100: string;
  bestAo5: string;
  bestAo12: string;
  bestAo100: string;
}

export function summarize(solves: Solve[]): StatsSummary {
  return {
    count: solves.length,
    best: formatMs(bestSingle(solves)),
    worst: formatMs(worstSingle(solves)),
    mean: formatMs(meanOfAll(solves)),
    ao5: formatMs(averageOfN(solves, 5)),
    ao12: formatMs(averageOfN(solves, 12)),
    ao100: formatMs(averageOfN(solves, 100)),
    bestAo5: formatMs(bestAverageOfN(solves, 5)),
    bestAo12: formatMs(bestAverageOfN(solves, 12)),
    bestAo100: formatMs(bestAverageOfN(solves, 100)),
  };
}
