import { afterEach, describe, expect, it, vi } from 'vitest';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import tweener from '@/app/[lang]/sim/engine/tweener';

function finishAllTweens(): void {
  let guard = 20;
  while (tweener.length > 0 && guard-- > 0) tweener.finish();
  if (tweener.length > 0) throw new Error('sim tweens did not drain');
}

afterEach(() => {
  finishAllTweens();
  vi.restoreAllMocks();
});

describe('NxN real-time catch-up', () => {
  it('finishes stale turns in place and animates only the newest turn', () => {
    const cube = new Cube(3);
    const expected = new Cube(3);
    try {
      expected.twister.setup('R U F D');
      const setupSpy = vi.spyOn(cube.twister, 'setup');
      cube.twister.push('R U', false, 1, 60);

      cube.twister.catchUpRealtime('F D', 'R U F D', 4.8);

      expect(cube.twister.length).toBe(0);
      expect(cube.twister.backlog).toBe(1);
      expect(cube.busy).toBe(true);
      expect(tweener.tweens).toHaveLength(1);
      expect(tweener.tweens[0].duration).toBe(4.8);
      expect(setupSpy).not.toHaveBeenCalled();

      finishAllTweens();
      expect(cube.serialize()).toBe(expected.serialize());
    } finally {
      finishAllTweens();
      cube.dispose();
      expected.dispose();
    }
  });

  it('supports wide turns, rotations and half turns without rebuilding', () => {
    const cube = new Cube(3);
    const expected = new Cube(3);
    try {
      expected.twister.setup("R U Rw2 x F'");
      cube.twister.push('R U', false, 1, 60);

      cube.twister.catchUpRealtime("Rw2 x F'", "R U Rw2 x F'", 4.8);

      expect(cube.twister.backlog).toBe(1);
      finishAllTweens();
      expect(cube.serialize()).toBe(expected.serialize());
    } finally {
      finishAllTweens();
      cube.dispose();
      expected.dispose();
    }
  });

  it('does not finish an animation owned by another cube', () => {
    const liveCube = new Cube(3);
    const otherCube = new Cube(3);
    try {
      liveCube.twister.push('R U', false, 1, 60);
      otherCube.twister.push('F U', false, 1, 60);
      expect(otherCube.twister.backlog).toBe(2);

      liveCube.twister.catchUpRealtime('F D', 'R U F D', 4.8);

      expect(otherCube.busy).toBe(true);
      expect(otherCube.twister.length).toBe(1);
      expect(otherCube.twister.backlog).toBe(2);
      expect(tweener.tweens).toHaveLength(2);
    } finally {
      finishAllTweens();
      liveCube.dispose();
      otherCube.dispose();
    }
  });

  it('falls back to the canonical full state for malformed input', () => {
    const cube = new Cube(3);
    const expected = new Cube(3);
    try {
      expected.twister.setup('R U F D');
      const setupSpy = vi.spyOn(cube.twister, 'setup');
      cube.twister.push('R U', false, 1, 60);

      cube.twister.catchUpRealtime('F ??? D', 'R U F D', 4.8);

      expect(cube.twister.backlog).toBe(0);
      expect(setupSpy).toHaveBeenCalledOnce();
      expect(cube.serialize()).toBe(expected.serialize());
    } finally {
      finishAllTweens();
      cube.dispose();
      expected.dispose();
    }
  });
});
