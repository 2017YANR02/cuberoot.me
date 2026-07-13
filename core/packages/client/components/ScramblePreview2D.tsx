'use client';

/**
 * Static 2D unfolded WCA scramble preview — pure custom SVG renderers ported
 * from tnoodle-lib (clock/sq1/mega/pyra/skewb/unfolded-cube) plus a cstimer
 * port for Mirror Blocks.
 *
 * Ported from packages/client-vite/src/components/ScramblePreview2D.tsx, but with
 * the TwistyPlayer fallback removed — all currently supported events have a
 * synchronous custom SVG renderer, so no need to pull in cubing/twisty (which
 * triggers the search worker code path that conflicts with Turbopack prerender).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  renderClockScrambleSvg,
  DEFAULT_CLOCK_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/clock_svg';
import {
  renderSq1ScrambleSvg,
  DEFAULT_SQ1_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/sq1_svg';
import {
  renderMegaScrambleSvg,
  DEFAULT_MEGA_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/mega_svg';
import {
  renderPyraScrambleSvg,
  PYRA_DEFAULT_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/pyraminx_svg';
import {
  renderSkewbScrambleSvg,
  SKEWB_DEFAULT_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/skewb_svg';
import { renderMirrorBlocksScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/mirror_blocks_svg';
import { renderIvyScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/ivy_svg';
import { renderFloppyScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/floppy_svg';
import { renderCuboid223ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid223_svg';
import { renderCuboid233ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid233_svg';
import { renderCuboid334ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid334_svg';
import { renderCuboid335ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid335_svg';
import { renderCuboid336ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid336_svg';
import { renderCuboid337ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cuboid337_svg';
import { renderSlide8ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/slide8_svg';
import { renderSlide15ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/slide15_svg';
import { renderSuperFloppyScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/superfloppy_svg';
import { renderUfoScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/ufo_svg';
import { renderCm2ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cm2_svg';
import { renderCm3ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/cm3_svg';
import { renderHeliScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/heli_svg';
import { renderHelicvScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/helicv_svg';
import { renderCticoScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/ctico_svg';
import { renderDiamondScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/diamond_svg';
import { renderGearScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/gear_svg';
import { renderMpyrScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/mpyr_svg';
import { renderDinoScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/dino_svg';
import { renderSq2ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/sq2_svg';
import { renderSsq1ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/ssq1_svg';
import { renderBsqScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/bsq_svg';
import { renderBicScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/bicube_svg';
import { renderSia123ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/sia123_svg';
import { renderSia222ScrambleSvg } from '@/app/[lang]/scramble/gen/_svg/sia222_svg';
import { renderBakedNet } from '@/app/[lang]/scramble/gen/_svg/_baked_nets';
import {
  renderUnfoldedSvgForEvent,
  eventToCubeSize,
} from '@/app/[lang]/scramble/gen/_svg/cube_unfolded_svg';
// mask-core, NOT puzzle-mask: this component only parses a mask string, it never
// expands pieces — so it must not pull the derived tables (lib/puzzle-image/data)
// into the chunk of every page that shows a scramble preview.
import { toRenderMask, type MaskRenderOptions } from '@/lib/puzzle-image/mask-core';

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
  mirror_333: true, ivy: true, '133': true, '223': true, '233': true, '334': true, '335': true, '336': true, '337': true, '8p': true, '15p': true, sfl: true, ufo: true, cm2: true, cm3: true, heli: true, helicv: true, ctico: true, dmd: true, gear: true, mpyrso: true, dino: true, crz3a: true, sq2: true, ssq1: true, bsq: true, bic: true, sia123: true, sia222: true,
  // group-theoretic baked nets (see _svg/_baked_nets) — keep in sync with BAKED_NET_EVENTS
  fto: true, baby_fto: true, master_tetraminx: true, kilominx: true, redi_cube: true,
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
  /** Wrap the preview in an <a> that opens this very SVG full-size in a new tab.
   *  Keeps the popup pixel-identical to the thumbnail (same SVG string) instead
   *  of a different server-rendered net. */
  fullSizeLink?: boolean;
  /** Tooltip for the full-size link (caller passes the i18n'd string). */
  linkTitle?: string;
  /** Gray out stickers — canonical id DSL, e.g. `U:0,2;F:3-5`. Applied in the
   *  solved frame, so the gray travels with the piece through the scramble.
   *  Only the piece-model renderers honour it (NxN net, pyraminx, skewb, megaminx). */
  mask?: string;
}

