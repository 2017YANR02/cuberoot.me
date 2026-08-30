import { WR_METRICS } from '@/lib/wr-metrics';
import { compute as computeRolling, getConfigs as getRollingConfigs } from './rolling';
import { compute as computeRound, getConfigs as getRoundConfigs, type SolveEntry } from './round';

export type WcaResultMetricMode =
  | 'singles'
  | 'mo3' | 'ao5' | 'ao12' | 'ao25' | 'ao50' | 'ao100'
  | 'avg' | 'bao5' | 'wao5' | 'mo5' | 'bpa' | 'wpa' | 'median' | 'bestc' | 'worstc' | 'worst';

export interface WcaResultMetricOption {
  key: WcaResultMetricMode;
  zh: string;
  en: string;
}

const wrMetricById = new Map(WR_METRICS.map(metric => [metric.id, metric]));
const canonicalOption = (key: WcaResultMetricMode, metricId: string): WcaResultMetricOption => {
  const metric = wrMetricById.get(metricId);
  if (!metric) throw new Error(`Unknown WCA result metric: ${metricId}`);
  return { key, zh: metric.zh, en: metric.en };
};

export const WCA_RESULT_METRIC_OPTIONS: readonly WcaResultMetricOption[] = [
  canonicalOption('singles', 'single'),
  ...getRollingConfigs().map(config => ({ key: config.key as WcaResultMetricMode, zh: config.label, en: config.label })),
  canonicalOption('avg', 'average'),
  ...getRoundConfigs().map(config => canonicalOption(config.key as WcaResultMetricMode, config.key)),
];

const ROLLING_KEYS = new Set(getRollingConfigs().map(config => config.key));

export interface WcaMetricRound {
  key: string;
  competition: string;
  date: string;
  roundType: string;
  roundOrder: number;
  attempts: number[];
  average: number;
}

/** One selected metric per result row, using the same engines as DistributionViz. */
export function computeWcaMetricByRound(
  rounds: readonly WcaMetricRound[],
  mode: WcaResultMetricMode,
): Map<string, number | null> {
  const ordered = rounds.slice().sort((a, b) =>
    a.date.localeCompare(b.date)
    || a.competition.localeCompare(b.competition)
    || a.roundOrder - b.roundOrder
    || a.key.localeCompare(b.key),
  );
  const values = new Map<string, number | null>();

  if (mode === 'singles' || mode === 'avg') {
    for (const round of ordered) {
      if (mode === 'avg') {
        values.set(round.key, round.average > 0 ? round.average : null);
        continue;
      }
      const valid = round.attempts.filter(value => value > 0);
      values.set(round.key, valid.length > 0 ? Math.min(...valid) : null);
    }
    return values;
  }

  const entries: SolveEntry[] = [];
  const spans = new Map<string, { first: number; last: number }>();
  for (const round of ordered) {
    const first = entries.length;
    for (let attemptIdx = 0; attemptIdx < round.attempts.length; attemptIdx++) {
      const cs = round.attempts[attemptIdx];
      if (cs === 0) continue;
      entries.push({
        cs,
        compName: round.competition,
        compDate: round.date,
        roundType: round.roundType,
        attemptIdx,
        average: entries.length === first && round.average > 0 ? round.average : null,
      });
    }
    if (entries.length > first) spans.set(round.key, { first, last: entries.length - 1 });
    else values.set(round.key, null);
  }

  if (ROLLING_KEYS.has(mode)) {
    const metric = computeRolling(entries.map(entry => entry.cs))[mode] as (number | null)[];
    for (const round of ordered) {
      const span = spans.get(round.key);
      if (span) values.set(round.key, metric[span.last] ?? null);
    }
    return values;
  }

  const metric = computeRound(entries)[mode] as (number | null)[];
  for (const round of ordered) {
    const span = spans.get(round.key);
    if (span) values.set(round.key, metric[span.first] ?? null);
  }
  return values;
}
