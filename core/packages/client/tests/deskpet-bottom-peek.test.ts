import { describe, expect, it } from 'vitest';
import { bottomDragReach, bottomPeekLine, bottomPeekViewport } from '@/lib/deskpet-bottom-peek';

describe('captured fractional viewport and SVG geometry', () => {
  const box = { top: 748.5416870117188, left: 919.9896240234375, width: 176.39584350585938, height: 176.39584350585938 };
  const visual = { width: 1400, height: 847.3333129882812, offsetLeft: 0, offsetTop: 0 };
  const scale = .27604168284063557;
  it('replays the captured lower-bound rejection and preserves fractional viewport height', () => {
    expect(bottomPeekLine(box, { left: 0, right: 1400, bottom: 847 })).toBeUndefined();
    const viewport = bottomPeekViewport(1400, 847, visual);
    expect(viewport.bottom).toBe(847.3333129882812);
    for (const density of [1, 1.25, 1.5, 2, 3, 4]) {
      expect(bottomPeekLine(box, viewport, { x: box.left, y: box.top, scaleX: scale, scaleY: scale, pixelSize: 1 / density })).toBe(358);
    }
  });
  it('does not accept a full extra pixel outside the lower tolerance, the upper limit or cropped sides', () => {
    const viewport = bottomPeekViewport(1400, 847, visual);
    const geometry = { x: box.left, y: viewport.bottom - 358 * scale + 2 / 3, scaleX: scale, scaleY: scale, pixelSize: 1 / 3 };
    expect(bottomPeekLine(box, viewport, geometry)).toBeUndefined();
    expect(bottomPeekLine(box, viewport, { ...geometry, y: viewport.bottom - 501 * scale })).toBeUndefined();
    expect(bottomPeekLine(box, viewport, { ...geometry, x: -100, y: viewport.bottom - 400 * scale })).toBeUndefined();
    expect(bottomPeekLine(box, viewport, { ...geometry, scaleY: 0 })).toBeUndefined();
  });
});

describe('bounded pointer bottom reach', () => {
  it('compensates the grip continuously only in the final edge band', () => {
    for (const height of [134.4, 176.4, 226.8]) {
      for (const fraction of [.36, .5, .64, .82, .9]) {
        const grip = height * fraction;
        expect(bottomDragReach(400, grip, height, 768)).toBe(0);
        expect(bottomDragReach(767, grip, height, 768)).toBeCloseTo(Math.max(0, grip + 1 - height * .56), 6);
        let previous = 0;
        for (let y = 700; y <= 767; y += .25) {
          const next = bottomDragReach(y, grip, height, 768);
          expect(next).toBeGreaterThanOrEqual(previous);
          expect(next - previous).toBeLessThan(3);
          previous = next;
        }
      }
    }
    expect(bottomDragReach(767, -1, 176.4, 768)).toBe(0);
    expect(bottomDragReach(767, 200, 176.4, 768)).toBe(0);
  });
});

describe('bottom peek contact geometry', () => {
  const viewport = { bottom: 800, left: 0, right: 1200 };
  it('matches the real bottom contact at every size without changing the rectangle', () => {
    for (const size of [120, 176.4, 252, 320]) {
      for (const line of [358.4, 370, 400, 429.9, 430.1, 450, 480, 499.9]) {
        const box = { top: 800 - line * size / 640, left: 200, width: size, height: size };
        const before = { ...box };
        expect(bottomPeekLine(box, viewport)).toBeCloseTo(line, 6);
        expect(box).toEqual(before);
      }
    }
  });
  it('rejects heights outside the delivered range, excessive exposure and side-clipped paws', () => {
    for (const line of [350, 357, 501, 640]) {
      expect(bottomPeekLine({ top: 800 - line / 2, left: 200, width: 320, height: 320 }, viewport)).toBeUndefined();
    }
    expect(bottomPeekLine({ top: 570, left: -40, width: 320, height: 320 }, viewport)).toBeUndefined();
    expect(bottomPeekLine({ top: 570, left: 960, width: 320, height: 320 }, viewport)).toBeUndefined();
    expect(bottomPeekLine({ top: 570, left: 200, width: 320, height: 0 }, viewport)).toBeUndefined();
  });
});
