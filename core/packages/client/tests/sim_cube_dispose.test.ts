import { afterEach, describe, expect, it, vi } from 'vitest';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import tweener from '@/app/[lang]/sim/engine/tweener';

const cubes = new Set<Cube>();
function createCube() {
  const cube = new Cube(3);
  cubes.add(cube);
  return cube;
}
function dispose(cube: Cube) {
  cube.dispose();
  cubes.delete(cube);
}
afterEach(() => {
  // Isolate even an unfixed disposed callback, without executing it in cleanup.
  tweener.tweens.length = 0;
  for (const cube of cubes) cube.dispose();
  cubes.clear();
});

describe('NxN cube animation ownership on disposal', () => {
  it('can initialize a new live view after disposing an unfinished turn', () => {
    const old = createCube();
    old.twister.push('R U F');
    expect(old.busy).toBe(true);
    expect(old.twister.length).toBe(2);
    dispose(old);
    const next = createCube();
    expect(() => next.twister.setup('R U')).not.toThrow();
    expect(old.twister.length).toBe(0);
  });

  it('removes a pointer snap animation before its cube references are cleared', () => {
    const cube = createCube();
    const group = cube.table.groups.y[0];
    expect(group.drag()).toBe(true);
    group.angle = Math.PI / 8;
    expect(group.twist(Math.PI / 2, false)).toBe(true);
    expect(tweener.length).toBe(1);
    dispose(cube);
    expect(() => tweener.update(1)).not.toThrow();
    expect(tweener.length).toBe(0);
    expect(group.cubelets).toHaveLength(0);
  });

  it('leaves another cube animation running without finishing or canceling it', () => {
    const old = createCube();
    const other = createCube();
    const expected = createCube();
    expected.twister.setup('U');
    old.twister.push('R');
    other.twister.push('U');
    const survivingTween = tweener.tweens[1];
    expect(tweener.length).toBe(2);
    dispose(old);
    expect(tweener.tweens).toEqual([survivingTween]);
    expect(survivingTween.value).toBe(0);
    expect(other.busy).toBe(true);
    tweener.update(1);
    expect(survivingTween.value).toBe(1);
    tweener.finish();
    expect(other.busy).toBe(false);
    expect(other.serialize()).toBe(expected.serialize());
  });

  it.each(['.', '~'])('cancels a %s pause and its pending moves without callbacks', (pause) => {
    const cube = createCube();
    const callback = vi.fn();
    cube.callbacks.push(callback);
    cube.twister.push(`${pause} R U`);
    expect(tweener.length).toBe(1);
    expect(cube.twister.length).toBe(2);
    callback.mockClear();
    dispose(cube);
    expect(tweener.length).toBe(0);
    expect(cube.twister.length).toBe(0);
    tweener.finish();
    expect(callback).not.toHaveBeenCalled();
  });
});
