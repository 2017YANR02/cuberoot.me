/**
 * Pure state model for the puzzle-image generator (/visualcube, and later /sim's
 * image panel). No React / DOM — importable from node.
 *
 * `ImageSpec` was `EditorState` in app/[lang]/visualcube/page.tsx.
 */

import type { PaintColor } from '@/app/[lang]/scramble/solver/_paint-shared';

export const FACE_LIST = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type FaceKey = (typeof FACE_LIST)[number];

export type AlgType = 'alg' | 'case';
export type SpecialView = 'normal' | 'plan' | 'trans' | 'net' | 'wca';
export type PuzzleType = 'cube' | 'sq1' | 'megaminx' | 'pyraminx' | 'skewb';
export type PuzzleVariant = 'iso' | 'net' | 'top' | 'wca';

export type { PaintColor };

export interface ImageSpec {
  puzzleType: PuzzleType;
  puzzleVariant: PuzzleVariant;
  cubeSize: number;
  imageSize: number;
  algType: AlgType;
  algorithm: string;
  arrows: string;
  defaultArrowColor: string;
  cubeView: SpecialView;
  stageMask: string;
  maskAlg: string;
  faceU: string;
  faceR: string;
  faceF: string;
  faceD: string;
  faceL: string;
  faceB: string;
  rotateAxis1: string;
  rotateAxis2: string;
  rotateAngle1: number;
  rotateAngle2: number;
  backgroundColor: string;
  cubeColor: string;
  cubeOpacity: number;
  stickerOpacity: number;
  dist: number;
  arrowFace: FaceKey;
  arrowFrom: number;
  arrowTo: number;
  arrowPass: number | null;
  arrowScale: number | null;
  arrowInfluence: number | null;
  arrowColor: string;
  /** 3x3 paint-editor net (54 chars over URFDLBX). URL key `fc`. */
  paintedFacelet: string;
  netActiveColor: PaintColor;
  /** Per-sticker mask DSL (`U:0,2;F:3-5`, see mask-core). URL key `msk`. */
  stickerMask: string;
  /** Fill for masked stickers. Puzzle sticker data, not a theme token. URL key `mkc`. */
  maskColor: string;
}
