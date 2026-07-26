'use client';

/**
 * 斜转的 PaintSpec —— 把 lib/skewb-solver 的模型接到共享画板机制上(_PaintToolbar 的色板 /
 * 动作条、_paint-shared 的同块规则与 usePainter 全是 spec 驱动的)。
 *
 * 与二阶那份的差别只有三处:`n: 0`(不是 NxN,画布由 `_InteractiveSkewbNet` 自己按展开图画)、
 * 配色走 tnoodle 自己那套(与预览图 / tnoodle PDF 同一份,不是 WCA 三阶配色)、块型只有角。
 */

import {
  EMPTY_SKEWB_FACELET, SKEWB_STICKERS, SKEWB_STICKERS_PER_COLOR, SKEWB_STICKER_SIBLINGS,
  SOLVED_SKEWB_FACELET, friendlySkewbErr, randomLegalSkewbFacelet, validateSkewbFacelet,
} from '@/lib/skewb-solver';
import { SKEWB_DEFAULT_COLORS } from '@/app/[lang]/scramble/gen/_svg/skewb_svg';
import type { FaceLetter, PaintSpec } from './_paint-shared';

/** tnoodle 的斜转配色(U 白 / R 蓝 / F 红 / D 黄 / L 绿 / B 橙),按 FaceLetter 取。 */
export const SKEWB_COLOR_HEX = Object.fromEntries(
  (['U', 'R', 'F', 'D', 'L', 'B'] as FaceLetter[]).map((f) => [f, SKEWB_DEFAULT_COLORS[f]]),
) as Record<FaceLetter, string>;

export const SKEWB_PAINT: PaintSpec = {
  n: 0,
  size: SKEWB_STICKERS,
  maxPerColor: SKEWB_STICKERS_PER_COLOR,
  siblings: SKEWB_STICKER_SIBLINGS,
  empty: EMPTY_SKEWB_FACELET,
  solved: SOLVED_SKEWB_FACELET,
  fixedCenters: false,   // 斜转的中心块会动 → 30 格全可涂,取色只能点色板
  colors: SKEWB_COLOR_HEX,
  pieceLabel: '一个角块',
  validate: validateSkewbFacelet,
  friendlyErr: friendlySkewbErr,
  randomLegal: randomLegalSkewbFacelet,
};
