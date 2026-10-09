import { describe, expect, it } from 'vitest';
import { compute as computeRolling, getConfigs } from '@/lib/wca-result-metrics/rolling';
import {
  computeWcaMetricByRound,
  computeWcaMetricStatsByRound,
  WCA_AVERAGE_METRIC_KEYS,
  WCA_RESULT_METRIC_OPTIONS,
  WCA_SINGLE_METRIC_KEYS,
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
  it('keeps FMC Mo3 decimals and invalidates windows with a failure', () => {
    const fmc = [{ ...rounds[0]!, attempts: [21, 17, 18], average: 1867 }];
    expect(computeWcaMetricByRound(fmc, 'mo3', '333fm').get('later')).toBe(1867);
    expect(computeWcaMetricByRound(fmc, 'median', '333fm').get('later')).toBe(18);
    expect(computeWcaMetricByRound([{ ...fmc[0]!, attempts: [17, -1, 18] }], 'mo3', '333fm').get('later')).toBeNull();
  });

  it('uses the middle of three attempts and limits five-solve metrics to full rounds', () => {
    const mo3 = [{ ...rounds[0]!, attempts: [100, 300, 200], average: 200 }];
    expect(computeWcaMetricByRound(mo3, 'median').get('later')).toBe(200);
    expect(computeWcaMetricByRound([{ ...mo3[0]!, attempts: [100, 200, -2] }], 'median').get('later')).toBe(200);
    expect(computeWcaMetricByRound([{ ...mo3[0]!, attempts: [100, -1, -2] }], 'median').get('later')).toBeNull();
    for (const mode of ['bao5', 'wao5', 'mo5', 'bpa', 'wpa', 'bestc', 'worstc'] as const) {
      expect(computeWcaMetricByRound(mo3, mode).get('later')).toBeNull();
      expect(computeWcaMetricByRound([{ ...mo3[0]!, attempts: [100, 200, 300, 0, 0] }], mode).get('later')).toBeNull();
    }
  });

  it('counts the worst of four valid attempts when Ao5 drops one DNF', () => {
    expect(computeWcaMetricByRound([{ ...rounds[0]!, attempts: [100, 200, 300, 400, -1] }], 'worstc').get('later')).toBe(400);
  });

  it('rounds Ao25/Ao50 trimming up and preserves their failure allowance', () => {
    expect(getConfigs().find(config => config.key === 'ao25')?.trim).toBe(2);
    expect(getConfigs().find(config => config.key === 'ao50')?.trim).toBe(3);
    expect((computeRolling([...Array.from({ length: 23 }, (_, i) => i + 1), 900, 1000]).ao25 as number[])[24]).toBe(13);
    expect((computeRolling([...Array(47).fill(600), -1, -2, -1]).ao50 as number[])[49]).toBe(600);
    expect((computeRolling([...Array(46).fill(600), -1, -2, -1, -1]).ao50 as (number | null)[])[49]).toBeNull();
  });

  it('applies WCA second rounding to timed means over ten minutes', () => {
    const slow = [{ ...rounds[0]!, attempts: [60000, 60100, 60100] }];
    expect(computeWcaMetricByRound(slow, 'mo3', '666').get('later')).toBe(60100);
    expect(computeWcaMetricByRound([{ ...rounds[0]!, attempts: [60000, 60100, 60100, 60100, 60200] }], 'bao5').get('later')).toBe(60100);
  });

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

  it('ranks round metrics chronologically with standard competition ties', () => {
    const tiedRounds: WcaMetricRound[] = [
      { ...rounds[1]!, key: 'first', competition: 'First', date: '2026-01-01' },
      { ...rounds[1]!, key: 'tie', competition: 'Tie', date: '2026-01-02' },
      { ...rounds[1]!, key: 'better', competition: 'Better', date: '2026-01-03', attempts: [50, 100, 200, 300, 400] },
      { ...rounds[1]!, key: 'fourth', competition: 'Fourth', date: '2026-01-04', attempts: [200, 300, 400, 500, 600] },
      { ...rounds[1]!, key: 'invalid', competition: 'Invalid', date: '2026-01-05', attempts: [-1, -1, 0, 0, 0] },
    ];

    expect(computeWcaMetricStatsByRound(tiedRounds.reverse(), 'median').ranks).toEqual(new Map([
      ['first', 1],
      ['tie', 1],
      ['better', 1],
      ['fourth', 4],
      ['invalid', null],
    ]));
  });

  it('keeps canonical bilingual labels in the shared menu', () => {
    expect(WCA_RESULT_METRIC_OPTIONS.find(option => option.key === 'singles')).toMatchObject({ zh: '单次', en: 'Single' });
    expect(WCA_RESULT_METRIC_OPTIONS.find(option => option.key === 'median')).toMatchObject({ zh: '中位数', en: 'Median' });
    expect(WCA_RESULT_METRIC_OPTIONS.find(option => option.key === 'bestc')).toMatchObject({ zh: '最佳有效', en: 'Best Counting' });
  });

  it('splits single-value and average metrics between the two result columns', () => {
    expect(WCA_SINGLE_METRIC_KEYS).toEqual(['singles', 'median', 'bestc', 'worstc', 'worst']);
    expect(WCA_AVERAGE_METRIC_KEYS).toEqual([
      'avg', 'mo3', 'ao5', 'ao12', 'ao25', 'ao50', 'ao100', 'bao5', 'wao5', 'mo5', 'bpa', 'wpa',
    ]);
    expect(new Set([...WCA_SINGLE_METRIC_KEYS, ...WCA_AVERAGE_METRIC_KEYS]))
      .toEqual(new Set(WCA_RESULT_METRIC_OPTIONS.map(option => option.key)));
  });
});
