import { expect, it } from 'vitest';

import { zoomAtPoint } from './useVideoZoom';

it('zooms around the pointer, clamps to 1–8x, and restores the full picture', () => {
  const initial = { scale: 1, x: 0, y: 0 };
  const enlarged = zoomAtPoint(initial, -100, 0.75, 0.25);
  expect(enlarged.scale).toBeGreaterThan(1);
  expect(enlarged.x + 0.75 * enlarged.scale).toBeCloseTo(0.75);
  expect(enlarged.y + 0.25 * enlarged.scale).toBeCloseTo(0.25);
  expect(zoomAtPoint(enlarged, 100, 0.75, 0.25)).toEqual(initial);
  expect(zoomAtPoint(initial, 100, 0.5, 0.5)).toEqual(initial);
  expect(zoomAtPoint({ scale: 8, x: -3, y: -3 }, -100, 0.5, 0.5)).toEqual({ scale: 8, x: -3, y: -3 });
  const smaller = zoomAtPoint({ scale: 2, x: -1, y: -1 }, 100, 0, 0);
  expect(smaller.x).toBeCloseTo(1 - smaller.scale);
  expect(smaller.y).toBeCloseTo(1 - smaller.scale);
  expect(zoomAtPoint(initial, 0, 0.5, 0.5)).toBe(initial);
  expect(zoomAtPoint(initial, Number.NaN, 0.5, 0.5)).toBe(initial);
});
