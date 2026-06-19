import { describe, it, expect } from 'vitest';
import { adjustRankWithLiveComp, type LiveCompEntry } from '@/lib/comp-live-rank';
import type { RankResult } from '@/lib/rank-client';

function rr(worldRank: number, natRank: number | null): RankResult {
  return {
    world: { rank: worldRank, total: 1000 },
    national: natRank === null ? null : { rank: natRank, total: 50 },
    continental: null,
  };
}

describe('adjustRankWithLiveComp', () => {
  // 真实案例:许俊邦(#1, HK)单次 1.42 官方算全国第 1;同场陈柏熹(#2, HK)1.16 更快,
  // 赛前官方 PB ≥ 1.42 → 应把许俊邦修正为全国第 2、世界 +1。
  it('demotes a stale NR1 when a same-comp faster result exists', () => {
    const entries: LiveCompEntry[] = [
      { number: 1, iso2: 'HK', compBest: 142 },                    // 许俊邦自己
      { number: 2, iso2: 'HK', compBest: 116, officialBest: 200 }, // 陈柏熹,赛前 PB 2.00 ≥ 1.42
    ];
    const out = adjustRankWithLiveComp(rr(227, 1), entries, 142, 1, 'HK');
    expect(out.national?.rank).toBe(2);
    expect(out.world.rank).toBe(228);
  });

  // 更快的人赛前官方 PB 已 < value → 官方榜早已计入,不重复加。
  it('does not double-count a faster person already in official rankings', () => {
    const entries: LiveCompEntry[] = [
      { number: 1, iso2: 'HK', compBest: 142 },
      { number: 2, iso2: 'HK', compBest: 116, officialBest: 130 }, // 赛前 1.30 已 < 1.42
    ];
    const out = adjustRankWithLiveComp(rr(227, 2), entries, 142, 1, 'HK');
    expect(out.national?.rank).toBe(2); // 不变
    expect(out.world.rank).toBe(227);
  });

  // 选手自己不计入(即便自己别轮有更快成绩)。
  it('excludes the person themselves', () => {
    const entries: LiveCompEntry[] = [
      { number: 1, iso2: 'HK', compBest: 100 }, // 自己更快也不算
    ];
    const out = adjustRankWithLiveComp(rr(10, 1), entries, 142, 1, 'HK');
    expect(out.national?.rank).toBe(1);
    expect(out.world.rank).toBe(10);
  });

  // 并列(compBest == value)不算(WCA 名次按严格更快 + 1)。
  it('ignores ties (compBest equal to value)', () => {
    const entries: LiveCompEntry[] = [
      { number: 1, iso2: 'HK', compBest: 142 },
      { number: 2, iso2: 'HK', compBest: 142, officialBest: 200 },
    ];
    const out = adjustRankWithLiveComp(rr(227, 1), entries, 142, 1, 'HK');
    expect(out.national?.rank).toBe(1);
    expect(out.world.rank).toBe(227);
  });

  // 不同国家的更快成绩只动世界名次,不动全国名次。
  it('a faster foreigner bumps world rank but not national', () => {
    const entries: LiveCompEntry[] = [
      { number: 1, iso2: 'HK', compBest: 142 },
      { number: 2, iso2: 'CN', compBest: 86, officialBest: 200 }, // 中国选手更快
    ];
    const out = adjustRankWithLiveComp(rr(227, 1), entries, 142, 1, 'HK');
    expect(out.national?.rank).toBe(1);   // 全国不变
    expect(out.world.rank).toBe(228);     // 世界 +1
  });

  // 无 national 档(服务端没返回)时只修世界,national 保持 null。
  it('keeps national null when base has none', () => {
    const entries: LiveCompEntry[] = [
      { number: 2, iso2: 'CN', compBest: 86, officialBest: 200 },
    ];
    const out = adjustRankWithLiveComp(rr(227, null), entries, 142, 1, '');
    expect(out.national).toBeNull();
    expect(out.world.rank).toBe(228);
  });

  // 多个同国更快、且都无赛前 PB → 全国名次累加。
  it('accumulates multiple faster same-country newcomers', () => {
    const entries: LiveCompEntry[] = [
      { number: 1, iso2: 'HK', compBest: 142 },
      { number: 2, iso2: 'HK', compBest: 116, officialBest: 200 },
      { number: 3, iso2: 'HK', compBest: 130 }, // 无官方 PB
    ];
    const out = adjustRankWithLiveComp(rr(227, 1), entries, 142, 1, 'HK');
    expect(out.national?.rank).toBe(3); // 1 + 2
    expect(out.world.rank).toBe(229);
  });
});
