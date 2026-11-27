'use client';

import { AllFaces, Axis, Face } from '@cuberoot/visualcube';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import { CUBE_COLOR_NAMES, CUBE_FACE_FOR_COLOR_LETTER, type CubeColorLetter } from '@/lib/cube-colors';
import { visualCubeSchemeForOrientation } from '@/lib/cube-orientation';
import { twoByTwoState } from '../lib/2x2-state';
import { egBottomRows, egMoves } from './lesson-data';
import { egPalette, useEgOrientation } from './orientation';

export const EG_DIRECTIONS = [
  { zh: '前', en: 'Front' }, { zh: '右', en: 'Right' },
  { zh: '后', en: 'Back' }, { zh: '左', en: 'Left' },
] as const;
export const EG_CORNER_VIEWS = [
  { zh: '前和右', en: 'Front and right' }, { zh: '右和后', en: 'Right and back' },
  { zh: '后和左', en: 'Back and left' }, { zh: '左和前', en: 'Left and front' },
] as const;
const colorNames = (row: string) => [...row].map(color => color === 'D'
  ? tr({ zh: '灰', en: 'gray' })
  : tr(CUBE_COLOR_NAMES[CUBE_FACE_FOR_COLOR_LETTER[color as CubeColorLetter]])).join(' / ');

export function BottomDiagram({ setup, corner = 0, size = 160, decorative = false, pitch = 30 }: {
  setup: string; corner?: number; size?: number; decorative?: boolean; pitch?: number;
}) {
  const orientation = useEgOrientation();
  const { sticker } = egPalette(orientation);
  const rows = decorative ? [] : egBottomRows(setup);
  const alt = decorative ? '' : rows.map((row, index) =>
    `${tr(EG_DIRECTIONS[index])} ${colorNames([...row].map(color => sticker(color as CubeColorLetter)).join(''))}`).join(' · ');
  return <VisualCube local puzzleSize={2} size={size} view="iso" scheme={visualCubeSchemeForOrientation(orientation)} setup={setup} alt={alt}
    viewportRotations={[[Axis.Y, 35 + corner * 90], [Axis.X, pitch]]} />;
}

export function BottomRecognitionDiagram({ setup, size = 160 }: { setup: string; size?: number }) {
  const { sticker } = egPalette(useEgOrientation());
  // Flip the bottom toward the viewer while keeping the front and back in place.
  const state = twoByTwoState(egMoves(setup, 'z2'));
  const facelets = AllFaces.flatMap(face => state[face]).map(color => sticker(color as CubeColorLetter)).join('');
  return <div className="eg-set-bottom-diagram" aria-hidden="true">
    <VisualCube local puzzleSize={2} size={size} view="plan" faceletColors={facelets} alt="" />
  </div>;
}

export function TopDiagram({ setup, size = 144, topOnly = false, lazy = false, decorative = false, outlinedFacelets, visibleFacelets }: {
  setup: string; size?: number; topOnly?: boolean; lazy?: boolean; decorative?: boolean; outlinedFacelets?: readonly number[];
  visibleFacelets?: readonly number[];
}) {
  const orientation = useEgOrientation();
  const { sticker } = egPalette(orientation);
  const state = decorative && !visibleFacelets ? null : twoByTwoState(setup);
  const facelets = state && AllFaces.map(face => state[face].map((color, index) =>
    (topOnly && color !== 'Y') || (visibleFacelets && !visibleFacelets.includes(face * 4 + index))
      ? 'D' : sticker(color as CubeColorLetter)).join(''));
  const alt = !decorative && facelets ? [
    `${tr({ zh: '顶面', en: 'Top' })} ${colorNames(facelets[Face.U])}`,
    ...[Face.F, Face.R, Face.B, Face.L].map((face, index) =>
      `${tr(EG_DIRECTIONS[index])} ${colorNames(facelets[face].slice(0, 2))}`),
  ].join(' · ') : '';
  return <VisualCube local puzzleSize={2} size={size} view={topOnly ? 'oll' : 'pll'}
    scheme={visualCubeSchemeForOrientation(orientation, topOnly)} setup={setup} alt={alt} loading={lazy ? 'lazy' : undefined}
    faceletColors={visibleFacelets && facelets ? facelets.join('') : undefined}
    outlinedFacelets={outlinedFacelets} outlinePlanSides={!!outlinedFacelets?.length} />;
}
