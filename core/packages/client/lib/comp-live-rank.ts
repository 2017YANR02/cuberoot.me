/**
 * comp-live-rank — 把「本场实时成绩」并进 WCA 官方名次,得到现实正确的全国/世界名次。
 *
 * 背景:比赛页成绩弹窗里「破 PB 但非纪录」的成绩会显示它在 WCA 历史里的全国/世界名次
 * (rank-for 端点查 WCA 官方 dump,口径 = 严格快于本成绩的选手数 + 1)。官方 dump 不含
 * 尚未收录的本场比赛,于是会出现矛盾:某成绩官方算「全国第 1」,但同场更快的成绩已经诞生
 * (例:许俊邦 1.42 官方 NR1,但同场陈柏熹刚跑出更快的 1.16 NR)。
 *
 * 修正口径:
 *   修正名次 = 官方名次 + Δ
 *   Δ = 本场该项目中、compBest 严格快于 value、且 officialBest 未 < value(无官方 PB 或 ≥ value)
 *       的【不同选手】数。
 * 说明:officialBest < value 的人官方榜已计入,不重复加;选手自己不计入。无论本场是否已被官方
 * 收录,口径都自洽(已收录时这些人的 officialBest 也 < value,自动跳过,Δ=0)。
 *
 * 只修正 national / world(弹窗仅展示这两档);total(上榜总数)不展示,故不动。
 */
import type { RankResult } from '@/lib/rank-client';

export interface LiveCompEntry {
  /** 选手本场编号(去重 + 排除自己用) */
  number: number;
  /** 选手国家 iso2(大写),用于 national delta */
  iso2: string;
  /** 该选手在本场该项目该口径(single/average)的最快有效成绩(厘秒,> 0) */
  compBest: number;
  /** 赛前官方 PB(厘秒);无则 undefined。officialBest < value 表示官方榜已计入,不重复加 */
  officialBest?: number;
}

export function adjustRankWithLiveComp(
  base: RankResult,
  entries: LiveCompEntry[],
  value: number,
  selfNumber: number,
  countryIso2: string,
): RankResult {
  if (!(value > 0)) return base;
  let dWorld = 0;
  let dNat = 0;
  for (const e of entries) {
    if (e.number === selfNumber) continue;
    if (!(e.compBest > 0) || e.compBest >= value) continue; // 只数严格更快
    if (e.officialBest !== undefined && e.officialBest < value) continue; // 官方榜已计入
    dWorld++;
    if (countryIso2 && e.iso2 === countryIso2) dNat++;
  }
  if (dWorld === 0 && dNat === 0) return base;
  return {
    ...base,
    world: { ...base.world, rank: base.world.rank + dWorld },
    national: base.national ? { ...base.national, rank: base.national.rank + dNat } : base.national,
  };
}
