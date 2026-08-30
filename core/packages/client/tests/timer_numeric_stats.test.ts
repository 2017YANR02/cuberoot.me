import { describe, expect, it } from 'vitest';
import { summarizeNumericValues } from '@cuberoot/shared/timer';

describe('shared numeric statistics', () => {
  it('uses population variance and ignores non-finite values', () => {
    const stats = summarizeNumericValues([10, 20, 30, Infinity]);
    expect(stats?.mean).toBe(20);
    expect(stats?.sd).toBeCloseTo(Math.sqrt(200 / 3));
    expect(stats?.cv).toBeCloseTo((Math.sqrt(200 / 3) / 20) * 100);
  });

  it('needs at least two finite values', () => {
    expect(summarizeNumericValues([10, Infinity])).toBeNull();
  });
});
