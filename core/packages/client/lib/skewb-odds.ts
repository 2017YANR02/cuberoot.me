/**
 * 斜转(Skewb)的精确概率 —— 识别口径、纯中心情形、首步步数分布,全部落在同一个分母
 * 3,149,280 上,由 `lib/skewb-solver` 的运行时枚举现算。
 *
 * 为什么不像 `lib/eo-axes.ts` 那样在页面上现算:那边是列联表卷积,毫秒级;这边要扫全空间
 * 再跑四趟 BFS,约 2 秒,端到页面上就是白屏。所以走 `exact_dist.ts` 那条路 ——
 * **常量写在文件里,`tests/skewb_odds.test.ts` 每次跑都用 `computeSkewbOdds()` 重算一遍并逐个断言**。
 * 页面读常量(零延迟),数字仍然是 CI 现场自证的,不是抄的。
 *
 * ## 「棒」和「灯」是什么(不是我们发明的口径)
 *
 * 站内术语表 `wiki/glossary.json` 的原文:
 *   · **Bar 棒** = 2 connected stickers(2 连格)
 *   · **Light 灯** = line except the middle dot(线除去中间那个点)
 *
 * 落到斜转的一个面上(中心是个转 45° 的菱形,四个角是三角形,菱形的四个顶点顶在面的四条边中点):
 *   · 中心与同面任一角三角**共边**相连 → 两者同色就是一根**棒**;
 *   · 面上一条边的两端是两个角三角,中间隔着中心的一个顶点 → 这两个同色就是一对**灯**
 *     (它们所属的两个角块共用立方体的那条棱)。
 * 面上的对角两格既不共边也不成线,不算这两者。
 *
 * 这两条不是猜的:表格给的「No bar 51568/3149280」「No bar & no light 1040/3149280」两个数,
 * 只有按上面这个口径枚举才逐位对上(试过中心/相邻/对角的各种组合,别的都差着量级)。
 */

import {
  skewbGraph, skewbGraphStats, SKEWB_CORNER_BLOCKS, SKEWB_CORNER_SLOTS, SKEWB_SLOTS_PER_FACE,
} from '@/lib/skewb-solver';

export const SKEWB_TOTAL = 3_149_280;

/** WCA 打乱的下限:tnoodle 不给 ≤6 步就能解开的态,所以比赛里见到的只有这 3,077,655 个。 */
export const SKEWB_WCA_MIN_MOVES = 7;

export interface SkewbRecognition {
  /** 六个面都没有「中心 + 同面角块同色」。 */
  noBar: number;
  /** 六个面都没有「同一条边两端的两个角块同色」。 */
  noLight: number;
  noBarNoLight: number;
  /** 每一面的 5 格颜色两两不同 —— 棒、灯、对角同色一个都没有。 */
  rainbow: number;
  /** 某个面的首层已经还原(四角同色 + 四条侧带各自同色 + 该面中心同色)。 */
  skipLayer: number;
}

/** 角块全好、只剩中心没归位的 360 个态,按中心置换的轮型 × 最优步数拆开。 */
export interface SkewbCentresOnlyRow {
  /** 轮型(降序,省略不动点),`''` = 恒等。 */
  cycle: string;
  total: number;
  byDist: Record<number, number>;
}

export interface SkewbStepRow {
  key: 'face' | 'layer' | 'layerCentre' | 'centres';
  /** 目标态数(= 0 步档)。 */
  seeds: number;
  /** 下标 = 步数。 */
  hist: number[];
}

export interface SkewbOdds {
  total: number;
  /** 整解最优步数的精确分布(下标 = 步数,0..11)。 */
  histogram: number[];
  /** 最优解 ≥ 7 步的态数 = 比赛打乱的全集。 */
  wcaLegal: number;
  recognition: SkewbRecognition;
  centresOnly: SkewbCentresOnlyRow[];
  steps: SkewbStepRow[];
  /** 首层四角归位之后剩下的 case(中心与另外四角自由),按到还原的最优步数拆开。 */
  lastLayer: { cases: number; byDist: Record<number, number> };
}

// ─── 几何:全部从块划分推,不手抄哪三格是一个角 ───

const faceOfSlot = (slot: number) => Math.floor(slot / SKEWB_SLOTS_PER_FACE);

