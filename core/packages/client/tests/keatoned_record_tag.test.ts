// 「日掩」判定(WCA Reg 9i2:同一日历日只认最好的那条)。
//
// 基线数字全部取自真实数据,不是编的:
//   - 2026-07-25 当天 Wuhu Open 2026(CN)与 GAN Tarlac Speedcubing Open 2026(PH)同日举行,
//     赛前 333oh 平均 WR = 7.72 / AsR = 8.01 / CN NR = 8.22 / PH NR = 8.09(服务端快照实测值)。
//     Crimson Arradaza 在 Tarlac 打出 7.72(平 WR),陈震在芜湖决赛打出 6.99、初赛 7.99。
//   - 2015-11-21 River Hill Fall 2015:赛前 333 单次 WR = 5.25(Collin Burns, USA),
//     Keaton Ellis 5.09、Lucas Etter 4.90 同场同日 —— WCA 官方库里 Keaton 那条 tag 是 NULL,
//     这就是 keatoned 一词的出处。
//
// 服务端 utils/current_records.ts 的 judgeByDay 是同一算法的另一份实现,改一处必须同步另一处。

import { describe, it, expect } from 'vitest';
import { judgeRecordTag, type RecordsSnapshot } from '@/lib/record-tag';
import { applyDayRankDelta } from '@/lib/comp-live-rank';

const CN = { countryId: 'China', continentId: '_Asia' };
const PH = { countryId: 'Philippines', continentId: '_Asia' };
const US = { countryId: 'USA', continentId: '_North America' };

function entry(value: number, person: string, comp: string, personIso2 = '') {
  return { value, comp, compName: comp, person, personIso2 };
}

// 2026-07-25:赛前基线 + 当日全球最好(6.99 陈震@芜湖;菲律宾范围内最好是 7.72 Crimson)
const JULY25: RecordsSnapshot = {
  wr: { '333oh|1': 772 },
  cr: { '333oh|1|_Asia': 801 },
  nr: { '333oh|1|China': 822, '333oh|1|Philippines': 809 },
  day: {
    wr: { '333oh|1': entry(699, 'Zhen Chen', 'WuhuOpen2026', 'CN') },
    cr: { '333oh|1|_Asia': entry(699, 'Zhen Chen', 'WuhuOpen2026', 'CN') },
    nr: {
      '333oh|1|China': entry(699, 'Zhen Chen', 'WuhuOpen2026', 'CN'),
      '333oh|1|Philippines': entry(772, 'Crimson Arradaza', 'TarlacSpeedcubingOpen2026', 'PH'),
    },
  },
};

// 2015-11-21 River Hill Fall 2015:赛前 333 单次 WR/NAR/USA NR 都是 5.25(Collin Burns),
// Keaton Ellis 5.09 与 Lucas Etter 4.90 同场同日 —— 三级全被同胞抢走。
const RIVER_HILL: RecordsSnapshot = {
  wr: { '333|0': 525 },
  cr: { '333|0|_North America': 525 },
  nr: { '333|0|USA': 525 },
  day: {
    wr: { '333|0': entry(490, 'Lucas Etter', 'RiverHillFall2015', 'US') },
    cr: { '333|0|_North America': entry(490, 'Lucas Etter', 'RiverHillFall2015', 'US') },
    nr: { '333|0|USA': entry(490, 'Lucas Etter', 'RiverHillFall2015', 'US') },
  },
};

