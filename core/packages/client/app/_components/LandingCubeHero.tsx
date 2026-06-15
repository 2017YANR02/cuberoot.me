'use client';

// Decorative 3D cube on the Landing-page Trainer hero card.
// Lazy-loads cubing/twisty; no controls; auto-loops a slow alg.
// Falls back to a static lucide Box icon if the import fails.

import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';

export default function LandingCubeHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Ctor, setCtor] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    import('cubing/twisty').then((mod) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const C = (mod as any).TwistyPlayer || (mod as any).default;
      setCtor(() => C);
    }).catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!Ctor || !containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';

    const player = new Ctor({
      puzzle: '3x3x3',
      alg: "S' U' M' y2",
      controlPanel: 'none',
      background: 'none',
      hintFacelets: 'none',
      visualization: 'PG3D',
      tempoScale: 0.6,
    });
    player.style.width = '100%';
    player.style.height = '100%';
    container.appendChild(player);

    const start = () => { try { player.play(); } catch { /* destroyed */ } };
    start();
    const timer = setInterval(() => {
      try {
        const tl = player.timeline;
        if (tl && typeof tl.timestamp === 'number' && typeof tl.maxTimestamp === 'number') {
          if (tl.timestamp >= tl.maxTimestamp - 100) {
            tl.timestamp = 0;
            player.play();
          }
        }
      } catch { /* ignore */ }
    }, 500);

    return () => {
      clearInterval(timer);
      container.innerHTML = '';
    };
  }, [Ctor]);

  useEffect(() => {
    const slot = containerRef.current;
    if (!slot) return;
    let startX = 0, startY = 0, dragged = false;
    const onMove = (m: PointerEvent) => {
      if ((m.clientX - startX) ** 2 + (m.clientY - startY) ** 2 > 16) dragged = true;
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
    };
    const onDown = (e: PointerEvent) => {
      startX = e.clientX; startY = e.clientY; dragged = false;
      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onUp, true);
    };
    const onClick = (e: MouseEvent) => {
      if (dragged) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dragged = false;
      }
    };
    slot.addEventListener('pointerdown', onDown, true);
    slot.addEventListener('click', onClick, true);
    return () => {
      slot.removeEventListener('pointerdown', onDown, true);
      slot.removeEventListener('click', onClick, true);
      onUp();
    };
  }, [failed]);

  if (failed) {
    return (
      <div className="cube-hero-fallback">
        <Box size={48} strokeWidth={1.5} />
      </div>
    );
  }

  return <div ref={containerRef} className="cube-hero-slot" />;
}
