import type { AlgCase, AlgCaseMeta } from '@cuberoot/shared';

export const OPTIMAL_METRICS = ['etm', 'htm', 'qtm', 'stm', 'sqtm', 'atm'] as const;
export type OptimalMetric = (typeof OPTIMAL_METRICS)[number];
export type OptimalComparison = 'lte' | 'eq' | 'gte';

export interface OptimalFilter {
  metric: OptimalMetric;
  comparison: OptimalComparison;
  moves: number;
}

export interface OptimalRange {
  min: number;
  max: number;
}

export function isOptimalMetric(value: unknown): value is OptimalMetric {
  return typeof value === 'string' && (OPTIMAL_METRICS as readonly string[]).includes(value);
}

function validLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function optimalLength(meta: AlgCaseMeta | undefined, metric: OptimalMetric): number | null {
  const value = meta?.optimal?.[metric]?.len;
  return validLength(value) ? value : null;
}

/** Metrics actually backed by case-level optimal data in the current scope. */
export function availableOptimalMetrics(cases: readonly AlgCase[]): OptimalMetric[] {
  return OPTIMAL_METRICS.filter(metric => cases.some(c => optimalLength(c.meta, metric) !== null));
}

export function optimalRange(cases: readonly AlgCase[], metric: OptimalMetric): OptimalRange | null {
  const values = cases
    .map(c => optimalLength(c.meta, metric))
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Apply one case-level optimal-distance condition.
 *
 * A stale URL whose metric is unavailable for this scope is treated as no filter;
 * once a valid filter is active, cases missing that metric do not match.
 */
export function filterCasesByOptimal(
  cases: readonly AlgCase[],
  filter: OptimalFilter | null,
): AlgCase[] {
  if (!filter || !validLength(filter.moves)) return [...cases];
  if (!optimalRange(cases, filter.metric)) return [...cases];
  return cases.filter(c => {
    const value = optimalLength(c.meta, filter.metric);
    if (value === null) return false;
    if (filter.comparison === 'eq') return value === filter.moves;
    if (filter.comparison === 'gte') return value >= filter.moves;
    return value <= filter.moves;
  });
}
