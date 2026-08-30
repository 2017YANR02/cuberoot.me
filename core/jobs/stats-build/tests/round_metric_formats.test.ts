import { describe, expect, it } from 'vitest';
import { WrBao5 } from '../src/statistics/wr_bao5';
import { WrMedian } from '../src/statistics/wr_median';
import { WrVariance } from '../src/statistics/wr_variance';
import { WrWorst } from '../src/statistics/wr_worst';

describe('round metrics by competition format', () => {
  it('enables median, worst and variance for Mo3 while keeping BAo5 Ao5-only', () => {
    expect(new WrMedian().targetEvents()).toHaveProperty('666');
    expect(new WrWorst().targetEvents()).toHaveProperty('666');
    expect(new WrVariance().targetEvents()).toHaveProperty('666');
    expect(new WrBao5().targetEvents()).not.toHaveProperty('666');
  });

  it('computes the median for both Mo3 and Ao5, treating DNF as worst', () => {
    const metric = new WrMedian();
    expect(metric.computeMetric([100, 300, 200])).toBe(200);
    expect(metric.computeMetric([100, 200, -1])).toBe(200);
    expect(metric.computeMetric([100, -1, -1])).toBeNull();
    expect(metric.computeMetric([100, 200, 300, 400, -1])).toBe(300);
  });

  it('requires every solve to be valid for worst and variance', () => {
    const worst = new WrWorst();
    const variance = new WrVariance();

    expect(worst.computeMetric([100, 300, 200])).toBe(300);
    expect(worst.computeMetric([100, 200, -1])).toBeNull();
    expect(worst.computeMetric([100, 200, 300, 400, 500])).toBe(500);

    expect(variance.computeMetric([100, 200, 300])).toBe(10_000);
    expect(variance.computeMetric([100, 200, -1])).toBeNull();
  });
});
