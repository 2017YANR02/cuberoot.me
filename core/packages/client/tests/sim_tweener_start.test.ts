import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tweener } from '@cuberoot/puzzle-render-core/engine/tweener';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('shared animation loop startup', () => {
  it('starts once on the first tween and preserves elapsed-time and pause behavior', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
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

it('never charges a new tween for main-thread time before its creation', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', undefined);
  const clock = new Tweener();
  clock.loop(0);
  now = 75;
  const values: number[] = [];
  clock.tween(0, 1, 4.8, v => { values.push(v); return v === 1; }, 'linear');
  now = 80;
  clock.loop(now);
  expect(values).toEqual([0.0625]);
});

it('advances before both views draw and defers a newly queued tween until the next frame', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', undefined);
  const clock = new Tweener();
  const order: string[] = [];
  clock.tween(0, 1, 0.6, v => {
    order.push('turn');
    if (v === 1) clock.tween(0, 1, 0.6, () => { order.push('next'); return true; });
    return v === 1;
  });
  const a = clock.subscribeFrame(() => order.push('view-a'));
  const b = clock.subscribeFrame(() => order.push('view-b'));
  now = 10;
  clock.loop(now);
  expect(order).toEqual(['turn', 'view-a', 'view-b']);
  order.length = 0; now = 20; clock.loop(now);
  expect(order).toEqual(['next', 'view-a', 'view-b']);
  a(); b();
});

it('sleeps with no animations or views and wakes for the next turn', () => {
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const clock = new Tweener();
  clock.tween(0, 1, 0.6, v => v === 1);
  frames.shift()!(10);
  expect(frames).toHaveLength(0);
  clock.tween(0, 1, 1, v => v === 1);
  expect(frames).toHaveLength(1);
  clock.finish();
});
