/**
 * 顶层最优步数分布的护栏(A9 的 1LLL 那一半)。
 *
 * fixture 是线上公式库 2026-07-27 那天四个 LL 集合的抽稀快照:每个 case 只留
 * `set / cn / htm / qtm / stm / sqtm`(5KB)。CI 不联网,所以这里锁的是
 * 「聚合逻辑 + 那天的库存」;库若被改动,`/math/probability` 面板上的现场对账会当场露馅。
 *
 * 最强的一条自检不靠 fixture:四个集合的 3,915 条轨道 + 还原态那条 = 3,916,
 * 而 3,916 正是 `orbitStats` 现场对 62,208 个顶层状态跑 AUF 双边作用数出来的轨道数。
 */
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import {
  LL_SOLVED_ORBIT, LL_UNIVERSE_TOTAL, llMeanLength, llOptimalBins, type OptimalMetric,
} from '@/lib/alg_probability';
import { enumerateUniverse, orbitStats } from '@/app/[lang]/math/probability/_components/ll_math';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

interface Row { set: string; cn: string; lens: Partial<Record<OptimalMetric, number>> }

const ROWS: Row[] = gunzipSync(readFileSync(path.join(FIXTURES, 'll_case_optimal.tsv.gz')))
  .toString('utf8').trim().split('\n').slice(1)
  .map((line) => {
    const [set, cn, htm, qtm, stm, sqtm] = line.split('\t');
    const lens: Partial<Record<OptimalMetric, number>> = {};
    for (const [k, v] of [['htm', htm], ['qtm', qtm], ['stm', stm], ['sqtm', sqtm]] as const) {
      if (v) lens[k] = Number(v);
    }
    return { set, cn, lens };
  });

/** 还原成 `llOptimalBins` 认得的最小 case 形状。 */
const asCase = (r: Row): AlgCase => ({
  id: 0,
  name: '',
  algs: [],
  meta: {
    sym: { cn: r.cn },
    optimal: Object.fromEntries(Object.entries(r.lens).map(([k, len]) => [k, { len }])),
  },
} as unknown as AlgCase);

const listsBySet = (sets: string[]) => sets.map((s) => ROWS.filter((r) => r.set === s).map(asCase));
const ALL = listsBySet(['1lll', 'zbll', 'ell', 'pll']);

describe('顶层四个集合:轨道数与状态数', () => {
  it('62,208 个状态的 AUF 轨道恰好 3,916 条 —— 现场数,不查表', () => {
    const universe = enumerateUniverse('1lll');
    expect(universe.length).toBe(LL_UNIVERSE_TOTAL);
    expect(orbitStats(universe).orbits).toBe(3916);
  });

  it('库里 3,915 条 + 还原态那条 = 3,916,一条不多一条不少', () => {
    expect(ROWS.length).toBe(3915);
    const bins = llOptimalBins(ALL);
    expect(bins.cases).toBe(3916);
    expect(bins.missing).toBe(0);
  });

  it('四个集合逐个的轨道合计与 lib/alg_probability 文件头的对账数一致', () => {
    const expected: Record<string, number> = { '1lll': 54_096, zbll: 7_488, ell: 336, pll: 284 };
    for (const [set, want] of Object.entries(expected)) {
      const bins = llOptimalBins(listsBySet([set]), 'htm', false);
      expect(bins.states, set).toBe(want);
    }
  });

  it('加上还原态那 4 个,状态总数正好铺满 62,208', () => {
    expect(llOptimalBins(ALL).states).toBe(LL_UNIVERSE_TOTAL);
    expect(LL_SOLVED_ORBIT.states).toBe(4);
  });
});

describe('顶层最优步数分布', () => {
  it('HTM:按状态计逐档锁死,平均 12.575 步', () => {
    const bins = llOptimalBins(ALL);
    expect(bins.byState).toEqual({
      0: 4, 6: 64, 7: 160, 8: 320, 9: 548, 10: 2_304, 11: 6_616,
      12: 15_576, 13: 23_348, 14: 12_016, 15: 1_236, 16: 16,
    });
    expect(llMeanLength(bins).toFixed(3)).toBe('12.575');
  });

  it('HTM:按 case 计逐档锁死 —— 与按状态计不成比例', () => {
    const bins = llOptimalBins(ALL);
    expect(bins.byCase).toEqual({
      0: 1, 6: 4, 7: 10, 8: 20, 9: 35, 10: 144, 11: 415,
      12: 976, 13: 1_471, 14: 760, 15: 79, 16: 1,
    });
  });

  it('差距最大的是还原那一档:1 个 case,却只占 4 个状态', () => {
    const bins = llOptimalBins(ALL);
    const caseShare = bins.byCase[0] / bins.cases;
    const stateShare = bins.byState[0] / bins.states;
    // 还原态的对称阶是 4,轨道只有 4 个状态 —— 普通 case 的四分之一
    expect(caseShare / stateShare).toBeCloseTo(3.97, 2);
    // 14 步那档聚了最多带对称的 case,所以按 case 计偏高
    expect(bins.byCase[14] / bins.cases).toBeGreaterThan(bins.byState[14] / bins.states);
  });

  it('1..5 步是空的:顶层最少也要 6 步才动得了', () => {
    const bins = llOptimalBins(ALL);
    for (const d of [1, 2, 3, 4, 5]) expect(bins.byState[d]).toBeUndefined();
    expect(bins.byState[6]).toBe(64);
  });

  it('四套度量都齐:每一套都覆盖全部 62,208 个状态,且 QTM ≥ HTM', () => {
    for (const m of ['htm', 'qtm', 'stm', 'sqtm'] as OptimalMetric[]) {
      const bins = llOptimalBins(ALL, m);
      expect(bins.states, m).toBe(LL_UNIVERSE_TOTAL);
      expect(bins.missing, m).toBe(0);
    }
    expect(llMeanLength(llOptimalBins(ALL, 'qtm')))
      .toBeGreaterThan(llMeanLength(llOptimalBins(ALL, 'htm')));
  });

  it('去掉还原态那条时,0 步档就该消失', () => {
    const bins = llOptimalBins(ALL, 'htm', false);
    expect(bins.byState[0]).toBeUndefined();
    expect(bins.states).toBe(LL_UNIVERSE_TOTAL - 4);
  });
});
