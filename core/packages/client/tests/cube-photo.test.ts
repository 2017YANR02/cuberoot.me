import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { detectCubePhoto } from '@/lib/cube-photo/detect';
import { faceGrid, homography, project, validQuad, type Quad } from '@/lib/cube-photo/geometry';
import { cubePhotoFixture } from './fixtures/cube-photo';

describe('cube photo geometry', () => {
  it('projects perspective thirds, rather than dividing image-space edges equally', () => {
    const q: Quad = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 90, y: 90 }, { x: 30, y: 90 }];
    const h = homography(q)!;
    expect(project(h, 0.5, 0.5)).toEqual({ x: 60, y: 60 });
    expect(project(h, 0.5, 1 / 3)).toEqual({ x: 60, y: 45 });
    expect(faceGrid(q, 'top').filter(s => s.inferred)).toHaveLength(0);
    expect(faceGrid(q, 'left').filter(s => s.inferred)).toHaveLength(6);
    expect(validQuad([q[0], q[2], q[1], q[3]])).toBe(false);
  });
  it('does not manufacture a candidate for a blank photo', () => {
    const data = new Uint8ClampedArray(120 * 100 * 4).fill(160);
    expect(detectCubePhoto({ width: 120, height: 100, data })).toEqual({ candidates: [], lineCount: 0, reason: 'no-edges' });
  });
  for (const occluded of [false, true]) it(`locates the top grid with lower layers ${occluded ? 'occluded' : 'visible'}`, async () => {
    const fixture = cubePhotoFixture(occluded);
    const { data, info } = await sharp(Buffer.from(fixture.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const detection = detectCubePhoto({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) });
    expect(detection.reason).toBe('ok');
    const actual = detection.candidates[0].corners.slice(0, 4);
    const errors = actual.map((p, i) => Math.hypot(p.x - fixture.top[i].x, p.y - fixture.top[i].y));
    // Ten source pixels is much smaller than a sticker in this 640px fixture.
    expect(errors.every(error => error < 10), JSON.stringify({ errors, candidate: detection.candidates[0] })).toBe(true);
  });
});
