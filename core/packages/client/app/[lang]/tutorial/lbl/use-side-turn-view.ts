import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Alg } from 'cubing/alg';
import type { AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { sideTurn } from './alg-cues';
import { LBL_LEFT_VIEW_YAW } from './content';
import { SIDE_VIEW_TURN_MS } from './schedule-demo-play';
import { DEFAULT_ALG_MOVE_DURATION_MS, resolveSimMoveDurationScale } from '@/components/AlgPlayer/player-setup';

/** Merge side-view adjustments into adjacent y turns; otherwise use the section pause. */
export function useSideTurnView(player: RefObject<AlgPlayerHandle | null>, alg: string, step: number, ready: boolean, initialYaw = 0, moveDurationMs = DEFAULT_ALG_MOVE_DURATION_MS) {
  const yaw = useRef(initialYaw);
  const moves = useMemo(() => new Alg(alg).expand().toString().split(/\s+/), [alg]);
  const changes = useMemo(() => {
    const result = new Map<number, number>();
    let left = initialYaw !== 0;
    moves.forEach((move, index) => {
      const side = sideTurn(move);
      if (side && (side === 'L') !== left) {
        left = side === 'L';
        result.set(index, left ? LBL_LEFT_VIEW_YAW : 0);
      }
    });
    return result;
  }, [moves, initialYaw]);
  // Step advances when a move starts: index is both the preceding rotation's
  // destination step and the next side turn's start. Orbit during that rotation.
  const combined = useMemo(() => new Set([...changes.keys()].filter(index => /^y(?:2)?'?$/.test(moves[index - 1] ?? ''))), [changes, moves]);
  const pauseSteps = useMemo(() => [...changes.keys()].filter(index => index > 0 && !combined.has(index)), [changes, combined]);
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
      if (start === undefined && !combined.has(step) && player.current?.isUserMovePending?.(false)) {
        frame = requestAnimationFrame(tick);
        return;
      }
      start ??= now;
      const duration = combined.has(step) ? moveDurationMs * resolveSimMoveDurationScale('3x3', moves[step - 1]) : SIDE_VIEW_TURN_MS;
      const progress = Math.min((now - start) / duration, 1);
      const eased = combined.has(step) ? 1 - (1 - progress) ** 2 : progress * progress * (3 - 2 * progress);
      const next = from + (target - from) * eased;
      player.current?.orbitView?.(next - yaw.current, 0);
      yaw.current = next;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [changes, combined, moves, moveDurationMs, player, ready, step, initialYaw]);
  return pauseSteps;
}
