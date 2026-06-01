/**
 * Shared stats surface (Solo + Battle).
 *
 * 1) Timer's canonical engine is re-exported verbatim. Available names
 *    (operate on Solve[] from ../_lib/types):
 *      averageOfN, meanOfN, bestOfN, bpa, wpa,
 *      bestAverageOfN, bestMeanOfN, bestBestOfN,
 *      bestSingle, worstSingle, meanOfAll, countAll,
 *      stdDev, coefficientOfVariation, formatPct, subXBreakdown,
 *      pbSingleIndex, eventDefaultFormat, formatPrimary, formatBestPrimary,
 *      summarize, formatMs
 *      (types: EventFormat, StatsSummary)
 *
 * 2) Battle-named adapters below. Battle operates on SolveEntry[] (lowercase
 *    'dnf', Math.round rounding, slightly different DNF tolerance) — these are
 *    a faithful port of battle/_components/engine/stats.ts so battle can
 *    re-point imports here with zero behavior change. They are NOT aliases of
 *    the timer functions above (different input type + rounding).
 *
 * Do not modify ../_lib/stats.ts — extend here.
 */

export * from '../_lib/stats';

import type { SolveEntry } from '@/app/[lang]/battle/_components/engine/types';

/**
 * Effective time (ms, Infinity for DNF) from a battle history entry.
 * Tolerates the legacy plain-number format.
 */
export function getEffectiveTimeFromEntry(entry: SolveEntry | number): number {
  if (typeof entry === 'number') return entry;
  if (entry.penalty === 'dnf') return Infinity;
  if (entry.penalty === '+2') return entry.time + 2000;
  return entry.time;
}

/** Battle Ao5: last 5, drop best+worst, mean middle 3; 2+ DNF -> DNF. */
export function computeAo5(history: SolveEntry[]): number | null {
  if (history.length < 5) return null;
  const last5 = history.slice(-5).map(getEffectiveTimeFromEntry);
  const sorted = [...last5].sort((a, b) => a - b);
  const dnfCount = sorted.filter(t => t === Infinity).length;
  if (dnfCount >= 2) return Infinity;
  return Math.round((sorted[1] + sorted[2] + sorted[3]) / 3);
}

/** Battle generic average (Ao12/Ao100…): trim ceil(n/20) each end. */
export function computeAverage(history: SolveEntry[], n: number): number | null {
  if (history.length < n) return null;
  const lastN = history.slice(-n).map(getEffectiveTimeFromEntry);
  const trim = Math.ceil(n / 20);
  const sorted = [...lastN].sort((a, b) => a - b);
  const dnfCount = sorted.filter(t => t === Infinity).length;
  if (dnfCount > trim) return Infinity;
  const middle = sorted.slice(trim, n - trim);
  const sum = middle.reduce((a, b) => a + b, 0);
  return Math.round(sum / middle.length);
}

/** Battle one-shot mean/sd/cv over already-valid (non-DNF) times. */
export function computeBasicStats(
  validTimes: number[]
): { mean: number; sd: number; cv: number } | null {
  if (validTimes.length < 2) return null;
  let sum = 0;
  for (let i = 0; i < validTimes.length; i++) sum += validTimes[i];
  const mean = sum / validTimes.length;
  let sqSum = 0;
  for (let j = 0; j < validTimes.length; j++) {
    const d = validTimes[j] - mean;
    sqSum += d * d;
  }
  const variance = sqSum / validTimes.length;
  const sd = Math.sqrt(variance);
  const cv = mean > 0 ? (sd / mean) * 100 : 0;
  return { mean: Math.round(mean), sd, cv };
}

/** Battle streak: longest/current run of times strictly below threshold. */
export function computeStreak(
  times: number[],
  threshold: number
): { current: number; best: number } {
  let best = 0;
  let streak = 0;
  for (let i = 0; i < times.length; i++) {
    if (times[i] !== Infinity && times[i] < threshold) {
      streak++;
      if (streak > best) best = streak;
    } else {
      streak = 0;
    }
  }
  return { current: streak, best };
}

/** Battle PB-single marker: is entry[index] the best single up to that point. */
export function isPBSingleAt(history: SolveEntry[], index: number): boolean {
  const effTime = getEffectiveTimeFromEntry(history[index]);
  if (effTime === Infinity) return false;
  for (let i = 0; i < index; i++) {
    const t = getEffectiveTimeFromEntry(history[i]);
    if (t <= effTime) return false;
  }
  return true;
}

/** Battle sub-X breakdown — needs a plain formatter injected for labels. */
export function computeSubXBreakdown(
  validTimes: number[],
  formatTimePlainFn: (ms: number) => string
): Array<{ label: string; pct: number; threshold: number }> {
  if (validTimes.length < 5) return [];
  const stats = computeBasicStats(validTimes);
  if (!stats) return [];
  const { mean, sd } = stats;

  const candidates = [mean - sd, mean - sd * 0.5, mean, mean + sd * 0.5, mean + sd];
  const thresholds: Array<{ threshold: number; label: string; pct: number }> = [];
  const seen: Record<string, boolean> = {};
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c <= 0) continue;
    let nice: number;
    if (c >= 60000) nice = Math.round(c / 10000) * 10000;
    else if (c >= 10000) nice = Math.round(c / 5000) * 5000;
    else if (c >= 5000) nice = Math.round(c / 1000) * 1000;
    else nice = Math.round(c / 500) * 500;
    if (nice <= 0) continue;
    const key = '' + nice;
    if (seen[key]) continue;
    seen[key] = true;
    const count = validTimes.filter(t => t < nice).length;
    const pct = Math.round((count / validTimes.length) * 100);
    if (pct > 0 && pct < 100) {
      thresholds.push({ threshold: nice, label: 'sub-' + formatTimePlainFn(nice), pct });
    }
  }

  thresholds.sort((a, b) => a.threshold - b.threshold);
  return thresholds.slice(0, 4);
}

/** Battle relative-date label (today=HH:MM / yesterday / M/D HH:MM). */
export function formatRelativeDate(isoDate: string, locale: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);

  const timeStr =
    d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');

  if (diff === 0) return timeStr;
  if (diff === 1) return (locale === 'zh' ? '昨天 ' : 'Yesterday ') + timeStr;
  return d.getMonth() + 1 + '/' + d.getDate() + ' ' + timeStr;
}
