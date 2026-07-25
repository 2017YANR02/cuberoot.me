'use client';

/**
 * 2×2×2 的 PaintSpec —— 把 lib/pocket-facelet 的模型接到共享画板上(_InteractiveCubeNet /
 * _Interactive3DCube / _PaintToolbar 都是 spec 驱动的)。
 *
 * 单独一个文件而不塞进 _paint-shared:那个模块被 /paint 的 puzzle-image 与导出路径引用,
 * 不该把二阶求解器的表带进它们的 chunk。
 */

import {
  EMPTY_POCKET_FACELET, POCKET_STICKER_SIBLINGS, SOLVED_POCKET_FACELET,
  friendlyPocketErr, randomPocketFacelet, validatePocketFacelet,
} from '@/lib/pocket-facelet';
import type { PaintSpec } from './_paint-shared';

export const CUBE2_PAINT: PaintSpec = {
  n: 2,
  size: 24,
  maxPerColor: 4,
  siblings: POCKET_STICKER_SIBLINGS,
  empty: EMPTY_POCKET_FACELET,
  solved: SOLVED_POCKET_FACELET,
  fixedCenters: false, // 二阶没有中心块 → 24 格全可涂,取色只能点色板
  validate: validatePocketFacelet,
  friendlyErr: friendlyPocketErr,
  randomLegal: () => randomPocketFacelet(),
};
