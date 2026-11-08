import type { AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { LBL_LEFT_VIEW_YAW } from './content';

export const SIDE_VIEW_TURN_MS = 450;
export const SIDE_VIEW_HOLD_MS = 300;
export const SIDE_VIEW_PAUSE_MS = SIDE_VIEW_TURN_MS + SIDE_VIEW_HOLD_MS;

/** Fit the opening view change into the existing wait before playback. */
export function scheduleDemoPlay(
  getPlayer: () => AlgPlayerHandle | null,
  delay: number,
  turnLeft: boolean,
  canPlay: () => boolean,
  play: () => void,
) {
  const duration = turnLeft && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? SIDE_VIEW_TURN_MS : 0;
  let frame = 0;
  let timer = window.setTimeout(() => {
    if (!canPlay()) return;
    if (!duration) {
      play();
      return;
    }
    const start = performance.now();
    let previousYaw = 0;
    const tick = (now: number) => {
      if (!canPlay()) return;
      const progress = Math.min((now - start) / duration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const yaw = LBL_LEFT_VIEW_YAW * eased;
      getPlayer()?.orbitView?.(yaw - previousYaw, 0);
      previousYaw = yaw;
      if (progress < 1) frame = requestAnimationFrame(tick);
      else timer = window.setTimeout(() => { if (canPlay()) play(); }, SIDE_VIEW_HOLD_MS);
    };
    frame = requestAnimationFrame(tick);
  }, delay - (duration ? SIDE_VIEW_PAUSE_MS : 0));
  return () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
  };
}
