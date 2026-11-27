import { createContext, useContext } from 'react';
import { faceShowingColor, orientedFaceColors } from '@cuberoot/shared/timer/cube-orientation';
import {
  CUBE_COLOR_LETTER_FOR_FACE, CUBE_COLOR_NAMES, CUBE_FACE_FOR_COLOR_LETTER,
  type CubeColorLetter, type CubeFace,
} from '@/lib/cube-colors';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';

export const EgOrientationContext = createContext(TWO_BY_TWO_ORIENTATION);
export type EgColorName = typeof CUBE_COLOR_NAMES.U;

export function useEgOrientation() {
  return useContext(EgOrientationContext);
}

const teachingColors = orientedFaceColors(TWO_BY_TWO_ORIENTATION);

export function egPalette(orientation: string) {
  const colors = orientedFaceColors(orientation);
  return {
    name: (face: CubeFace) => CUBE_COLOR_NAMES[colors[face]],
    sticker: (letter: CubeColorLetter) => {
      const home = faceShowingColor(teachingColors, CUBE_FACE_FOR_COLOR_LETTER[letter]);
      return CUBE_COLOR_LETTER_FOR_FACE[colors[home]];
    },
  };
}
