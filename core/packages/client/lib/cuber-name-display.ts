// Ported from packages/client-vite/src/utils/name_utils.ts.
// 选手名处理工具 — 跨页面共享。WCA API 返回 "Name (中文)" 形式,
// 我们渲染时不留括号:中文模式抽中文,英文模式去掉括号。

const CJK_REGEX = /[一-鿿]/;
const PAREN_ZH_REGEX = /\(([^)]*[一-鿿][^)]*)\)\s*$/;

/** 从带括号的选手名中提取中文名 */
export function extractChineseName(text: string): string | null {
  const m = PAREN_ZH_REGEX.exec(text);
  if (m && CJK_REGEX.test(m[1])) return m[1];
  return null;
}

/** 去掉选手名中所有括号及其内容 */
export function stripChineseParens(text: string): string {
  return text.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

/** 根据当前语言返回选手显示名 */
export function displayCuberName(rawName: string, isZh: boolean): string {
  if (isZh) {
    return extractChineseName(rawName) ?? stripChineseParens(rawName);
  }
  return stripChineseParens(rawName);
}
