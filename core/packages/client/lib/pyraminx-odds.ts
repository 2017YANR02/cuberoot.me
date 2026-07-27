/**
 * 金字塔(Pyraminx)核心的精确识别概率 —— 全部落在同一个分母 933,120 上,由
 * `lib/pyraminx-solver` 的运行时坐标枚举现算。
 *
 * 与 `lib/skewb-odds.ts` 同一条路子:**常量写在文件里,`tests/pyraminx_odds.test.ts` 每次跑都用
 * `computePyraminxOdds()` 全空间重算一遍并逐个断言**。页面读常量(零延迟),数字仍是 CI 现场自证。
 *
 * ## 面上哪些格算「相邻」—— 不看图,由块结构定
 *
 * 金字塔一个面 9 格:3 个尖(不在这 933,120 里)、3 个轴块、3 个棱块。轴块的 3 格是三个倒三角,
 * 棱块的 3 格是三个正三角(角上那三个正三角是尖)。于是面上的核心六格连成一个**六边形环**,
 * 轴、棱交替 —— 同面的两个轴块不相邻,两个棱块也不相邻,**所有相邻都是「轴 + 棱」**。
 *
 * 哪个轴与哪个棱相邻,不必读贴纸坐标图,块的**面集合**就定死了:轴块 A 在顶点 V 上,它的 3 格
 * 落在 V 的三个面上;棱块 E 在棱 VW 上,它的 2 格落在同时含 V、W 的那两个面上。于是
 *
 *   A 与 E 相邻 ⟺ E 的两个面都在 A 的三个面里 ⟺ V 是 E 的一端。
 *
 * 每个轴块邻 3 条棱、每对邻居共享 2 个面 → 4 × 3 × 2 = 24 条面内相邻,正是六边形环 × 4 面。
 *
 * ## 「棒」与「块」
 *
 * 站内术语表 `wiki/glossary.json`:**Bar 棒** = 2 connected stickers(2 连格)。落到金字塔上就是
 * 一条面内相邻两格同色。相邻的一对(轴块, 棱块)共享两个面,于是有两档:
 *   · 只在一个面上同色 → 面上看是一根**棒**;
 *   · 两个面上都同色 → 这条棱已经贴着这个轴块拼好了,是一个真正的**块**(表格叫 strong bar)。
 *
 * 表格 `Pyra` 页给的 `No strong bar 348053/933120` 按「块」这个口径逐位对上。
 * 同一页的 `No weak bar 180/933120` 试过十几种口径都复现不出来(最接近的两档:相邻同色一根都没有
 * 是 1,897,同面任意「轴 = 棱」同色都没有是 651),口径不明,不采纳 —— 详见 `docs/xlsx-stats-port.md`。
 */

import {
  PYRA_AXIAL_BLOCKS, PYRA_AXIAL_SLOTS, PYRA_CORE_STATE_COUNT, PYRA_EDGE_BLOCKS, PYRA_EDGE_SLOTS,
  PYRA_SLOTS_PER_FACE, pyraGraph,
} from '@/lib/pyraminx-solver';

export const PYRA_CORE_TOTAL = PYRA_CORE_STATE_COUNT;

/** 面内相邻的一对(轴块, 棱块)共享的两个面 —— 12 对邻居,24 条相邻。 */
export const PYRA_ADJACENT_PAIRS = 12;
export const PYRA_ADJACENCIES = 24;

export interface PyraminxOdds {
  total: number;
  /** 轴块朝向的取法(3⁴)与棱块摆法(6!/2 × 2⁵),两者相乘 = total。 */
  axialStates: number;
  edgeStates: number;
  /** 下标 = 面内相邻同色的条数(0..24)。 */
  barHist: number[];
  /** 下标 = 已拼好的「轴 + 棱」块数(0..12)。 */
  blockHist: number[];
  /** 一根棒都没有 = barHist[0]。 */
  noBar: number;
  /** 一个块都没有 = blockHist[0]。 */
  noBlock: number;
  /** 更严的一档:同一个面上任何「轴块格 = 棱块格」都没有(含不相邻的那 12 对)。 */
  noSameFaceMatch: number;
}

/**
 * 全空间枚举(~1.5s):两个坐标各自的颜色数组来自求解器的坐标索引表,
 * 逐对相乘扫 933,120 个态。**只在测试里跑**,页面读下面的常量。
 */
