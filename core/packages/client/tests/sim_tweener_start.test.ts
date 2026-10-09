import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tweener } from '@cuberoot/puzzle-render-core/engine/tweener';

afterEach(() => vi.unstubAllGlobals());

describe('shared animation loop startup', () => {
  it('starts once on the first tween and preserves elapsed-time and pause behavior', () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('requestAnimationFrame', raf);
    const clock = new Tweener();
    expect(raf).not.toHaveBeenCalled();

    const values: number[] = [];
    clock.tween(0, 1, 60, value => { values.push(value); return value === 1; });
    clock.tween(0, 1, 60, value => value === 1);
    expect(raf).toHaveBeenCalledTimes(1);
    frames.shift()!(100);
    expect(values).toEqual([]);
    frames.shift()!(600);
    expect(values).toEqual([0.75]);

    clock.paused = true;
    frames.shift()!(1100);
    expect(values).toEqual([0.75]);
    clock.paused = false;
    frames.shift()!(1600);
    expect(values).toEqual([0.75, 1]);
    expect(clock.length).toBe(0);
  });

  it('keeps headless manual ticks available while automatic advancement is paused', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const clock = new Tweener();
    clock.paused = true;
    const update = vi.fn((value: number) => value === 1);
    clock.tween(0, 1, 60, update);
    clock.update(30);
    expect(update).toHaveBeenLastCalledWith(0.75);
    clock.update(30);
    expect(update).toHaveBeenLastCalledWith(1);
    expect(clock.length).toBe(0);
  });
});
