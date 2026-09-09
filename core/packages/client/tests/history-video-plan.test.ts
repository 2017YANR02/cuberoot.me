import { describe, expect, it } from 'vitest';
import { HISTORY_GAITS, HISTORY_LAST, HISTORY_SPACING, HISTORY_WALK_SPEED, type HistoryGait } from '@/app/[lang]/dev/architecture/history/history-days';
import { HISTORY_VIDEO_FPS, historyVideoPlan } from '@/app/[lang]/dev/architecture/history/history-video-plan';

describe('history video journey', () => {
  it('holds the first date, walks forward at the live speed and includes the final date', () => {
    const plan = historyVideoPlan(3, 5, 1);
    expect(plan.positionAt(0)).toBe(3);
    expect(plan.positionAt(15)).toBe(3);
    expect(plan.positionAt(plan.totalFrames - 1)).toBe(5);
    const travelFrames = Math.ceil(2 * HISTORY_SPACING / HISTORY_WALK_SPEED * HISTORY_VIDEO_FPS);
    expect(plan.totalFrames).toBe(15 + travelFrames + 31);
    let previous = 3;
    for (let frame = 0; frame < plan.totalFrames; frame++) {
      const value = plan.positionAt(frame);
      expect(value >= previous && value <= 5).toBe(true);
      previous = value;
    }
  });

  it('covers every recorded day at 10x without silently cutting off the end', () => {
    const plan = historyVideoPlan(0, HISTORY_LAST, 10);
    const visited = new Set(Array.from({ length: plan.totalFrames }, (_, frame) => Math.round(plan.positionAt(frame))));
    expect([...visited]).toEqual(Array.from({ length: HISTORY_LAST + 1 }, (_, index) => index));
    expect(plan.positionAt(plan.totalFrames - 1)).toBe(HISTORY_LAST);
  });

  it('creates a three second animated view for a single date', () => {
    const plan = historyVideoPlan(HISTORY_LAST, HISTORY_LAST, 5);
    expect(plan.duration).toBe(3);
    expect(plan.totalFrames).toBe(90);
    expect(plan.positionAt(89)).toBe(HISTORY_LAST);
  });

  it.each([1, 2, 5, 10])('exports running at twice the walking speed with the same endpoints at %sx', speed => {
    const plan = historyVideoPlan(3, 5, speed, 'run');
    const travelFrames = Math.ceil(2 * HISTORY_SPACING / (HISTORY_GAITS.run.speed * speed) * HISTORY_VIDEO_FPS);
    expect(plan.totalFrames).toBe(15 + travelFrames + 31);
    expect(plan.positionAt(0)).toBe(3);
    expect(plan.positionAt(plan.totalFrames - 1)).toBe(5);
    expect(Math.abs((historyVideoPlan(3, 5, speed).totalFrames - 46) / 2 - travelFrames)).toBeLessThanOrEqual(.5);
    let previous = 3;
    for (let frame = 0; frame < plan.totalFrames; frame++) {
      const position = plan.positionAt(frame);
      expect(position >= previous && position <= 5).toBe(true);
      previous = position;
    }
    expect(historyVideoPlan(5, 5, speed, 'run').duration).toBe(3);
  });

  it('rejects an unsupported travel style', () => {
    expect(() => historyVideoPlan(0, 1, 1, 'fly' as HistoryGait)).toThrow('gait');
  });

  it.each([[-1, 2, 1], [4, 3, 1], [0, HISTORY_LAST + 1, 1], [0.5, 2, 1], [NaN, 2, 1]])('rejects invalid date indices (%s, %s)', (start, end, speed) => {
    expect(() => historyVideoPlan(start, end, speed)).toThrow('range');
  });

  it.each([0, -1, 3, Infinity, NaN])('rejects unsupported speed %s', speed => {
    expect(() => historyVideoPlan(0, 1, speed)).toThrow('speed');
  });

  it('requires a shorter range or faster speed for videos over thirty minutes', () => {
    expect(() => historyVideoPlan(0, HISTORY_LAST, 1)).toThrow('duration');
    expect(() => historyVideoPlan(0, HISTORY_LAST, 5)).not.toThrow();
  });
});
