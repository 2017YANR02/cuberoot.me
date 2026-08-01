// /calendar 的事件配色 —— 用户手选的「数据色」,不是主题色,所以在这里定死 hex,
// 深浅主题共用同一批色相(和 lib/cube-colors、bar-race-colors 同一路数)。
// 主题相关的部分(块底色透明度、文字对比、边框)在 calendar.css 里用 color-mix 从这些
// 色值派生,不在这里算,免得两套主题各留一份。
//
// 名字沿用 Google 日历那套(番茄 / 薰衣草 / 罗勒…),用户换过来不用重新认颜色。

import type { CalendarColor } from '@cuberoot/shared/calendar';

export interface ColorDef {
  key: CalendarColor;
  hex: string;
  zh: string;
  en: string;
}

export const CALENDAR_COLOR_DEFS: ColorDef[] = [
  { key: 'peacock', hex: '#039be5', zh: '孔雀蓝', en: 'Peacock' },
  { key: 'blueberry', hex: '#3f51b5', zh: '蓝莓', en: 'Blueberry' },
  { key: 'lavender', hex: '#7986cb', zh: '薰衣草', en: 'Lavender' },
  { key: 'grape', hex: '#8e24aa', zh: '葡萄', en: 'Grape' },
  { key: 'flamingo', hex: '#e67c73', zh: '火烈鸟', en: 'Flamingo' },
  { key: 'tomato', hex: '#d50000', zh: '番茄', en: 'Tomato' },
  { key: 'tangerine', hex: '#f4511e', zh: '橘子', en: 'Tangerine' },
  { key: 'banana', hex: '#f6bf26', zh: '香蕉', en: 'Banana' },
  { key: 'sage', hex: '#33b679', zh: '鼠尾草', en: 'Sage' },
  { key: 'basil', hex: '#0b8043', zh: '罗勒', en: 'Basil' },
  { key: 'graphite', hex: '#616161', zh: '石墨', en: 'Graphite' },
];

const BY_KEY = new Map(CALENDAR_COLOR_DEFS.map((c) => [c.key as string, c]));

/** 色值;认不出的 key 退回孔雀蓝(库里存的是枚举,只有脏数据会走到这)。 */
export function colorHex(key: string): string {
  return BY_KEY.get(key)?.hex ?? CALENDAR_COLOR_DEFS[0].hex;
}

export function colorName(key: string, isZh: boolean): string {
  const def = BY_KEY.get(key) ?? CALENDAR_COLOR_DEFS[0];
  return isZh ? def.zh : def.en;
}

/**
 * 块上文字该用黑还是白 —— 按 WCAG 相对亮度算,别凭眼睛猜:香蕉黄配白字在浅主题下
 * 直接糊掉。阈值 0.55 是这批色实测的分界(香蕉/火烈鸟走深字,其余走白字)。
 */
export function readableInk(hex: string): string {
  const n = hex.replace('#', '');
  const v = (i: number): number => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * v(0) + 0.7152 * v(2) + 0.0722 * v(4);
  return lum > 0.45 ? '#1b1b1b' : '#ffffff';
}
