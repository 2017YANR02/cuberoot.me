/**
 * Static 2D scramble preview backed by cubing.js's <twisty-player>.
 *
 * Used for puzzles whose homemade SVG renderers were inaccurate (megaminx,
 * sq1, clock, pyraminx, skewb). NxN cubes still go through CubeNet — that
 * renderer was visually correct.
 *
 * cubing.js ships TwistyPlayer as a Custom Element. We mount it imperatively
 * inside a host <div>; React never owns the element's children. Backside is
 * hidden, control panel hidden, no animation — we just show the end-of-alg
 * pattern.
 */

import { useEffect, useRef, type JSX } from 'react';
import type { EventId } from '../types.ts';
import { TwistyPlayer, type PuzzleID } from 'cubing/twisty';

interface CubingPreviewProps {
  event: EventId;
  scramble: string;
  /** Approximate cell size in px, matching CubeNet's `size` prop semantics. */
  size?: number;
  className?: string;
}

/** Map our event ids to cubing.js puzzle ids. Returns null if unsupported. */
function puzzleIdForEvent(event: EventId): PuzzleID | null {
  switch (event) {
    case '222': return '2x2x2';
    case '333': return '3x3x3';
    case '444': return '4x4x4';
    case '555': return '5x5x5';
    case '666': return '6x6x6';
    case '777': return '7x7x7';
    case 'mega': return 'megaminx';
    case 'pyra': return 'pyraminx';
    case 'skewb': return 'skewb';
    case 'sq1': return 'square1';
    case 'clock': return 'clock';
    default: return null;
  }
}

/**
 * Approximate display dimensions chosen to roughly match the old SVG nets'
 * footprint at the same `size` value, so callers don't have to retune layouts.
 */
function dimensionsFor(puzzle: PuzzleID, size: number): { w: number; h: number } {
  switch (puzzle) {
    case '2x2x2': return { w: size * 8,  h: size * 6 };
    case '3x3x3': return { w: size * 12, h: size * 9 };
    case '4x4x4': return { w: size * 16, h: size * 12 };
    case '5x5x5': return { w: size * 20, h: size * 15 };
    case '6x6x6': return { w: size * 24, h: size * 18 };
    case '7x7x7': return { w: size * 28, h: size * 21 };
    case 'megaminx': return { w: size * 18, h: size * 12 };
    case 'pyraminx': return { w: size * 12, h: size * 10 };
    case 'skewb':    return { w: size * 12, h: size * 9 };
    case 'square1':  return { w: size * 10, h: size * 7 };
    case 'clock':    return { w: size * 14, h: size * 7 };
    default:         return { w: size * 12, h: size * 9 };
  }
}

export default function CubingPreview(props: CubingPreviewProps): JSX.Element {
  const { event, scramble, className } = props;
  const size = props.size ?? 14;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);
  const prevPuzzleRef = useRef<PuzzleID | null>(null);

  const puzzle = puzzleIdForEvent(event);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !puzzle) return;

    if (!playerRef.current) {
      const player = new TwistyPlayer({
        puzzle,
        alg: scramble,
        visualization: '2D',
        background: 'none',
        controlPanel: 'none',
        backView: 'none',
        hintFacelets: 'none',
        viewerLink: 'none',
      });
      player.style.width = '100%';
      player.style.height = '100%';
      player.style.display = 'block';
      host.appendChild(player);
      playerRef.current = player;
      prevPuzzleRef.current = puzzle;
    } else {
      const player = playerRef.current;
      // TwistyPlayer disallows reading `.puzzle`; track in a ref ourselves.
      if (prevPuzzleRef.current !== puzzle) {
        player.puzzle = puzzle;
        prevPuzzleRef.current = puzzle;
      }
      try {
        player.alg = scramble;
      } catch {
        // Invalid alg for this puzzle — leave the previous state.
      }
    }
  }, [puzzle, scramble]);

  // Tear down on unmount so we don't leak the underlying element / workers.
  useEffect(() => {
    return () => {
      const player = playerRef.current;
      if (player && player.parentNode) {
        player.parentNode.removeChild(player);
      }
      playerRef.current = null;
    };
  }, []);

  if (!puzzle) {
    // Caller shouldn't route unsupported events through here, but be safe.
    return <div className={className} style={{ display: 'none' }} aria-hidden />;
  }

  const { w, h } = dimensionsFor(puzzle, size);
  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: w, height: h, display: 'block' }}
      role="img"
      aria-label={`${event} scramble preview`}
    />
  );
}
