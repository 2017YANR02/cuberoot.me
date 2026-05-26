'use client';

/**
 * Minimal 3x3 2D scramble preview using cubing.js TwistyPlayer (visualization=2D).
 * Standalone — does NOT require the scramble-display npm package or sq1/mega SVG renderers.
 * Solver only needs 3x3, so this is sufficient.
 */

import { useEffect, useRef, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwistyPlayerCtor = new (init: Record<string, unknown>) => any;

export default function CubingPreview2D({ scramble, size = 14, className }: { scramble: string; size?: number; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [Ctor, setCtor] = useState<TwistyPlayerCtor | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (Ctor) return;
    import('cubing/twisty').then((mod) => {
      const C = (mod as unknown as { TwistyPlayer?: TwistyPlayerCtor; default?: TwistyPlayerCtor }).TwistyPlayer
        ?? (mod as unknown as { default?: TwistyPlayerCtor }).default;
      if (C) setCtor(() => C);
    }).catch((err) => console.warn('cubing/twisty load failed', err));
  }, [Ctor]);

  useEffect(() => {
    if (!Ctor || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const player = new Ctor({
      puzzle: '3x3x3',
      experimentalSetupAlg: scramble,
      visualization: '2D',
      background: 'none',
      controlPanel: 'none',
      hintFacelets: 'none',
    });
    playerRef.current = player;
    const w = size * 8;
    const h = size * 6;
    player.style.width = `${w}px`;
    player.style.height = `${h}px`;
    container.appendChild(player);
    return () => {
      playerRef.current = null;
    };
  }, [Ctor, size]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    try { player.experimentalSetupAlg = scramble; } catch { /* */ }
  }, [scramble]);

  return <div ref={containerRef} className={className} />;
}
