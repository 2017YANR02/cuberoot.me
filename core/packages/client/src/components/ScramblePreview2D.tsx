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
import { renderMegaScrambleSvg, DEFAULT_MEGA_COLORS } from '../pages/gen/mega_svg';
import { renderPyraScrambleSvg, PYRA_DEFAULT_COLORS } from '../pages/gen/pyraminx_svg';
import { renderSkewbScrambleSvg, SKEWB_DEFAULT_COLORS } from '../pages/gen/skewb_svg';
import { renderUnfoldedSvgForEvent, eventToCubeSize } from '../pages/gen/cube_unfolded_svg';
import { isShapeModEvent, shapeModSourceEvent } from '../utils/shapeModScramble';

// Shape mods (mirror_333 / fisher_333 / etc) share scramble + underlying cube
// state with their WCA source event — for preview purposes treat them as the
// source. (Visual sticker-shape differences are out of scope; we render the
// resulting cube state in WCA colors so users can verify the scramble.)
function previewSource(event: string): string {
  if (isShapeModEvent(event)) return shapeModSourceEvent(event) ?? event;
  return event;
}

const EVENT_TO_PUZZLE: Record<string, string> = {
  '222': '2x2x2',
  '333': '3x3x3', '333oh': '3x3x3', '333bf': '3x3x3', '333fm': '3x3x3', '333ft': '3x3x3',
  '333mbf': '3x3x3', '333mbo': '3x3x3',
  '444': '4x4x4', '444bf': '4x4x4',
  '555': '5x5x5', '555bf': '5x5x5',
  '666': '6x6x6',
  '777': '7x7x7',
  'pyram': 'pyraminx',
  'skewb': 'skewb',
  'sq1': 'square1',
  'minx': 'megaminx',
  'clock': 'clock',
  // 非 WCA(cubing.js twizzleEvents),走 TwistyPlayer 2D fallback
  'fto': 'fto',
  'master_tetraminx': 'master_tetraminx',
  'kilominx': 'kilominx',
  'redi_cube': 'redi_cube',
  'baby_fto': 'baby_fto',
};

export function eventHasScramblePreview(event: string): boolean {
  const eff = previewSource(event);
  if (eff in EVENT_TO_PUZZLE) return true;
  return eventToCubeSize(eff) !== null;  // covers `nxnN` synthetic ids
}

interface Props {
  /** WCA event id (e.g. '333', 'pyram'). */
  event: string;
  /** Scramble move sequence to apply as setup state. */
  scramble: string;
  /** Width/height in px. The 2D net naturally has ~2:1.5 aspect; cubing.js scales to fit. */
  size?: number;
  /** Tnoodle-style per-part color override. Honored when event ∈ {clock, sq1, minx}. */
  clockColors?: Record<string, string>;
  sq1Colors?: Record<string, string>;
  megaColors?: Record<string, string>;
}

/** Strip injected '\n' (mega cycles) and convert sq1 plain `1,0/-1,0` → `(1,0)/(-1,0)`. */
function normalizeAlg(puzzle: string, alg: string): string {
  const flat = alg.replace(/\s+/g, ' ').trim();
  if (puzzle !== 'square1') return flat;
  return flat.replace(/(-?\d+,-?\d+)/g, '($1)');
}

export function ScramblePreview2D({ event, scramble, size = 60, clockColors, sq1Colors, megaColors }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const eff = previewSource(event);
  const puzzle = EVENT_TO_PUZZLE[eff];

  // tnoodle-port branches — synchronous custom SVGs. Returns early.
  const customSvg = useMemo(() => {
    try {
      if (eff === 'clock') return renderClockScrambleSvg(scramble, clockColors ?? DEFAULT_CLOCK_COLORS);
      if (eff === 'sq1')   return renderSq1ScrambleSvg(scramble,   sq1Colors   ?? DEFAULT_SQ1_COLORS);
      if (eff === 'minx')  return renderMegaScrambleSvg(scramble,  megaColors  ?? DEFAULT_MEGA_COLORS);
      if (eff === 'pyram') return renderPyraScrambleSvg(scramble,  PYRA_DEFAULT_COLORS);
      if (eff === 'skewb') return renderSkewbScrambleSvg(scramble, SKEWB_DEFAULT_COLORS);
      if (eventToCubeSize(eff)) return renderUnfoldedSvgForEvent(eff, scramble);
      return null;
    } catch (err) {
      console.warn(`[ScramblePreview2D] ${event} (eff=${eff}) render failed`, err);
      return null;
    }
  }, [event, eff, scramble, clockColors, sq1Colors, megaColors]);

  useEffect(() => {
    // All WCA events now render via custom tnoodle-port SVGs above.
    // The TwistyPlayer effect below is dead code retained as a fallback
    // for any future puzzle that doesn't have a tnoodle port yet.
    if (customSvg) return;
    if (eff === 'clock' || eff === 'sq1' || eff === 'minx') return; // handled above
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
  // TwistyPlayer fallback path needs a puzzle id from EVENT_TO_PUZZLE.
  if (!puzzle) return null;
  return <div ref={hostRef} style={hostStyle} />;
}
