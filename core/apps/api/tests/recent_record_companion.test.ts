import { describe, expect, it, vi } from 'vitest';
import { collectInferred, collectRankCandidates } from '../src/routes/cubing_live';
import { formatInferred } from '../src/routes/wca_recent_records';
import { enrich, formatCombinedRecords } from '../src/utils/record_format';
import { overlayDeltaPure } from '../src/utils/wca_live_overlay';

vi.mock('../src/db/connection.js', () => ({ query: vi.fn(async () => []) }));
vi.mock('../src/routes/wca_stats_extra.js', () => ({
  worldRankTop100: vi.fn(async (_event: string, type: string) => type === 'average' ? 10 : 17),
}));

type CompData = Parameters<typeof collectInferred>[0];
type Result = CompData['resultsByRound'][string][number];
const result: Result = {
  i: 8509370, c: 0, n: 4, e: '333', r: 'f', f: 'a',
  b: 354, a: 452, v: [450, 474, 354, 547, 433], sr: '', ar: 'FWR', pS: 1, pA: 1,
};
function records(overrides: Partial<Result> = {}, includePersonalRecords = false, fwrBaseline?: number) {
  const data: CompData = {
    slug: 'WuhanCrimsonAutumn2026', name: 'Wuhan Crimson Autumn 2026', source: 'wca',
    compId: 0, type: 'WCA', events: [], fetchedAt: 0,
    users: { '4': { number: 4, name: 'Yunzhi Lian (连允之)', wcaid: '2025LIAN01', region: 'cn' } },
    resultsByRound: { '333:f': [{ ...result, ...overrides }] },
    membersByFilter: { females: [4], children: [], newcomers: [] },
    ...(fwrBaseline === undefined ? {} : { currentRecords: { fwr: { '333|1': fwrBaseline }, wr: {}, cr: {}, nr: {} } }),
  };
  return collectInferred(data, '2026-09-13', includePersonalRecords);
}

