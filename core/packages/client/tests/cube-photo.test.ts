import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { detectCubePhoto } from '@/lib/cube-photo/detect';
import { faceGrid, homography, project, validQuad, type Quad } from '@/lib/cube-photo/geometry';
import { cubePhotoFixture } from '@cuberoot/shared/testing/cube-photo';
import { resizePhotoPixels } from '@cuberoot/shared/cube-photo/pixels';
import { SOLVED_FACELET } from '@cuberoot/shared/cube-facelet';
import algFixture from '@cuberoot/shared/testing/cube-photo-algs';

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
  it('rejects neutral grids even when their perspective matches three cube faces', async () => {
    const fixture = cubePhotoFixture(false, .1, SOLVED_FACELET);
    // Strong, coherent 3x3 edges alone must not certify a keyboard/table-like grid.
    const svg = fixture.svg.replace(/#(?:f9dc28|1075db|e82b35)/g, '#dddddd');
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const detection = detectCubePhoto({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) });
    expect(detection.reason).toBe('no-grid');
    expect(detection.candidates).toEqual([]);
  });
  it('keeps a fully white top when the side top rows provide color evidence', async () => {
    const fixture = cubePhotoFixture(true, .1, SOLVED_FACELET);
    const svg = fixture.svg.replaceAll('#f9dc28', '#eeeeee');
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const detection = detectCubePhoto({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) });
    expect(detection.reason).toBe('ok');
    expect(detection.candidates[0].corners.slice(0, 4).every((p, i) => Math.hypot(p.x - fixture.top[i].x, p.y - fixture.top[i].y) < 10)).toBe(true);
  });
  it('locates a uniform PLL top with soft seams instead of the more colorful vertical side', async () => {
    const fixture = cubePhotoFixture(true, .18, algFixture.states.pll);
    const svg = fixture.svg.replace('fill="#181b20"', 'fill="#b0b020"');
    const { data, info } = await sharp(Buffer.from(svg)).blur(1.2).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const detection = detectCubePhoto({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) });
    expect(detection.reason).toBe('ok');
    const errors = detection.candidates[0].corners.slice(0, 4).map((p, i) => Math.hypot(p.x - fixture.top[i].x, p.y - fixture.top[i].y));
    expect(errors.every(error => error < 10), JSON.stringify(errors)).toBe(true);
  });
  it('finds a uniform top in a landscape photo dominated by background grid lines', async () => {
    const fixture = cubePhotoFixture(true, .18, SOLVED_FACELET);
    const cube = fixture.svg.replace(/^.*?<rect[^>]*\/>/, '').replace('</svg>', '')
      .replace('fill="#181b20"', 'fill="#b0b020"');
    const background = Array.from({ length: 12 }, (_, row) => Array.from({ length: 26 }, (_, col) =>
      `<rect x="${col * 25 + 2}" y="${row * 28 + 2}" width="20" height="20" rx="2" fill="#ddd"/>`).join('')).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#151820"/>${background}<g transform="translate(165 4) scale(.65)">${cube}</g></svg>`;
    const { data, info } = await sharp(Buffer.from(svg)).blur(.6).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const detection = detectCubePhoto({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) });
    expect(detection.reason).toBe('ok');
    const expected = fixture.top.map(p => ({ x: 165 + p.x * .65, y: 4 + p.y * .65 }));
    const errors = detection.candidates[0].corners.slice(0, 4).map((p, i) => Math.hypot(p.x - expected[i].x, p.y - expected[i].y));
    expect(errors.every(error => error < 10), JSON.stringify(errors)).toBe(true);
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
  it('retains perspective grids after compressed photos are downsampled', async () => {
    for (const perspective of [0.06, 0.18, 0.24]) {
      const fixture = cubePhotoFixture(true, perspective);
      const compressed = await sharp(Buffer.from(fixture.svg)).resize(1920, 1620).webp({ quality: 80 }).toBuffer();
      const { data, info } = await sharp(compressed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const detection = detectCubePhoto(resizePhotoPixels({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) }));
      expect(detection.reason).toBe('ok');
      expect(detection.candidates[0].corners.slice(0, 4).every((p, i) => Math.hypot(p.x - fixture.top[i].x, p.y - fixture.top[i].y) < 10)).toBe(true);
    }
  });
  it('area-averages RGBA against white and rejects invalid resize bounds', () => {
    const data = new Uint8ClampedArray(64 * 64 * 4);
    for (let i = 0; i < data.length; i += 8) { data[i] = 255; data[i + 3] = 255; }
    const pixels = { width: 64, height: 64, data };
    const small = resizePhotoPixels(pixels, 32);
    expect([small.width, small.height, ...small.data.slice(0, 4)]).toEqual([32, 32, 255, 128, 128, 255]);
    expect(() => resizePhotoPixels(pixels, 0)).toThrow('invalid-pixels');
    expect(() => resizePhotoPixels({ ...pixels, width: 63 })).toThrow('invalid-pixels');
  });
});