interface SkewbGeometry {
  /** 面 → 该面 4 个角格在 SKEWB_CORNER_SLOTS 里的下标。 */
  faceLocs: number[][];
  /** 一对「灯」:同面、且两个角块共用一条立方体棱。 */
  lightPairs: { a: number; b: number }[];
  /** 一对面对角(既不共边也不成线),用来判「整面无重复色」。 */
  diagPairs: { a: number; b: number }[];
  /** 面 f → 它的四个角块伸到侧面 g 上的那两格。 */
  sideBands: { f: number; bands: { g: number; locs: number[] }[] }[];
}

function geometry(): SkewbGeometry {
  const localOf = new Map<number, number>();
  SKEWB_CORNER_SLOTS.forEach((s, i) => localOf.set(s, i));
  const pieceOf = new Map<number, number>();
  const pieceFaces: number[][] = [];
  SKEWB_CORNER_BLOCKS.forEach((blk, pi) => {
    pieceFaces.push(blk.map(faceOfSlot));
    blk.forEach((s) => pieceOf.set(s, pi));
  });

  const faceLocs: number[][] = [];
  for (let f = 0; f < 6; f++) {
    const locs: number[] = [];
    for (let s = 1; s < SKEWB_SLOTS_PER_FACE; s++) locs.push(localOf.get(f * SKEWB_SLOTS_PER_FACE + s)!);
    faceLocs.push(locs);
  }

  const lightPairs: { a: number; b: number }[] = [];
  const diagPairs: { a: number; b: number }[] = [];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const pi = pieceOf.get(SKEWB_CORNER_SLOTS[faceLocs[f][i]])!;
        const pj = pieceOf.get(SKEWB_CORNER_SLOTS[faceLocs[f][j]])!;
        // 两个角块共用一条立方体棱 ⇔ 它们占的面集合交出 2 个面(本面 + 另一个)
        const shared = pieceFaces[pi].filter((x) => pieceFaces[pj].includes(x)).length;
        const pair = { a: faceLocs[f][i], b: faceLocs[f][j] };
        (shared === 2 ? lightPairs : diagPairs).push(pair);
      }
    }
  }

  const sideBands = faceLocs.map((locs, f) => {
    const byFace = new Map<number, number[]>();
    for (const l of locs) {
      const pi = pieceOf.get(SKEWB_CORNER_SLOTS[l])!;
      for (const s of SKEWB_CORNER_BLOCKS[pi]) {
        const gf = faceOfSlot(s);
        if (gf === f) continue;
        const arr = byFace.get(gf) ?? [];
        arr.push(localOf.get(s)!);
        byFace.set(gf, arr);
      }
    }
    return { f, bands: [...byFace].map(([g, ls]) => ({ g, locs: ls })) };
  });

  return { faceLocs, lightPairs, diagPairs, sideBands };
}

// ─── 现算 ───

/** 从一组目标态出发在全空间上广搜,返回逐步数的态数。 */
function bfsHistogram(seedOf: (cornerState: Uint8Array, centerState: Uint8Array) => boolean): SkewbStepRow['hist'] {
  const g = skewbGraph();
  const nK = g.center.n;
  const dist = new Uint8Array(g.total).fill(255);
  const qc = new Int32Array(g.total);
  const qk = new Int32Array(g.total);
  let head = 0;
  let tail = 0;
  for (let ci = 0; ci < g.corner.n; ci++) {
    const cs = g.corner.states[ci];
    for (let ki = 0; ki < nK; ki++) {
      if (!seedOf(cs, g.center.states[ki])) continue;
      dist[ci * nK + ki] = 0;
      qc[tail] = ci; qk[tail] = ki; tail++;
    }
  }
  while (head < tail) {
    const c = qc[head];
    const k = qk[head];
    head++;
    const d = dist[c * nK + k] + 1;
    for (let m = 0; m < 8; m++) {
      const nc = g.corner.moveTable[c * 8 + m];
      const nk = g.center.moveTable[k * 8 + m];
      const idx = nc * nK + nk;
      if (dist[idx] === 255) { dist[idx] = d; qc[tail] = nc; qk[tail] = nk; tail++; }
    }
  }
  const hist: number[] = [];
  for (let i = 0; i < g.total; i++) { const d = dist[i]; hist[d] = (hist[d] ?? 0) + 1; }
  for (let i = 0; i < hist.length; i++) hist[i] ??= 0;
  return hist;
}