describe('same-round personal record in recent records and Bark', () => {
  it('includes non-regional PRs in ranking candidates without promoting them to regional news', () => {
    const data: CompData = {
      slug: 'WuhanCrimsonAutumn2026', name: 'Wuhan Crimson Autumn 2026', source: 'wca',
      compId: 0, type: 'WCA', events: [], fetchedAt: 0,
      users: { '1': { number: 1, name: 'Yi Shen (沈懿)', wcaid: '2026SHEN01', region: 'cn' } },
      resultsByRound: { '333:1': [{ ...result, n: 1, a: 424, ar: '', sr: '' }], '333:f': [{ ...result, n: 1, a: 484, ar: '', sr: '' }] },
      membersByFilter: { females: [], children: [], newcomers: [] },
    };
    expect(collectInferred(data, '2026-09-13')).toEqual([]);
    expect(collectRankCandidates(data).get('333|1')?.map(entry => entry.value)).toEqual([424]);
    const candidates = collectRankCandidates(data).get('333|1')!;
    expect(3 + overlayDeltaPure(candidates, new Map(), 427).world).toBe(4);
    expect(4 + overlayDeltaPure(candidates, new Map([['2026SHEN01', 424]]), 427).world).toBe(4);
  });
  it('keeps source labels when two newcomer records are formatted together', () => {
    const events = (['1st-solve', '1st-comp'] as const).map(source => enrich({ tag: 'NWR', newcomer_source: source, rec_type: 'average', attempt_result: 2763, event_id: '444', person_name: 'Xuanyi Geng (耿暄一)', person_iso2: 'CN', comp_id: 'WuhanGoldenAutumn2026', comp_name: '武汉金秋赛2026', comp_iso2: 'CN' }));
    const formatted = formatCombinedRecords(events, () => null);
    expect(formatted.cn).toContain('（首次还原）NWR');
    expect(formatted.cn).toContain('（首场比赛）NWR');
  });
  it('carries separate NWR source identities from competition data through real bilingual formatting', async () => {
    const data: CompData = {
      slug: 'Newcomer2026', name: 'Newcomer 2026', source: 'wca', compId: 0, type: 'WCA', events: [], fetchedAt: 0,
      users: { '4': { number: 4, name: 'Xuanyi Geng (耿暄一)', wcaid: '2023GENG02', region: 'CN' } },
      resultsByRound: {}, membersByFilter: { females: [], children: [], newcomers: [] },
      newcomerRecords: ['1st-solve', '1st-comp'].map(source => ({ eventId: '444', roundId: 'f', personNumber: 4, type: 'average', source, value: 2763 })) as CompData['newcomerRecords'],
    };
    const inferred = collectInferred(data, '2026-09-12');
    expect(new Set(inferred.map(r => r.id)).size).toBe(2);
    expect(inferred.map(r => r.newcomerSource)).toEqual(['1st-solve', '1st-comp']);
    const formatted = await Promise.all(inferred.map(formatInferred));
    expect(formatted[0].cn).toContain('平均新人世界纪录（首次还原）NWR');
    expect(formatted[0].en).toContain('(1st solve: first-round average)');
    expect(formatted[1].cn).toContain('平均新人世界纪录（首场比赛）NWR');
    expect(formatted[1].en).toContain('(1st competition)');
    data.users['77'] = data.users['4'];
    data.newcomerRecords = data.newcomerRecords!.map(record => ({ ...record, personNumber: 77, roundId: 'd' }));
    expect(collectInferred(data, '2026-09-12').map(r => r.id)).toEqual(inferred.map(r => r.id));
  });
  it('includes confirmed standalone PRs only for personal subscriptions', () => {
    expect(records({ ar: '' })).toEqual([]);
    expect(records({ ar: '' }, true).map(r => [r.type, r.tag])).toEqual([['single', 'PR'], ['average', 'PR']]);
    expect(records({ ar: '', pS: 2, pA: undefined }, true)).toEqual([]);
    expect(records({ ar: '', b: -1, a: 0 }, true)).toEqual([]);
    expect(records({}, true).map(r => [r.type, r.tag])).toEqual([['single', 'PR'], ['average', 'FWR']]);
  });
  it('formats the Wuhan final with the single PR before the competition', async () => {
    const [record] = records();
    expect(record.companionPr).toEqual({ type: 'single', attemptResult: 354 });
    const output = await formatInferred(record);
    expect(output.cn).toContain('4.52三阶平均女子世界纪录FWR/WR10 连允之🇨🇳| 3.54单次个人纪录PR/WR17 | ');
    expect(output.en).toContain('4.52 3x3 FWR/WR10 Avg Yunzhi Lian🇨🇳| 3.54 PR/WR17 Single | Wuhan Crimson Autumn 2026');
  });

  it('carries an FWR tie against the pre-competition female baseline into formatting', async () => {
    const [record] = records({ a: 427, b: 360, pS: undefined }, false, 427);
    expect(record.tied).toBe(true);
    const output = await formatInferred(record);
    expect(output.cn).toContain('4.27三阶平均女子世界纪录FWR(平)/WR10');
    expect(output.en).toContain('4.27 3x3 FWR(Tied)/WR Avg');
  });

  it.each([{ pS: undefined }, { pS: 2 }, { b: 0 }, { b: -1 }, { b: -2 }, { sr: 'NR' }])(
    'does not invent or duplicate a companion PR for %j', overrides => {
      expect(records(overrides).find(r => r.type === 'average')?.companionPr).toBeUndefined();
    },
  );

  it('also attaches a confirmed average PR to a single record', () => {
    expect(records({ sr: 'NR', ar: '' })[0].companionPr).toEqual({ type: 'average', attemptResult: 452 });
  });

  it('refreshes cached text when companion data arrives or is corrected', async () => {
    const [without] = records({ pS: undefined });
    expect((await formatInferred(without)).cn).not.toContain('3.54');
    expect((await formatInferred(records()[0])).cn).toContain('3.54单次个人纪录');
    expect((await formatInferred(records({ b: 350 })[0])).cn).toContain('3.50单次个人纪录');
    expect((await formatInferred(without)).cn).not.toContain('3.54');
  });
});
