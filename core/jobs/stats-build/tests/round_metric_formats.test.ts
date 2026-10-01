import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoundMetric } from '../src/core/round_metric';
import { WrBao5 } from '../src/statistics/wr_bao5';
import { WrMedian } from '../src/statistics/wr_median';
import { WrVariance } from '../src/statistics/wr_variance';
import { WrWorst } from '../src/statistics/wr_worst';
import { WrWorstCounting } from '../src/statistics/wr_worst_counting';
import { WrBestCounting } from '../src/statistics/wr_best_counting';
import { WrBpa } from '../src/statistics/wr_bpa';
import { WrWpa } from '../src/statistics/wr_wpa';
import { WrMo5 } from '../src/statistics/wr_mo5';
import { WrWao5 } from '../src/statistics/wr_wao5';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('../src/core/database', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/core/database')>();
  return { ...actual, query: queryMock };
});

afterEach(() => {
  RoundMetric.clearPrecomputed();
  queryMock.mockReset();
});

describe('round metrics by competition format', () => {
  it('keeps the worst counting solve when the dropped worst is DNF/DNS', () => {
    const worst = new WrWorstCounting();
    expect(worst.computeMetric([100, 200, 300, 400, -1])).toBe(400);
    expect(worst.computeMetric([100, 200, 300, 400, -2])).toBe(400);
    expect(worst.computeMetric([100, 200, 300, -1, -2])).toBeNull();
  });

  it('rejects Mo3 and incomplete rounds for five-solve-only metrics', () => {
    for (const metric of [new WrBao5(), new WrWao5(), new WrMo5(), new WrBpa(), new WrWpa(), new WrBestCounting(), new WrWorstCounting()]) {
      expect(metric.computeMetric([100, 200, 300])).toBeNull();
      expect(metric.computeMetric([100, 200, 300, 400])).toBeNull();
      expect(metric.computeMetric([100, 200, 300, 400, 0])).toBeNull();
    }
  });

  it('keeps original attempt order when calculating WAo5', () => {
    const attempts = [500, 100, 400, 300, 200];
    expect(new WrWao5().computeMetric(attempts)).toBe(400);
    expect(attempts).toEqual([500, 100, 400, 300, 200]);
    expect(new WrBpa().computeMetric(attempts)).toBe(800 / 3);
  });
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

  it('keeps a derived WR from a round whose official average was not a WR', async () => {
    queryMock.mockImplementation(async (sql: string) => sql.includes("event_id = 'clock'") ? [{
      person_id: '2017CHAM09',
      attempts: '277,280,614,289,694',
      average: 394,
      best: 277,
      person_link: '[Cham J. Chambers](https://www.worldcubeassociation.org/persons/2017CHAM09)',
      country_id: 'United Kingdom',
      competition_link: '[Wiltshire Spring 2023](https://www.worldcubeassociation.org/competitions/WiltshireSpring2023)',
      start_date: '2023-03-25',
    }] : []);

    const json = await new WrBao5().toJson();
    const history = json.panels?.find(panel => panel.id === 'history');
    const clock = history?.sections.find(section => section.title === "Rubik's Clock");

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("WHERE (best > 0 OR average > 0) AND event_id = 'clock'"));
    expect(clock?.rows.some(row => row[0] === '2.82'
      && String(row[3]).includes('2017CHAM09')
      && row[4] === '2023-03-25')).toBe(true);
  });
});
