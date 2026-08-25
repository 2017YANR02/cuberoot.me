/**
 * 上游过期基线标出来的假纪录:cubing.com / WCA Live 按自己那份纪录表判 tag,
 * 别处刚破的纪录它们不一定看得见。
 *
 * 真实场景:2026-07-25 芜湖公开赛陈震把单手平均 WR 刷到 6.99(已进 wca_results_flat),
 * 一周后 2026-08-01 上海夏季赛他决赛 7.29,cubing.com 仍标 WR,比赛页照抄 → 页面上
 * 出现两个 WR。本站基线已含 6.99,7.29 连中国 NR 都够不着,足以反证。
 *
 * 日期门槛不可省:基线是「当前」纪录,含本场之后的成绩。回看 2015 年的比赛时,当年真实的
 * WR 不能被今天的纪录抹掉 —— 所以只有「纪录达成日 <= 本场比赛日」才允许反证。
 *
 * 服务端 refutesTag(带比赛日)与 client 侧 refutesTag(只给直播中的 WS 推送用,基线天然
 * 都在今天之前,不需要日期)是同一规则的两份实现,改一处必须同步另一处。
 */
import { describe, it, expect } from 'vitest';
import { pathToFileURL } from 'node:url';
import { refutesTag as clientRefutes, type RecordsSnapshot } from '@/lib/record-tag';
import { workspaceFixturePath } from './workspace-fixture-path';

const { refutesTag: serverRefutes } = await import(pathToFileURL(
  workspaceFixturePath('@cuberoot/server', 'src', 'utils', 'current_records.ts'),
).href);

const CN = { region: 'China', countryId: 'China', continentId: '_Asia' };

// 单手平均:WR/AsR/CN NR 都是陈震 2026-07-25 芜湖的 6.99;单次 5.66 是更早的别人。
const recs = {
  wr: new Map([['333oh|1', 699], ['333oh|0', 566]]),
  cr: new Map([['333oh|1|_Asia', 699]]),
  nr: new Map([['333oh|1|China', 699]]),
  wrAt: new Map([['333oh|1', '2026-07-25'], ['333oh|0', '2024-10-04']]),
  crAt: new Map([['333oh|1|_Asia', '2026-07-25']]),
  nrAt: new Map([['333oh|1|China', '2026-07-25']]),
  iso2ToCountryId: new Map([['cn', 'China']]),
  nameToCountryId: new Map([['china', 'China']]),
  countryIdToContinent: new Map([['China', '_Asia']]),
  countryIdToIso2: new Map([['China', 'cn']]),
};

describe('服务端 refutesTag', () => {
  it('上海 7.29 被一周前芜湖的 6.99 反证 → 上游的 WR 是假的', () => {
    expect(serverRefutes('WR', 729, '333oh', true, CN, recs, '2026-08-01')).toBe(true);
  });

  it('同一条成绩的 NR 也够不着(NR 同为 6.99)', () => {
    expect(serverRefutes('NR', 775, '333oh', true, CN, recs, '2026-08-01')).toBe(true);
  });

  it('纪录本身(6.99 当天)不被反证 —— 平纪录也算(Reg 9i1a)', () => {
    expect(serverRefutes('WR', 699, '333oh', true, CN, recs, '2026-07-25')).toBe(false);
  });

  it('纪录发生在本场之后 → 不动上游 tag(回看历史比赛)', () => {
    // 2026-07-01 的比赛打出 7.29 时,6.99 还不存在。
    expect(serverRefutes('WR', 729, '333oh', true, CN, recs, '2026-07-01')).toBe(false);
  });

  it('拿不到比赛日 → 不动上游 tag', () => {
    expect(serverRefutes('WR', 729, '333oh', true, CN, recs, null)).toBe(false);
  });

  it('该 scope 没有基线 → 不动上游 tag', () => {
    // 单次没有中国 NR 基线,反证不了。
    expect(serverRefutes('NR', 649, '333oh', false, CN, recs, '2026-08-01')).toBe(false);
  });

  it('洲际 tag 走大洲基线(AsR 与 CR 同级)', () => {
    expect(serverRefutes('AsR', 729, '333oh', true, CN, recs, '2026-08-01')).toBe(true);
    expect(serverRefutes('AsR', 690, '333oh', true, CN, recs, '2026-08-01')).toBe(false);
  });

  it('多日赛(strictlyBefore):同日的纪录不算反证 —— 可能就是本场后面某天刷的', () => {
    expect(serverRefutes('WR', 729, '333oh', true, CN, recs, '2026-07-25', true)).toBe(false);
    expect(serverRefutes('WR', 729, '333oh', true, CN, recs, '2026-07-26', true)).toBe(true);
  });

  it('解析不出国家 / 大洲 → 洲际与 NR 反证不了', () => {
    expect(serverRefutes('NR', 729, '333oh', true, undefined, recs, '2026-08-01')).toBe(false);
    expect(serverRefutes('WR', 729, '333oh', true, undefined, recs, '2026-08-01')).toBe(true);
  });
});

describe('client refutesTag(直播中 WS 推送)', () => {
  const snap: RecordsSnapshot = {
    wr: { '333oh|1': 699 },
    cr: { '333oh|1|_Asia': 699 },
    nr: { '333oh|1|China': 699 },
  };

  it('与服务端同口径:7.29 的 WR 被反证', () => {
    expect(clientRefutes('WR', 729, '333oh', true, CN, snap)).toBe(true);
  });

  it('平纪录不反证', () => {
    expect(clientRefutes('WR', 699, '333oh', true, CN, snap)).toBe(false);
  });

  it('没快照 / 没 tag / 无效成绩 → 一律不动', () => {
    expect(clientRefutes('WR', 729, '333oh', true, CN, undefined)).toBe(false);
    expect(clientRefutes('', 729, '333oh', true, CN, snap)).toBe(false);
    expect(clientRefutes('WR', -1, '333oh', true, CN, snap)).toBe(false);
  });

  it('该 scope 没基线 → 不动', () => {
    expect(clientRefutes('WR', 729, '444', true, CN, snap)).toBe(false);
  });
});
