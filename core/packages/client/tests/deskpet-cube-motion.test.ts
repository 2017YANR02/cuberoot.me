import { describe, expect, it } from 'vitest';
import { cubeMotionFrame, turningCube } from '../scripts/deskpet-rootbeast/cube-motion.mjs';

function paintedStickers(svg: string) {
  return [...svg.matchAll(/<polygon points="([^"]+)" fill="([^"]+)"/g)]
    .filter(match => match[2] !== '#2a2d36')
    .map(match => {
      const points = match[1].split(' ').map(pair => pair.split(',').map(Number));
      // Compare full cells: VisualCube insets toward one projected diagonal,
      // whose midpoint shifts slightly under a quarter-turn in perspective.
      const center = points[0].map((v, axis) => (v + points[2][axis]) / 2);
      const cells = points.map(p => p.map((v, axis) => center[axis] + (v - center[axis]) / .85));
      return { color: match[2], x: cells.reduce((sum, p) => sum + p[0], 0) / 4, y: cells.reduce((sum, p) => sum + p[1], 0) / 4 };
    });
}

describe('Root Beast real cube layer motion', () => {
  it.each([[90, 'U'], [-90, "U'"], [180, 'U2']] as const)('lands a %s degree turn on the simulated %s state', (angle, move) => {
    const setup = "R U R' U' F";
    const turning = paintedStickers(cubeMotionFrame({ alg: setup, angle }));
    const landed = paintedStickers(cubeMotionFrame({ alg: `${setup} ${move}` }));
    expect(turning).toHaveLength(27);
    expect(landed).toHaveLength(27);
    for (const sticker of turning) {
      expect(landed.some(next => next.color === sticker.color && Math.hypot(next.x - sticker.x, next.y - sticker.y) < .0001)).toBe(true);
    }
  });

  it('moves the U layer through real intermediate geometry while the lower layers stay fixed', () => {
    const start = cubeMotionFrame();
    const middle = cubeMotionFrame({ angle: 37.5 });
    const base = (svg: string) => svg.match(/<g data-cube-base="fixed">([\s\S]*?)<\/g>/)![1];
    expect(base(middle)).toBe(base(start));
    expect(middle).not.toBe(start);
    expect(middle).not.toMatch(/transform="rotate/);
  });

  it('removes the UF edge from the cube when it flies, then reseats that same piece', () => {
    const initial = cubeMotionFrame();
    const airborne = cubeMotionFrame({ popOffset: [-1.08, -1.74] });
    expect(airborne).toContain('data-cube-piece="UF"');
    expect(airborne).toContain('fill-rule="evenodd"');
    expect(paintedStickers(airborne)).toHaveLength(27);
    expect(cubeMotionFrame({ popOffset: [0, 0] })).toBe(initial);
  });

  it('rejects unsupported moves and overlapping timelines rather than faking whole-cube spins', () => {
    const animate = (art: string) => art;
    expect(() => turningCube(animate, 108, { moves: ['R'], beats: [[10, 30]] })).toThrow('Unsupported');
    expect(() => turningCube(animate, 108, { beats: [[20, 50], [45, 70]] })).toThrow('non-overlapping');
    expect(() => turningCube(animate, 108, { pop: [40, 60, 80] })).toThrow('after the last turn');
    expect(() => turningCube(animate, 0)).toThrow('positive size');
    expect(() => cubeMotionFrame({ angle: NaN })).toThrow('finite angle');
  });
});
