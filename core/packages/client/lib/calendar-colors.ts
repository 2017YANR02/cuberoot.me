// /calendar 的事件配色 —— 用户手选的「数据色」,不是主题色,所以在这里定死 hex,
// 完整 24 色按 Google Calendar 菜单排序;深色值取自维护者 2026-10-03 提供的
// iOS 深色菜单截图的 sRGB 色块中央像素,不受网站配色主题染色。
//
// 名字沿用 Google 日历那套(番茄 / 薰衣草 / 罗勒…),用户换过来不用重新认颜色。

import type { CalendarColor } from '@cuberoot/shared/calendar';
import { isCalendarHexColor } from '@cuberoot/shared/calendar';

export interface ColorDef {
  key: CalendarColor | `google:#${string}`;
  hex: string;
  darkHex: string;
  zh: string;
  en: string;
}

export const CALENDAR_COLOR_DEFS: ColorDef[] = [
  { key: 'google:#ad1457', hex: '#ad1457', darkHex: '#b84d7b', zh: '菊苣红', en: 'Radicchio' },
  { key: 'google:#d81b60', hex: '#d81b60', darkHex: '#d9497e', zh: '樱花粉红', en: 'Cherry Blossom' },
  { key: 'flamingo', hex: '#e67c73', darkHex: '#e2867c', zh: '红鹤色', en: 'Flamingo' },
  { key: 'tomato', hex: '#d50000', darkHex: '#db4546', zh: '番茄红', en: 'Tomato' },
  { key: 'tangerine', hex: '#f4511e', darkHex: '#f16f45', zh: '橘红', en: 'Tangerine' },
  { key: 'google:#ef6c00', hex: '#ef6c00', darkHex: '#ea842f', zh: '南瓜色', en: 'Pumpkin' },
  { key: 'google:#f09300', hex: '#f09300', darkHex: '#eaa130', zh: '芒果黄', en: 'Mango' },
  { key: 'banana', hex: '#f6bf26', darkHex: '#ecc24a', zh: '香蕉黄', en: 'Banana' },
  { key: 'google:#e4c441', hex: '#e4c441', darkHex: '#dbc359', zh: '香橼黄', en: 'Citron' },
  { key: 'google:#c0ca33', hex: '#c0ca33', darkHex: '#bcc44a', zh: '牛油果色', en: 'Avocado' },
  { key: 'google:#7cb342', hex: '#7cb342', darkHex: '#83b053', zh: '开心果绿', en: 'Pistachio' },
  { key: 'basil', hex: '#0b8043', darkHex: '#3d8f66', zh: '罗勒绿', en: 'Basil' },
  { key: 'sage', hex: '#33b679', darkHex: '#48b482', zh: '鼠尾草绿', en: 'Sage' },
  { key: 'google:#009688', hex: '#009688', darkHex: '#2c9b92', zh: '桉树绿', en: 'Eucalyptus' },
  { key: 'peacock', hex: '#039be5', darkHex: '#30a8e4', zh: '孔雀蓝', en: 'Peacock' },
  { key: 'google:#4285f4', hex: '#4285f4', darkHex: '#5f96f2', zh: '钴蓝', en: 'Cobalt' },
  { key: 'lavender', hex: '#7986cb', darkHex: '#7f8aca', zh: '薰衣草色', en: 'Lavender' },
  { key: 'blueberry', hex: '#3f51b5', darkHex: '#6370bc', zh: '蓝莓色', en: 'Blueberry' },
  { key: 'google:#b39ddb', hex: '#b39ddb', darkHex: '#ae99d4', zh: '紫藤色', en: 'Wisteria' },
  { key: 'google:#9e69af', hex: '#9e69af', darkHex: '#9f6eaf', zh: '水晶紫', en: 'Amethyst' },
  { key: 'grape', hex: '#8e24aa', darkHex: '#9f52b4', zh: '葡萄紫', en: 'Grape' },
  { key: 'google:#795548', hex: '#795548', darkHex: '#896b61', zh: '可可棕', en: 'Cocoa' },
  { key: 'graphite', hex: '#616161', darkHex: '#737373', zh: '石墨黑', en: 'Graphite' },
  { key: 'google:#a79b8e', hex: '#a79b8e', darkHex: '#a4988a', zh: '桦木灰', en: 'Birch' },
];

const BY_KEY = new Map(CALENDAR_COLOR_DEFS.map((c) => [c.key as string, c]));
const BY_HEX = new Map(CALENDAR_COLOR_DEFS.map((c) => [c.hex, c]));
const DEFAULT_COLOR = BY_KEY.get('peacock')!;

/** The same palette also renders imported Google labels; custom hex remains unchanged. */
export const GOOGLE_LABEL_COLORS: Record<string, string> = Object.fromEntries(CALENDAR_COLOR_DEFS.map((c) => [c.hex, c.darkHex]));

/** 来源 hex 原样显示，不用最接近的调色板颜色替换。 */
export function colorHex(key: string, theme: 'light' | 'dark' = 'light'): string {
  if (/^google:#[\da-f]{6}$/i.test(key)) {
    const hex = key.slice(7).toLowerCase();
    return theme === 'dark' ? GOOGLE_LABEL_COLORS[hex] ?? hex : hex;
  }
  if (isCalendarHexColor(key)) return key;
  const def = BY_KEY.get(key) ?? DEFAULT_COLOR;
  return theme === 'dark' ? def.darkHex : def.hex;
}

export function colorName(key: string, isZh: boolean): string {
  if (/^google:#[\da-f]{6}$/i.test(key)) {
    const def = BY_HEX.get(key.slice(7).toLowerCase());
    return def ? (isZh ? def.zh : def.en) : key.slice(7);
  }
  if (isCalendarHexColor(key)) return key;
  const def = BY_KEY.get(key) ?? DEFAULT_COLOR;
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
