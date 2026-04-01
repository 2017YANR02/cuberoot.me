// NOTE: WCA 统计数据运行时翻译——从 Legacy i18n.js 1:1 移植
// 用于表格单元格中的项目名、类型值、选手名的中英文显示

// NOTE: WCA 项目名 英文原始值 → 中文缩写 映射
// 规则：去掉"魔方"字样，三阶单手→单手，三阶脚拧→脚拧
export const EVENT_ZH: Record<string, string> = {
  "Rubik's Cube": "三阶", "2×2×2 Cube": "二阶",
  "4×4×4 Cube": "四阶", "5×5×5 Cube": "五阶",
  "6×6×6 Cube": "六阶", "7×7×7 Cube": "七阶",
  "3×3×3 Blindfolded": "三盲", "3×3×3 Fewest Moves": "最少步",
  "3×3×3 One-Handed": "单手", "Megaminx": "五魔",
  "Pyraminx": "金字塔", "Rubik's Clock": "魔表",
  "Skewb": "斜转", "Square-1": "SQ1",
  "4×4×4 Blindfolded": "四盲", "5×5×5 Blindfolded": "五盲",
  "3×3×3 Multi-Blind": "多盲", "3×3×3 With Feet": "脚拧",
  "Rubik's Magic": "八板", "Master Magic": "十二板",
  "Rubik's Cube: Multiple blind old style": "旧多盲",
  // NOTE: SQL 输出别名
  "3×3×3 Cube": "三阶", "Clock": "魔表", "Magic": "八板",
  "3×3×3 Multi-Blind Old Style": "旧多盲",
  // NOTE: × vs x 变体
  "2x2x2 Cube": "二阶", "3x3x3 Cube": "三阶",
  "4x4x4 Cube": "四阶", "5x5x5 Cube": "五阶",
  "6x6x6 Cube": "六阶", "7x7x7 Cube": "七阶",
  "3x3x3 Blindfolded": "三盲", "3x3x3 Fewest Moves": "最少步",
  "3x3x3 One-Handed": "单手",
  "4x4x4 Blindfolded": "四盲", "5x5x5 Blindfolded": "五盲",
  "3x3x3 Multi-Blind": "多盲", "3x3x3 With Feet": "脚拧",
  "3x3x3 Multi-Blind Old Style": "旧多盲",
};

// NOTE: WCA 项目名 英文原始值 → 英文缩写 映射
export const EVENT_EN: Record<string, string> = {
  "Rubik's Cube": "3x3", "2×2×2 Cube": "2x2",
  "4×4×4 Cube": "4x4", "5×5×5 Cube": "5x5",
  "6×6×6 Cube": "6x6", "7×7×7 Cube": "7x7",
  "3×3×3 Cube": "3x3",
  "3×3×3 Blindfolded": "3BLD", "3×3×3 Fewest Moves": "FMC",
  "3×3×3 One-Handed": "OH", "Rubik's Clock": "Clock",
  "4×4×4 Blindfolded": "4BLD", "5×5×5 Blindfolded": "5BLD",
  "3×3×3 Multi-Blind": "MBLD", "3×3×3 With Feet": "Feet",
  // NOTE: × vs x 变体
  "2x2x2 Cube": "2x2", "3x3x3 Cube": "3x3",
  "4x4x4 Cube": "4x4", "5x5x5 Cube": "5x5",
  "6x6x6 Cube": "6x6", "7x7x7 Cube": "7x7",
  "3x3x3 Blindfolded": "3BLD", "3x3x3 Fewest Moves": "FMC",
  "3x3x3 One-Handed": "OH",
  "4x4x4 Blindfolded": "4BLD", "5x5x5 Blindfolded": "5BLD",
  "3x3x3 Multi-Blind": "MBLD", "3x3x3 With Feet": "Feet",
  "3x3x3 Multi-Blind Old Style": "Old MBLD",
  "3×3×3 Multi-Blind Old Style": "Old MBLD",
  "Rubik's Cube: Multiple blind old style": "Old MBLD",
};

// NOTE: 简单值翻译映射——Type/Metric 等列
export const VALUE_ZH: Record<string, string> = {
  "Single": "单次", "Average": "平均", "Mean": "平均",
  "Mo3": "三次平均",
};

// NOTE: 从带括号中文名中提取中文
const CJK_REGEX = /[\u4e00-\u9fff]/;
const PAREN_ZH_REGEX = /\(([^)]*[\u4e00-\u9fff][^)]*)\)\s*$/;

export function extractChineseName(text: string): string | null {
  const m = PAREN_ZH_REGEX.exec(text);
  if (m && CJK_REGEX.test(m[1])) return m[1];
  return null;
}

// NOTE: 翻译表格单元格文本——同时支持中英文
// isZh: true=中文映射, false=英文缩短映射
export function translateCellText(text: string, columnKey: string, isZh?: boolean): string | null {
  if (columnKey === 'event') {
    if (isZh) return EVENT_ZH[text] ?? null;
    return EVENT_EN[text] ?? null;  // 英文模式也去掉 Cube 后缀
  }
  if (columnKey === 'type' || columnKey === 'wr_metric') {
    if (isZh) return VALUE_ZH[text] ?? null;
    return null;  // 英文模式 type 列不翻译
  }
  // 通用：任何列都可能出现 Single/Average/event
  if (isZh) return VALUE_ZH[text] ?? EVENT_ZH[text] ?? null;
  return EVENT_EN[text] ?? null;
}

// NOTE: 中文模式——Markdown 链接中提取括号内中文
export function translatePersonLink(linkText: string): string | null {
  return extractChineseName(linkText);
}

// NOTE: 去掉选手名中所有括号及其内容（中文、韩文、注音等）
export function stripChineseParens(text: string): string {
  return text.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}
