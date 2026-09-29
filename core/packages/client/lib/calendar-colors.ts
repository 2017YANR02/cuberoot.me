// /calendar 的事件配色 —— 用户手选的「数据色」,不是主题色,所以在这里定死 hex,
// 深浅两组是 Google Calendar 现代配色的实际数据色，不受网站配色主题染色。
// 2026-09-28 在 Google 活动颜色菜单逐项核对；不能用 API 的旧版 pastel 色值代替 UI 色值。
//
// 名字沿用 Google 日历那套(番茄 / 薰衣草 / 罗勒…),用户换过来不用重新认颜色。

import type { CalendarColor } from '@cuberoot/shared/calendar';
import { isCalendarHexColor } from '@cuberoot/shared/calendar';

export interface ColorDef {
  key: CalendarColor;
  hex: string;
  darkHex: string;
  zh: string;
  en: string;
}

export const CALENDAR_COLOR_DEFS: ColorDef[] = [
  { key: 'peacock', hex: '#039be5', darkHex: '#4b99d2', zh: '孔雀蓝', en: 'Peacock' },
  { key: 'blueberry', hex: '#3f51b5', darkHex: '#6e72c3', zh: '蓝莓', en: 'Blueberry' },
  { key: 'lavender', hex: '#7986cb', darkHex: '#828bc2', zh: '薰衣草', en: 'Lavender' },
  { key: 'grape', hex: '#8e24aa', darkHex: '#a75aba', zh: '葡萄', en: 'Grape' },
  { key: 'flamingo', hex: '#e67c73', darkHex: '#d6837a', zh: '火烈鸟', en: 'Flamingo' },
  { key: 'tomato', hex: '#d50000', darkHex: '#da5234', zh: '番茄', en: 'Tomato' },
  { key: 'tangerine', hex: '#f4511e', darkHex: '#e3683e', zh: '橘子', en: 'Tangerine' },
  { key: 'banana', hex: '#f6bf26', darkHex: '#e7ba51', zh: '香蕉', en: 'Banana' },
  { key: 'sage', hex: '#33b679', darkHex: '#55b080', zh: '鼠尾草', en: 'Sage' },
  { key: 'basil', hex: '#0b8043', darkHex: '#489160', zh: '罗勒', en: 'Basil' },
  { key: 'graphite', hex: '#616161', darkHex: '#7c7c7c', zh: '石墨', en: 'Graphite' },
];

const BY_KEY = new Map(CALENDAR_COLOR_DEFS.map((c) => [c.key as string, c]));

/** Google modern 24-color labels, verified in both menus. Prefix distinguishes source colors from custom hex. */
export const GOOGLE_LABEL_COLORS: Record<string, string> = {
  '#ad1457': '#c05476', '#d81b60': '#d85675', '#e67c73': '#d6837a', '#d50000': '#da5234',
  '#f4511e': '#e3683e', '#ef6c00': '#dd7835', '#f09300': '#e0963c', '#f6bf26': '#e7ba51',
  '#e4c441': '#d8be5e', '#c0ca33': '#bcc256', '#7cb342': '#85ad59', '#0b8043': '#489160',
  '#33b679': '#55b080', '#009688': '#429a8e', '#039be5': '#4b99d2', '#4285f4': '#668be1',
  '#7986cb': '#828bc2', '#3f51b5': '#6e72c3', '#b39ddb': '#ae9cce', '#9e69af': '#a479b1',
  '#8e24aa': '#a75aba', '#795548': '#957367', '#616161': '#7c7c7c', '#a79b8e': '#a5998c',
};

/** 来源 hex 原样显示，不用最接近的调色板颜色替换。 */
export function colorHex(key: string, theme: 'light' | 'dark' = 'light'): string {
  if (/^google:#[\da-f]{6}$/i.test(key)) {
    const hex = key.slice(7).toLowerCase();
    return theme === 'dark' ? GOOGLE_LABEL_COLORS[hex] ?? hex : hex;
  }
  if (isCalendarHexColor(key)) return key;
  const def = BY_KEY.get(key) ?? CALENDAR_COLOR_DEFS[0];
  return theme === 'dark' ? def.darkHex : def.hex;
}

export function colorName(key: string, isZh: boolean): string {
  if (/^google:#[\da-f]{6}$/i.test(key)) return key.slice(7);
  if (isCalendarHexColor(key)) return key;
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
