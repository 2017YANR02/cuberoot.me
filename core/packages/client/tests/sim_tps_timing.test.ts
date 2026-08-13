import { afterEach, describe, expect, it } from 'vitest';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { TwistAction } from '@/app/[lang]/sim/engine/nxn/twister';
import ClockBoard from '@/app/[lang]/sim/engine/clock/clockBoard';
import tweener, { Tween } from '@/app/[lang]/sim/engine/tweener';
import { timing } from '@/app/[lang]/sim/engine/tweenTiming';
import {
  elapsedMsToSimTicks,
  simSpeedToTicks,
  simSpeedToTps,
  simStepDurationMs,
  simTpsToSpeed,
  uniformSimTimeline,
} from '@/lib/sim_timing';

afterEach(() => {
  tweener.finish();
  timing.frames = 30;
});

describe('sim TPS timing', () => {
  it('maps the slider to exact bounded TPS durations', () => {
    expect(simSpeedToTicks(0)).toBe(120);
    expect(simSpeedToTps(0)).toBe(0.5);
    expect(simStepDurationMs(0.5)).toBe(2000);
    expect(simSpeedToTicks(100)).toBe(10);
    expect(simSpeedToTps(100)).toBe(6);
    expect(simStepDurationMs(6)).toBeCloseTo(1000 / 6);
    expect(simTpsToSpeed(0.5)).toBe(0);
    expect(simTpsToSpeed(6)).toBe(100);
    expect(simSpeedToTicks(Number.NaN)).toBe(65);
  });

  it('finishes at the same elapsed time at 60 Hz and 240 Hz', () => {
    const run = (hz: number): number => {
      let elapsedMs = 0;
      const tween = new Tween(0, 1, 60, (v) => v >= 1);
      while (elapsedMs < 2000) {
        const frameMs = 1000 / hz;
        elapsedMs += frameMs;
        if (tween.update(elapsedMsToSimTicks(frameMs))) return elapsedMs;
      }
      throw new Error('tween did not finish');
    };

    expect(run(60)).toBeCloseTo(1000, 8);
    expect(run(240)).toBeCloseTo(1000, 8);
  });

  it('gives U2, slices and rotations one NxN beat each', () => {
    timing.frames = 60;
    const cube = new Cube(3);
    try {
      for (const token of ['U', 'U2', 'M', 'E', 'S', 'x', 'y', 'z']) {
        expect(cube.twister.twist(new TwistAction(token), false, true), token).toBe(true);
        expect(tweener.tweens.length, token).toBeGreaterThan(0);
        expect(tweener.tweens.every((tween) => tween.duration === 60), token).toBe(true);
        tweener.finish();
      }
    } finally {
      cube.dispose();
    }
  });

  it('gives every shared non-NxN token one beat regardless of magnitude', () => {
    timing.frames = 60;
    const board = new ClockBoard();
    for (const token of ['UR1+', 'UR6+', 'y2']) {
      board.twister.push(token);
      expect(tweener.tweens).toHaveLength(1);
      expect(tweener.tweens[0].duration, token).toBe(60);
      board.twister.finish();
    }
  });

  it('builds a one-beat-per-leaf cubing.js timeline', () => {
    const leaves = ['U2', 'M', 'x'];
    expect(uniformSimTimeline(leaves)).toEqual([
      { animLeaf: 'U2', start: 0, end: 1000 },
      { animLeaf: 'M', start: 1000, end: 2000 },
      { animLeaf: 'x', start: 2000, end: 3000 },
    ]);
  });
});
