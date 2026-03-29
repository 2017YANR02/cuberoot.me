// NOTE: WCA 统计数据运行时翻译——从 Legacy i18n.js 1:1 移植
// 用于表格单元格中的项目名、类型值、选手名的中文化

// NOTE: WCA 项目名 英文 → 中文 映射（对标 Legacy i18n.js _eventZh）
export const EVENT_ZH: Record<string, string> = {
  "Rubik's Cube": "三阶魔方", "2×2×2 Cube": "二阶魔方",
  "4×4×4 Cube": "四阶魔方", "5×5×5 Cube": "五阶魔方",
  "6×6×6 Cube": "六阶魔方", "7×7×7 Cube": "七阶魔方",
  "3×3×3 Blindfolded": "三盲", "3×3×3 Fewest Moves": "最少步",
  "3×3×3 One-Handed": "三阶单手", "Megaminx": "五魔",
  "Pyraminx": "金字塔", "Rubik's Clock": "魔表",
  "Skewb": "斜转", "Square-1": "SQ1",
  "4×4×4 Blindfolded": "四盲", "5×5×5 Blindfolded": "五盲",
  "3×3×3 Multi-Blind": "多盲", "3×3×3 With Feet": "三阶脚拧",
  "Rubik's Magic": "八板", "Master Magic": "十二板",
  "Rubik's Cube: Multiple blind old style": "旧多盲",
  // NOTE: 上游统计 SQL 输出的别名（与 WCA 官方全名不同）
  "3×3×3 Cube": "三阶魔方", "Clock": "魔表", "Magic": "八板",
  "3×3×3 Multi-Blind Old Style": "旧多盲",
  // NOTE: × vs x 变体（stats-build 可能输出 x 或 ×）
  "2x2x2 Cube": "二阶魔方", "3x3x3 Cube": "三阶魔方",
  "4x4x4 Cube": "四阶魔方", "5x5x5 Cube": "五阶魔方",
  "6x6x6 Cube": "六阶魔方", "7x7x7 Cube": "七阶魔方",
  "3x3x3 Blindfolded": "三盲", "3x3x3 Fewest Moves": "最少步",
  "3x3x3 One-Handed": "三阶单手",
  "4x4x4 Blindfolded": "四盲", "5x5x5 Blindfolded": "五盲",
  "3x3x3 Multi-Blind": "多盲", "3x3x3 With Feet": "三阶脚拧",
  "3x3x3 Multi-Blind Old Style": "旧多盲",
};

// NOTE: 简单值翻译映射——表格中的 Type/Metric 等列（对标 Legacy i18n.js _headerZh 中的值类条目）
export const VALUE_ZH: Record<string, string> = {
  "Single": "单次", "Average": "平均", "Mean": "平均",
  "Mo3": "三次平均",
};

// NOTE: 从带括号的中文名选手名中提取中文（对标 Legacy i18n.js 的选手翻译行为）
// 例如: "Xuanyi Geng (耿暄一)" → "耿暄一"
// 仅当中文模式且存在中文括号内容时生效
const CJK_REGEX = /[\u4e00-\u9fff]/;
const PAREN_ZH_REGEX = /\(([^)]*[\u4e00-\u9fff][^)]*)\)\s*$/;

export function extractChineseName(text: string): string | null {
  const m = PAREN_ZH_REGEX.exec(text);
  if (m && CJK_REGEX.test(m[1])) return m[1];
  return null;
}

// NOTE: 翻译表格单元格文本——根据列类型选择对应映射
// columnKey: header[j].key — 'event'/'type'/'person' 等
// 返回 null 表示不翻译
export function translateCellText(text: string, columnKey: string): string | null {
  // 项目名翻译
  if (columnKey === 'event') {
    return EVENT_ZH[text] ?? null;
  }
  // 类型翻译 (Single/Average/Mean)
  if (columnKey === 'type' || columnKey === 'wr_metric') {
    return VALUE_ZH[text] ?? null;
  }
  // 通用值翻译（表格中任何列都可能出现的 Single/Average）
  return VALUE_ZH[text] ?? EVENT_ZH[text] ?? null;
}

// NOTE: 中文模式——Markdown 链接中的选手名提取中文括号内容
// "[Xuanyi Geng (耿暄一)](url)" → "耿暄一"
export function translatePersonLink(linkText: string): string | null {
  return extractChineseName(linkText);
}

// NOTE: 英文模式——去掉括号内的中文内容，只保留英文名
// "[Xuanyi Geng (耿暄一)](url)" → "Xuanyi Geng"
// 对标 Legacy en 模式下的选手名显示
export function stripChineseParens(text: string): string {
  return text.replace(/\s*\([^)]*[\u4e00-\u9fff][^)]*\)\s*$/, '').trim();
}
