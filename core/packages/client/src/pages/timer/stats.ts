/**
 * Stats engine — pure functions over Solve[].
 *
 * Conventions: time values are post-penalty effective ms; DNF = Infinity.
 * "Last N" means the most recent N solves in chronological order (so the array
 * passed in must already be ordered oldest → newest).
 */

import type { Solve, EventId } from './types';
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
  if (ms <= 0) return 0;
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

/**
 * Best Possible Average — when exactly one more solve is needed to complete an
 * aoN window, returns the trimmed mean assuming that final solve = 0 ms.
 *
 * Returns null when not "live" (solves.length !== n - 1) or n < 3.
 * Returns Infinity when even the best-case substitution yields > maxDnfsAllowed
 * (i.e. existing DNFs already exceed the cap, since a 0 ms substitute can't
 * reduce the DNF count).
 */
export function bpa(solves: Solve[], n: number): number | null {
  if (n < 3) return null;
  if (solves.length !== n - 1) return null;
  const last = solves.slice(-(n - 1)).map(effectiveMs);
  const window = [...last, 0];
  return truncToCs(trimmedMean(window));
}

/**
 * Worst Possible Average — same "live" contract as `bpa`, but assumes the
 * final solve = DNF (Infinity). Returns Infinity when the resulting DNF count
 * exceeds maxDnfsAllowed for n.
 */
export function wpa(solves: Solve[], n: number): number | null {
  if (n < 3) return null;
  if (solves.length !== n - 1) return null;
  const last = solves.slice(-(n - 1)).map(effectiveMs);
  const window = [...last, Infinity];
  return truncToCs(trimmedMean(window));
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

/**
 * Mean of N over the last N solves — no trim, all solves count.
 * Any DNF in the window → Infinity. Per WCA 9f7 the mean is truncated to cs.
 */
export function meanOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const last = solves.slice(-n).map(effectiveMs);
  if (last.some(t => t === Infinity)) return Infinity;
  return truncToCs(last.reduce((a, b) => a + b, 0) / n);
}

/**
 * Best of N — fastest valid solve in the most recent N. If every solve in the
 * window is DNF, returns Infinity.
 */
export function bestOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const last = solves.slice(-n).map(effectiveMs);
  let best = Infinity;
  for (const t of last) if (t < best) best = t;
  return best;
}

/** Best mean-of-N across the entire solve history. */
export function bestMeanOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  let best = Infinity;
  for (let i = 0; i + n <= solves.length; i++) {
    const window = solves.slice(i, i + n).map(effectiveMs);
    if (window.some(t => t === Infinity)) continue;
    const m = window.reduce((a, b) => a + b, 0) / n;
    if (m < best) best = m;
  }
  return Number.isFinite(best) ? truncToCs(best) : best;
}

/** Best best-of-N across the entire solve history. */
export function bestBestOfN(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  let best = Infinity;
  for (let i = 0; i + n <= solves.length; i++) {
    for (const s of solves.slice(i, i + n)) {
      const t = effectiveMs(s);
      if (t < best) best = t;
    }
  }
  return best;
}

/** WCA per-event default average format. */
export type EventFormat = { kind: 'ao5' | 'mo3' | 'bo3' | 'single'; n: number };
export function eventDefaultFormat(event: EventId): EventFormat {
  if (event === '333fm') return { kind: 'mo3', n: 3 };
  if (event === '333mbld') return { kind: 'single', n: 1 };
  if (event === '444bld' || event === '555bld' || event === '666bld' || event === '777bld') {
    return { kind: 'bo3', n: 3 };
  }
  // 3BLD ('333bld') is ao5 since 2023+; 3BLD-NI also ao5 here.
  return { kind: 'ao5', n: 5 };
}

/** Compute primary average per event format over the most recent solves. */
export function formatPrimary(solves: Solve[], fmt: EventFormat): string {
  if (solves.length < fmt.n) return '-';
  if (fmt.kind === 'ao5')    return formatMs(averageOfN(solves, fmt.n));
  if (fmt.kind === 'mo3')    return formatMs(meanOfN(solves, fmt.n));
  if (fmt.kind === 'bo3')    return formatMs(bestOfN(solves, fmt.n));
  // single
  const last = solves[solves.length - 1];
  return formatMs(effectiveMs(last));
}

