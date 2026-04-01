/**
 * 打乱生成器 — 从 pll_recognition_trainer/src/scripts/helpers.js 原版移植
 *
 * 核心逻辑：solution + dTurn + colorShift + crossColor → 完整打乱序列
 */

// NOTE: 底面颜色 → 整体旋转的映射，sr-puzzlegen 默认朝向是黄顶蓝前
export const crossColorToCubeRotation = (c: string): string => {
  switch (c) {
    case 'y': return 'x2';
    case 'b': return "x'";
    case 'r': return 'z';
    case 'g': return 'x';
    case 'o': return "z'";
    case 'w': return '';
    default:
      console.error('crossColorToCubeRotation: invalid color', c);
      return '';
  }
};

/**
 * 公式反转 — 将每个 move 取逆后整体反序
 * 例：R U R' → R U' R'
 */
export const inverseScramble = (s: string): string => {
  const arr = s.split(' ');
  return arr
    .map((it) => {
      if (it.length === 0) return '';
      if (it[it.length - 1] === '2') return it;
      if (it[it.length - 1] === "'") return it.slice(0, -1);
      return `${it}'`;
    })
    .reverse()
    .join(' ');
};

export interface PllCaseInstance {
  name: string;       // "Aa", "Jb", "Z" 等
  rotation: string;   // "", "y", "y2", "y'"
  dTurn: string;      // "", "d", "d2", "d'"
  colorShift: number; // 0-3，表示 y 旋转次数
  crossColor: string; // "w", "y", "b", "g", "r", "o"
}

/**
 * 根据 case 实例生成完整打乱序列
 * 原版来自 helpers.js scrambleForCase
 */
export const scrambleForCase = (
  pllCase: PllCaseInstance | null,
  pllMap: Record<string, Record<string, string>>,
  crossColorOverride?: string
): string => {
  if (!pllCase) return '';
  const cc = crossColorOverride ? crossColorOverride[0].toLowerCase() : pllCase.crossColor;
  const solution = pllMap[pllCase.name]?.['noAuf'] || '';
  const crossColorChange = crossColorToCubeRotation(cc);
  const colorShift = 'y '.repeat(pllCase.colorShift).trim();
  const inversedRotation = inverseScramble(pllCase.rotation);
  return `${crossColorChange} ${colorShift} ${pllCase.dTurn} ${solution} ${inversedRotation}`
    .replace(/\s+/g, ' ')
    .trim();
};
