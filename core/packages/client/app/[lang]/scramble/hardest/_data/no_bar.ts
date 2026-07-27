/**
 * 「没有棒」家族:同色贴纸互不挨着的三阶状态。三档口径由严到松,
 * 全部在 `tests/no_bar.test.ts` 里对着上游语料逐条验过(见 `lib/no-bar.ts` 的口径定义)。
 *
 * 语料来自 `3x3.xlsx` 的三页,分别对应三档;稀有度不抄上游,本机自己采样。
 */

/** 三档口径的语料条数(上游给的,本站逐条验过它们确实满足对应口径)。 */
export const NO_BAR_CORPORA = [
  {
    key: 'bar' as const,
    total: 5_350,
    zh: '无棒:同一面上没有两块同色上下左右相邻',
    en: 'No bar: no two same-coloured stickers orthogonally adjacent on a face',
    example: "F R U2 B' R' D L2 D2 L2 B2 F' D U L2 F2 R U' L U'",
  },
  {
    key: 'contact' as const,
    total: 2_016,
    zh: '无接触:斜着挨着也不同色 —— 每个颜色在每一面上都成孤立格',
    en: 'No contact: not even diagonally, so every colour sits isolated on every face',
    example: "B F D B' F' U L' R' D B2 F2 L' R' U' B' F' U L' R' U'",
  },
  {
    key: 'line' as const,
    total: 4_082,
    zh: '无同线:每一行、每一列、两条对角线上都没有两块同色(不必相邻)',
    en: 'No line: no row, column or main diagonal of a face holds two of the same colour',
    example: "D' L2 U R D F2 R2 D2 U2 R' U R B' R'",
  },
];

/** 本机采样:均匀随机合法态 N 个里有多少个「无棒」。种子固定,测试重跑。 */
export const NO_BAR_SAMPLE = { n: 10_000_000, noBar: 61, noContact: 0, seed: 20260727 };

/**
 * 上游那页写的是「10¹⁰ 里找到 5,350 条」= 5.35 × 10⁻⁷,与本机采样的 6.1 × 10⁻⁶ 差 11 倍。
 * 本机采样器过了三项均匀性自检(角朝向全正 1/3⁷、棱朝向全正 1/2¹¹、角排列复原 1/8!,
 * 各差不到 1.3 个标准差),而那 5,350 条也逐条确实满足「无棒」——
 * 差的是**它那个分母**的来历,不是口径。所以页面报本机的数,上游那句只作记录。
 */
export const NO_BAR_UPSTREAM = { found: 5_350, outOf: 1e10 };
