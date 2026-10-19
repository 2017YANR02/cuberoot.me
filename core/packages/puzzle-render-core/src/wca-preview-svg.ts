/** Shared WCA preview dispatch extracted from the Web thumbnail/PDF renderer. */
import { renderUnfoldedSvgForEvent, eventToCubeSize, type MaskRenderOptions } from '@cuberoot/shared/cube-unfolded-svg';
import { renderClockScrambleSvg, DEFAULT_CLOCK_COLORS } from './clock-svg';
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS } from './sq1-svg';
import { renderMegaScrambleSvg, DEFAULT_MEGA_COLORS } from './mega-svg';
import { renderPyraScrambleSvg, PYRA_DEFAULT_COLORS } from './pyraminx-svg';
import { renderSkewbScrambleSvg, SKEWB_DEFAULT_COLORS } from './skewb-svg';

export interface WcaPreviewSvgOptions {
  event: string;
  scramble: string;
  clockColors?: Record<string, string>;
  sq1Colors?: Record<string, string>;
  megaColors?: Record<string, string>;
  mask?: MaskRenderOptions;
}

export function renderWcaPreviewSvg({ event, scramble, clockColors, sq1Colors, megaColors, mask }: WcaPreviewSvgOptions): string | null {
  if (event === 'clock') return renderClockScrambleSvg(scramble, clockColors ?? DEFAULT_CLOCK_COLORS);
  if (event === 'sq1') return renderSq1ScrambleSvg(scramble, sq1Colors ?? DEFAULT_SQ1_COLORS);
  if (event === 'minx') return renderMegaScrambleSvg(scramble, megaColors ?? DEFAULT_MEGA_COLORS, mask);
  if (event === 'pyram') return renderPyraScrambleSvg(scramble, PYRA_DEFAULT_COLORS, mask);
  if (event === 'skewb') return renderSkewbScrambleSvg(scramble, SKEWB_DEFAULT_COLORS, mask);
  return eventToCubeSize(event) ? renderUnfoldedSvgForEvent(event, scramble, mask) : null;
}
