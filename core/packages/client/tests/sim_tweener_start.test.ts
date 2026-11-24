import { afterEach, describe, expect, it, vi } from 'vitest';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import tweener, { Tweener } from '@cuberoot/puzzle-render-core/engine/tweener';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('shared animation loop startup', () => {
  it('pauses one tween without stopping another or charging paused time on resume', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', undefined);
    const clock = new Tweener();
    const pausedValues: number[] = [], otherValues: number[] = [];
    const first = clock.tween(0, 1, 60, v => { pausedValues.push(v); return v === 1; }, 'linear');
    clock.tween(0, 1, 60, v => { otherValues.push(v); return v === 1; }, 'linear');
    now = 250; clock.loop(now);
    expect(pausedValues).toEqual([.25]);
    first.setPaused(true);
    now = 1250; clock.loop(now);
    expect(pausedValues).toEqual([.25]);
    expect(otherValues).toEqual([.25, 1]);
    now = 5000; first.setPaused(false);
    now = 5250; clock.loop(now);
    expect(pausedValues).toEqual([.25, .5]);
    now = 5750; clock.loop(now);
    expect(pausedValues).toEqual([.25, .5, 1]);
    expect(clock.length).toBe(0);
  });
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

it('keeps the same layer angle in two comparison views through a pause and resume', () => {
  vi.stubGlobal('requestAnimationFrame', undefined);
  let now = 100;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const before = new Cube(2), after = new Cube(2);
  const angle = (cube: Cube) => cube.table.groups.x[1].angle;
  try {
    const start = now;
    for (const cube of [before, after]) {
      now += 5;
      expect(cube.twister.twist(new TwistAction('R'), false, false, 60, 'linear', start)).toBe(true);
    }
    tweener.loop(350);
    const pausedAt = angle(before);
    expect(Math.abs(pausedAt)).toBeCloseTo(Math.PI / 8);
    expect(angle(after)).toBe(pausedAt);
    for (const cube of [before, after]) cube.twister.setAnimationPaused(true, 350);
    tweener.loop(850);
    expect([angle(before), angle(after)]).toEqual([pausedAt, pausedAt]);
    const resume = now = 1000;
    for (const cube of [before, after]) {
      now += 5;
      cube.twister.setAnimationPaused(false, resume);
    }
    tweener.loop(1250);
    expect(Math.abs(angle(before))).toBeCloseTo(Math.PI / 4);
    expect(angle(after)).toBe(angle(before));
    tweener.loop(1750);
    expect(before.busy || after.busy).toBe(false);
    expect(before.serialize()).toBe(after.serialize());
  } finally {
    for (const cube of [before, after]) { cube.table.groups.x[1].finish(); cube.dispose(); }
  }
});
