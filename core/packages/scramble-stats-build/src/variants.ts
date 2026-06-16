// 打乱难度统计的共享常量:变体 / 阶段 / 颜色子集定义。
// build.ts(直方图 + 示例)与 build_first_appearance.ts(首次出现时间线)共用,避免重复定义漂移。

export interface VariantSpec {
  key: string;
  file: string;
  id_col: string;
  stages: string[];
  // NOTE: angle → canonical color letter (Y/R/W/O/B/G)
  // 全部变体表头后缀统一为 z0..x3(std 记号),映射到颜色字母后脱离 angle 概念
  angleToColor: Record<string, ColorLetter>;
  colFor: (stage: string, angle: string) => string;
}

// NOTE: 颜色字母顺序（字母序）；subset key = sorted letters
export const COLOR_LETTERS = ['B', 'G', 'O', 'R', 'W', 'Y'] as const;
export type ColorLetter = typeof COLOR_LETTERS[number];

export const ANGLE_COLOR_STD: Record<string, ColorLetter> = {
  z0: 'Y', z1: 'R', z2: 'W', z3: 'O', x1: 'B', x3: 'G',
};

export const VARIANTS: VariantSpec[] = [
  {
    key: 'std',
    file: 'std.csv',
    id_col: 'id',
    stages: ['cross', 'xcross', 'xxcross', 'xxxcross', 'xxxxcross'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    key: 'eo',
    file: 'eo.csv',
    id_col: 'id',
    stages: ['eo_cross', 'eo_xcross', 'eo_xxcross', 'eo_xxxcross', 'eo_xxxxcross'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    key: 'pair',
    file: 'pair.csv',
    id_col: 'id',
    stages: ['cross_pair', 'xcross_pair', 'xxcross_pair', 'xxxcross_pair'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    key: 'pseudo',
    file: 'pseudo.csv',
    id_col: 'id',
    stages: ['pseudo_cross', 'pseudo_xcross', 'pseudo_xxcross', 'pseudo_xxxcross'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    key: 'pseudo_pair',
    file: 'pseudo_pair.csv',
    id_col: 'id',
    stages: [
      'pseudo_cross_pseudo_pair',
      'pseudo_xcross_pseudo_pair',
      'pseudo_xxcross_pseudo_pair',
      'pseudo_xxxcross_pseudo_pair',
    ],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // F2LEO = cross 进度 + 自由 F2L 棱 EO 门控；4 阶段(无 xxxxcross,届时无自由棱)
    key: 'f2leo',
    file: 'f2leo.csv',
    id_col: 'id',
    stages: ['f2leo_cross', 'f2leo_xcross', 'f2leo_xxcross', 'f2leo_xxxcross'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // Pseudo F2LEO = F2LEO + 角/棱槽解耦(off-by-D);4 阶段
    key: 'pseudo_f2leo',
    file: 'pseudo_f2leo.csv',
    id_col: 'id',
    stages: [
      'pseudo_f2leo_cross',
      'pseudo_f2leo_xcross',
      'pseudo_f2leo_xxcross',
      'pseudo_f2leo_xxxcross',
    ],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // 2x2x2 块(1 角 + 3 棱, cstimer 同语义);单阶段。每角度列 = 该底色 4 个贴底块的最小步数
    key: '222',
    file: '222.csv',
    id_col: 'id',
    stages: ['block222'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // Roux 第一块(UI key 按块尺寸叫 123;管道名/CSV 仍叫 roux):
    // fbsquare = 1x2x2 方块(1角+2棱, 每底色 8 目标最小);rouxs1 = 1x2x3(每底色 4 块最小)
    key: '123',
    file: 'roux.csv',
    id_col: 'id',
    stages: ['fbsquare', 'rouxs1'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // Petrus 2x2x3(2角+5棱);单阶段。每角度列 = 该底色 4 个 2x2x3 块的最小步数
    key: '223',
    file: '223.csv',
    id_col: 'id',
    stages: ['block223'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // 双 1x2x3(UI key 123x2;管道名/CSV 叫 f2b):D 层 4 角 + 6 棱联合最优。
    // 每角度列 = 该底色 2 个块对(侧轴 LR/FB)的最小步数
    key: '123x2',
    file: 'f2b.csv',
    id_col: 'id',
    stages: ['f2b'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // ZZ EOLine:eo = 全 12 棱定向(每底色 2 水平轴最小);eoline = eo + 线棱归位。
    // EO/DR 只依赖轴 ⇒ 对面底色列天然同值(z0≡z2 等),展示口径不变
    key: 'eoline',
    file: 'eoline.csv',
    id_col: 'id',
    stages: ['eo', 'eoline'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // DR(Kociemba phase-1 最优):降到 ⟨U,D,L2,R2,F2,B2⟩ 陪集;单阶段
    key: 'dr',
    file: 'dr.csv',
    id_col: 'id',
    stages: ['dr'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
];

// NOTE: 实际 UI 用到的 subset —— single (6), dual (3 对相反色), quad (3 种排除相反色对), cn (1)
// 共 6+3+3+1 = 13 个。dual/quad 只枚举 3 条相反色轴（WY / BG / OR）
export const OPPOSITE_PAIRS: [ColorLetter, ColorLetter][] = [
  ['W', 'Y'],
  ['B', 'G'],
  ['O', 'R'],
];

export function sortedKey(letters: ColorLetter[]): string {
  return [...letters].sort().join('');
}

export const SUBSET_KEYS: string[] = (() => {
  const all: ColorLetter[] = [...COLOR_LETTERS];
  const keys: string[] = [];
  for (const c of COLOR_LETTERS) keys.push(c);                    // size 1
  for (const p of OPPOSITE_PAIRS) keys.push(sortedKey(p));        // size 2
  for (const p of OPPOSITE_PAIRS) {
    const excl = new Set(p);
    keys.push(sortedKey(all.filter((c) => !excl.has(c))));         // size 4
  }
  keys.push(sortedKey(all));                                       // size 6
  return keys;
})();

// 给定 CSV 表头 + 变体,算每个 stage 的 6 颜色列下标 + 各 subset 的 bitmask。
// build.ts 与 build_first_appearance.ts 行内取 min 共用。
export type StagePlan = {
  colorIdx: number[];                          // [B,G,O,R,W,Y] 在 CSV 的列 idx
  subsetMasks: { key: string; mask: number }[];
};

export function buildStagePlans(header: string[], spec: VariantSpec): Map<string, StagePlan> {
  const idxMap = new Map<string, number>();
  header.forEach((h, i) => idxMap.set(h, i));
  const colorToAngle: Record<ColorLetter, string> = {} as Record<ColorLetter, string>;
  for (const [angle, color] of Object.entries(spec.angleToColor)) colorToAngle[color] = angle;

  const plans = new Map<string, StagePlan>();
  for (const stage of spec.stages) {
    const colorIdx: number[] = new Array(6).fill(-1);
    for (let i = 0; i < 6; i++) {
      const color = COLOR_LETTERS[i];
      const angle = colorToAngle[color];
      if (angle === undefined) throw new Error(`[${spec.key}] variant is missing color ${color}`);
      const col = spec.colFor(stage, angle);
      const idx = idxMap.get(col);
      if (idx === undefined) throw new Error(`[${spec.key}] missing column '${col}' in header`);
      colorIdx[i] = idx;
    }
    const subsetMasks = SUBSET_KEYS.map((key) => {
      let mask = 0;
      for (const ch of key) mask |= 1 << COLOR_LETTERS.indexOf(ch as ColorLetter);
      return { key, mask };
    });
    plans.set(stage, { colorIdx, subsetMasks });
  }
  return plans;
}