export function ScramblePreview2D({
  event,
  scramble,
  size = 60,
  clockColors,
  sq1Colors,
  megaColors,
  fullSizeLink,
  linkTitle,
  mask,
}: Props) {
  const eff = previewSource(event);

  const customSvg = useMemo(() => {
    const m: MaskRenderOptions | undefined = (() => {
      const rm = toRenderMask(mask);
      return rm ? { mask: rm } : undefined;
    })();
    try {
      if (event === 'mirror_333') return renderMirrorBlocksScrambleSvg(scramble);
      if (eff === 'clock') return renderClockScrambleSvg(scramble, clockColors ?? DEFAULT_CLOCK_COLORS);
      if (eff === 'sq1') return renderSq1ScrambleSvg(scramble, sq1Colors ?? DEFAULT_SQ1_COLORS);
      if (eff === 'minx') return renderMegaScrambleSvg(scramble, megaColors ?? DEFAULT_MEGA_COLORS, m);
      if (eff === 'pyram') return renderPyraScrambleSvg(scramble, PYRA_DEFAULT_COLORS, m);
      if (eff === 'skewb') return renderSkewbScrambleSvg(scramble, SKEWB_DEFAULT_COLORS, m);
      if (eff === 'ivy') return renderIvyScrambleSvg(scramble);
      if (eff === '133') return renderFloppyScrambleSvg(scramble);
      if (eff === '223') return renderCuboid223ScrambleSvg(scramble);
      if (eff === '233') return renderCuboid233ScrambleSvg(scramble);
      if (eff === '334') return renderCuboid334ScrambleSvg(scramble);
      if (eff === '335') return renderCuboid335ScrambleSvg(scramble);
      if (eff === '336') return renderCuboid336ScrambleSvg(scramble);
      if (eff === '337') return renderCuboid337ScrambleSvg(scramble);
      if (eff === '8p') return renderSlide8ScrambleSvg(scramble);
      if (eff === '15p') return renderSlide15ScrambleSvg(scramble);
      if (eff === 'sfl') return renderSuperFloppyScrambleSvg(scramble);
      if (eff === 'ufo') return renderUfoScrambleSvg(scramble);
      if (eff === 'cm2') return renderCm2ScrambleSvg(scramble);
      if (eff === 'cm3') return renderCm3ScrambleSvg(scramble);
      if (eff === 'heli') return renderHeliScrambleSvg(scramble);
      if (eff === 'helicv') return renderHelicvScrambleSvg(scramble);
      if (eff === 'ctico') return renderCticoScrambleSvg(scramble);
      if (eff === 'dmd') return renderDiamondScrambleSvg(scramble);
      if (eff === 'gear') return renderGearScrambleSvg(scramble);
      if (eff === 'mpyrso') return renderMpyrScrambleSvg(scramble);
      if (eff === 'dino') return renderDinoScrambleSvg(scramble);
      if (eff === 'sq2') return renderSq2ScrambleSvg(scramble);
      if (eff === 'ssq1') return renderSsq1ScrambleSvg(scramble);
      if (eff === 'bsq') return renderBsqScrambleSvg(scramble);
      if (eff === 'bic') return renderBicScrambleSvg(scramble);
      if (eff === 'sia123') return renderSia123ScrambleSvg(scramble);
      if (eff === 'sia222') return renderSia222ScrambleSvg(scramble);
      const baked = renderBakedNet(eff, scramble);
      if (baked) return baked;
      if (eventToCubeSize(eff)) return renderUnfoldedSvgForEvent(eff, scramble, m);
      return null;
    } catch (err) {
      console.warn(`[ScramblePreview2D] ${event} (eff=${eff}) render failed`, err);
      return null;
    }
  }, [event, eff, scramble, clockColors, sq1Colors, megaColors, mask]);

  // Object URL of the exact same SVG, for the "open full-size" link. Create AND
  // revoke inside one effect so React StrictMode's mount→unmount→remount (dev)
  // can't leave a revoked URL in the DOM. Browser-only — never runs on SSR.
  const [fullSizeHref, setFullSizeHref] = useState<string | null>(null);
  useEffect(() => {
    if (!fullSizeLink || !customSvg) {
      setFullSizeHref(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([customSvg], { type: 'image/svg+xml' }));
    setFullSizeHref(url);
    return () => URL.revokeObjectURL(url);
  }, [fullSizeLink, customSvg]);

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
  const inner = (
    <div
      style={hostStyle}
      dangerouslySetInnerHTML={{ __html: customSvg }}
    />
  );
  if (fullSizeLink && fullSizeHref) {
    return (
      <a
        href={fullSizeHref}
        target="_blank"
        rel="noopener noreferrer"
        // stopPropagation: parent row has click-to-copy
        onClick={(e) => e.stopPropagation()}
        title={linkTitle}
        style={{ display: 'inline-flex' }}
      >
        {inner}
      </a>
    );
  }
  return inner;
}
