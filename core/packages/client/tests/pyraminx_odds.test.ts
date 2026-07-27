/**
 * 金字塔识别概率的护栏。
 *
 * 判据分三层:
 *   · **几何**:面内相邻只可能是「轴块 + 棱块」,而且由块的面集合唯一定死(4 × 3 对邻居 / 24 条相邻);
 *   · **重算**:`computePyraminxOdds()` 扫全部 933,120 个态,逐字段对上文件里的常量;
 *   · **换一条路**:浅层状态改走 tnoodle 自己的公式解析器生成 36 字符 facelet,再数一遍棒和块 ——
 *     与坐标索引表那条路必须逐个相同(验的是「坐标 → 颜色」的还原没错位)。
 * 外部锚点是表格 `Cube Odds.xlsx` 的 `Pyra` 页:`No strong bar 348053` 必须逐位命中。
 */
import { describe, expect, it } from 'vitest';
import {
  PYRAMINX_ODDS, PYRA_ADJACENCIES, PYRA_ADJACENT_PAIRS, PYRA_CORE_TOTAL,
  PYRA_SHEET_NO_STRONG_BAR, PYRA_SHEET_NO_WEAK_BAR, computePyraminxOdds,
} from '@/lib/pyraminx-odds';
import {
  PYRA_AXIAL_BLOCKS, PYRA_CORE_MOVE_NAMES, PYRA_EDGE_BLOCKS, PYRA_SLOTS_PER_FACE,
  SOLVED_PYRA_FACELET, pyraFaceletFromMoves,
} from '@/lib/pyraminx-solver';
import { MINX_LL, MINX_LL_CO, MINX_LL_EO, entryById } from '@/lib/skip-probability';

const faceOf = (s: number) => Math.floor(s / PYRA_SLOTS_PER_FACE);

/** 相邻 ⟺ 棱块的两个面都在轴块的三个面里(棱的一端就是轴所在的顶点)。 */
function neighbourPairs(): Array<Array<readonly [number, number]>> {
  const out: Array<Array<readonly [number, number]>> = [];
  for (const axial of PYRA_AXIAL_BLOCKS) {
    const axialFaces = new Set(axial.map(faceOf));
    for (const edge of PYRA_EDGE_BLOCKS) {
      const shared = edge.map(faceOf).filter((f) => axialFaces.has(f));
      if (shared.length !== 2) continue;
      out.push(shared.map((f) => [
        axial.find((s) => faceOf(s) === f)!,
        edge.find((s) => faceOf(s) === f)!,
      ] as const));
    }
  }
  return out;
}

