/**
 * 换成四分之一转口径(QTM)之后最难的那一撮 —— cube20.org 的「已知 ≥24q 位置」语料。
 *
 * 上游发布的同样是**打乱**而不是位置(见 `twenty_f.ts` 的 `TWENTY_F_CORPUS`):
 * 一条打乱代表 96 / |稳定子| 个位置。本站把这 3,344 条的稳定子逐条数出来,得到下面每一个数。
 *
 * 能验的与不能验的,分清楚:
 *   - **能验**:每条打乱自身的 QTM 长度确实等于它那一列(24 / 25 / 26)—— 也就是「≤ 那个数」的见证;
 *     H 那一列就是打乱的步数;以及全部对称性分析(型、稳定子、代表多少个位置)。
 *   - **不能验**:「≥ 24q」这一半是上游的结论,要一个 QTM 最优求解器才能独立复核,站内只有 HTM 的管道。
 *     所以本站不说这些位置「就是」24q,只说上游如此声称,而我们复现了它的全部可复现部分。
 */

/** 语料条数(表格那份快照)。 */
export const KNOWN_24Q_TOTAL = 3_344;

/** 三类打乱的清点 —— 全部本机现数。 */
export const KNOWN_24Q_CENSUS = {
  /** 带非平凡对称性的条数,以及它们代表的位置数(只算 24q 那批)。 */
  symmetricScrambles: 3_324,
  symmetricPositions: 78_820,
  /** 无对称但有反对称:每条代表 48 个。 */
  antisymmetricOnly: 14,
  /** 对称、反对称都没有:每条代表 96 个 —— 上游说这类最难找。 */
  plain: 3,
  /** 按 QTM 深度分开的位置数。 */
  positions24: 79_780,
  positions25: 36,
  positions26: 3,
  /** 三档相加。 */
  positions: 79_819,
};

/**
 * 上游那页(2025-07-25 版)现在的数字,用来说明本站这份是旧快照:
 * 已知 24q 位置 94,372 个,其中带对称性的 78,820 个由 3,324 条打乱代表 —— 这两个数与本机复算逐位相同,
 * 长出来的全在「无对称」那一类(上游现在有 262 + 31 条,本快照只有 14 + 3 条)。
 */
export const KNOWN_24Q_UPSTREAM = {
  asOf: '2025-07-25',
  positions24: 94_372,
  symmetricPositions: 78_820,
  symmetricScrambles: 3_324,
  /** 无对称那批代表的位置数 = 262 × 48 + 31 × 96。 */
  plainPositions: 15_552,
  url: 'https://cube20.org/distance20s/',
};

/** 比 24q 还深的三条,全语料就这些。`positions` 是它代表的位置数(96 / 稳定子阶)。 */
export const KNOWN_24Q_DEEPEST: {
  q: number; scramble: string; type: string; stabilizer: number; positions: number; note: { zh: string; en: string };
}[] = [
  {
    q: 26,
    scramble: "U2 F U2 R' L F2 U F' B' R L U2 R U D' R L' D R' L' D2",
    type: 'D4h',
    stabilizer: 32,
    positions: 3,
    note: {
      zh: '唯一一个已知的 26q 位置(superflip + fourspot),自身与自身的逆同构;三个朝向算三个位置',
      en: 'the only known 26q position (superflip plus fourspot), self-inverse; its three orientations count as three positions',
    },
  },
  {
    q: 25,
    scramble: "U2 F U2 R' L F2 U F' B' R L U2 R U D' R L' D R' L' D'",
    type: 'C4',
    stabilizer: 8,
    positions: 12,
    note: { zh: '26q 那个的近邻', en: 'a neighbour of the 26q position' },
  },
  {
    q: 25,
    scramble: "U F U2 R' L F2 U F' B' R L U2 L U D' R' L D R' L' U2",
    type: 'C2(a)',
    stabilizer: 4,
    positions: 24,
    note: { zh: '另一个近邻', en: 'the other neighbour' },
  },
];
