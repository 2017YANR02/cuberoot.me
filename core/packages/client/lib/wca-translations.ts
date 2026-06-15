// Ported from packages/client-vite/src/pages/wca_stats/wca_translations.ts.
// 表格单元格 / 选手链接 中英文翻译。

import { extractChineseName } from './cuber-name-display';

export { extractChineseName, stripChineseParens } from './cuber-name-display';

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
  "3×3×3 Cube": "三阶", "Clock": "魔表", "Magic": "八板",
  "3×3×3 Multi-Blind Old Style": "旧多盲",
  "2x2x2 Cube": "二阶", "3x3x3 Cube": "三阶",
  "4x4x4 Cube": "四阶", "5x5x5 Cube": "五阶",
  "6x6x6 Cube": "六阶", "7x7x7 Cube": "七阶",
  "3x3x3 Blindfolded": "三盲", "3x3x3 Fewest Moves": "最少步",
  "3x3x3 One-Handed": "单手",
  "4x4x4 Blindfolded": "四盲", "5x5x5 Blindfolded": "五盲",
  "3x3x3 Multi-Blind": "多盲", "3x3x3 With Feet": "脚拧",
  "3x3x3 Multi-Blind Old Style": "旧多盲",
};

export const EVENT_EN: Record<string, string> = {
  "Rubik's Cube": "3x3", "2×2×2 Cube": "2x2",
  "4×4×4 Cube": "4x4", "5×5×5 Cube": "5x5",
  "6×6×6 Cube": "6x6", "7×7×7 Cube": "7x7",
  "3×3×3 Cube": "3x3",
  "3×3×3 Blindfolded": "3BLD", "3×3×3 Fewest Moves": "FMC",
  "3×3×3 One-Handed": "OH", "Rubik's Clock": "Clock",
  "4×4×4 Blindfolded": "4BLD", "5×5×5 Blindfolded": "5BLD",
  "3×3×3 Multi-Blind": "MBLD", "3×3×3 With Feet": "Feet",
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

export const VALUE_ZH: Record<string, string> = {
  "Single": "单次", "Average": "平均", "Mean": "平均",
  "Mo3": "三次平均",
  "Still active": "至今",
};

export const VALUE_EN: Record<string, string> = {
  "Average": "Avg",
};

export function translateCellText(text: string, columnKey: string, isZh?: boolean): string | null {
  if (columnKey === 'event') {
    if (isZh) return EVENT_ZH[text] ?? null;
    return EVENT_EN[text] ?? null;
  }
  if (columnKey === 'type' || columnKey === 'wr_metric') {
    if (isZh) return VALUE_ZH[text] ?? null;
    return VALUE_EN[text] ?? null;
  }
  if (isZh) return VALUE_ZH[text] ?? EVENT_ZH[text] ?? null;
  return VALUE_EN[text] ?? EVENT_EN[text] ?? null;
}

export function translatePersonLink(linkText: string): string | null {
  return extractChineseName(linkText);
}
