/**
 * Pure state model for the puzzle-image generator (/visualcube, and later /sim's
 * image panel). No React / DOM — importable from node.
 *
 * `ImageSpec` was `EditorState` in app/[lang]/visualcube/page.tsx.
 */

import type { PaintColor } from '@/app/[lang]/scramble/solver/_paint-shared';
import type { PlanSideRule, PlanUpRule } from '@cuberoot/visualcube';

export type { PlanSideRule, PlanUpRule };

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
  /**
   * `cubeView: 'plan'` only — drop the greyed side-rim stickers instead of drawing
   * them, leaving a plan image with just the coloured bars (the classic OLL-recognition
   * look). The 9 U-face stickers are never affected. URL key `ngs`.
   */
  hideGreySides: boolean;
  /**
   * `cubeView: 'plan'` 识别简化(移植自 MeiCubeTool 的 view=plan simplify)。规则按
   * 「阈值」理解:选中的档位以下的图案全留,以上的抹掉。侧面/顶面两条规则只对三阶成立
   * (判据是「角-棱-角」三格窗口),其余尺寸自动失效。URL: psr / pur / psy / pfs / pfh。
   */
  planSideRule: PlanSideRule;
  planUpRule: PlanUpRule;
  /** 顶层色(U 面配色)的贴纸永远保留 —— 规则再狠也不会把题面本身抹掉。默认开。 */
  planShowYellow: boolean;
  /** `side=<csv>&up=<csv>`,1 起数;在规则之后强制显示 / 强制隐藏。 */
  planForceShow: string;
  planForceHide: string;
}
