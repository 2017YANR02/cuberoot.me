// NOTE: bar-chart-race 横条配色 — 按大洲固定 hue + 选手 ID 微调亮度/饱和度
//   6 大洲 + Multiple Continents 各自一个固定色相;country(WCA id)→ continent 走静态映射表
//   Top10HistoryPage / SorRace 共用,避免各写一份。
import { COUNTRY_TO_CONTINENT, type Continent } from '@/lib/country-continents';

export const CONTINENT_HUE: Record<Continent, number> = {
  'Asia': 0,                  // 红
  'Europe': 220,              // 蓝
  'Africa': 30,               // 橙
  'North America': 140,       // 绿
  'South America': 280,       // 紫
  'Oceania': 180,             // 青
  'Multiple Continents': 0,   // 灰(下方特判,降饱和)
};

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function colorForRow(pid: string, country: string | null | undefined): string {
  const ph = hashStr(pid);
  const continent = country ? COUNTRY_TO_CONTINENT[country] : undefined;
  if (!continent || continent === 'Multiple Continents') {
    return `hsl(0 0% ${42 + ((ph >>> 0) % 16)}%)`;  // 灰阶
  }
  const hue = CONTINENT_HUE[continent];
  const lightness = 42 + ((ph >>> 0) % 16);    // 42-57%
  const saturation = 55 + ((ph >>> 4) % 20);   // 55-74%
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}
