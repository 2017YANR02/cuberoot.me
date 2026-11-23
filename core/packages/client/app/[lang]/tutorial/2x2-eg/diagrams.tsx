'use client';

import { Axis, Face } from '@cuberoot/visualcube';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import { visualCubeSchemeForOrientation } from '@/lib/cube-orientation';
import { TWO_BY_TWO_ORIENTATION, twoByTwoState } from '../lib/2x2-state';
import { egBottomRows } from './lesson-data';

export const EG_DIRECTIONS = [
  { zh: '前', en: 'Front' }, { zh: '右', en: 'Right' },
  { zh: '后', en: 'Back' }, { zh: '左', en: 'Left' },
] as const;
export const EG_CORNER_VIEWS = [
  { zh: '前和右', en: 'Front and right' }, { zh: '右和后', en: 'Right and back' },
  { zh: '后和左', en: 'Back and left' }, { zh: '左和前', en: 'Left and front' },
] as const;
const colors: Record<string, { zh: string; en: string }> = {
  W: { zh: '白', en: 'White' }, Y: { zh: '黄', en: 'Yellow' },
  R: { zh: '红', en: 'Red' }, G: { zh: '绿', en: 'Green' },
  B: { zh: '蓝', en: 'Blue' }, O: { zh: '橙', en: 'Orange' },
};
const colorNames = (row: string, yellowOnly = false) => [...row].map(color =>
  yellowOnly && color !== 'Y' ? tr({ zh: '灰', en: 'Gray' }) : tr(colors[color])).join(' / ');
const scheme = visualCubeSchemeForOrientation(TWO_BY_TWO_ORIENTATION);
const yellowScheme = visualCubeSchemeForOrientation(TWO_BY_TWO_ORIENTATION, true);

export function BottomDiagram({ setup, corner = 0, size = 160, decorative = false }: {
  setup: string; corner?: number; size?: number; decorative?: boolean;
}) {
  const rows = decorative ? [] : egBottomRows(setup);
  const alt = decorative ? '' : rows.map((row, index) =>
    `${tr(EG_DIRECTIONS[index])} ${colorNames(row)}`).join(' · ');
  return <VisualCube local puzzleSize={2} size={size} view="iso" scheme={scheme} setup={setup} alt={alt}
    viewportRotations={[[Axis.Y, 35 + corner * 90], [Axis.X, 30]]} />;
}

export function TopDiagram({ setup, size = 144, yellowOnly = false, lazy = false, decorative = false }: {
  setup: string; size?: number; yellowOnly?: boolean; lazy?: boolean; decorative?: boolean;
}) {
  const state = decorative ? null : twoByTwoState(setup);
  const alt = state ? [
    `${tr({ zh: '顶面', en: 'Top' })} ${colorNames(state[Face.U].join(''), yellowOnly)}`,
    ...[Face.F, Face.R, Face.B, Face.L].map((face, index) =>
      `${tr(EG_DIRECTIONS[index])} ${colorNames(state[face].slice(0, 2).join(''), yellowOnly)}`),
  ].join(' · ') : '';
  return <VisualCube local puzzleSize={2} size={size} view={yellowOnly ? 'oll' : 'pll'}
    scheme={yellowOnly ? yellowScheme : scheme} setup={setup} alt={alt} loading={lazy ? 'lazy' : undefined} />;
}