describe('Reg 9i2 同日裁决', () => {
  it('平 WR 但同日别处更快 → 掉到 NR,并记下被掩的 WR', () => {
    const r = judgeRecordTag(772, '333oh', true, PH, JULY25);
    expect(r.tag).toBe('NR');
    expect(r.keatoned?.level).toBe('WR');
    expect(r.keatoned?.byValue).toBe(699);
    expect(r.keatoned?.byComp).toBe('WuhuOpen2026');
  });

  it('当日最好的那条正常拿 WR,不算被掩', () => {
    const r = judgeRecordTag(699, '333oh', true, CN, JULY25);
    expect(r.tag).toBe('WR');
    expect(r.keatoned).toBeNull();
  });

  it('同场初赛够到 AsR,但同日决赛更快 → 什么都不给,记被掩的 CR', () => {
    // 7.99 > 7.72 够不着 WR;<= 8.01 够得着 AsR,但当日亚洲最好是 6.99。
    const r = judgeRecordTag(799, '333oh', true, CN, JULY25);
    expect(r.tag).toBe('');
    expect(r.keatoned?.level).toBe('CR');
  });

  it('够不着任何一级 → 无 tag 也无日掩', () => {
    const r = judgeRecordTag(932, '333oh', true, CN, JULY25);
    expect(r.tag).toBe('');
    expect(r.keatoned).toBeNull();
  });

  it('并列当日最好 → 照给 tag(Reg 9i1a 平纪录也算)', () => {
    // 2016-10-08 两场比赛的 skewb 平均并列 2.63,官方两条都标了 WR。
    const tie: RecordsSnapshot = {
      wr: { 'skewb|1': 270 },
      cr: {}, nr: {},
      day: { wr: { 'skewb|1': entry(263, 'Someone Else', 'GLSCupV2016') } },
    };
    const r = judgeRecordTag(263, 'skewb', true, PH, tie);
    expect(r.tag).toBe('WR');
    expect(r.keatoned).toBeNull();
  });

  it('Keaton Ellis 5.09:WR 和 NR 双双被同胞抢走 → 官方那条 tag 为空', () => {
    const r = judgeRecordTag(509, '333', false, US, RIVER_HILL);
    expect(r.tag).toBe('');
    expect(r.keatoned?.level).toBe('WR');
    expect(r.keatoned?.byPerson).toBe('Lucas Etter');
  });

  it('无 day 数据(多日赛拿不到轮次日期)→ 退化成原行为,只比赛前基线', () => {
    const noDay: RecordsSnapshot = { wr: { '333oh|1': 772 }, cr: {}, nr: {} };
    const r = judgeRecordTag(772, '333oh', true, PH, noDay);
    expect(r.tag).toBe('WR');
    expect(r.keatoned).toBeNull();
  });
});

// 名次侧:官方 dump 里没有任何当日成绩,掩掉这条的那几条得并进世界/全国名次,
// 否则 badge 说「当天有人更快」而名次还写着 WR1。
describe('日掩 → 名次修正', () => {
  const rank = (world: number, nat: number | null) => ({
    world: { rank: world, total: 1000 },
    national: nat === null ? null : { rank: nat, total: 100 },
    continental: null,
  });

  it('掩它的同一个人跨两级(WR + AsR)只算一次', () => {
    const r = judgeRecordTag(772, '333oh', true, PH, JULY25);
    expect(r.keatonedBy.map(e => e.person)).toEqual(['Zhen Chen']);
  });

  it('Crimson 7.72:世界第 1 → 第 2,菲律宾名次不动(掩它的是中国人)', () => {
    const r = judgeRecordTag(772, '333oh', true, PH, JULY25);
    const out = applyDayRankDelta(rank(1, 1), r.keatonedBy, 'PH');
    expect(out.world.rank).toBe(2);
    expect(out.national?.rank).toBe(1);
  });

  it('Keaton 5.09:掩它的是同胞 → 世界和全国名次一起 +1', () => {
    const r = judgeRecordTag(509, '333', false, US, RIVER_HILL);
    expect(r.keatonedBy.map(e => e.person)).toEqual(['Lucas Etter']);
    const out = applyDayRankDelta(rank(1, 1), r.keatonedBy, 'US');
    expect(out.world.rank).toBe(2);
    expect(out.national?.rank).toBe(2);
  });

  it('掩它的是本人同日更靠后的一轮 → 名次不动(一人只占一格)', () => {
    // 陈震初赛 7.99 够得着 AsR(8.01),被自己决赛的 6.99 掩掉;不能把自己挤下去。
    const r = judgeRecordTag(799, '333oh', true, CN, JULY25);
    expect(r.keatoned?.level).toBe('CR');
    const base = rank(6, 2);
    const out = applyDayRankDelta(base, r.keatonedBy, 'CN', { person: 'Zhen Chen', comp: 'WuhuOpen2026' });
    expect(out).toBe(base);
  });

  it('同名但不同场 → 不当成本人', () => {
    const r = judgeRecordTag(772, '333oh', true, PH, JULY25);
    const out = applyDayRankDelta(rank(1, 1), r.keatonedBy, 'PH', { person: 'Zhen Chen', comp: 'SomeOtherComp2026' });
    expect(out.world.rank).toBe(2);
  });

  it('没被日掩 → 名次原样返回', () => {
    const r = judgeRecordTag(699, '333oh', true, CN, JULY25);
    expect(r.keatonedBy).toEqual([]);
    const base = rank(1, 1);
    expect(applyDayRankDelta(base, r.keatonedBy, 'CN')).toBe(base);
  });
});