export function computePyraminxOdds(): PyraminxOdds {
  const g = pyraGraph();
  const faceOf = (s: number) => Math.floor(s / PYRA_SLOTS_PER_FACE);

  const axialColors: Uint8Array[] = new Array(g.axial.n);
  for (const [key, i] of g.axial.index) axialColors[i] = Uint8Array.from(key, (c) => c.charCodeAt(0));
  const edgeColors: Uint8Array[] = new Array(g.edge.n);
  for (const [key, i] of g.edge.index) edgeColors[i] = Uint8Array.from(key, (c) => c.charCodeAt(0));

  const aLoc = new Map(PYRA_AXIAL_SLOTS.map((s, i) => [s, i]));
  const eLoc = new Map(PYRA_EDGE_SLOTS.map((s, i) => [s, i]));

  /** 邻居对 → 它们共享的两个面上的 [轴格, 棱格];不相邻但同面的另记一份。 */
  const neighbours: Array<Array<readonly [number, number]>> = [];
  const sameFace: Array<readonly [number, number]> = [];
  for (const axial of PYRA_AXIAL_BLOCKS) {
    const axialFaces = new Set(axial.map(faceOf));
    for (const edge of PYRA_EDGE_BLOCKS) {
      const shared = edge.map(faceOf).filter((f) => axialFaces.has(f));
      const pairs = shared.map((f) => [
        aLoc.get(axial.find((s) => faceOf(s) === f)!)!,
        eLoc.get(edge.find((s) => faceOf(s) === f)!)!,
      ] as const);
      sameFace.push(...pairs);
      if (shared.length === 2) neighbours.push(pairs);
    }
  }
  if (neighbours.length !== PYRA_ADJACENT_PAIRS) throw new Error('pyraminx-odds: 邻居对数不是 12');
  const adjacent = neighbours.flat();
  if (adjacent.length !== PYRA_ADJACENCIES) throw new Error('pyraminx-odds: 面内相邻不是 24 条');

  const barHist = new Array<number>(PYRA_ADJACENCIES + 1).fill(0);
  const blockHist = new Array<number>(PYRA_ADJACENT_PAIRS + 1).fill(0);
  let noSameFaceMatch = 0;

  for (let ai = 0; ai < g.axial.n; ai++) {
    const ac = axialColors[ai];
    for (let ei = 0; ei < g.edge.n; ei++) {
      const ec = edgeColors[ei];
      let bars = 0;
      for (const [x, y] of adjacent) if (ac[x] === ec[y]) bars++;
      let blocks = 0;
      for (const pair of neighbours) if (pair.every(([x, y]) => ac[x] === ec[y])) blocks++;
      barHist[bars]++;
      blockHist[blocks]++;
      if (!sameFace.some(([x, y]) => ac[x] === ec[y])) noSameFaceMatch++;
    }
  }

  return {
    total: g.total,
    axialStates: g.axial.n,
    edgeStates: g.edge.n,
    barHist,
    blockHist,
    noBar: barHist[0],
    noBlock: blockHist[0],
    noSameFaceMatch,
  };
}

/** `computePyraminxOdds()` 的结果;CI 每次重算并逐字段断言。 */
export const PYRAMINX_ODDS: PyraminxOdds = {
  total: 933_120,
  axialStates: 81,
  edgeStates: 11_520,
  barHist: [
    1_897, 10_224, 34_068, 73_856, 125_946, 153_720, 163_964, 139_824, 107_121, 61_376,
    33_876, 16_704, 6_862, 2_520, 804, 144, 189, 0, 24, 0, 0, 0, 0, 0, 1,
  ],
  blockHist: [348_053, 336_408, 172_752, 57_248, 14_739, 3_192, 600, 96, 15, 16, 0, 0, 1],
  noBar: 1_897,
  noBlock: 348_053,
  noSameFaceMatch: 651,
};

/** 表格 `Pyra` 页给的「No strong bar」,与 `noBlock` 逐位相同。 */
export const PYRA_SHEET_NO_STRONG_BAR = 348_053;
/** 同页的「No weak bar」;复现不出来,只作为对照留在这里,不上页面。 */
export const PYRA_SHEET_NO_WEAK_BAR = 180;
