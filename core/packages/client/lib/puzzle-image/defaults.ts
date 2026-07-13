import { SOLVED_FACELET } from '@/app/[lang]/scramble/solver/facelet';
import type { FaceKey, ImageSpec, PuzzleType, PuzzleVariant } from './types';

export const FACE_DEFAULTS: Record<FaceKey, string> = {
  U: '#fefe00',
  R: '#00d800',
  F: '#ee0000',
  D: '#ffffff',
  L: '#0000f2',
  B: '#ffa100',
};

export const DEFAULTS: ImageSpec = {
  puzzleType: 'cube',
  puzzleVariant: 'iso',
  cubeSize: 3,
  imageSize: 256,
  algType: 'alg',
  algorithm: '',
  arrows: '',
  defaultArrowColor: '',
  cubeView: 'normal',
  stageMask: '',
  maskAlg: '',
  faceU: FACE_DEFAULTS.U,
  faceR: FACE_DEFAULTS.R,
  faceF: FACE_DEFAULTS.F,
  faceD: FACE_DEFAULTS.D,
  faceL: FACE_DEFAULTS.L,
  faceB: FACE_DEFAULTS.B,
  rotateAxis1: 'y',
  rotateAxis2: 'x',
  rotateAngle1: 30,
  rotateAngle2: -30,
  backgroundColor: '',
  cubeColor: '#000000',
  cubeOpacity: 100,
  stickerOpacity: 100,
  dist: 5,
  arrowFace: 'U',
  arrowFrom: 0,
  arrowTo: 2,
  arrowPass: null,
  arrowScale: null,
  arrowInfluence: null,
  arrowColor: '#808080',
  paintedFacelet: SOLVED_FACELET,
  netActiveColor: 'U',
  stickerMask: '',
  maskColor: '#404040',
};

export interface RotationDefaults {
  axis1: string;
  angle1: number;
  axis2: string;
  angle2: number;
}

export function rotationDefaultsFor(args: {
  puzzleType: PuzzleType;
  puzzleVariant: PuzzleVariant;
}): RotationDefaults {
  const { puzzleType: t, puzzleVariant: v } = args;
  if (t === 'skewb' && v === 'top') {
    return { axis1: 'y', angle1: 0, axis2: 'x', angle2: 0 };
  }
  if (t === 'sq1') {
    return { axis1: 'y', angle1: -34, axis2: 'x', angle2: -56 };
  }
  if (t === 'pyraminx') {
    return { axis1: 'y', angle1: 60, axis2: 'x', angle2: -60 };
  }
  if (t === 'skewb') {
    return { axis1: 'y', angle1: 45, axis2: 'x', angle2: 34 };
  }
  if (t === 'megaminx') {
    return { axis1: 'y', angle1: 0, axis2: 'x', angle2: 0 };
  }
  return {
    axis1: DEFAULTS.rotateAxis1, angle1: DEFAULTS.rotateAngle1,
    axis2: DEFAULTS.rotateAxis2, angle2: DEFAULTS.rotateAngle2,
  };
}

export function rotationsMatchDefault(s: ImageSpec): boolean {
  const d = rotationDefaultsFor(s);
  return s.rotateAxis1 === d.axis1 && s.rotateAngle1 === d.angle1 &&
         s.rotateAxis2 === d.axis2 && s.rotateAngle2 === d.angle2;
}

/**
 * Puzzle-TYPE switch: reset the viewport rotation to the new puzzle's defaults
 * UNCONDITIONALLY, throwing away whatever the user had dialled in. A megaminx
 * angle is meaningless on a pyraminx, so the old page (visualcube page.tsx, the
 * puzzle-type buttons) never tried to preserve it.
 *
 * NOT the same as `snapRotationOnVariantBoundary`, which is what the VARIANT
 * switch uses: that one only snaps when the current angles still equal the
 * defaults, i.e. it preserves a hand-dialled rotation across iso/top/net/wca.
 * Two boundaries, two behaviours — keep them separate.
 */
export function resetRotationsForPuzzle(s: ImageSpec, partial: Partial<ImageSpec>): ImageSpec {
  const next = { ...s, ...partial };
  const d = rotationDefaultsFor(next);
  next.rotateAxis1 = d.axis1; next.rotateAngle1 = d.angle1;
  next.rotateAxis2 = d.axis2; next.rotateAngle2 = d.angle2;
  return next;
}

export function snapRotationOnVariantBoundary(s: ImageSpec, partial: Partial<ImageSpec>): ImageSpec {
  const next = { ...s, ...partial };
  if (rotationsMatchDefault(s)) {
    const d = rotationDefaultsFor(next);
    next.rotateAxis1 = d.axis1; next.rotateAngle1 = d.angle1;
    next.rotateAxis2 = d.axis2; next.rotateAngle2 = d.angle2;
  }
  return next;
}
