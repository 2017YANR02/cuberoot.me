import { FTO_DRAW_ELEMENTS } from '@/lib/fto-draw-elements';
import {
  ftoEifStickerState,
  type FtoEifFaceKey,
  type FtoEifStickerState,
} from '@cuberoot/shared/fto-notation';

export {
  FTO_EIF_ACTION_SEQUENCES,
  FTO_EIF_BASE_MOVES,
  FTO_EIF_FACE_KEYS,
  canonicalFtoEifAlgorithm,
  invertFtoEifAlgorithm,
  isFtoEifSolved,
  parseFtoEifAlgorithm,
  parseFtoEifToken,
  reduceFtoEifAlgorithm,
  type FtoEifBaseMove,
  type FtoEifFaceKey,
  type FtoEifStickerState,
  type FtoEifTokenParts,
} from '@cuberoot/shared/fto-notation';

export interface FtoEifPalette extends Record<FtoEifFaceKey, string> {
  stroke: string;
}

export const DEFAULT_FTO_EIF_PALETTE: FtoEifPalette = {
  u: '#0fcc09',
  f: '#deff26',
  r: '#666666',
  l: '#ff9900',
  d: '#2997fd',
  e: '#8830e3',
  i: '#d80f0f',
  b: '#ffffff',
  stroke: '#000000',
};

export const FTO_EIF_FACE_LABELS: Record<FtoEifFaceKey, string> = {
  u: 'U', f: 'F', r: 'R', l: 'L', d: 'D', e: 'Bl', i: 'Br', b: 'B',
};

export function ftoEifState(
  algorithm: string,
  palette: FtoEifPalette = DEFAULT_FTO_EIF_PALETTE,
): FtoEifStickerState {
  return ftoEifStickerState(algorithm, palette);
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderFtoEifSvg(
  algorithm: string,
  palette: FtoEifPalette = DEFAULT_FTO_EIF_PALETTE,
  options: { title?: string } = {},
): string {
  const state = ftoEifState(algorithm, palette);
  const title = options.title ? `<title>${escapeXml(options.title)}</title>` : '';
  const paths = FTO_DRAW_ELEMENTS.map((element) => {
    if (element.key === 'body') return `<path d="${element.d}" fill="${escapeXml(palette.stroke)}"/>`;
    const key = element.key.toLowerCase() as keyof FtoEifStickerState;
    const strokeWidth = element.key.startsWith('B') || element.key.startsWith('F') ? 4 : 2;
    return `<path d="${element.d}" fill="${escapeXml(state[key])}" stroke="${escapeXml(palette.stroke)}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 279.92 301.94" role="img">${title}${paths}</svg>`;
}