/** 全空间精确统计。约 2 秒 —— 只给测试用,页面读下面的 `SKEWB_ODDS`。 */
export function computeSkewbOdds(): SkewbOdds {
  const g = skewbGraph();
  const nK = g.center.n;
  const { faceLocs, lightPairs, diagPairs, sideBands } = geometry();
  const stats = skewbGraphStats();

  const recognition: SkewbRecognition = {
    noBar: 0, noLight: 0, noBarNoLight: 0, rainbow: 0, skipLayer: 0,
  };
  const centresOnly = new Map<string, SkewbCentresOnlyRow>();
  const lastLayerDist: Record<number, number> = {};
  let lastLayerCases = 0;

  // 首层「归位」的锚:D 面(面序 U R F D L B 的第 4 个)四个角块各归各位。
  const D = 3;

  for (let ci = 0; ci < g.corner.n; ci++) {
    const cs = g.corner.states[ci];

    let hasLight = false;
    for (const p of lightPairs) if (cs[p.a] === cs[p.b]) { hasLight = true; break; }
    let hasDiag = false;
    for (const p of diagPairs) if (cs[p.a] === cs[p.b]) { hasDiag = true; break; }

    // 每面角格的颜色集合(位掩码)+ 该面四角是否同色 + 侧带是否成立
    const faceMask = new Uint8Array(6);
    const faceColor = new Uint8Array(6);
    const layerReady = new Uint8Array(6);
    for (let f = 0; f < 6; f++) {
      const l = faceLocs[f];
      faceMask[f] = (1 << cs[l[0]]) | (1 << cs[l[1]]) | (1 << cs[l[2]]) | (1 << cs[l[3]]);
      faceColor[f] = cs[l[0]];
      const uniform = cs[l[0]] === cs[l[1]] && cs[l[0]] === cs[l[2]] && cs[l[0]] === cs[l[3]];
      layerReady[f] = uniform && sideBands[f].bands.every(
        (b) => b.locs.length !== 2 || cs[b.locs[0]] === cs[b.locs[1]],
      ) ? 1 : 0;
    }

    // 角块全好(六面角格各自单色)—— 斜转只有唯一一个还原态,所以这等价于「只剩中心」
    const cornersSolved = faceColor.every((c, f) => faceMask[f] === (1 << c)) && faceColor.every((c, f) => c === f);
    // 首层四角归位:D 面四角显 D,且它们伸到侧面的两格各自就是那个侧面的颜色
    const layerHome = faceLocs[D].every((l) => cs[l] === D)
      && sideBands[D].bands.every((b) => b.locs.every((l) => cs[l] === b.g));

    for (let ki = 0; ki < nK; ki++) {
      const ks = g.center.states[ki];
      let hasBar = false;
      for (let f = 0; f < 6; f++) if (faceMask[f] & (1 << ks[f])) { hasBar = true; break; }

      if (!hasBar) recognition.noBar++;
      if (!hasLight) recognition.noLight++;
      if (!hasBar && !hasLight) recognition.noBarNoLight++;
      if (!hasBar && !hasLight && !hasDiag) recognition.rainbow++;
      for (let f = 0; f < 6; f++) {
        if (layerReady[f] && ks[f] === faceColor[f]) { recognition.skipLayer++; break; }
      }

      if (cornersSolved) {
        // 中心置换 σ:f 上现在这块中心的家在哪个面(角块已归位 ⇒ 家 = 颜色)
        const seen = new Array<boolean>(6).fill(false);
        const cyc: number[] = [];
        for (let f = 0; f < 6; f++) {
          if (seen[f]) continue;
          let len = 0;
          let x = f;
          while (!seen[x]) { seen[x] = true; x = ks[x]; len++; }
          if (len > 1) cyc.push(len);
        }
        cyc.sort((a, b) => b - a);
        const key = cyc.join('+');
        const row = centresOnly.get(key) ?? { cycle: key, total: 0, byDist: {} };
        const d = g.dist[ci * nK + ki];
        row.total++;
        row.byDist[d] = (row.byDist[d] ?? 0) + 1;
        centresOnly.set(key, row);
      }

      if (layerHome) {
        lastLayerCases++;
        const d = g.dist[ci * nK + ki];
        lastLayerDist[d] = (lastLayerDist[d] ?? 0) + 1;
      }
    }
  }

  const wcaLegal = stats.histogram.slice(SKEWB_WCA_MIN_MOVES).reduce((a, b) => a + b, 0);

  const faceUniform = (cs: Uint8Array, f: number) => {
    const l = faceLocs[f];
    return cs[l[0]] === cs[l[1]] && cs[l[0]] === cs[l[2]] && cs[l[0]] === cs[l[3]];
  };
  const bandsOk = (cs: Uint8Array, f: number) =>
    sideBands[f].bands.every((b) => b.locs.length !== 2 || cs[b.locs[0]] === cs[b.locs[1]]);

  const steps: SkewbStepRow[] = [
    { key: 'face', seeds: 0, hist: bfsHistogram((cs) => [0, 1, 2, 3, 4, 5].some((f) => faceUniform(cs, f))) },
    { key: 'layer', seeds: 0, hist: bfsHistogram((cs) => [0, 1, 2, 3, 4, 5].some((f) => faceUniform(cs, f) && bandsOk(cs, f))) },
    {
      key: 'layerCentre',
      seeds: 0,
      hist: bfsHistogram((cs, ks) => [0, 1, 2, 3, 4, 5].some(
        (f) => faceUniform(cs, f) && bandsOk(cs, f) && ks[f] === cs[faceLocs[f][0]],
      )),
    },
    { key: 'centres', seeds: 0, hist: bfsHistogram((_cs, ks) => ks.every((c, f) => c === f)) },
  ];
  for (const s of steps) s.seeds = s.hist[0];

  const order = ['', '2+2', '3', '4+2', '3+3', '5'];
  const rows = [...centresOnly.values()].sort((a, b) => order.indexOf(a.cycle) - order.indexOf(b.cycle));

  return {
    total: stats.total,
    histogram: stats.histogram,
    wcaLegal,
    recognition,
    centresOnly: rows,
    steps,
    lastLayer: { cases: lastLayerCases, byDist: lastLayerDist },
  };
}

