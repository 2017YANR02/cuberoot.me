/**
 * Static 2D unfolded WCA scramble preview — wraps cubing.js TwistyPlayer in
 * `visualization: '2D'` mode. cubing.js's 2D renderer handles all WCA puzzles
 * with the official white-top / green-front colour scheme; no per-puzzle
 * facelet handling here.
 *
 * Used by /scramble/gen for the per-scramble thumbnail. Lazy-imports
 * cubing/twisty so the bundle cost is paid once.
 *
 * Clock special case: when `event === 'clock'` we bypass TwistyPlayer and
 * render via `renderClockScrambleSvg` (tnoodle ClockPuzzle.java port),
 * because cubing.js's clock visualization isn't recolorable per-part.
 */
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { renderClockScrambleSvg, DEFAULT_CLOCK_COLORS } from '../pages/gen/clock_svg';
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS } from '../pages/gen/sq1_svg';

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
  /** Tnoodle-style per-part color override. Honored when event ∈ {clock, sq1}. */
  clockColors?: Record<string, string>;
  sq1Colors?: Record<string, string>;
}

/** sq1 plain `1,0/-1,0` → `(1,0)/(-1,0)` for cubing.js parser. */
function normalizeAlg(puzzle: string, alg: string): string {
  if (puzzle !== 'square1') return alg;
  return alg.replace(/(-?\d+,-?\d+)/g, '($1)');
}

export function ScramblePreview2D({ event, scramble, size = 60, clockColors, sq1Colors }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const puzzle = EVENT_TO_PUZZLE[event];

  // tnoodle-port branches — synchronous custom SVGs. Returns early.
  const customSvg = useMemo(() => {
    try {
      if (event === 'clock') return renderClockScrambleSvg(scramble, clockColors ?? DEFAULT_CLOCK_COLORS);
      if (event === 'sq1') return renderSq1ScrambleSvg(scramble, sq1Colors ?? DEFAULT_SQ1_COLORS);
      return null;
    } catch (err) {
      console.warn(`[ScramblePreview2D] ${event} render failed`, err);
      return null;
    }
  }, [event, scramble, clockColors, sq1Colors]);

  useEffect(() => {
    if (event === 'clock' || event === 'sq1') return; // handled above
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

  if (customSvg) {
    return (
      <div
        style={hostStyle}
        // SVG content is generated locally from a small whitelisted template, no user HTML.
        dangerouslySetInnerHTML={{ __html: customSvg }}
      />
    );
  }
  return <div ref={hostRef} style={hostStyle} />;
}
