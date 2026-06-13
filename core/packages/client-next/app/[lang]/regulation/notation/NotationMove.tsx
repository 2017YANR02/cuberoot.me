'use client';

// A single looping 3D move demo tile for the Notation chapter.
//
// Lazy-imports cubing/twisty TwistyPlayer (same skeleton as
// components/CubingPreview.tsx) and renders a small cube that continuously
// LOOPS one move so the reader can see exactly what that symbol does. Tapping a
// tile replays immediately. A whole grid of these is the centrepiece of the
// page, so the loop + cleanup must be tight (no leaked players / intervals).

import { useEffect, useRef, useState, type ReactNode } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TwistyPlayerCtor = new (init: Record<string, unknown>) => any;

// Module-level cache so every tile on the page shares one import of the (heavy)
// cubing/twisty bundle instead of resolving the dynamic import N times.
let ctorPromise: Promise<TwistyPlayerCtor | null> | null = null;
function loadCtor(): Promise<TwistyPlayerCtor | null> {
  if (!ctorPromise) {
    ctorPromise = import('cubing/twisty')
      .then((mod) => {
        const C = (mod as unknown as { TwistyPlayer?: TwistyPlayerCtor; default?: TwistyPlayerCtor }).TwistyPlayer
          ?? (mod as unknown as { default?: TwistyPlayerCtor }).default;
        return C ?? null;
      })
      .catch((err) => {
        console.warn('[NotationMove] cubing/twisty load failed', err);
        return null;
      });
  }
  return ctorPromise;
}

export interface NotationMoveProps {
  /** cubing.js puzzle id, e.g. '3x3x3', '4x4x4', 'megaminx', 'pyraminx', 'skewb'. */
  puzzle: string;
  /** The alg to animate (one move, e.g. "R", "Rw", "x", "R++"). */
  move: string;
  /** Big mono symbol shown above the cube (defaults to `move`). */
  symbol?: ReactNode;
  /** Short caption under the cube. */
  caption?: ReactNode;
  /** Loop period in ms (how often the move replays). */
  periodMs?: number;
}

export default function NotationMove({
  puzzle, move, symbol, caption, periodMs = 1800,
}: NotationMoveProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [Ctor, setCtor] = useState<TwistyPlayerCtor | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  // Lazy-load the constructor (shared module-level promise).
  useEffect(() => {
    if (Ctor) return;
    let cancelled = false;
    loadCtor().then((C) => { if (!cancelled && C) setCtor(() => C); });
    return () => { cancelled = true; };
  }, [Ctor]);

  // Build the player + start the loop. Rebuild only when ctor/puzzle/move change.
  useEffect(() => {
    if (!Ctor || !hostRef.current) return;
    const host = hostRef.current;
    host.innerHTML = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    try {
      player = new Ctor({
        puzzle,
        alg: move,
        experimentalSetupAlg: '',
        background: 'none',
        controlPanel: 'none',
        hintFacelets: 'none',
        tempoScale: 1.2,
      });
      playerRef.current = player;
      player.style.width = '100%';
      player.style.height = '100%';
      host.appendChild(player);

      const replay = () => {
        try { player.timestamp = 0; player.play?.(); } catch { /* ignore */ }
      };
      // Kick off immediately, then re-trigger on an interval so it keeps looping.
      try { player.play?.(); } catch { /* ignore */ }
      timer = setInterval(replay, periodMs);
    } catch (err) {
      console.warn(`[NotationMove] init failed for ${puzzle} ${move}`, err);
    }

    return () => {
      if (timer) clearInterval(timer);
      playerRef.current = null;
      if (player && player.parentNode) player.parentNode.removeChild(player);
    };
  }, [Ctor, puzzle, move, periodMs]);

  const replayNow = () => {
    const player = playerRef.current;
    if (!player) return;
    try { player.timestamp = 0; player.play?.(); } catch { /* ignore */ }
  };

  return (
    <figure
      className="nt-tile"
      onClick={replayNow}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); replayNow(); } }}
      aria-label={typeof symbol === 'string' ? symbol : move}
    >
      <div className="nt-sym">{symbol ?? move}</div>
      <div ref={hostRef} className="nt-cube" aria-hidden="true" />
      {caption != null && <figcaption className="nt-cap">{caption}</figcaption>}
    </figure>
  );
}
