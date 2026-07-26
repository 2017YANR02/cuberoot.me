'use client';

/**
 * 金字塔的 PaintSpec —— 把 lib/pyraminx-solver 的模型接到共享画板机制上。
 *
 * 三处与立方体族不同:`n: 0`(不是 NxN,画布由 `_InteractivePyraNet` 自己按展开图画)、配色走
 * tnoodle 那套(与预览图 / tnoodle PDF 同源)、**没有对面色**(4 个面两两相邻,L+R 是一条真棱,
 * 沿用立方体的对面表会把合法状态拦掉)。
 */

import {
  EMPTY_PYRA_FACELET, PYRA_STICKERS, PYRA_STICKERS_PER_COLOR, PYRA_STICKER_SIBLINGS,
  SOLVED_PYRA_FACELET, friendlyPyraErr, randomLegalPyraFacelet, validatePyraFacelet,
} from '@/lib/pyraminx-solver';
import { PYRA_DEFAULT_COLORS } from '@/app/[lang]/scramble/gen/_svg/pyraminx_svg';
import type { FaceLetter, PaintSpec } from './_paint-shared';

/** 金字塔只有 4 个面(tnoodle 面序 F D L R):F 绿 / D 黄 / L 红 / R 蓝。 */
export const PYRA_PALETTE_FACES: readonly FaceLetter[] = ['F', 'D', 'L', 'R'];

export const PYRA_COLOR_HEX = Object.fromEntries(
  PYRA_PALETTE_FACES.map((f) => [f, PYRA_DEFAULT_COLORS[f]]),
) as Record<FaceLetter, string>;

export const PYRA_PAINT: PaintSpec = {
  n: 0,
  size: PYRA_STICKERS,
  maxPerColor: PYRA_STICKERS_PER_COLOR,
  siblings: PYRA_STICKER_SIBLINGS,
  empty: EMPTY_PYRA_FACELET,
  solved: SOLVED_PYRA_FACELET,
  fixedCenters: false,
  colors: PYRA_COLOR_HEX,
  opposite: {},          // 四面两两相邻 —— 一个块上任何两色都可能同时出现
  pieceLabel: '一个块',
  validate: validatePyraFacelet,
  friendlyErr: friendlyPyraErr,
  randomLegal: randomLegalPyraFacelet,
};
