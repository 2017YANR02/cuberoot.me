/**
 * 首页「纪录」列表:WCA Live feed 的 tag 按 Reg 9i2 同日复判后的有效 tag。
 *
 * 真实场景(2026-07-25 同日两场):Crimson Arradaza 在 GAN Tarlac Speedcubing Open 2026
 * 打出 7.72 单手平均,WCA Live feed 标 WR —— feed 只看自家平台,看不到同日跑在 cubing.com
 * 上的芜湖公开赛,陈震在那里打出 6.99。比赛页走 judgeByDay 判 NR,首页却照抄 feed 的 WR。
 *
 * 判定规则(src/utils/current_records.ts resolveFeedTag):只降级不升级 ——
 * 升级要信 wca_results_flat 周更 dump 基线,会把已被超越的成绩误升;降级只依赖
 * 「同日有更快的」这个本地事实。
 *
 * 同日裁决本身的用例在 keatoned_record_tag.test.ts。
 */
import { describe, it, expect } from 'vitest';
import { resolveFeedTag, recordLevelRank, type KeatonedInfo } from '../src/utils/current_records';

const maskedByChen: KeatonedInfo = {
  level: 'WR',
  byValue: 699,
  byComp: 'WuhuOpen2026',
  byCompName: 'Wuhu Open 2026',
  byPerson: 'Zhen Chen',
  byPersonIso2: 'CN',
};

describe('recordLevelRank', () => {
  it('WR > 洲际(CR 与 AsR/ER/… 同级)> NR', () => {
    expect(recordLevelRank('WR')).toBe(0);
    expect(recordLevelRank('CR')).toBe(1);
    expect(recordLevelRank('AsR')).toBe(1);
    expect(recordLevelRank('ER')).toBe(1);
    expect(recordLevelRank('NR')).toBe(2);
  });
});

describe('resolveFeedTag', () => {
  it('Crimson 7.72:feed 说 WR,同日复判说 NR → 采纳 NR', () => {
    expect(resolveFeedTag('WR', { tag: 'NR', keatoned: maskedByChen })).toBe('NR');
  });

  it('复判说 WR 而 feed 只给 NR → 不升级,保留 feed 的 NR', () => {
    expect(resolveFeedTag('NR', { tag: 'WR', keatoned: null })).toBe('NR');
  });

  it('复判与 feed 同级 → 保留 feed 的具体洲际写法(CR 不覆盖 AsR)', () => {
    expect(resolveFeedTag('AsR', { tag: 'CR', keatoned: null })).toBe('AsR');
  });

  it('三级全被同日更快的抹掉 → null,不进纪录列表', () => {
    expect(resolveFeedTag('WR', { tag: '', keatoned: maskedByChen })).toBeNull();
  });

  it('判不出级别且没被日掩(缺基线)→ 不动 feed 的 tag', () => {
    expect(resolveFeedTag('WR', { tag: '', keatoned: null })).toBe('WR');
  });

  it('复判整体不可用(多日赛 / 池空 / 基线未 warm)→ 不动 feed 的 tag', () => {
    expect(resolveFeedTag('WR', null)).toBe('WR');
  });
});
