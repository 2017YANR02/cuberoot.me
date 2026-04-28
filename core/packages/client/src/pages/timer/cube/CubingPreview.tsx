/**
 * Static scramble preview backed by cubing.js's <twisty-player> custom element.
 *
 * We create the element via document.createElement and set attributes — this
 * bypasses both:
 *   1. TwistyPlayer constructor's "Bad position … children of undefined"
 *      mid-life puzzle-swap bug;
 *   2. cubing.js's narrow JSX type for <twisty-player> (only puzzle/alg typed).
 *
 * Attributes are HTML-only (kebab-case). Importing 'cubing/twisty' as a side
 * effect registers the custom element via customElements.define.
 */

import { useEffect, useRef, type JSX } from 'react';
import type { EventId } from '../types.ts';
import 'cubing/twisty';

interface CubingPreviewProps {
  event: EventId;
  scramble: string;
  size?: number;
  className?: string;
}

type PuzzleID =
  | '2x2x2' | '3x3x3' | '4x4x4' | '5x5x5' | '6x6x6' | '7x7x7'
  | 'megaminx' | 'pyraminx' | 'skewb' | 'square1' | 'clock';

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

function dimensionsFor(puzzle: PuzzleID, size: number): { w: number; h: number } {
  switch (puzzle) {
    case '2x2x2':   return { w: size * 8,  h: size * 6 };
    case '3x3x3':   return { w: size * 12, h: size * 9 };
    case '4x4x4':   return { w: size * 16, h: size * 12 };
    case '5x5x5':   return { w: size * 20, h: size * 15 };
    case '6x6x6':   return { w: size * 24, h: size * 18 };
    case '7x7x7':   return { w: size * 28, h: size * 21 };
    case 'megaminx': return { w: size * 18, h: size * 12 };
    case 'pyraminx': return { w: size * 12, h: size * 10 };
    case 'skewb':    return { w: size * 12, h: size * 9 };
    case 'square1':  return { w: size * 14, h: size * 8 };
    case 'clock':    return { w: size * 14, h: size * 7 };
  }
}

export default function CubingPreview(props: CubingPreviewProps): JSX.Element {
  const { event, scramble, className } = props;
  const size = props.size ?? 14;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const puzzle = puzzleIdForEvent(event);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !puzzle) return;

    const player = document.createElement('twisty-player');
    player.setAttribute('puzzle', puzzle);
    player.setAttribute('alg', scramble);
    player.setAttribute('background', 'none');
    player.setAttribute('control-panel', 'none');
    player.setAttribute('back-view', 'none');
    player.setAttribute('hint-facelets', 'none');
    player.setAttribute('viewer-link', 'none');
    player.setAttribute('experimental-stickering', 'full');
    player.style.width = '100%';
    player.style.height = '100%';
    player.style.display = 'block';
    host.appendChild(player);

    return () => {
      if (player.parentNode) player.parentNode.removeChild(player);
    };
  }, [puzzle, scramble]);

  if (!puzzle) {
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
