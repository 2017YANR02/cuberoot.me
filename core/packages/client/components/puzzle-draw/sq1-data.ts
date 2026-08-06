/** Geometry and shape presets ported from the authorized cubing.pro drawing tool. */

export interface Sq1Preset {
  id: string;
  zh: string;
  en: string;
  pattern: string;
}

export const SQ1_PRESETS: readonly Sq1Preset[] = [
  { id: 'star', zh: '星', en: 'Star', pattern: 'cccccc' },
  { id: 'kite', zh: '风筝', en: 'Kite', pattern: 'ececcece' },
  { id: 'square', zh: '方', en: 'Square', pattern: 'ecececec' },
  { id: 'scallop', zh: '贝壳', en: 'Scallop', pattern: 'eeccccee' },
  { id: 'mushroom', zh: '蘑菇', en: 'Mushroom', pattern: 'ecceccee' },
  { id: 'right-paw', zh: '右爪', en: 'R Paw', pattern: 'eecccece' },
  { id: 'left-paw', zh: '左爪', en: 'L Paw', pattern: 'ececccee' },
  { id: 'right-fist', zh: '右拳', en: 'R Fist', pattern: 'ececceec' },
  { id: 'left-fist', zh: '左拳', en: 'L Fist', pattern: 'ceeccece' },
  { id: 'shield', zh: '盾', en: 'Shield', pattern: 'eeccceec' },
  { id: 'barrel', zh: '桶', en: 'Barrel', pattern: 'ceecceec' },
  { id: 'twins', zh: '对', en: 'Twins', pattern: 'cceeccc' },
  { id: '8', zh: '8', en: '8', pattern: 'eeeecceeee' },
  { id: '71', zh: '71', en: '71', pattern: 'eeececeeee' },
  { id: '62', zh: '62', en: '62', pattern: 'eeeceeceee' },
  { id: '53', zh: '53', en: '53', pattern: 'eeceeeceee' },
  { id: '44', zh: '44', en: '44', pattern: 'eeceeeecee' },
  { id: '6', zh: '6', en: '6', pattern: 'eeccceeee' },
  { id: '51r', zh: '51R', en: '51R', pattern: 'eeeeccece' },
  { id: '51l', zh: '51L', en: '51L', pattern: 'ececceeee' },
  { id: '411', zh: '411', en: '411', pattern: 'ecececeee' },
  { id: '42r', zh: '42R', en: '42R', pattern: 'eeeecceec' },
  { id: '42l', zh: '42L', en: '42L', pattern: 'ceecceeee' },
  { id: '33', zh: '33', en: '33', pattern: 'eeeceeecc' },
  { id: '321', zh: '321', en: '321', pattern: 'ececeeece' },
  { id: '312', zh: '312', en: '312', pattern: 'eeececeec' },
  { id: '222', zh: '222', en: '222', pattern: 'ceeceecee' },
  { id: 'l', zh: 'L', en: 'L', pattern: 'cececcc' },
  { id: 'i', zh: 'I', en: 'I', pattern: 'ecceccc' },
] as const;

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
