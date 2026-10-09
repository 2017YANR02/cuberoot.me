import { describe, expect, it } from 'vitest';
import {
  averageOfN, bestAverageOfN, bestMeanOfN, bpa, meanOfAll, meanOfN,
  roundProjection, roundResult, DEFAULT_ROUND_CONFIG, wpa, type Solve,
} from '@cuberoot/shared/timer';

const solves = (times: number[], event: Solve['event'] = '333'): Solve[] => times.map((timeMs, i) => ({
  id: String(i), event, timeMs, penalty: 'ok', scramble: '', ts: i,
}));

describe('timer average rounding matches round simulation', () => {
  it('rounds Ao5 up instead of truncating a hundredth', () => {
    const attempts = solves([8000, 9000, 9005, 9010, 12000]);
    expect(averageOfN(attempts, 5)).toBe(9010);
    expect(bestAverageOfN(attempts, 5)).toBe(9010);
    expect(roundResult(attempts, DEFAULT_ROUND_CONFIG).official).toBe(9010);
  });

  it('uses the same rounding for Mo3, best Mo3 and the session mean', () => {
    const attempts = solves([10000, 11000, 11002]);
    expect(meanOfN(attempts, 3)).toBe(10670);
    expect(bestMeanOfN(attempts, 3)).toBe(10670);
    expect(meanOfAll(attempts)).toBe(10670);
  });

  it('rounds long timed means to seconds without applying that threshold to FMC', () => {
    expect(meanOfN(solves([600000, 601000, 601000]), 3)).toBe(601000);
    expect(meanOfN(solves([600000, 601000, 601000], '333fm'), 3)).toBe(600670);
  });

  it('agrees on BPA/WPA when their raw means need rounding up', () => {
    const attempts = solves([8000, 9000, 9005, 9010]);
    const projection = roundProjection(attempts, DEFAULT_ROUND_CONFIG);
    expect(bpa(attempts, 5)).toBe(8670);
    expect(wpa(attempts, 5)).toBe(9010);
    expect(projection.bpa).toBe(bpa(attempts, 5));
    expect(projection.wpa).toBe(wpa(attempts, 5));
  });
});
