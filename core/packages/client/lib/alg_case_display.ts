/**
 * OLL / PLL case 的「英文名 + 编号」展示,以及 recon 注释用的精确 case 名映射。
 *
 * - OLL:DB 里 case 名是纯编号 "OLL 1".."OLL 57"。speedcubing 社区惯用英文名
 *   (DH / S+ / Sune 之类),这里把编号→英文名,列表展示成 "DH (1)"。
 * - PLL:DB 里是 Aa/Ab/.../Gd/Ua/Ub。其中 Aa→A+, Ab→A-, Ua→U-, Ub→U+ 改名,
 *   展示成 "A+ (Aa)";其余原样。
 *
 * 同一份映射既给 /alg/3x3/{oll,pll} 列表展示用,也给 recon 自动补全的注释
 * (`// OLL-S+` / `// PLL-Gd`)用。
 */
import type { AlgCase } from '@cuberoot/shared';

/** OLL 编号(1..57) → 社区英文名。来源:用户提供的 OLL 命名表。 */
export const OLL_NAME_BY_NUMBER: Record<number, string> = {
  1: 'DH', 2: 'DPi', 3: 'DS+', 4: 'DS-', 5: 'O+', 6: 'O-', 7: 'N+', 8: 'N-',
  9: 'Y-', 10: 'Y+', 11: 'M+', 12: 'M-', 13: 'J+', 14: 'J-', 15: 'L+', 16: 'L-',
  17: 'DL', 18: 'DU', 19: 'DT', 20: 'X', 21: 'H', 22: 'Pi', 23: 'U', 24: 'T',
  25: 'L', 26: 'S-', 27: 'S+', 28: 'A', 29: 'F+', 30: 'F-', 31: 'Q-', 32: 'Q+',
  33: 'T2', 34: 'C1', 35: 'K1', 36: 'W-', 37: 'K2', 38: 'W+', 39: 'Z-', 40: 'Z+',
  41: 'G-', 42: 'G+', 43: 'P-', 44: 'P+', 45: 'T1', 46: 'C3', 47: 'V-', 48: 'V+',
  49: 'R+', 50: 'R-', 51: 'I2', 52: 'I3', 53: 'E-', 54: 'E+', 55: 'I4', 56: 'I1',
  57: 'B',
};

/** PLL 改名:仅这 4 个,其余原样。 */
export const PLL_RENAME: Record<string, string> = {
  Aa: 'A+', Ab: 'A-', Ua: 'U-', Ub: 'U+',
};

