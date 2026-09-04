// Tutorial category display order, card tier and bilingual label.
//
// `cat` matches the `category` field in catalog.json verbatim. Kept as a
// data-only module (no lucide icons, no hooks) so the server metadata for
// /tutorial-legacy/c/<cat> can read the same labels the index page renders — otherwise
// the card would say "Chinese Resources" while the tab said "CHS". Icons stay
// in the index page, keyed by the same `cat`.
//
// A category present in catalog.json but missing here gets NO card on the index
// (the index only renders configured categories that have posts). Its /tutorial-legacy/c/
// URL still resolves, and its metadata falls back to the raw catalog name.

export type Tier = 'hero' | 'hero-side' | 'medium' | 'standard' | 'utility';

export interface CategoryConfig {
  cat: string;
  tier: Tier;
  label: { en: string; zh: string };
}

export const CATEGORY_CARDS: CategoryConfig[] = [
  // Tier 1 — 3 张大卡（1 hero + 2 hero-side）
  { cat: '3x3', tier: 'hero', label: { en: '3x3', zh: '三阶' } },
  { cat: '魔方根', tier: 'hero-side', label: { en: 'CubeRoot Method', zh: '魔方根方法' } },
  { cat: 'CHS', tier: 'hero-side', label: { en: 'Chinese Resources', zh: '中文资料' } },
  // Tier 2 — medium（3 per row）
  { cat: 'FMC', tier: 'medium', label: { en: 'FMC', zh: '最少步' } },
  { cat: '3BLD', tier: 'medium', label: { en: '3BLD', zh: '盲拧' } },
  { cat: '2x2', tier: 'medium', label: { en: '2x2', zh: '二阶' } },
  // Tier 3 — standard（4 per row）
  { cat: 'Roux', tier: 'standard', label: { en: 'Roux', zh: '桥式' } },
  { cat: 'SQ1', tier: 'standard', label: { en: 'SQ1', zh: 'SQ1' } },
  { cat: 'Skewb', tier: 'standard', label: { en: 'Skewb', zh: '斜转' } },
  { cat: 'Non-WCA', tier: 'standard', label: { en: 'Non-WCA', zh: '非 WCA' } },
  { cat: '4x4', tier: 'standard', label: { en: '4x4', zh: '四阶' } },
  { cat: 'Pyraminx', tier: 'standard', label: { en: 'Pyraminx', zh: '金字塔' } },
  { cat: '5x5', tier: 'standard', label: { en: '5x5', zh: '五阶' } },
  { cat: 'Megaminx', tier: 'standard', label: { en: 'Megaminx', zh: '五魔' } },
  { cat: 'Big', tier: 'standard', label: { en: 'Big Cubes', zh: '大魔方' } },
  { cat: 'Big BLD', tier: 'standard', label: { en: 'Big BLD', zh: '大魔方盲拧' } },
  { cat: 'Mehta', tier: 'standard', label: { en: 'Mehta', zh: 'Mehta' } },
  // Tier 4 — utility（2 per row，小条）
  { cat: 'Stats', tier: 'utility', label: { en: 'Stats', zh: '统计' } },
  { cat: 'Blogs', tier: 'utility', label: { en: 'Blogs', zh: '博客' } },
  { cat: 'Misc', tier: 'utility', label: { en: 'Misc', zh: '杂项' } },
  { cat: 'Solves', tier: 'utility', label: { en: 'Solves', zh: '解法分析' } },
  { cat: 'Tools', tier: 'utility', label: { en: 'Tools', zh: '工具' } },
  { cat: 'Hardware', tier: 'utility', label: { en: 'Hardware', zh: '硬件' } },
  { cat: 'Clock', tier: 'utility', label: { en: 'Clock', zh: 'Clock' } },
  { cat: 'Pretty Patterns', tier: 'utility', label: { en: 'Pretty Patterns', zh: '花样' } },
  { cat: 'Theory', tier: 'utility', label: { en: 'Theory', zh: '理论' } },
];

const BY_CAT = new Map(CATEGORY_CARDS.map((c) => [c.cat, c]));

/** Bilingual label for a category, or the raw catalog name for the handful of
 *  categories that have no card configured. */
export function categoryLabel(cat: string): { en: string; zh: string } {
  return BY_CAT.get(cat)?.label ?? { en: cat, zh: cat };
}
