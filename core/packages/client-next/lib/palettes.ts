// 中国色「配色主题」(palette) — 叠在现有 light/dark 之上的可选整套配色。
// 默认无 palette = 经典(站点原赭陶 light/dark,一行不动)。选某 palette 时
// <html data-palette=x>,实际 token 覆盖在 app/globals.css 的 :root[data-palette=x]{}
// 块里(那是色值单一来源);这里只存 picker 用的元数据(名字 / 明暗 / 预览色块)。
//
// 配色取自中国传统色(zhongguose.com 锚点),全部过 WCA 对比度:正文 11+,
// 强调字 4.5-8。改这里的 swatch / scheme 要跟 globals.css 对应块保持一致。

export type PaletteId = 'claude' | 'xinhuang' | 'yanqing' | 'danxia' | 'hantan' | 'wujin';

export interface PaletteMeta {
  id: PaletteId;
  zh: string;
  en: string;
  /** 该 palette 是浅底还是深底 — 决定 color-scheme / favicon / theme-color。 */
  scheme: 'light' | 'dark';
  /** picker 预览三色块:[背景, 强调, 文字]。 */
  swatch: [string, string, string];
}

export const PALETTE_KEY = 'palette';

export const PALETTES: PaletteMeta[] = [
  { id: 'claude', zh: '克劳德', en: 'Claude', scheme: 'light', swatch: ['#ece3d0', '#b1502f', '#2b2620'] },
  { id: 'xinhuang', zh: '新篁', en: 'Young Bamboo', scheme: 'light', swatch: ['#eef7f2', '#277a4b', '#1f3a2e'] },
  { id: 'yanqing', zh: '砚青', en: 'Inkstone Blue', scheme: 'light', swatch: ['#f7f4ed', '#2376b7', '#1b1c1f'] },
  { id: 'danxia', zh: '丹霞', en: 'Crimson Glow', scheme: 'light', swatch: ['#faf3ec', '#cc3a52', '#3a2420'] },
  { id: 'hantan', zh: '寒潭', en: 'Cold Pool', scheme: 'dark', swatch: ['#142b32', '#e3b59c', '#dfeae8'] },
  { id: 'wujin', zh: '乌金', en: 'Black Gold', scheme: 'dark', swatch: ['#1a1916', '#d9a82a', '#e8e1d2'] },
];

const SCHEME_BY_ID: Record<string, 'light' | 'dark'> = Object.fromEntries(
  PALETTES.map((p) => [p.id, p.scheme]),
);

export function isPaletteId(id: string | null | undefined): id is PaletteId {
  return !!id && id in SCHEME_BY_ID;
}

export function paletteScheme(id: string | null | undefined): 'light' | 'dark' | null {
  return id && id in SCHEME_BY_ID ? SCHEME_BY_ID[id] : null;
}
