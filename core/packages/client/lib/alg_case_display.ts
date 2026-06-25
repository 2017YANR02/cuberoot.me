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

/** /alg 列表用:按 (puzzle, set) 决定是否套 OLL/PLL 展示变换。 */
export function displayAlgCaseName(puzzle: string, set: string, name: string): string {
  if (puzzle === '3x3' && set === 'oll') return displayOllName(name);
  if (puzzle === '3x3' && set === 'pll') return displayPllName(name);
  return name;
}
