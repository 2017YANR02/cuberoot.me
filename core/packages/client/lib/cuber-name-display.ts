import { isDeletedOwner } from '@cuberoot/shared/account';

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

interface DisplayCuberNameOptions {
  /** 窄列里的外国名缩写为「名 + 姓氏首字母 + .」。 */
  compactForeign?: boolean;
}

function compactForeignName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name;
  const surnameInitial = Array.from(parts[parts.length - 1])[0];
  return `${parts[0]} ${surnameInitial}.`;
}

/** 根据当前语言返回选手显示名 */
export function displayCuberName(rawName: string, isZh: boolean, options?: DisplayCuberNameOptions): string {
  if (isZh) {
    const chineseName = extractChineseName(rawName);
    if (chineseName) return chineseName;
    const foreignName = stripChineseParens(rawName);
    return options?.compactForeign ? compactForeignName(foreignName) : foreignName;
  }
  return stripChineseParens(rawName);
}

/**
 * 站内作者位的显示名。ownerId 是归属键(shared/account.ts):账号注销后,公开内容的作者键被
 * 换成墓碑 `deleted:<uid>`、姓名快照清空,这里把那个空位补成「已注销用户」。
 *
 * 为什么不在存的时候就写死「已注销用户」四个字:那是一句中文,英文界面会照原样吐出来。
 * 名字的语言归渲染层管,库里只留一个不带任何身份的键。
 */
export function ownerDisplayName(
  ownerId: string | null | undefined,
  rawName: string | null | undefined,
  isZh: boolean,
): string {
  if (isDeletedOwner(ownerId)) return isZh ? '已注销用户' : 'Deleted user';
  return displayCuberName(rawName || '', isZh);
}
