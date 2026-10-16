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

import { CUBE_FACE_FOR_COLOR_LETTER, CUBE_FILL, type CubeFace } from '@cuberoot/puzzle-render-core/support/cube-colors';
import { TIMER_COLOR_NAMES as COLOR_NAME, type TimerColorLetter as ColorLetter } from '@cuberoot/shared/timer';


import './cube-color-chip.css';

export * from './cube-color-model';
import { isCubeColorLetters } from './cube-color-model';

export interface CubeColorChipProps {
  localize?: (text: { en: string; zh: string }) => string;
  /** 色字母,1~2 片(`'GR'` 这样的整串也收)。认不出的字母整个不渲染。 */
  colors: string | readonly ColorLetter[];
  /** 悬浮 / 无障碍标题。不给就用颜色名(「绿 红」)。 */
  title?: string;
  className?: string;
  faceColors?: Readonly<Record<CubeFace, string>>;
}

export default function CubeColorChip({ colors, title, className, faceColors = CUBE_FILL, localize = (text) => text.en }: CubeColorChipProps) {
  const letters = (typeof colors === 'string' ? [...colors] : colors) as ColorLetter[];
  // 认不出的字母整块不画:一个颜色错了的色块比没有色块更糟,它会被当成真的。
  if (!isCubeColorLetters(letters.join(''))) return null;
  const label = title ?? letters.map(c => localize(COLOR_NAME[c])).join(' ');
  return (
    <span className={`ccc-chip${className ? ` ${className}` : ''}`} title={label} aria-label={label} role="img">
      {letters.map((c, i) => (
        <span key={`${c}-${i}`} style={{ background: faceColors[CUBE_FACE_FOR_COLOR_LETTER[c]] }} />
      ))}
    </span>
  );
}
