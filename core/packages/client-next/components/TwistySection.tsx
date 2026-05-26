'use client';

/**
 * Minimal port of packages/client/src/components/TwistySection.tsx for client-next.
 * Strips face-overlay / drag-commit / pyraminx tip / skewb pointer handling —
 * those are only needed by /sim. The analyzer only needs scramble + alg playback
 * for 3x3x3, which is what this version covers.
 */

import { useEffect, useRef, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwistyPlayerCtor = new (init: Record<string, unknown>) => any;

export default function TwistySection({
  puzzle, scramble, alg, fillPane = false,
}: {
  puzzle: string;
  scramble: string;
  alg: string;
  fillPane?: boolean;
}) {
  const [Ctor, setCtor] = useState<TwistyPlayerCtor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerInstRef = useRef<any>(null);

  useEffect(() => {
    if (!Ctor) {
      import('cubing/twisty').then((mod) => {
        const C = (mod as unknown as { TwistyPlayer?: TwistyPlayerCtor; default?: TwistyPlayerCtor }).TwistyPlayer
          ?? (mod as unknown as { default?: TwistyPlayerCtor }).default;
        if (C) setCtor(() => C);
      }).catch((err) => console.warn('Failed to load cubing library:', err));
    }
  }, [Ctor]);

  useEffect(() => {
    if (!Ctor || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const player = new Ctor({
      puzzle,
      experimentalSetupAlg: scramble,
      alg,
      controlPanel: 'bottom-row',
    });
    playerInstRef.current = player;
    player.style.colorScheme = 'light';
    if (fillPane) {
      const syncSize = () => {
        const w = container.offsetWidth;
        const h = container.offsetHeight;
        if (w > 0 && h > 0) {
          player.style.width = `${w}px`;
          player.style.height = `${h}px`;
        }
      };
      syncSize();
      const ro = new ResizeObserver(syncSize);
      ro.observe(container);
      container.appendChild(player);
      return () => {
        ro.disconnect();
        playerInstRef.current = null;
      };
    }
    player.style.width = '100%';
    player.style.maxWidth = '400px';
    player.style.margin = '12px 0';
    container.appendChild(player);
    return () => {
      playerInstRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Ctor, puzzle, fillPane]);

  useEffect(() => {
    const player = playerInstRef.current;
    if (!player) return;
    try { player.alg = alg; } catch { /* parser rejected */ }
  }, [alg]);

  useEffect(() => {
    const player = playerInstRef.current;
    if (!player) return;
    try { player.experimentalSetupAlg = scramble; } catch { /* ignore */ }
  }, [scramble]);

  return (
    <div className={`twisty-section${fillPane ? ' twisty-section--fill' : ''}`}>
      <div ref={containerRef} className="twisty-container" />
    </div>
  );
}