/** "OLL 27" → 27;非该格式或越界返 null。 */
function ollNumber(name: string): number | null {
  const m = /^OLL\s+(\d+)$/.exec(name.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 57 ? n : null;
}

/** OLL 列表展示:"OLL 27" → "S+ (27)";无映射回退原名。 */
export function displayOllName(name: string): string {
  const n = ollNumber(name);
  if (n == null) return name;
  const en = OLL_NAME_BY_NUMBER[n];
  return en ? `${en} (${n})` : name;
}

/** PLL 列表展示:"Aa" → "A+ (Aa)";未改名原样。 */
export function displayPllName(name: string): string {
  const key = name.trim();
  const renamed = PLL_RENAME[key];
  return renamed ? `${renamed} (${key})` : name;
}

/** recon 注释用的精确 OLL case 名:"OLL 27" → "S+"(无映射回退原名)。 */
export function ollCommentName(name: string): string {
  const n = ollNumber(name);
  if (n == null) return name.trim();
  return OLL_NAME_BY_NUMBER[n] ?? name.trim();
}

/** recon 注释用的精确 PLL case 名:"Aa" → "A+";未改名原样。 */
export function pllCommentName(name: string): string {
  const key = name.trim();
  return PLL_RENAME[key] ?? key;
}

/** EPLL(只换棱)的 4 个 case,用改名后的展示名:U+ / U- / H / Z。 */
export const EPLL_NAMES = new Set(['U+', 'U-', 'H', 'Z']);

/** 某 PLL 是否 EPLL(传 DB 原名 Ua/Ub/H/Z 或展示名都行)。 */
export function isEpll(name: string): boolean {
  return EPLL_NAMES.has(pllCommentName(name));
}

/**
 * recon 注释里 PLL 行的完整标签(不含 `// `):EPLL 加 E 前缀。
 * "Ub" → "EPLL-U+","Gd" → "PLL-Gd"。
 */
export function pllCommentLabel(name: string): string {
  const display = pllCommentName(name);
  return (EPLL_NAMES.has(display) ? 'EPLL-' : 'PLL-') + display;
}

/**
 * ZBLL 组改名(展示层):Sune "S" → "S+",Antisune "AS" → "S-"。其余组(U/T/L/H/Pi)不变。
 * 仅作展示 / recon 注释用;DB 里的 subgroup / name / URL slug 仍是 S / AS —— 因为 "+"
 * 进 URL path 会被当成空格、破坏 /alg/3x3/zbll/s+2 这类链接,且 zbll_lookup 等按原名建表。
 */
export const ZBLL_GROUP_RENAME: Record<string, string> = { S: 'S+', AS: 'S-' };

/** ZBLL 顶层组 slug → 展示前缀。Sune S→S+,Antisune AS→S-,Pi 保留小写 i,其余大写。 */
const ZBLL_TOP_DISPLAY: Record<string, string> = {
  u: 'U', t: 'T', l: 'L', h: 'H', pi: 'Pi', s: 'S+', as: 'S-',
};

/**
 * ZBLL 组 / 子组 token → 展示名。顶层组(u/t/l/h/pi/s/as)和方向制子组(ur/sb/asf/pif…)
 * 都认,也兼容迁移前的数字制(u1→U1、s1→S+1)。S/AS 还原成 S+/S-,Pi 保留小写 i,方向
 * 字母大写。
 *   "ur"→"UR"  "sb"→"S+B"  "asf"→"S-F"  "pif"→"PiF"  "s"→"S+"  "pi"→"Pi"
 */
export function displayZbllToken(token: string): string {
  const t = token.trim().toLowerCase().replace(/\s+/g, '');
  const m = /^(as|s|pi|u|t|l|h)(.*)$/.exec(t); // 多字符前缀 as/pi 要排在单字母前
  if (!m) return token.trim().toUpperCase();
  return (ZBLL_TOP_DISPLAY[m[1]] ?? m[1].toUpperCase()) + m[2].toUpperCase();
}

/** ZBLL 案例名展示:"ZBLL AS 13" → "ZBLL S- 13","ZBLL S 13" → "ZBLL S+ 13";其余原样。 */
export function displayZbllName(name: string): string {
  const m = /^ZBLL\s+(AS|S)\s+(\d+)$/.exec(name.trim());
  if (!m) return name;
  const renamed = ZBLL_GROUP_RENAME[m[1]];
  return renamed ? `ZBLL ${renamed} ${m[2]}` : name;
}

/**
 * recon 注释用的 ZBLL 标签:"ZBLL AS 13" → "ZBLL-S-13","ZBLL S 13" → "ZBLL-S+13",
 * "ZBLL U 13" → "ZBLL-U13"(组按改名表,编号紧跟,匹配用户给的 `ZBLL-S-XX` 格式)。
 * 非 ZBLL case 名返回 null。
 */
export function zbllCommentLabel(name: string): string | null {
  const m = /^ZBLL\s+(AS|S|U|T|L|H|Pi)\s+(\d+)$/.exec(name.trim());
  if (!m) return null;
  const group = ZBLL_GROUP_RENAME[m[1]] ?? m[1];
  return `ZBLL-${group}${m[2]}`;
}

/** /alg 列表用:按 (puzzle, set) 决定是否套 OLL/PLL/ZBLL 展示变换。 */
export function displayAlgCaseName(puzzle: string, set: string, name: string): string {
  if (puzzle === '3x3' && set === 'oll') return displayOllName(name);
  if (puzzle === '3x3' && set === 'pll') return displayPllName(name);
  if (puzzle === '3x3' && set === 'zbll') return displayZbllName(name);
  return name;
}

/**
 * case 的主名。有 `meta.ollcp`(1LLL 表导入的 case)就用它 —— 站长定的字母制命名优先,
 * 站上原来那个数字制名字降为副名(docs/1lll-migration.md §7 B8)。
 *
 * `PLL-A+` 里的 set 前缀是冗余的,剥掉 —— 不然 pll 页每张卡都顶着一个 `PLL-`。
 */
export function primaryCaseName(puzzle: string, set: string, c: AlgCase): string {
  const ollcp = c.meta?.ollcp;
  if (!ollcp) return displayAlgCaseName(puzzle, set, c.name);
  const prefix = `${set.toUpperCase()}-`;
  return ollcp.startsWith(prefix) ? ollcp.slice(prefix.length) : ollcp;
}
