import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Alg } from 'cubing/alg';
import type { AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { sideTurn } from './alg-cues';
import { LBL_LEFT_VIEW_YAW } from './content';
import { SIDE_VIEW_TURN_MS } from './schedule-demo-play';

/** Use the player's existing section pause to turn the view between settled moves. */
export function useSideTurnView(player: RefObject<AlgPlayerHandle | null>, alg: string, step: number, ready: boolean, initialYaw = 0) {
  const yaw = useRef(initialYaw);
  const changes = useMemo(() => {
    const result = new Map<number, number>();
    let left = initialYaw !== 0;
    new Alg(alg).expand().toString().split(/\s+/).forEach((move, index) => {
      const side = sideTurn(move);
      if (side && (side === 'L') !== left) {
        left = side === 'L';
        result.set(index, left ? LBL_LEFT_VIEW_YAW : 0);
      }
    });
    return result;
  }, [alg, initialYaw]);
  const pauseSteps = useMemo(() => [...changes.keys()].filter(index => index > 0), [changes]);
  useEffect(() => { yaw.current = initialYaw; }, [alg, initialYaw]);
  useEffect(() => {
    if (!ready || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let target = initialYaw;
    for (const [index, value] of changes) {
      if (index > step) break;
      target = value;
    }
    if (target === yaw.current) return;
    let frame = 0;
    let start: number | undefined;
    const from = yaw.current;
    const tick = (now: number) => {
      if (start === undefined && player.current?.isUserMovePending?.(false)) {
        frame = requestAnimationFrame(tick);
        return;
      }
      start ??= now;
      const progress = Math.min((now - start) / SIDE_VIEW_TURN_MS, 1);
      const next = from + (target - from) * progress * progress * (3 - 2 * progress);
      player.current?.orbitView?.(next - yaw.current, 0);
      yaw.current = next;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [changes, player, ready, step, initialYaw]);
  return pauseSteps;
}
