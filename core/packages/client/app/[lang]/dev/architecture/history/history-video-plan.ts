import { HISTORY_LAST, HISTORY_SPACING, HISTORY_WALK_SPEED } from './history-days';

export const HISTORY_VIDEO_FPS = 30;
export const HISTORY_VIDEO_SPEEDS = [1, 2, 5, 10] as const;

export function historyVideoPlan(start: number, end: number, speed: number) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > HISTORY_LAST || start > end) throw new Error('range');
  if (!HISTORY_VIDEO_SPEEDS.some(value => value === speed)) throw new Error('speed');
  const travelFrames = Math.ceil((end - start) * HISTORY_SPACING / (HISTORY_WALK_SPEED * speed) * HISTORY_VIDEO_FPS);
  const intro = HISTORY_VIDEO_FPS / 2;
  const totalFrames = travelFrames ? intro + travelFrames + HISTORY_VIDEO_FPS + 1 : HISTORY_VIDEO_FPS * 3;
  const duration = totalFrames / HISTORY_VIDEO_FPS;
  if (duration > 30 * 60) throw new Error('duration');
  return {
    totalFrames, duration,
    positionAt(frame: number) {
      const fraction = travelFrames ? Math.min(1, Math.max(0, (frame - intro) / travelFrames)) : 0;
      return start + (end - start) * fraction;
    },
  };
}
