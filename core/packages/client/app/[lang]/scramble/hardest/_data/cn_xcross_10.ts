/**
 * 六色底 XCross 需要 10 步的全部 438 个状态 —— XCross 的上确界。
 *
 * 「六色底 XCross = 10」= 六个底色 × 四个 F2L 槽共 24 种口径**全部**要 10 步。
 * 单色底 4 槽 XCross 的最大深度就是 10(dist_xcross_1col 金标 d=10 = 4,998,960),
 * 所以这 438 个状态是整个 4.3e19 空间里最难开局的一撮:换哪个面当底都躲不掉 10 步。
 *
 * 438 = 下面 23 条代表在 48 元对称群(24 转体 × 镜像)下的轨道并集,轨道大小
 * 6/12/24/48 四档。tests/cn_xcross_10.test.ts 现场展开 23×48 去重,断言恰好
 * 命中上游给出的 438 个状态(逐个比对,不是只比个数)。
 *
 * ⚠ 来源分级:
 *   - 438 这个**上界**(不存在第 439 个)来自上游穷举搜索,本仓库没有复算能力 ——
 *     需要在 4.3e19 全空间上跑,已知最紧的可枚举上界是双色底 XCross d=10 的
 *     20,230,604 个状态(dist_xcross_2col 金标),而那一档的状态本身也没落地。
 *   - 「这 438 个确实都是六色底 10 步」是本地实证的:solver 的 std_analyzer
 *     (CUBE_RUN_FULL_STD=1)跑完 438 条,438×6 = 2,628 个 xcross 值全部为 10。
 *   - `optimal` 列由本机 cubeopt(h48 15G 剪枝表)对 23 条代表逐条复算,与表格一致;
 *     结论归档在 tests/fixtures/cn_xcross_10_golden.json 的 `optimal` 段(CI 没有那张表)。
 *   - 轨道结构 / 集合相等由 CI 测试现场证明。
 *
 * 数据来自用户自建表格 3x3.xlsx 的 `10f CN xcross uniq 23` 页(张铭源、颜瑞民)。
 */

export interface CnXcrossRep {
  /** 代表打乱(WCA 记号)。 */
  scramble: string;
  /** 该代表在 48 元对称群下的轨道大小 —— 六个数加起来 = 438。 */
  orbit: number;
  /** 整方最优步数 H*。 */
  optimal: number;
  /** 六个底色里 Cross 的最小 / 最大步数(XCross 恒为 10,故不单列)。 */
  crossMin: number;
  crossMax: number;
  /** 六个底色里 XXCross 的最小 / 最大步数。 */
  xxcMin: number | null;
  xxcMax: number | null;
  /** 六个底色里 XXXCross 的最小 / 最大步数。 */
  xxxcMin: number | null;
  xxxcMax: number | null;
  /** 最优 2x2x2 块步数(六色底口径)。 */
  block222: number | null;
  /** 最优 EO 步数。 */
  eo: number | null;
}

/** 六色底 XCross = 10 的状态总数。 */
export const CN_XCROSS_10_TOTAL = 438;

/** 全空间大小,用于算概率(1 / 9.87489e16)。 */
export const CUBE_STATES = '43252003274489856000';

/** 48 元对称群:24 个转体 × {恒等, M 镜像}。 */
export const CN_XCROSS_10_SYMMETRY_ORDER = 48;

export const CN_XCROSS_10_REPS: CnXcrossRep[] = [
  {
    scramble: "F R U' R2 U B' D2 L2 B U2 B2 U' L U' B' D' F' U2 R' U'",
    orbit: 6,
    optimal: 20,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 13,
    xxxcMax: 13,
    block222: 8,
    eo: 7
  },
  {
    scramble: "B2 D2 B2 R B2 R' D' R2 F2 U2 F R' B U B2 D L' F' R U'",
    orbit: 6,
    optimal: 20,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 13,
    xxxcMax: 13,
    block222: 7,
    eo: 7
  },
  {
    scramble: "D B' D2 B' U2 R D L' B F2 U2 F' D2 U F2 U2 L F' U'",
    orbit: 6,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 13,
    xxxcMax: 13,
    block222: 8,
    eo: null
  },
  {
    scramble: "F L' D R' D L2 R2 D B' U' F R' D2 L2 B D2 B2 L2 U'",
    orbit: 6,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 12,
    xxxcMin: 13,
    xxxcMax: 13,
    block222: 8,
    eo: null
  },
  {
    scramble: "U2 R B' L2 D' F' U B' L' B2 D R F2 U2 F' L' D2 F2 U'",
    orbit: 12,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "B2 D2 B' R' U2 R2 B2 R U' B2 U L2 U B F' D' L' R U'",
    orbit: 12,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "B2 F2 R' B D2 R U' L' B' U' R' D' F U' F' L F' R' U'",
    orbit: 48,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "D' R U2 B F U2 L' D F2 D2 L2 U B2 F' L2 F2 L2 R' U'",
    orbit: 12,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "D U B' L' R2 D' U' R' B F' D' R2 B U2 F D' R F U'",
    orbit: 48,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "D2 F U L2 B R B2 R2 U B' L' D R D2 F' U B' U' F'",
    orbit: 24,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 13,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "U' R' D' R B' D B' D2 R F' D U2 F2 L' R B R F' R'",
    orbit: 24,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "B' F2 U' L2 F' R' F' D2 B' R2 B2 D' B2 L R F' D F' U2",
    orbit: 12,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "F2 U2 B' L' F2 D' L F' R' D' R2 U B U2 L' D' R2 B2 U'",
    orbit: 24,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "F2 D R D L F2 D2 L2 F D' U B' R U' B2 U L2 F U2",
    orbit: 12,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "L U2 B F D R' D2 R' B2 D B2 L' R' B' L2 U F2 D U2",
    orbit: 48,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "L' D2 L' D U2 F U2 R B2 D' B' L F D L' F2 L' D U'",
    orbit: 24,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "F' R' D' B' L' R U' L2 D L B' D U2 L2 F L' R' D2 U2",
    orbit: 24,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "L' R D' U2 B F' R' U' R F2 U B' L B L R F D2 U'",
    orbit: 6,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 13,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "B2 F2 L' D2 B L2 D2 U' B L' R F U R2 D' B2 F L' U'",
    orbit: 12,
    optimal: 19,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "D2 B' U2 L2 F' D' R2 B2 F2 L' U2 B' D' F' L U' L2 R",
    orbit: 48,
    optimal: 18,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 10,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "L2 B' L R U B F' D' U B F2 L2 D' U' L' F2 D U'",
    orbit: 6,
    optimal: 18,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 12,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "R' F L' R2 D2 F2 U' R2 U B' U' F' U' R' D' B' U' F'",
    orbit: 12,
    optimal: 18,
    crossMin: 8,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 11,
    xxxcMin: 13,
    xxxcMax: 13,
    block222: 7,
    eo: null
  },
  {
    scramble: "R2 D' B2 F2 L R' B D' U' L B2 U2 L B' F D' R2 U'",
    orbit: 6,
    optimal: 18,
    crossMin: 6,
    crossMax: 8,
    xxcMin: 11,
    xxcMax: 12,
    xxxcMin: 13,
    xxxcMax: 14,
    block222: 7,
    eo: null
  }
];
