import { describe, expect, it } from 'vitest';
import { matchCameraRotation } from '@/lib/video-recon/engine/camera-orientation';

function quadrants(colors: number[]) {
  const pixels = new Uint8ClampedArray(12 * 12 * 4);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const value = colors[(y >= 6 ? 2 : 0) + (x >= 6 ? 1 : 0)];
      pixels.set([value, value, value, 255], 4 * (12 * y + x));
    }
  }
  return pixels;
}

describe('camera sensor frames relative to the native preview', () => {
  const source = quadrants([0, 80, 160, 240]);
  it.each([
    [0, [0, 80, 160, 240]],
    [90, [160, 0, 240, 80]],
    [180, [240, 160, 80, 0]],
    [270, [80, 240, 0, 160]],
  ] as const)('recognizes a %i degree display rotation', (rotation, order) => {
    expect(matchCameraRotation(source, quadrants([...order]))).toBe(rotation);
  });
  it('leaves the last orientation in effect when a frame is uniform or unrelated', () => {
    const blank = quadrants([30, 30, 30, 30]);
    expect(matchCameraRotation(blank, blank)).toBeUndefined();
    expect(matchCameraRotation(source, blank)).toBeUndefined();
  });
});
