'use client';

/**
 * CubeColorChip —— 一两片贴纸的颜色,画成一个小色块。
 *
 *     ▮▮  GR        ▮  W cross
 *
 * 站里到处在用**颜色字母**说 F2L 的槽和十字的面:求解器的槽位下拉写 `BL`、复盘的
 * 标注写 `GR` / `OB`(cubedb 那套两字母配色)、十字写 `W cross`。字母对认得的人是
 * 一秒的事,对别人是一道要背的表 —— 而这页面本来就在讲颜色。
 *
 * 所以把色块抽出来一份:哪儿写颜色字母,哪儿就摆得上。原来只有 `StageSolver` 的
 * 槽位下拉有(`SlotChip`),复盘那边照着再画一遍就是第二份真相 —— 两处的颜色、
 * 圆角、竖分隔迟早会不一样。
 *
 * 颜色取 `lib/cube-colors` 的 `CUBE_FILL`(全站单一来源),不在这里硬码。
 * 两片之间的竖线是**缝隙透出背景色**,不是画的线 —— 深浅主题都不用改。
 */

import { CUBE_FILL, type CubeFace } from '@/lib/cube-colors';
import { COLOR_NAME, type ColorLetter } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { tr } from '@/i18n/tr';

import './cube-color-chip.css';

/** 色字母 → 标准配色里的面。和 `lib/cube-colors` 的朝向约定一致。 */
const FACE_OF_LETTER: Record<ColorLetter, CubeFace> = {
  W: 'U', Y: 'D', G: 'F', B: 'B', O: 'L', R: 'R',
};

export const CUBE_COLOR_LETTERS = 'WYGBOR';

/** 这段文字是不是纯色字母(1~2 片)。调用方拿它决定要不要摆色块。 */
export function isCubeColorLetters(s: string): boolean {
  return s.length >= 1 && s.length <= 2 && [...s].every(c => CUBE_COLOR_LETTERS.includes(c));
}

/**
 * 一条标注开头那一两个色字母,没有就是 null。
 *
 * `GR` / `OB` 是那一对 F2L 的两片侧贴纸,`W cross` 是十字的颜色 —— 都是 cubedb 那套
 * 写法,认得的人一秒,不认得的要背一张表。
 *
 * 只认**开头**、只认 1~2 个字母、后面必须断开(空白 / `/` / 括号 / 到头)。末层的
 * `OLL-F-` / `PLL-T` / `EPLL-Z` 因此一个都不会误中 —— 首字母要么不是色字母,要么
 * 后面紧跟着别的字母。宁可少摆一个色块,也不能给 `OLL-F-` 摆一个橙色块。
 */
export function leadingCubeColors(label: string): string | null {
  const m = /^([WYGBOR]{1,2})(?=$|[\s/(])/.exec(label);
  return m ? m[1] : null;
}

export interface CubeColorChipProps {
  /** 色字母,1~2 片(`'GR'` 这样的整串也收)。认不出的字母整个不渲染。 */
  colors: string | readonly ColorLetter[];
  /** 悬浮 / 无障碍标题。不给就用颜色名(「绿 红」)。 */
  title?: string;
  className?: string;
}

export default function CubeColorChip({ colors, title, className }: CubeColorChipProps) {
  const letters = (typeof colors === 'string' ? [...colors] : colors) as ColorLetter[];
  // 认不出的字母整块不画:一个颜色错了的色块比没有色块更糟,它会被当成真的。
  if (!isCubeColorLetters(letters.join(''))) return null;
  const label = title ?? letters.map(c => tr(COLOR_NAME[c])).join(' ');
  return (
    <span className={`ccc-chip${className ? ` ${className}` : ''}`} title={label} aria-label={label} role="img">
      {letters.map((c, i) => (
        <span key={`${c}-${i}`} style={{ background: CUBE_FILL[FACE_OF_LETTER[c]] }} />
      ))}
    </span>
  );
}
