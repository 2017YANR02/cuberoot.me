import { describe, expect, it } from 'vitest';
import { createTrainerStateBatchSampler } from '../src/cross-trainer/batch';

describe('cross trainer batch sampler', () => {
  it('shares one bounded batch result with every timer host', () => {
    const sample = createTrainerStateBatchSampler();
    const result = sample({
      variant: 'std',
      stage: 'cross',
      colors: 'W',
      slot: 0,
      lo: 0,
      hi: 0,
    }, 2, 1_000, () => 0.5);

    expect(result.verdict).toBe('ok');
    expect(result.items).toHaveLength(2);
    expect(result.items.every(({ depth }) => depth === 0)).toBe(true);
  });
});
