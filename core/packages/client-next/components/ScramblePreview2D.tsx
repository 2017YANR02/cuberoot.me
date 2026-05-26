'use client';

/**
 * Static 2D unfolded WCA scramble preview — pure custom SVG renderers ported
 * from tnoodle-lib (clock/sq1/mega/pyra/skewb/unfolded-cube) plus a cstimer
 * port for Mirror Blocks.
 *
 * Ported from packages/client/src/components/ScramblePreview2D.tsx, but with
 * the TwistyPlayer fallback removed — all currently supported events have a
 * synchronous custom SVG renderer, so no need to pull in cubing/twisty (which
 * triggers the search worker code path that conflicts with Turbopack prerender).
 */
import { useMemo, type CSSProperties } from 'react';
import {
  renderClockScrambleSvg,
  DEFAULT_CLOCK_COLORS,
} from '@/app/scramble/gen/_svg/clock_svg';
import {
  renderSq1ScrambleSvg,
  DEFAULT_SQ1_COLORS,
} from '@/app/scramble/gen/_svg/sq1_svg';
import {
  renderMegaScrambleSvg,
  DEFAULT_MEGA_COLORS,
} from '@/app/scramble/gen/_svg/mega_svg';
import {
  renderPyraScrambleSvg,
  PYRA_DEFAULT_COLORS,
} from '@/app/scramble/gen/_svg/pyraminx_svg';
import {
  renderSkewbScrambleSvg,
  SKEWB_DEFAULT_COLORS,
} from '@/app/scramble/gen/_svg/skewb_svg';
import { renderMirrorBlocksScrambleSvg } from '@/app/scramble/gen/_svg/mirror_blocks_svg';
import {
  renderUnfoldedSvgForEvent,
  eventToCubeSize,
} from '@/app/scramble/gen/_svg/cube_unfolded_svg';

// Minimal shape-mod helpers inline — full table lives in client/utils/shapeModScramble.ts
// (not yet ported). Only mirror_333 needs special-case handling here.
function previewSource(event: string): string {
  if (event === 'mirror_333') return '333';
  return event;
}

const HAS_PREVIEW: Record<string, boolean> = {
  '222': true, '333': true, '333oh': true, '333bf': true, '333fm': true,
  '333ft': true, '333mbf': true, '333mbo': true, '444': true, '444bf': true,
  '555': true, '555bf': true, '666': true, '777': true,
  pyram: true, skewb: true, sq1: true, minx: true, clock: true,
  mirror_333: true,
};

export function eventHasScramblePreview(event: string): boolean {
  if (HAS_PREVIEW[event]) return true;
  const eff = previewSource(event);
  if (HAS_PREVIEW[eff]) return true;
  return eventToCubeSize(eff) !== null;
}

interface Props {
  event: string;
  scramble: string;
  size?: number;
  clockColors?: Record<string, string>;
  sq1Colors?: Record<string, string>;
  megaColors?: Record<string, string>;
}

export function ScramblePreview2D({
  event,
  scramble,
  size = 60,
  clockColors,
  sq1Colors,
  megaColors,
}: Props) {
  const eff = previewSource(event);

  const customSvg = useMemo(() => {
    try {
      if (event === 'mirror_333') return renderMirrorBlocksScrambleSvg(scramble);
      if (eff === 'clock') return renderClockScrambleSvg(scramble, clockColors ?? DEFAULT_CLOCK_COLORS);
      if (eff === 'sq1') return renderSq1ScrambleSvg(scramble, sq1Colors ?? DEFAULT_SQ1_COLORS);
      if (eff === 'minx') return renderMegaScrambleSvg(scramble, megaColors ?? DEFAULT_MEGA_COLORS);
      if (eff === 'pyram') return renderPyraScrambleSvg(scramble, PYRA_DEFAULT_COLORS);
      if (eff === 'skewb') return renderSkewbScrambleSvg(scramble, SKEWB_DEFAULT_COLORS);
      if (eventToCubeSize(eff)) return renderUnfoldedSvgForEvent(eff, scramble);
      return null;
    } catch (err) {
      console.warn(`[ScramblePreview2D] ${event} (eff=${eff}) render failed`, err);
      return null;
    }
  }, [event, eff, scramble, clockColors, sq1Colors, megaColors]);

  const isPortrait = eff === 'sq1';
  const hostStyle: CSSProperties = {
    width: isPortrait ? size : size * 2,
    height: isPortrait ? size * 2 : size * 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    margin: '0 auto',
  };

  if (!customSvg) return null;
  return (
    <div
      style={hostStyle}
      dangerouslySetInnerHTML={{ __html: customSvg }}
    />
  );
}
