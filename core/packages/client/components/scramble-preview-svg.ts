/**
 * Single renderer contract for scramble preview SVGs.
 *
 * The React thumbnail and PDF exporter must call this same dispatcher: a puzzle
 * advertised as having a preview must never silently become an empty PDF cell.
 */
import {
  renderClockScrambleSvg,
  DEFAULT_CLOCK_COLORS,
} from '@/app/[lang]/scramble/gen/_svg/clock_svg';
import {
  renderSq1ScrambleSvg,
  DEFAULT_SQ1_COLORS,
} from '@/lib/sq1-svg';
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
} from '@cuberoot/shared/cube-unfolded-svg';
import type { MaskRenderOptions } from '@/lib/puzzle-image/mask-core';

function previewSource(event: string): string {
  return event === 'mirror_333' ? '333' : event;
}

const HAS_PREVIEW: ReadonlySet<string> = new Set([
  '222', '333', '333oh', '333bf', '333fm', '333ft', '333mbf', '333mbo',
  '444', '444bf', '555', '555bf', '666', '777',
  'pyram', 'skewb', 'sq1', 'minx', 'clock',
  'mirror_333', 'ivy', '133', '223', '233', '334', '335', '336', '337',
  '8p', '15p', 'sfl', 'ufo', 'cm2', 'cm3', 'heli', 'helicv', 'ctico', 'dmd',
  'gear', 'mpyrso', 'dino', 'crz3a', 'sq2', 'ssq1', 'bsq', 'bic', 'sia123', 'sia222',
  'fto', 'baby_fto', 'master_tetraminx', 'kilominx', 'redi_cube',
]);

export function eventHasScramblePreview(event: string): boolean {
  const eff = previewSource(event);
  return HAS_PREVIEW.has(event) || HAS_PREVIEW.has(eff) || eventToCubeSize(eff) !== null;
}

export interface ScramblePreviewSvgOptions {
  event: string;
  scramble: string;
  clockColors?: Record<string, string>;
  sq1Colors?: Record<string, string>;
  megaColors?: Record<string, string>;
  mask?: MaskRenderOptions;
}

export function renderScramblePreviewSvg({
  event,
  scramble,
  clockColors,
  sq1Colors,
  megaColors,
  mask,
}: ScramblePreviewSvgOptions): string | null {
  const eff = previewSource(event);
  try {
    if (event === 'mirror_333') return renderMirrorBlocksScrambleSvg(scramble);
    if (eff === 'clock') return renderClockScrambleSvg(scramble, clockColors ?? DEFAULT_CLOCK_COLORS);
    if (eff === 'sq1') return renderSq1ScrambleSvg(scramble, sq1Colors ?? DEFAULT_SQ1_COLORS);
    if (eff === 'minx') return renderMegaScrambleSvg(scramble, megaColors ?? DEFAULT_MEGA_COLORS, mask);
    if (eff === 'pyram') return renderPyraScrambleSvg(scramble, PYRA_DEFAULT_COLORS, mask);
    if (eff === 'skewb') return renderSkewbScrambleSvg(scramble, SKEWB_DEFAULT_COLORS, mask);
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
    if (eventToCubeSize(eff)) return renderUnfoldedSvgForEvent(eff, scramble, mask);
    return null;
  } catch (err) {
    console.warn(`[scramble-preview] ${event} (eff=${eff}) render failed`, err);
    return null;
  }
}
