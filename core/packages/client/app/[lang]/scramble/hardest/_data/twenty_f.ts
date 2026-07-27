/**
 * 20 步态(整解 HTM 最优解恰好 20 步)的两份上游语料,以及本站在它们上面算出来的东西。
 *
 * 语料本身是搬运,来源写在下面;**每一个数字都是本机复算的**,
 * `tests/twenty_f.test.ts` 每次跑都从 `tests/fixtures/` 里把两份语料重新读一遍再算一遍。
 *
 * 1. `20moves.zip`(kociemba.org):32,625 个**带非平凡对称性**的 20 步态。
 *    对称型这一列上游自己标了,本站用 `scramble/symmetry/_sym_core.ts` 的 48 元群独立复算,
 *    32,625 条逐条相同 —— 那张表和 Kociemba 的分类是同一套东西。
 * 2. `random1000.txt`(cube20.org):1000 个随机 20 步态。拿站内纯 TS 求解器量它们的开局难度。
 */

/** 带非平凡对称性的 20 步态条数(上游语料的行数)。 */
export const TWENTY_F_SYM_TOTAL = 32_625;

/** 其中「自身与自身的逆同构」(反对称集合含单位元)的条数。 */
export const TWENTY_F_SYM_SELF_INVERSE = 2_516;

/**
 * 按对称型的普查。`type` 是 `_sym_core.ts` 的 33 个点群名之一,
 * `example` 是该型在语料里的第一条(点进去可以在对称分析页里看)。
 * 33 个型里只有这 24 个出现 —— 另外 9 个(O / Td / D3d / C3v / T / D4 / D2d(face) / C4v / C1)一条都没有。
 */
export const TWENTY_F_SYM_CENSUS: { type: string; count: number; example: string }[] = [
  { type: 'Oh', count: 1, example: "U F U2 F L2 B U2 F L' R' F2 D R2 U2 L2 B F' L F2 D" },
  { type: 'Th', count: 3, example: "U F U' R' B F2 R F L' R D R' D2 F' R' B' U' B' R' D'" },
  { type: 'D4h', count: 1, example: "D L2 F2 R2 B' D2 L R U' R2 U' F2 D' R2 U' B' F' D2 R' U'" },
  { type: 'D3', count: 4, example: "U F U' R L2 U2 L F R2 D' L' B' U R L' F' B D2 R D'" },
  { type: 'C4h', count: 28, example: "R U R F' U' R' U2 R' U' B' U2 F' R L' U R B R F' D'" },
  { type: 'D2h(edge)', count: 5, example: "L R' F' R2 D' B' F' U L' R' D F R B D2 U' R U R' U'" },
  { type: 'D2d(edge)', count: 11, example: "U F U R B' R U2 D L U2 F L2 D R U' R D R L' F2" },
  { type: 'S6', count: 81, example: "U R U R F2 L U' B R' D' L2 U2 B' D2 L D2 L' U B2 F" },
  { type: 'D2h(face)', count: 17, example: "U F U D2 B' R D R' L' U L F' U2 D B D B2 R' L' F2" },
  { type: 'C2v(a1)', count: 39, example: "F2 U' F2 L2 D U2 F L' B R B2 U' R B' U L2 U2 B' D R" },
  { type: 'C2v(b)', count: 93, example: "R B R L2 D' R L' U' B D L2 U2 B2 U L' D2 L2 U' L' B" },
  { type: 'C2h(b)', count: 69, example: "R B U2 F R D2 R L' F' D' F2 D2 L F U' R D' F L' B'" },
  { type: 'D2(edge)', count: 11, example: "D' R2 U2 F2 D F' D' L' D F' L' B' D2 U B' L R2 D' L R2" },
  { type: 'C4', count: 37, example: "U F U2 B2 L2 B L D' F' R F' L U B' D F2 L2 R' B U2" },
  { type: 'D2(face)', count: 4, example: "B2 U R2 B D U2 R2 B R' D R2 D2 F' D' L' R' B' F' R' U'" },
  { type: 'S4', count: 75, example: "F R F U2 R2 F U R U B2 L' U F' D2 R D B' U F R" },
  { type: 'C2h(a)', count: 293, example: "F R F B2 D F2 R' L2 B2 D B R U2 F B R U' L B L2" },
  { type: 'C2v(a2)', count: 445, example: "R U R F' R B' D2 F' L' B' U' R2 F U' B' U' R2 D' F2 L" },
  { type: 'C3', count: 576, example: "U B U B F R2 D2 F' L2 R B' L2 U' F R2 D2 L U' R' D" },
  { type: 'Cs(b)', count: 863, example: "U B L' U' R' U2 F D' F R U2 B' F' U2 L2 R' F' L2 B U'" },
  { type: 'C2(b)', count: 2_725, example: "R B U' F' L B R' D' B U' R2 L' B2 D2 R2 D2 B' D' R2 D'" },
  { type: 'C2(a)', count: 4_464, example: "U F U F' L' D F U R D2 F R2 D2 F2 U' R2 U R' F U2" },
  { type: 'Cs(a)', count: 15_592, example: "U F U B' L' B' L D2 F' R D' L' F2 U2 F' B U' R2 D' R'" },
  { type: 'Ci', count: 7_188, example: "R U R B L2 B2 L' U2 D' R' D B2 D2 L B' U F2 L' F D" },
];

/**
 * 对称型最高的那一条就是 superflip:角块全归位、12 条棱全部原地翻转。
 * 测试里逐位验(cp/co/ep/eo),不是靠名气。
 */
export const TWENTY_F_SUPERFLIP = "U F U2 F L2 B U2 F L' R' F2 D R2 U2 L2 B F' L F2 D";

/** cube20.org 的随机 20 步态条数。 */
export const TWENTY_F_RANDOM_TOTAL = 1_000;

/**
 * 这 1000 条的开局难度(键 = 步数,值 = 条数)。三个口径都用站内纯 TS 求解器现算:
 * 单色底十字(黄)、六色底十字(6 个底色取 min)、EOCross(两条 EO 轴取 min,与站内真题列同口径)。
 */
export const TWENTY_F_RANDOM_CROSS: Record<number, number> = { 4: 5, 5: 61, 6: 435, 7: 484, 8: 15 };
export const TWENTY_F_RANDOM_CN_CROSS: Record<number, number> = { 1: 1, 4: 29, 5: 360, 6: 590, 7: 20 };
export const TWENTY_F_RANDOM_EOCROSS: Record<number, number> = { 6: 5, 7: 122, 8: 711, 9: 162 };

/** 同口径的全空间均值,用来做对照(前两个是穷举金标,EOCross 那个是 132 万条真题的样本均值)。 */
export const TWENTY_F_BASELINE = { cross: 5.812058, cnCross: 4.809458, eoCross: 7.219 };

/** 唯一一条十字一步就好的(绿底 `F'`)—— 开局最容易,整解照样 20 步。 */
export const TWENTY_F_EASY_CROSS = {
  scramble: "L2 F' D B' L' B R2 U D R2 U' B' L2 U2 R2 L2 B2 L2 D2 R",
  color: 'Green' as const,
  moves: "F'",
};

/** 平均步数:从直方图现算,别另存一个数。 */
export function twentyFMean(hist: Record<number, number>): number {
  let n = 0;
  let sum = 0;
  for (const [d, c] of Object.entries(hist)) { n += c; sum += Number(d) * c; }
  return sum / n;
}
