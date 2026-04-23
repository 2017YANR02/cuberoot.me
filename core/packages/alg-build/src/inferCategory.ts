/**
 * 从文件路径推断分类 + 提供排序权重
 */

/** 顶层目录英文名 → 中文显示名 */
const TOP_DIR_ZH: Record<string, string> = {
  Big: '大魔方',
  'Big BLD': '大魔方盲拧',
  Blogs: '文章',
  Hardware: '硬件',
  Megaminx: '五魔',
  Misc: '杂项',
  'Non-WCA': '非WCA',
  'Pretty Patterns': '花样',
  Pyraminx: '金字塔',
  Skewb: '斜转',
  Solves: '解法分析',
  Stats: '统计',
  Theory: '理论',
  Tools: '工具',
  'WCA Scrambles': 'WCA打乱',
  魔方根: 'CubeRoot方法',
  CHS: '中文资料',
};

export function topDirToZh(topDir: string): string | null {
  return TOP_DIR_ZH[topDir] ?? null;
}

export interface CategoryInfo {
  category: string;
  subcategory: string | null;
  topDir: string;
}

/** relPath 形如 '3x3/CFOP/PLL.docx' → { category: '3x3', subcategory: 'CFOP', topDir: '3x3' } */
export function inferCategory(relPath: string): CategoryInfo {
  const parts = relPath.split(/[\\/]/).filter(Boolean);
  const topDir = parts[0] ?? 'Misc';
  const subcategory = parts.length > 2 ? parts[1] : null;
  return {
    category: topDir,
    subcategory,
    topDir,
  };
}

/** 列表排序权重：越小越靠前（核心内容置顶） */
const CATEGORY_ORDER: Record<string, number> = {
  魔方根: 5,
  '3x3': 10,
  Roux: 15,
  Mehta: 20,
  '3BLD': 25,
  '2x2': 30,
  '4x4': 35,
  '5x5': 40,
  Big: 45,
  'Big BLD': 50,
  Pyraminx: 60,
  Megaminx: 65,
  SQ1: 70,
  Skewb: 75,
  Clock: 80,
  FMC: 85,
  FTO: 90,
  Theory: 100,
  'Non-WCA': 110,
  Blogs: 120,
  Stats: 130,
  Tools: 140,
  Misc: 150,
  Hardware: 160,
  'Pretty Patterns': 170,
  Solves: 180,
  'WCA Scrambles': 190,
  CHS: 195,
};

/** slug 关键词精细排序（比 category 权重更强） */
const SLUG_KEYWORD_ORDER: Record<string, number> = {
  'cfop-tutorial': 1,
  pll: 2,
  oll: 3,
  zbll: 4,
  zbls: 5,
  '1lll': 6,
  f2l: 7,
  coll: 8,
  cmll: 9,
  roux: 11,
  mehta: 12,
};

export function categoryOrder(category: string): number {
  return CATEGORY_ORDER[category] ?? 200;
}

export function slugOrder(slug: string): number | null {
  for (const [kw, order] of Object.entries(SLUG_KEYWORD_ORDER)) {
    if (slug === kw || slug.startsWith(kw + '-') || slug.endsWith('-' + kw)) {
      return order;
    }
  }
  return null;
}
