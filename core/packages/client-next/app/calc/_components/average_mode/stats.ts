/**
 * WCA-rule averages.
 *  - Mo3: arithmetic mean of all 3 (any DNF → DNF)
 *  - Ao5: trim best+worst, mean of middle 3 (≥2 DNF → DNF; 1 DNF counts as worst)
 *  - Ao12: trim best+worst, mean of middle 10
 * All values are centiseconds. -1 = DNF, -2 = DNS (treated like DNF).
 */

export const DNF = -1;
export const DNS = -2;
export const NOT_ENOUGH = NaN;

const isFailure = (v: number) => v === DNF || v === DNS;

/** Mean of last N values. DNF if any failure, NaN if not enough. */
export function mean(values: number[], n: number): number {
  if (values.length < n) return NOT_ENOUGH;
  const slice = values.slice(values.length - n);
  if (slice.some(isFailure)) return DNF;
  const sum = slice.reduce((a, b) => a + b, 0);
  return Math.round(sum / n);
}

/** WCA trimmed average of last N. Trims 1 best + 1 worst. */
export function trimmedAverage(values: number[], n: number): number {
  if (values.length < n) return NOT_ENOUGH;
  const slice = values.slice(values.length - n);
  const failureCount = slice.filter(isFailure).length;
  if (failureCount >= 2) return DNF;

  // Indices sorted by value, with failures placed at the worst end (Infinity).
  const ranked = slice
    .map((v, i) => ({ v, i, sortKey: isFailure(v) ? Infinity : v }))
    .sort((a, b) => a.sortKey - b.sortKey);

  const trimSet = new Set<number>([ranked[0].i, ranked[ranked.length - 1].i]);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < slice.length; i++) {
    if (trimSet.has(i)) continue;
    sum += slice[i];
    count++;
  }
  return Math.round(sum / count);
}

export interface RowStats {
  i: number;
  value: number;
  mo3: number;
  ao5: number;
  ao12: number;
}

export interface SummaryStats {
  count: number;
  successCount: number;
  best: number;
  worst: number;
  mean: number;
  stdDev: number;
  bestMo3: number;
  bestAo5: number;
  bestAo12: number;
  currentMo3: number;
  currentAo5: number;
  currentAo12: number;
  dnfCount: number;
  dnfRate: number;
}

export function rollingStats(values: number[]): RowStats[] {
  const out: RowStats[] = [];
  for (let i = 0; i < values.length; i++) {
    const window = values.slice(0, i + 1);
    out.push({
      i,
      value: values[i],
      mo3: mean(window, 3),
      ao5: trimmedAverage(window, 5),
      ao12: trimmedAverage(window, 12),
    });
  }
  return out;
}

function bestOfRolling(rolling: RowStats[], key: 'mo3' | 'ao5' | 'ao12'): number {
  let best = NOT_ENOUGH;
  for (const r of rolling) {
    const v = r[key];
    if (v === DNF || !Number.isFinite(v)) continue;
    if (Number.isNaN(best) || v < best) best = v;
  }
  return best;
}

export function summarize(values: number[]): SummaryStats {
  const successes = values.filter((v) => !isFailure(v));
  const dnfs = values.filter(isFailure);
  const meanV = successes.length === 0
    ? NOT_ENOUGH
    : successes.reduce((a, b) => a + b, 0) / successes.length;
  const variance = successes.length < 2
    ? NOT_ENOUGH
    : successes.reduce((acc, v) => acc + (v - meanV) ** 2, 0) / successes.length;

  const rolling = rollingStats(values);

  return {
    count: values.length,
    successCount: successes.length,
    best: successes.length === 0 ? NOT_ENOUGH : Math.min(...successes),
    worst: successes.length === 0 ? NOT_ENOUGH : Math.max(...successes),
    mean: meanV,
    stdDev: Number.isFinite(variance) ? Math.sqrt(variance) : NOT_ENOUGH,
    bestMo3: bestOfRolling(rolling, 'mo3'),
    bestAo5: bestOfRolling(rolling, 'ao5'),
    bestAo12: bestOfRolling(rolling, 'ao12'),
    currentMo3: mean(values, 3),
    currentAo5: trimmedAverage(values, 5),
    currentAo12: trimmedAverage(values, 12),
    dnfCount: dnfs.length,
    dnfRate: values.length === 0 ? 0 : dnfs.length / values.length,
  };
}

