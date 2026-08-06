import { describe, expect, it } from 'vitest';
import {
  drawOrientedFrame,
  orientedDimensions,
  trackMatrixToRotation,
} from '@/app/[lang]/frame-count/video-orientation';

const ONE = 1 << 16;
const W = 1 << 30;

describe('frame-count video track orientation', () => {
  it.each([
    [[ONE, 0, 0, 0, ONE, 0, 0, 0, W], 0],
    [[0, ONE, 0, -ONE, 0, 0, 1080 * ONE, 0, W], 90],
    [[-ONE, 0, 0, 0, -ONE, 0, 1920 * ONE, 1080 * ONE, W], 180],
    [[0, -ONE, 0, ONE, 0, 0, 0, 1920 * ONE, W], 270],
  ] as const)('reads a canonical QuickTime matrix as %i degrees', (matrix, rotation) => {
    expect(trackMatrixToRotation(Int32Array.from(matrix))).toBe(rotation);
  });

  it('ignores missing, malformed, mirrored, and skewed transforms', () => {
    expect(trackMatrixToRotation(undefined)).toBe(0);
    expect(trackMatrixToRotation([NaN, 0, 0, 0, ONE])).toBe(0);
    expect(trackMatrixToRotation([ONE, 0, 0, 0, -ONE])).toBe(0);
    expect(trackMatrixToRotation([ONE, ONE / 2, 0, 0, ONE])).toBe(0);
  });

  it('swaps display dimensions only for quarter turns', () => {
    expect(orientedDimensions(1920, 1080, 0)).toEqual({ width: 1920, height: 1080 });
    expect(orientedDimensions(1920, 1080, 90)).toEqual({ width: 1080, height: 1920 });
    expect(orientedDimensions(1920, 1080, 180)).toEqual({ width: 1920, height: 1080 });
    expect(orientedDimensions(1920, 1080, 270)).toEqual({ width: 1080, height: 1920 });
  });

  it.each([
    [90, [0, 1, -1, 0, 180, 0]],
    [180, [-1, 0, 0, -1, 320, 180]],
    [270, [0, -1, 1, 0, 0, 320]],
  ] as const)('draws a %i-degree frame into the correctly translated canvas', (rotation, expected) => {
    const transforms: number[][] = [];
    const draws: unknown[][] = [];
    const context = {
      setTransform: (...values: number[]) => transforms.push(values),
      clearRect: () => undefined,
      drawImage: (...values: unknown[]) => draws.push(values),
    } as unknown as CanvasRenderingContext2D;
    const source = {} as CanvasImageSource;

    drawOrientedFrame(context, source, 320, 180, rotation);

    expect(transforms[1]).toEqual(expected);
    expect(draws).toEqual([[source, 0, 0, 320, 180]]);
    expect(transforms.at(-1)).toEqual([1, 0, 0, 1, 0, 0]);
  });
});
