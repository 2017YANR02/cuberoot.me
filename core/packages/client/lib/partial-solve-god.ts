/**
 * 部分还原的上帝之数 —— "只要求还原一部分块"时,那个子目标自己的图直径与距离分布。
 *
 * 与 /scramble/stats 的精确穷举集(Cross / XCross / …)是同一类问题的另一支:那边的目标是
 * "CFOP 某个阶段做完",可以在**商空间**里 BFS(自由块直接不看);这里的目标是"整个魔方还原,
 * 而初始状态被限制成某族部分打乱",距离仍是全群 4.3×10¹⁹ 里的最优解长度 —— 只能逐个最优解。
 *
 * 两族数据都来自 cuBerBruce 2011 年在 speedsolving 的帖子(Cube Explorer 跑的)。本仓做了三件事:
 *   1. 用 `_sym_core.ts` 的 48 元对称群独立复算等价类数 —— 1152 / 3272 逐位对上;
 *   2. 用本机最优解器(cube48opt + h48 剪枝表)重跑每个等价类代表,复算逐深度分布;
 *   3. 按轨道大小加权,给出上游**没有**给的"逐状态"分布与真实平均步数。
 *
 * 第 3 条不是锦上添花。等价类大小并不相同(48 或 96),cuBerBruce 本人就写明
 * "the equivalence classes are not all the same size so you can't calculate the exact average
 * from these numbers"。拿类计数直接求平均会得到一个**没有物理意义**的数
 * (角 5-循环:13.1076 vs 真值 13.1129),见 `CLASS_MEAN_TRAP`。
 */

/** 一族"部分打乱" —— 除了列出的块,整个魔方是还原的。 */
export interface PartialSolveFamily {
  id: 'corner5' | 'edge5';
  name: { zh: string; en: string };
  /** 一句话说清这族是什么。 */
  what: { zh: string; en: string };
  /** 状态数的构造式(KaTeX)+ 它算出来的值。页面上并排显示,数字不孤立出现。 */
  formula: { tex: string; parts: { zh: string; en: string } };
  states: number;
  /** 48 元对称 + 反对称(取逆)下的等价类数。 */
  classes: number;
  /** 轨道大小 → 个数。全是 48 或 96 —— 这正是"类平均 ≠ 真平均"的原因。 */
  orbitSizes: Record<number, number>;
  /** 逐深度等价类数(cuBerBruce 公布的口径)。 */
  classCounts: Record<number, number>;
  /** 逐深度状态数(本机按轨道大小加权算出,上游未给)。 */
  stateCounts: Record<number, number>;
  /** 该族的上帝之数(HTM)。 */
  diameter: number;
  source: { label: string; href: string };
}

export const PARTIAL_SOLVE_FAMILIES: PartialSolveFamily[] = [
  {
    id: 'corner5',
    name: { zh: '角块 5-循环', en: 'Corner 5-cycles' },
    what: {
      zh: '8 个角里挑 5 个,让它们首尾相接转一圈(可带扭向),其余 3 角与全部 12 棱归位。',
      en: 'Five of the eight corners cycle among themselves (twists allowed); the other three corners and all twelve edges are solved.',
    },
    formula: {
      tex: '\\binom{8}{5}\\cdot 4!\\cdot 3^{4} = 56\\cdot 24\\cdot 81 = 108{,}864',
      parts: {
        zh: '选 5 个角 × 这 5 个位置上的 5-循环 × 扭向(5 个角的扭向和须 ≡ 0 mod 3,故只有 3⁴ 自由度)',
        en: 'choose the 5 corners × 5-cycles on those positions × twists (the five twists must sum to 0 mod 3, leaving 3⁴ degrees of freedom)',
      },
    },
    states: 108864,
    classes: 1152,
    orbitSizes: { 48: 36, 96: 1116 },
    classCounts: { 10: 13, 11: 31, 12: 229, 13: 445, 14: 414, 15: 20 },
    stateCounts: { 10: 1152, 11: 2976, 12: 21408, 13: 42144, 14: 39264, 15: 1920 },
    diameter: 15,
    source: {
      label: 'cuBerBruce, speedsolving 2011',
      href: 'https://www.speedsolving.com/threads/gods-numbers-for-partial-solves.29785/post-604819',
    },
  },
  {
    id: 'edge5',
    name: { zh: '棱块 5-循环', en: 'Edge 5-cycles' },
    what: {
      zh: '12 条棱里挑 5 条转一圈(可带翻转),其余 7 棱与全部 8 角归位。',
      en: 'Five of the twelve edges cycle among themselves (flips allowed); the other seven edges and all eight corners are solved.',
    },
    formula: {
      tex: '\\binom{12}{5}\\cdot 4!\\cdot 2^{4} = 792\\cdot 24\\cdot 16 = 304{,}128',
      parts: {
        zh: '选 5 条棱 × 5-循环 × 翻转(5 条棱的翻转数须为偶,故只有 2⁴ 自由度)',
        en: 'choose the 5 edges × 5-cycles × flips (an even number of the five must be flipped, leaving 2⁴ degrees of freedom)',
      },
    },
    states: 304128,
    classes: 3272,
    orbitSizes: { 48: 208, 96: 3064 },
    classCounts: { 6: 3, 7: 5, 8: 23, 9: 57, 10: 248, 11: 579, 12: 1212, 13: 1011, 14: 132, 15: 2 },
    stateCounts: {
      6: 192, 7: 480, 8: 2112, 9: 5472, 10: 22992,
      11: 54144, 12: 112800, 13: 93936, 14: 11904, 15: 96,
    },
    diameter: 15,
    source: {
      label: 'cuBerBruce, speedsolving 2011',
      href: 'https://www.speedsolving.com/threads/gods-numbers-for-partial-solves.29785/post-604819',
    },
  },
];

export const familyById = (id: PartialSolveFamily['id']): PartialSolveFamily =>
  PARTIAL_SOLVE_FAMILIES.find((f) => f.id === id)!;

/** Σ counts —— 校验用,也用来当分母。 */
export function totalOf(counts: Record<number, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

/** Σ d·count / Σ count。两种口径都用它 —— 差别只在传进来的是类计数还是状态计数。 */
export function meanOf(counts: Record<number, number>): number {
  let n = 0, s = 0;
  for (const [d, c] of Object.entries(counts)) { n += c; s += Number(d) * c; }
  return n === 0 ? NaN : s / n;
}

/** 化到最简的 `整数 + 分子/分母`(真平均都是有理数,写成小数会看不出它精确)。 */
export function meanFraction(counts: Record<number, number>): { whole: number; num: number; den: number } {
  let n = 0, s = 0;
  for (const [d, c] of Object.entries(counts)) { n += c; s += Number(d) * c; }
  const whole = Math.floor(s / n);
  let num = s - whole * n, den = n;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(num, den) || 1;
  num /= g; den /= g;
  return { whole, num, den };
}

/**
 * 「拿等价类当样本求平均」这个陷阱的现场证据。
 *
 * 表格 https://bit.ly/3x3odds 对这两族各报了一个平均步数,两个数都恰好等于**类平均** ——
 * 也就是把 1152 / 3272 个大小不等的等价类当成等权样本。差值不大(小数点后第 3 位),
 * 但它不是"精度问题",是算错了对象:类不是状态。两族同时中招,更说明是口径问题而非笔误。
 */
export const CLASS_MEAN_TRAP = {
  corner5: { published: 13.10763889, trueMean: 13.1128748 },
  edge5: { published: 11.969437652811736, trueMean: 11.9654356 },
} as const;
