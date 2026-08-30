import { describe, expect, it } from 'vitest';
import {
  computeWcaMetricByRound,
  WCA_RESULT_METRIC_OPTIONS,
  type WcaMetricRound,
} from '@/lib/wca-result-metrics';

const rounds: WcaMetricRound[] = [
  {
    key: 'later', competition: 'Later', date: '2026-02-01', roundType: 'f', roundOrder: 10,
    attempts: [600, 700, 800, 900, 1000], average: 800,
  },
  {
    key: 'earlier', competition: 'Earlier', date: '2026-01-01', roundType: '1', roundOrder: 2,
    attempts: [100, 200, 300, 400, 500], average: 300,
  },
];

describe('WCA result metrics', () => {
  it('uses chronological solves for rolling values and returns each round endpoint', () => {
    expect(computeWcaMetricByRound(rounds, 'ao5')).toEqual(new Map([
      ['earlier', 300],
      ['later', 800],
    ]));
    expect(computeWcaMetricByRound(rounds, 'mo3')).toEqual(new Map([
      ['earlier', 400],
      ['later', 900],
    ]));
  });

  it('reuses the round metric engine for each result row', () => {
    const bestAo5 = computeWcaMetricByRound(rounds, 'bao5');
    const worstCounting = computeWcaMetricByRound(rounds, 'worstc');
    expect(bestAo5.get('earlier')).toBe(200);
    expect(worstCounting.get('earlier')).toBe(400);
  });

  it('keeps canonical bilingual labels in the shared menu', () => {
    expect(WCA_RESULT_METRIC_OPTIONS.find(option => option.key === 'singles')).toMatchObject({ zh: '单次', en: 'Single' });
    expect(WCA_RESULT_METRIC_OPTIONS.find(option => option.key === 'median')).toMatchObject({ zh: '中位数', en: 'Median' });
    expect(WCA_RESULT_METRIC_OPTIONS.find(option => option.key === 'bestc')).toMatchObject({ zh: '最佳有效', en: 'Best Counting' });
  });
});