/** Best historical primary across all solves for the given format. */
export function formatBestPrimary(solves: Solve[], fmt: EventFormat): string {
  if (solves.length < fmt.n) return '-';
  if (fmt.kind === 'ao5')    return formatMs(bestAverageOfN(solves, fmt.n));
  if (fmt.kind === 'mo3')    return formatMs(bestMeanOfN(solves, fmt.n));
  if (fmt.kind === 'bo3')    return formatMs(bestBestOfN(solves, fmt.n));
  return formatMs(bestSingle(solves));
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

/** Standard deviation of all *valid* (non-DNF) effective times. */
export function stdDev(solves: Solve[]): number | null {
  const valid = solves.map(effectiveMs).filter(t => Number.isFinite(t));
  if (valid.length < 2) return null;
  const m = valid.reduce((a, b) => a + b, 0) / valid.length;
  let sq = 0;
  for (const t of valid) sq += (t - m) * (t - m);
  return Math.sqrt(sq / valid.length);
}

/** Coefficient of variation (σ / μ) as a percentage (0..100+). */
export function coefficientOfVariation(solves: Solve[]): number | null {
  const valid = solves.map(effectiveMs).filter(t => Number.isFinite(t));
  if (valid.length < 2) return null;
  const m = valid.reduce((a, b) => a + b, 0) / valid.length;
  const sd = stdDev(solves);
  if (m <= 0 || sd === null) return null;
  return (sd / m) * 100;
}

/** Format a percentage with one decimal place, "—" for null. */
export function formatPct(p: number | null): string {
  if (p === null) return '—';
  return p.toFixed(1) + '%';
}

/**
 * Sub-X breakdown — what fraction of (valid, non-DNF) solves come in under
 * a few "interesting" thresholds. Thresholds are auto-picked from the
 * solve distribution: mean, mean - σ, mean + σ, with rounding to a "nice"
 * value at the appropriate scale.
 *
 * Returns up to 4 entries. Each entry has the threshold (ms), label, and
 * percentage (0..100) of solves under that threshold.
 */
export function subXBreakdown(solves: Solve[]): Array<{ threshold: number; label: string; pct: number }> {
  const valid = solves.map(effectiveMs).filter(t => Number.isFinite(t));
  if (valid.length < 5) return [];
  const m = valid.reduce((a, b) => a + b, 0) / valid.length;
  let sq = 0;
  for (const t of valid) sq += (t - m) * (t - m);
  const sd = Math.sqrt(sq / valid.length);

  const candidates = [m - sd, m - sd * 0.5, m, m + sd * 0.5, m + sd];
  const seen = new Set<number>();
  const out: Array<{ threshold: number; label: string; pct: number }> = [];
  for (const c of candidates) {
    if (c <= 0) continue;
    let nice: number;
    if (c >= 60000)      nice = Math.round(c / 10000) * 10000;
    else if (c >= 10000) nice = Math.round(c / 5000) * 5000;
    else if (c >= 5000)  nice = Math.round(c / 1000) * 1000;
    else                 nice = Math.round(c / 500) * 500;
    if (nice <= 0 || seen.has(nice)) continue;
    seen.add(nice);
    const count = valid.filter(t => t < nice).length;
    const pct = (count / valid.length) * 100;
    if (pct <= 0 || pct >= 100) continue;
    out.push({ threshold: nice, label: 'sub-' + formatMs(nice), pct });
  }
  return out.sort((a, b) => a.threshold - b.threshold).slice(0, 4);
}

/**
 * Identify which solve is currently the PB (best single, ignoring DNFs).
 * Returns the index in the original `solves` array, or -1 if all DNF / empty.
 */
export function pbSingleIndex(solves: Solve[]): number {
  let best = Infinity;
  let idx = -1;
  for (let i = 0; i < solves.length; i++) {
    const t = effectiveMs(solves[i]);
    if (t < best) { best = t; idx = i; }
  }
  return idx;
}

/** Compute a row of stats. Returns formatted strings ready for display. */
export interface StatsSummary {
  count: number;
  best: string;
  worst: string;
  mean: string;
  ao5: string;
  ao12: string;
  ao50: string;
  ao100: string;
  ao1000: string;
  mo3: string;
  bo3: string;
  bestAo5: string;
  bestAo12: string;
  bestAo50: string;
  bestAo100: string;
  bestAo1000: string;
  bestMo3: string;
  bestBo3: string;
  sd: string;
  cv: string;
  bpa5: string;
  wpa5: string;
  bpa12: string;
  wpa12: string;
}

export function summarize(solves: Solve[]): StatsSummary {
  return {
    count: solves.length,
    best: formatMs(bestSingle(solves)),
    worst: formatMs(worstSingle(solves)),
    mean: formatMs(meanOfAll(solves)),
    ao5: formatMs(averageOfN(solves, 5)),
    ao12: formatMs(averageOfN(solves, 12)),
    ao50: formatMs(averageOfN(solves, 50)),
    ao100: formatMs(averageOfN(solves, 100)),
    ao1000: formatMs(averageOfN(solves, 1000)),
    mo3: formatMs(meanOfN(solves, 3)),
    bo3: formatMs(bestOfN(solves, 3)),
    bestAo5: formatMs(bestAverageOfN(solves, 5)),
    bestAo12: formatMs(bestAverageOfN(solves, 12)),
    bestAo50: formatMs(bestAverageOfN(solves, 50)),
    bestAo100: formatMs(bestAverageOfN(solves, 100)),
    bestAo1000: formatMs(bestAverageOfN(solves, 1000)),
    bestMo3: formatMs(bestMeanOfN(solves, 3)),
    bestBo3: formatMs(bestBestOfN(solves, 3)),
    sd: stdDev(solves) === null ? '—' : formatMs(Math.round(stdDev(solves)!)),
    cv: formatPct(coefficientOfVariation(solves)),
    bpa5: formatMs(bpa(solves, 5)),
    wpa5: formatMs(wpa(solves, 5)),
    bpa12: formatMs(bpa(solves, 12)),
    wpa12: formatMs(wpa(solves, 12)),
  };
}
