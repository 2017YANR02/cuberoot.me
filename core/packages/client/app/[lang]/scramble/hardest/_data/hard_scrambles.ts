/**
 * 几条被反复引用的「极难打乱」—— 出处、整方最优步数、各阶段最优步数与一条见证解法。
 *
 * ⚠ 来源分级(与 cn_xcross_10.ts 同一套口径):
 *   - `crossByColor` / `xcrossByColor`:本地 solver 的 std_analyzer 实证(6 个底色逐个算)。
 *   - `stages[].count`:表格给的**最优**步数,本仓库没复核最优性;但 `stages[].solution`
 *     这条见证解法由 tests/hard_scrambles.test.ts 现场验证「确实解开了该阶段」且长度相符,
 *     所以「≤ count」是证过的,「= count」仍是表格口径。
 *   - `optimal`:整方最优 HTM,由本机 cubeopt(h48 15G 表)复核,见测试 fixture。
 *
 * 数据来自用户自建表格 3x3.xlsx 的 `hard scramble` 页。
 */

export type HardStageKey = 'cross' | 'xcross' | 'xxcross' | 'xxxcross';

export interface HardStage {
  key: HardStageKey;
  /** 表格给出的该阶段最优步数(六个底色取最小)。 */
  count: number;
  /** 一条达到该步数的解法 —— 测试会现场验它真的解开了这个阶段。 */
  solution: string;
}

export interface HardScramble {
  /** 出处:视频标题 / 网页 / 提出者,原样保留表格里的写法。 */
  source: string;
  scramble: string;
  /** 打乱本身的长度(HTM)。 */
  length: number;
  /** 整方最优步数 HTM。 */
  optimal: number;
  /** 六个底色各自的 Cross 最优步数(std_analyzer 实证)。 */
  crossByColor: number[];
  /** 六个底色各自的 XCross 最优步数(取四槽最小,std_analyzer 实证)。 */
  xcrossByColor: number[];
  stages: HardStage[];
  /** EO(棱定向)最优步数 —— 表格口径,未复核。 */
  eo: number | null;
  note?: { zh: string; en: string };
  /** 与本打乱成对出现的另一条(目前只有 superflip 复合那对)。 */
  partner?: { scramble: string; optimal: number; label: { zh: string; en: string } };
}

export const HARD_SCRAMBLES: HardScramble[] = [
  {
    source: 'I found the HARDEST Rubik’s Cube Scramble',
    scramble: "B F U F D R' F D L B2 U' B2 D B' R' F2 L2 R2 U'",
    length: 19,
    optimal: 19,
    crossByColor: [8, 8, 8, 8, 8, 8],
    xcrossByColor: [9, 9, 9, 9, 9, 9],
    stages: [
      { key: 'cross', count: 8, solution: "F R B L' B2 R2 F D" },
      { key: 'xcross', count: 9, solution: "F R D' B L' B2 R2 F D" },
      { key: 'xxcross', count: 11, solution: "F2 L F' B' R' D L F' U F2 L2" },
      { key: 'xxxcross', count: 13, solution: "F' B' U' B R2 B L' D2 F L2 D' R' L'" },
    ],
    eo: 7,
    note: {
      zh: '六个底色的 Cross 全是 8 步、XCross 全是 9 步 —— 差一步就进 438 那一撮。',
      en: 'Cross is 8 from every colour and XCross is 9 from every colour — one move short of the 438.',
    },
  },
  {
    source: 'Shuang Chen, Ruimin Yan',
    scramble: "F R U' R2 U B' D2 L2 B U2 B2 U' L U' B' D' F' U2 R' U'",
    length: 20,
    optimal: 20,
    crossByColor: [8, 8, 8, 8, 8, 8],
    xcrossByColor: [10, 10, 10, 10, 10, 10],
    stages: [
      { key: 'cross', count: 8, solution: "F R L D2 F B L D'" },
      { key: 'xcross', count: 10, solution: "F2 R D2 F U L U2 R' B' D'" },
      { key: 'xxcross', count: 11, solution: "F D2 F' R F R2 B2 U' L B D" },
      { key: 'xxxcross', count: 13, solution: "B U B2 D2 B' R F U' L B L2 D B" },
    ],
    eo: 7,
    note: {
      zh: '这一条就是 438 里的第 1 类代表:整方 20 步,六个底色的 XCross 全部 10 步。',
      en: 'This is representative #1 of the 438: 20 moves optimal, and XCross is 10 from all six colours.',
    },
  },
  {
    source: 'God’s Number is 20',
    scramble: "F U' F2 D' B U R' F' L D' R' U' L U B' D2 R' F U2 D2",
    length: 20,
    optimal: 20,
    crossByColor: [6, 6, 8, 8, 7, 7],
    xcrossByColor: [9, 9, 9, 9, 9, 9],
    stages: [
      { key: 'cross', count: 6, solution: 'F L B R F D' },
      { key: 'xcross', count: 9, solution: "F R' B' U' L' D2 L2 B D" },
      { key: 'xxcross', count: 11, solution: "F' R U2 B2 D' L2 F B' R D L'" },
      { key: 'xxxcross', count: 12, solution: "R' D F2 L U2 D2 F' B U R2 L' F'" },
    ],
    eo: null,
    note: {
      zh: 'cube20.org 首页那条 20 步态 —— 整方最难,但底色挑得好只要 6 步十字。',
      en: 'The 20-move state from the cube20.org front page — maximal overall, yet a well-chosen colour needs only a 6-move cross.',
    },
  },
  {
    source: 'Kliria the Kirlia',
    scramble: "U2 F' R' F2 D2 L2 D' R2 F2 U' F2 D U' B2 R2 F L B L2 U' R' D",
    length: 22,
    optimal: 19,
    crossByColor: [8, 8, 8, 8, 8, 8],
    xcrossByColor: [9, 9, 9, 9, 9, 9],
    stages: [
      { key: 'cross', count: 8, solution: "F R B L' B2 R2 F D" },
      { key: 'xcross', count: 9, solution: "U' R B' R2 F2 L U F' R'" },
      { key: 'xxcross', count: 11, solution: "F U B' R' D F B2 R2 B2 U2 L'" },
      { key: 'xxxcross', count: 12, solution: "L2 U' D' F' L' B' D L' R B2 D2 B" },
    ],
    eo: null,
  },
  {
    source: 'Chong Wen',
    scramble: "U F R2 D' F' L2 U F' B' U F' B' U L2 B' D' F R2 U F'",
    length: 20,
    optimal: 20,
    crossByColor: [1, 1, 5, 5, 5, 5],
    xcrossByColor: [8, 8, 8, 8, 8, 8],
    stages: [
      { key: 'cross', count: 1, solution: 'D2' },
      { key: 'xcross', count: 8, solution: "R B' D2 L' D2 R' B' D2" },
      { key: 'xxcross', count: 9, solution: "D2 F D2 B2 U B' U2 D2 F'" },
      { key: 'xxxcross', count: 12, solution: "F' D B' U2 B2 D' F2 U2 F' D B' D" },
    ],
    eo: null,
    note: {
      zh: '一步 D2 就有十字,却整方 20 步 —— 说明「十字好开」和「整方难」互不相干。',
      en: 'A single D2 gives the cross, yet the state is 20-move optimal — easy cross and hard cube are independent.',
    },
    partner: {
      scramble: "B R2 D B L2 R2 D B D R' F U' R2 D2 L U' F' L2 R' U'",
      optimal: 20,
      label: {
        zh: '叠一个 superflip 上去,仍然是 20 步最优',
        en: 'Compose a superflip onto it and it is still 20-move optimal',
      },
    },
  },
];
