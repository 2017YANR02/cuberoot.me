/** Geometry and shape presets ported from the authorized cubing.pro drawing tool. */

import { SQ1_SHAPES } from '@/lib/sq1-shapes';

export interface Sq1Preset {
  id: string;
  zh: string;
  en: string;
  pattern: string;
}

export const SQ1_PRESETS: readonly Sq1Preset[] = SQ1_SHAPES.map((shape) => ({
  id: shape.drawId,
  zh: shape.name,
  en: shape.name,
  pattern: shape.drawPattern,
}));

export const SQ1_AXIS_PATH = 'M 44.84834 1.38492 L 25.17810 74.79528';

export const SQ1_CORNER_PATHS = [
  'm35.01322,38.09014l-5.1493,-19.21651l-14.06721,0l0,14.06721l19.21651,5.1493z',
  'm15.79671,18.87363l-4.8037,-4.8037l17.58351,0l1.2874,4.8037l-14.06721,0z',
  'm15.79671,18.87363l-4.8037,-4.8037l0,17.58351l4.8037,1.2874l0,-14.06721z',
] as const;

export const SQ1_EDGE_PATHS = [
  'm35.01322,38.09014l5.1485,-19.21651l-10.2978,0l5.1493,19.21651z',
  'm40.16172,18.87363l1.2874,-4.8037l-12.8726,0l1.2874,4.8037l10.2978,0z',
] as const;

export const SQ1_ROTATE_POINT = '35.01322 38.0901';
export const SQ1_CORNER_TEXT_POINT = [21.94057, 27.84965] as const;
export const SQ1_EDGE_TEXT_POINT = [33.4, 27.84965] as const;

export function sq1PresetById(id: string): Sq1Preset | undefined {
  return SQ1_PRESETS.find((preset) => preset.id === id);
}

export function sq1PieceCounts(pattern: string): { edges: number; corners: number } {
  let edges = 0;
  let corners = 0;
  for (const piece of pattern) {
    if (piece === 'e') edges += 1;
    else if (piece === 'c') corners += 1;
  }
  return { edges, corners };
}
