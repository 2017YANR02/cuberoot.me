'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';

/** Hold the initial pose for two seconds after the simulator is ready. */
export function useStartInspection(enabled: boolean, player: RefObject<AlgPlayerHandle | null>, step: number) {
  const [inspecting, setInspecting] = useState(enabled);
  useEffect(() => {
    if (!inspecting || step > 0) return;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const waitForPlayer = () => {
      if (!player.current || player.current.isUserMovePending?.()) frame = requestAnimationFrame(waitForPlayer);
      else timer = setTimeout(() => setInspecting(false), 2000);
    };
    frame = requestAnimationFrame(waitForPlayer);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [inspecting, step, player]);
  return inspecting;
}
