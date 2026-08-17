import { describe, expect, it } from 'vitest';
import { orderedDragRange } from '@/components/RangeSlider/RangeSlider';

describe('RangeSlider pointer drag', () => {
  it('keeps one continuous drag moving after it crosses the other endpoint', () => {
    expect([5, 4, 3, 2, 1, 0].map((moving) => orderedDragRange(2, moving))).toEqual([
      [2, 5],
      [2, 4],
      [2, 3],
      [2, 2],
      [1, 2],
      [0, 2],
    ]);
  });

  it('works in the opposite direction as well', () => {
    expect([2, 3, 4, 5].map((moving) => orderedDragRange(4, moving))).toEqual([
      [2, 4],
      [3, 4],
      [4, 4],
      [4, 5],
    ]);
  });
});