describe('金字塔:面内相邻的结构', () => {
  const pairs = neighbourPairs();

  it('12 对邻居、24 条相邻,每个轴块邻 3 条棱、每条棱邻 2 个轴块', () => {
    expect(pairs.length).toBe(PYRA_ADJACENT_PAIRS);
    expect(pairs.flat().length).toBe(PYRA_ADJACENCIES);

    const perAxial = new Map<number, number>();
    const perEdge = new Map<number, number>();
    for (const pair of pairs) {
      const [aSlot, eSlot] = pair[0];
      const ai = PYRA_AXIAL_BLOCKS.findIndex((b) => b.includes(aSlot));
      const ei = PYRA_EDGE_BLOCKS.findIndex((b) => b.includes(eSlot));
      perAxial.set(ai, (perAxial.get(ai) ?? 0) + 1);
      perEdge.set(ei, (perEdge.get(ei) ?? 0) + 1);
    }
    expect([...perAxial.values()]).toEqual([3, 3, 3, 3]);
    expect([...perEdge.values()].sort()).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it('每个面上核心六格连成轴/棱交替的六边形环(同类不相邻)', () => {
    const byFace = new Map<number, number>();
    for (const pair of pairs) {
      for (const [aSlot, eSlot] of pair) {
        expect(faceOf(aSlot)).toBe(faceOf(eSlot));
        byFace.set(faceOf(aSlot), (byFace.get(faceOf(aSlot)) ?? 0) + 1);
      }
    }
    expect([...byFace.values()]).toEqual([6, 6, 6, 6]);
  });
});

describe('金字塔:全空间重算', () => {
  const odds = computePyraminxOdds();

  it('每个字段都与文件里的常量逐位相同', () => {
    expect(odds).toEqual(PYRAMINX_ODDS);
  });

  it('两张直方图各自加起来 = 933,120 = 3⁴ × (6!/2 × 2⁵)', () => {
    expect(odds.total).toBe(PYRA_CORE_TOTAL);
    expect(odds.axialStates * odds.edgeStates).toBe(PYRA_CORE_TOTAL);
    expect(odds.axialStates).toBe(3 ** 4);
    expect(odds.edgeStates).toBe((720 / 2) * 2 ** 5);
    expect(odds.barHist.reduce((a, b) => a + b, 0)).toBe(PYRA_CORE_TOTAL);
    expect(odds.blockHist.reduce((a, b) => a + b, 0)).toBe(PYRA_CORE_TOTAL);
  });

  it('满档只有还原态,而且 10 块、11 块根本拼不出来', () => {
    expect(odds.blockHist[12]).toBe(1);
    expect(odds.blockHist[11]).toBe(0);
    expect(odds.blockHist[10]).toBe(0);
    expect(odds.barHist[24]).toBe(1);
    expect(odds.barHist[23]).toBe(0);
    // 24 根棒 = 12 个块 = 还原:两张表的满档必须是同一个态
    expect(odds.barHist[24]).toBe(odds.blockHist[12]);
  });
});

describe('金字塔:速查表里的四条与枚举同源', () => {
  it('两个识别口径的分子就是枚举结果,两个分母就是 81 与 11,520', () => {
    expect(entryById('pyram-nobar').num).toBe(String(PYRAMINX_ODDS.noBar));
    expect(entryById('pyram-block').num).toBe(String(PYRAMINX_ODDS.noBlock));
    for (const id of ['pyram-nobar', 'pyram-block']) {
      expect(entryById(id).den).toBe(String(PYRAMINX_ODDS.total));
    }
    expect(entryById('pyram-axials').den).toBe(String(PYRAMINX_ODDS.axialStates));
    expect(entryById('pyram-edges').den).toBe(String(PYRAMINX_ODDS.edgeStates));
  });

  it('五魔顶层与金字塔核心撞了同一个 933,120,但因子毫无关系', () => {
    expect(MINX_LL).toBe(PYRAMINX_ODDS.total);
    expect(MINX_LL_CO * MINX_LL_EO).toBe(1296);
    expect(PYRAMINX_ODDS.axialStates).toBe(81);
  });
});

describe('金字塔:对表格', () => {
  it('No strong bar = 348,053 —— 「块」这个口径逐位命中', () => {
    expect(PYRAMINX_ODDS.noBlock).toBe(PYRA_SHEET_NO_STRONG_BAR);
  });

  it('No weak bar = 180 复现不出来:我们算得出的每一档都不是这个数', () => {
    const readings = [
      PYRAMINX_ODDS.noBar,              // 面内相邻同色一根都没有
      PYRAMINX_ODDS.noSameFaceMatch,    // 同面任意「轴格 = 棱格」都没有
      PYRAMINX_ODDS.noBlock,            // 一个块都没有
    ];
    for (const n of readings) expect(n).not.toBe(PYRA_SHEET_NO_WEAK_BAR);
    // 最接近的一档也差着一个数量级,不是舍入或差一
    expect(Math.min(...readings)).toBeGreaterThan(PYRA_SHEET_NO_WEAK_BAR * 3);
  });
});

describe('金字塔:换 tnoodle 那条路重数一遍', () => {
  it('≤3 步能到的每个态,facelet 上数出来的棒 / 块与坐标那条路相同', () => {
    const pairs = neighbourPairs();
    const barsOf = (facelet: string) => {
      let bars = 0;
      let blocks = 0;
      for (const pair of pairs) {
        let hit = 0;
        for (const [aSlot, eSlot] of pair) if (facelet[aSlot] === facelet[eSlot]) hit++;
        bars += hit;
        if (hit === 2) blocks++;
      }
      return { bars, blocks };
    };

    // 还原态:24 根棒、12 个块(全空间里独一份)
    expect(barsOf(SOLVED_PYRA_FACELET)).toEqual({ bars: 24, blocks: 12 });

    // 浅层 BFS:公式串交给 tnoodle 的解析器,拿回来的是 36 字符 facelet
    const seen = new Map<string, { bars: number; blocks: number }>();
    let frontier = [''];
    for (let d = 0; d < 3; d++) {
      const next: string[] = [];
      for (const alg of frontier) {
        for (const mv of PYRA_CORE_MOVE_NAMES) {
          const nextAlg = alg ? `${alg} ${mv}` : mv;
          const facelet = pyraFaceletFromMoves(nextAlg);
          if (seen.has(facelet)) continue;
          seen.set(facelet, barsOf(facelet));
          next.push(nextAlg);
        }
      }
      frontier = next;
    }
    expect(seen.size).toBeGreaterThan(200);

    // 同一批态在两张直方图里必须都数得到(浅层的分布是全空间分布的子集)
    const localBars = new Map<number, number>();
    const localBlocks = new Map<number, number>();
    for (const { bars, blocks } of seen.values()) {
      localBars.set(bars, (localBars.get(bars) ?? 0) + 1);
      localBlocks.set(blocks, (localBlocks.get(blocks) ?? 0) + 1);
    }
    for (const [bars, n] of localBars) {
      expect(PYRAMINX_ODDS.barHist[bars], `bars=${bars}`).toBeGreaterThanOrEqual(n);
    }
    for (const [blocks, n] of localBlocks) {
      expect(PYRAMINX_ODDS.blockHist[blocks], `blocks=${blocks}`).toBeGreaterThanOrEqual(n);
    }
  });
});
