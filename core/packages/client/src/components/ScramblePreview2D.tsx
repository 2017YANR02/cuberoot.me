/**
 * Static 2D unfolded WCA scramble preview — wraps cubing.js TwistyPlayer in
 * `visualization: '2D'` mode. cubing.js's 2D renderer handles all WCA puzzles
 * with the official white-top / green-front colour scheme; no per-puzzle
 * facelet handling here.
 *
 * Used by /scramble/gen for the per-scramble thumbnail. Lazy-imports
 * cubing/twisty so the bundle cost is paid once.
 */
import { useEffect, useRef, type CSSProperties } from 'react';

const EVENT_TO_PUZZLE: Record<string, string> = {
  '222': '2x2x2',
  '333': '3x3x3', '333oh': '3x3x3', '333bf': '3x3x3', '333fm': '3x3x3', '333mbf': '3x3x3',
  '444': '4x4x4', '444bf': '4x4x4',
  '555': '5x5x5', '555bf': '5x5x5',
  '666': '6x6x6',
  '777': '7x7x7',
  'pyram': 'pyraminx',
  'skewb': 'skewb',
  'sq1': 'square1',
  'minx': 'megaminx',
  'clock': 'clock',
};

export function eventHasScramblePreview(event: string): boolean {
  return event in EVENT_TO_PUZZLE;
}

interface Props {
  /** WCA event id (e.g. '333', 'pyram'). */
  event: string;
  /** Scramble move sequence to apply as setup state. */
  scramble: string;
  /** Width/height in px. The 2D net naturally has ~2:1.5 aspect; cubing.js scales to fit. */
  size?: number;
}

/** sq1 plain `1,0/-1,0` → `(1,0)/(-1,0)` for cubing.js parser. */
function normalizeAlg(puzzle: string, alg: string): string {
  if (puzzle !== 'square1') return alg;
  return alg.replace(/(-?\d+,-?\d+)/g, '($1)');
}

export function ScramblePreview2D({ event, scramble, size = 60 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const puzzle = EVENT_TO_PUZZLE[event];

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !puzzle) return;
    let cancelled = false;
    let player: HTMLElement | null = null;

    import('cubing/twisty').then((mod) => {
      if (cancelled || !host) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (mod as any).TwistyPlayer || (mod as any).default;
      try {
        player = new Ctor({
          puzzle,
          visualization: '2D',
          experimentalSetupAlg: normalizeAlg(puzzle, scramble),
          alg: '',
          controlPanel: 'none',
          background: 'none',
          hintFacelets: 'none',
          viewerLink: 'none',
        });
        if (player) {
          player.style.width = `${size * 2}px`;
          player.style.height = `${size * 1.5}px`;
          host.appendChild(player);
        }
      } catch (err) {
        console.warn(`[ScramblePreview2D] ${puzzle} failed: ${scramble}`, err);
      }
    }).catch((err) => console.warn('[ScramblePreview2D] load failed', err));

    return () => {
      cancelled = true;
      if (player && host.contains(player)) host.removeChild(player);
    };
  }, [puzzle, scramble, size]);

  if (!puzzle) return null;

  const hostStyle: CSSProperties = {
    width: size * 2,
    height: size * 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
  return <div ref={hostRef} style={hostStyle} />;
}
