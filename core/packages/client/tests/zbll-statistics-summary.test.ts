import { describe, expect, it } from 'vitest';
import { histogramFor, summarizeHistogram } from '@/app/[lang]/alg/double-zbll-about/useStatisticsData';
import statistics from '@/app/[lang]/alg/double-zbll-about/statistics.json';

describe('ZBLL comparison statistics', () => {
  it('weights move bins by frequency, including sparse bins and percentile boundaries', () => {
    expect(summarizeHistogram([0, 2, 0, 6, 2])).toEqual({ count: 10, min: 1, max: 4, mean: 2.8, median: 3, p90: 4 });
    expect(summarizeHistogram([])).toEqual({ count: 0, min: -1, max: -1, mean: 0, median: -1, p90: -1 });
  });
  it('counts slices using the shared metric and retains disclosed fallbacks', () => {
    const rows = [{ name: 'slice', scramble: 'M2 U', fallback: false }, { name: 'fallback', scramble: 'R2 U', fallback: true }];
    expect(histogramFor(rows, 'htm')).toEqual([0, 0, 1, 1]);
    expect(histogramFor(rows, 'stm')).toEqual([0, 0, 2]);
    expect(histogramFor(rows, 'sqtm')).toEqual([0, 0, 0, 2]);
    expect(histogramFor(rows, 'qtm')).toEqual([0, 0, 0, 1, 0, 1]);
  });
  for (const scope of ['pure', 'all'] as const) {
    it(`reconciles ${scope} double corpus with its published totals and extrema`, () => {
      const group = statistics.groups[scope];
      const htm = summarizeHistogram(group.histogram);
      const qtm = summarizeHistogram(group.qtmHistogram);
      expect(htm.count).toBe(group.count);
      expect(qtm.count).toBe(group.count);
      expect(htm.mean).toBe(group.totalHtm / group.count);
      expect(qtm.mean).toBe(group.totalQtm / group.count);
      expect(htm.min).toBe(group.shortest[0].htm);
      expect(htm.max).toBe(group.longest[0].htm);
    });
  }
});
