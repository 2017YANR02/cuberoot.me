import { describe, expect, it } from 'vitest';
import { HISTORY_GAITS, HISTORY_LAST, HISTORY_SPACING, HISTORY_WALK_SPEED, type HistoryGait } from '@/app/[lang]/dev/architecture/history/history-days';
import { HISTORY_VIDEO_FPS, historyVideoPlan } from '@/app/[lang]/dev/architecture/history/history-video-plan';

describe('history video journey', () => {
  it('holds the first date, walks forward at the live speed and includes the final date', () => {
    const plan = historyVideoPlan(3, 5, 'walk');
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

  it('covers every recorded day while gliding without silently cutting off the end', () => {
    const plan = historyVideoPlan(0, HISTORY_LAST, 'glide');
    const visited = new Set(Array.from({ length: plan.totalFrames }, (_, frame) => Math.round(plan.positionAt(frame))));
    expect([...visited]).toEqual(Array.from({ length: HISTORY_LAST + 1 }, (_, index) => index));
    expect(plan.positionAt(plan.totalFrames - 1)).toBe(HISTORY_LAST);
  });

  it('creates a three second animated view for a single date', () => {
    const plan = historyVideoPlan(HISTORY_LAST, HISTORY_LAST, 'run');
    expect(plan.duration).toBe(3);
    expect(plan.totalFrames).toBe(90);
    expect(plan.positionAt(89)).toBe(HISTORY_LAST);
  });

  it.each(['walk', 'jog', 'run', 'glide'] as HistoryGait[])('exports %s at its live speed with the same endpoints', gait => {
    const plan = historyVideoPlan(3, 5, gait);
    const travelFrames = Math.ceil(2 * HISTORY_SPACING / HISTORY_GAITS[gait].speed * HISTORY_VIDEO_FPS);
    expect(plan.totalFrames).toBe(15 + travelFrames + 31);
    expect(plan.positionAt(0)).toBe(3);
    expect(plan.positionAt(plan.totalFrames - 1)).toBe(5);
    let previous = 3;
    for (let frame = 0; frame < plan.totalFrames; frame++) {
      const position = plan.positionAt(frame);
      expect(position >= previous && position <= 5).toBe(true);
      previous = position;
    }
    expect(historyVideoPlan(5, 5, gait).duration).toBe(3);
  });

  it.each(['fly', 'constructor', 'toString', '', 10])('rejects unsupported travel style %s', gait => {
    expect(() => historyVideoPlan(0, 1, gait as HistoryGait)).toThrow('gait');
  });

  it.each([[-1, 2], [4, 3], [0, HISTORY_LAST + 1], [0.5, 2], [NaN, 2]])('rejects invalid date indices (%s, %s)', (start, end) => {
    expect(() => historyVideoPlan(start, end, 'walk')).toThrow('range');
  });

  it('requires a shorter range or faster speed for videos over thirty minutes', () => {
    expect(() => historyVideoPlan(0, HISTORY_LAST, 'walk')).toThrow('duration');
    expect(() => historyVideoPlan(0, HISTORY_LAST, 'run')).not.toThrow();
  });
});