/**
 * `computeSkewbOdds()` 的输出。**每个数都由 `tests/skewb_odds.test.ts` 现场重算后逐个断言**,
 * 改了求解器或口径就会红,不会静默漂。
 */
export const SKEWB_ODDS: SkewbOdds = {
  total: 3_149_280,
  histogram: [1, 8, 48, 288, 1728, 10248, 59304, 315198, 1225483, 1455856, 81028, 90],
  wcaLegal: 3_077_655,
  recognition: {
    noBar: 51_568,
    noLight: 117_360,
    noBarNoLight: 1_040,
    rainbow: 296,
    skipLayer: 3_110,
  },
  centresOnly: [
    { cycle: '', total: 1, byDist: { 0: 1 } },
    { cycle: '2+2', total: 45, byDist: { 8: 39, 9: 6 } },
    { cycle: '3', total: 40, byDist: { 8: 24, 9: 16 } },
    { cycle: '4+2', total: 90, byDist: { 9: 78, 10: 12 } },
    { cycle: '3+3', total: 40, byDist: { 10: 40 } },
    { cycle: '5', total: 144, byDist: { 10: 144 } },
  ],
  steps: [
    { key: 'face', seeds: 36_000, hist: [36_000, 262_080, 1_118_880, 1_609_920, 122_400] },
    { key: 'layer', seeds: 17_640, hist: [17_640, 141_120, 673_920, 1_686_960, 617_760, 11_880] },
    { key: 'layerCentre', seeds: 3_110, hist: [3_110, 24_880, 133_152, 666_904, 1_675_934, 640_870, 4_430] },
    { key: 'centres', seeds: 8_748, hist: [8_748, 69_984, 367_416, 997_272, 1_355_940, 349_920] },
  ],
  lastLayer: { cases: 1_080, byDist: { 0: 1, 6: 24, 7: 60, 8: 303, 9: 468, 10: 224 } },
};

/**
 * 表格里那格「纯中心三循环」:角块全好、三个中心轮换。24 个态 = 恰好一个本质情形
 * (24 个整体转向下的一条轨道),**最少 8 步** —— 表格写的 7 步不存在(见 `centresOnly`:
 * 角块全好的非还原态最少就是 8 步)。
 */
export const SKEWB_PURE_CENTRE_3CYCLE = { states: 24, moves: 8 } as const;

/**
 * `stats/scramble/puzzle_distribution.json` 里斜转那条 WCA 真题分布的副本 ——
 * 用来和上面的理论条件分布对账。测试直接读那个 JSON 核对,不许两边飘。
 */
export const SKEWB_WCA_SAMPLE = {
  sampleCount: 227_780,
  counts: { 7: 23_318, 8: 90_768, 9: 107_602, 10: 6_088, 11: 4 } as Record<number, number>,
};
