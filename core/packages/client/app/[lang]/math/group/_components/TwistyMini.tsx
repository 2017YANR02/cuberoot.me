'use client';

import { useState, useRef, useEffect } from 'react';

// Inline TwistyPlayer wrapper around cubing.js. Imported lazily (dynamic
// import of cubing/twisty) to keep first paint quick; each instance owns its
// own player. Shared by page.tsx and the lazy-loaded section modules.
export function TwistyMini({
  alg,
  setupAlg,
  visualization = '3D',
  onPlayerReady,
}: {
  alg: string;
  setupAlg?: string;
  visualization?: '2D' | '3D' | 'PG3D';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPlayerReady?: (player: any) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Ctor, setCtor] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onPlayerReady);
  readyRef.current = onPlayerReady;

  useEffect(() => {
    let cancelled = false;
    import('cubing/twisty').then((mod) => {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const C = (mod as any).TwistyPlayer;
      setCtor(() => C);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!Ctor || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const player = new Ctor({
      puzzle: '3x3x3',
      alg,
      experimentalSetupAlg: setupAlg ?? '',
      visualization,
      controlPanel: 'bottom-row',
      background: 'none',
      hintFacelets: 'none',
    });
    player.style.width = '100%';
    player.style.height = '100%';
    container.appendChild(player);
    readyRef.current?.(player);
  }, [Ctor, alg, setupAlg, visualization]);

  return <div ref={containerRef} className="gt-cube-host" />;
}
