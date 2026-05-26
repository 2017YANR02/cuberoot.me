/**
 * Stats engine — pure functions over Solve[]. Ported subset of
 * packages/client/src/pages/timer/stats.ts.
 *
 * Time values are post-penalty effective ms; DNF = Infinity.
 */

import type { Solve } from './timer-db';
import { effectiveMs } from './timer-db';

function trimCount(n: number): number {
  if (n < 3) return 0;
  return Math.max(1, Math.ceil(n / 20));
}

function maxDnfsAllowed(n: number): number {
  return n <= 12 ? 1 : trimCount(n);
}

function mean(times: number[]): number {
  if (times.length === 0) return NaN;
  if (times.some((t) => t === Infinity)) return Infinity;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

function trimmedMean(times: number[]): number {
  const n = times.length;
  if (n < 3) return mean(times);
  const trim = trimCount(n);
  const sorted = [...times].sort((a, b) => a - b);
  const dnfCount = sorted.filter((t) => t === Infinity).length;
  if (dnfCount > maxDnfsAllowed(n)) return Infinity;
  const middle = sorted.slice(trim, n - trim);
  return mean(middle);
}

function truncToCs(ms: number): number {
  if (!Number.isFinite(ms)) return ms;
  if (ms <= 0) return 0;
  return Math.floor(ms / 10) * 10;
}

/** Average of N over the last N solves. Returns null when fewer than N. */
export function averageOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const last = solves.slice(-n).map(effectiveMs);
  if (n === 1) return last[0];
  return truncToCs(trimmedMean(last));
}

/** Best aoN across the entire solve history. */
export function bestAverageOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  let best: number = Infinity;
  for (let i = n; i <= solves.length; i++) {
    const m = averageOfN(solves.slice(0, i), n);
    if (m == null) continue;
    if (m < best) best = m;
  }
  return Number.isFinite(best) ? best : null;
}

/** Best non-DNF single time across all solves. */
export function bestSingle(solves: Solve[]): number | null {
  let best: number = Infinity;
  for (const s of solves) {
    const v = effectiveMs(s);
    if (Number.isFinite(v) && v < best) best = v;
  }
  return Number.isFinite(best) ? best : null;
}

/** "12.34" / "1:23.45" / "DNF" / "—". */
export function formatMs(ms: number | null | undefined, precision: 2 | 3 = 2): string {
  if (ms == null) return '—';
  if (!Number.isFinite(ms)) return 'DNF';
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec - min * 60;
  const pad = sec < 10 && min > 0 ? '0' : '';
  if (min > 0) return `${min}:${pad}${sec.toFixed(precision)}`;
  return sec.toFixed(precision);
}
