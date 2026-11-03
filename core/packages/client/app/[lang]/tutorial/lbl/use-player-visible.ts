import { useEffect, useState, type RefObject } from 'react';
import type { AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';

/** Keep the reserved player area transparent until setup and paint have settled. */
export function usePlayerVisible(player: RefObject<AlgPlayerHandle | null>, identity: string) {
  const [visibleIdentity, setVisibleIdentity] = useState<string | null>(null);
  useEffect(() => {
    let frame = 0;
    const wait = () => {
      if (!player.current || player.current.isUserMovePending?.()) {
        frame = requestAnimationFrame(wait);
        return;
      }
      // Readiness is reported before the renderer's next frame. Allow that
      // frame to paint before revealing it, without an arbitrary time delay.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setVisibleIdentity(identity));
      });
    };
    frame = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(frame);
  }, [player, identity]);
  return visibleIdentity === identity;
}
