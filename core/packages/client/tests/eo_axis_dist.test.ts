/*
 * lib/eo-axis-dist — 纯 EO 的多轴精确分布。
 *
 * 三件事必须每次跑都重算,不能只锁常量:
 *   1. 商空间合法(`delta` 只依赖棱的类)。塌了就该抛,不该给出安静的错数据。
 *   2. 「只看一条轴」跑同一遍枚举 = 单轴金标 × 34,650 —— 这是权重没算错的判据。
 *   3. 轴越多越浅:三轴的累计分布逐档 ≥ 两轴 ≥ 单轴。取最小值只会更小,这是结构性的。
 * 另外三条单轴、三条轴对必须各自同分布 —— 这就是「对面色恒等、四色=六色」在数据上的样子。
 */

import { describe, expect, it } from 'vitest';
import {
  EO_ARRANGEMENTS, EO_AXIS_STATES, EO_BEST_OF_2_HIST, EO_BEST_OF_3_HIST, EO_CLASS_MULTIPLICITY,
  EO_EDGE_CLASS, EO_ONE_AXIS_HIST, computeEoAxisDist,
} from '@/lib/eo-axis-dist';
import { eoHistogram } from '@/lib/cross-trainer/eoline';
import type { EoAxis } from '@/lib/cross-trainer/eo';

const SETS: EoAxis[][] = [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
const t0 = Date.now();
const DIST = computeEoAxisDist(SETS);
const MS = Date.now() - t0;

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
const cumulative = (a: readonly number[]) => a.reduce<number[]>((acc, c, i) => [...acc, (acc[i - 1] ?? 0) + c], []);

describe('EO 多轴精确分布', () => {
  it('12 条棱按「碰不到的轴」恰好三类各四条', () => {
    const n = [0, 0, 0];
    for (const c of EO_EDGE_CLASS) n[c]++;
    expect(n).toEqual([4, 4, 4]);
    expect(EO_ARRANGEMENTS * EO_CLASS_MULTIPLICITY * 2048).toBe(980995276800);
    expect(EO_AXIS_STATES).toBe(70963200);
    process.stdout.write(`[eo-axis] 7 组轴集合一次枚举:${MS} ms\n`);
  });

  it('每条轴单独跑 = 单轴金标 × 34,650', () => {
    expect([...EO_ONE_AXIS_HIST]).toEqual(eoHistogram(2));
    const want = EO_ONE_AXIS_HIST.map((c) => c * EO_ARRANGEMENTS);
    for (const a of [0, 1, 2]) expect(DIST[a], `axis ${a}`).toEqual(want);
  });

  it('三条轴对同分布 —— 站内「单色底 = 双色底」就是这一条', () => {
    for (const i of [3, 4, 5]) expect(DIST[i], `set ${SETS[i]}`).toEqual([...EO_BEST_OF_2_HIST]);
  });

  it('三轴取最优 = 四色底 / 六色底那一档', () => {
    expect(DIST[6]).toEqual([...EO_BEST_OF_3_HIST]);
  });

  it('每条分布都盖满整个商空间', () => {
    for (let i = 0; i < SETS.length; i++) expect(sum(DIST[i]), `set ${SETS[i]}`).toBe(EO_AXIS_STATES);
  });

  it('轴越多越浅,直径始终是 7', () => {
    const one = cumulative(DIST[2]);
    const two = cumulative([...EO_BEST_OF_2_HIST]);
    const three = cumulative([...EO_BEST_OF_3_HIST]);
    expect(one.length).toBe(8);
    expect(two.length).toBe(8);
    expect(three.length).toBe(8);
    for (let d = 0; d < 8; d++) {
      expect(three[d], `d=${d}`).toBeGreaterThanOrEqual(two[d]);
      expect(two[d], `d=${d}`).toBeGreaterThanOrEqual(one[d]);
    }
    // 直径 7 在三档里都真的有态 —— reach.ts 的 TRAINER_GOD['eoline/eo'] = [7,7,7,7] 由此变成准确值。
    expect(DIST[2][7]).toBeGreaterThan(0);
    expect(EO_BEST_OF_2_HIST[7]).toBe(6230);
    expect(EO_BEST_OF_3_HIST[7]).toBe(401);
  });
});
