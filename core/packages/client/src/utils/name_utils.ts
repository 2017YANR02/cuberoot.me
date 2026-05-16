// NOTE: 选手名处理工具 — 跨页面共享（wca / upcoming-comps 等）

const CJK_REGEX = /[\u4e00-\u9fff]/;
const PAREN_ZH_REGEX = /\(([^)]*[\u4e00-\u9fff][^)]*)\)\s*$/;

/** 从带括号的选手名中提取中文名，如 "Yiheng Wang (王艺衡)" → "王艺衡" */
export function extractChineseName(text: string): string | null {
  const m = PAREN_ZH_REGEX.exec(text);
  if (m && CJK_REGEX.test(m[1])) return m[1];
  return null;
}

/** 去掉选手名中所有括号及其内容（中文、韩文、注音等），如 "Yiheng Wang (王艺衡)" → "Yiheng Wang" */
export function stripChineseParens(text: string): string {
  return text.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

/**
 * 根据当前语言返回选手显示名
 * - 中文模式：优先提取括号里的中文；没有就去掉括号
 * - 英文模式：去掉括号（中文、韩文等）
 */
export function displayCuberName(rawName: string, isZh: boolean): string {
  if (isZh) {
    return extractChineseName(rawName) ?? stripChineseParens(rawName);
  }
  return stripChineseParens(rawName);
}
