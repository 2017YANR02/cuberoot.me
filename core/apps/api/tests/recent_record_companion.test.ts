import { describe, expect, it, vi } from 'vitest';
import { collectInferred } from '../src/routes/cubing_live';
import { formatInferred } from '../src/routes/wca_recent_records';

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
function records(overrides: Partial<Result> = {}, includePersonalRecords = false) {
  const data: CompData = {
    slug: 'WuhanCrimsonAutumn2026', name: 'Wuhan Crimson Autumn 2026', source: 'wca',
    compId: 0, type: 'WCA', events: [], fetchedAt: 0,
    users: { '4': { number: 4, name: 'Yunzhi Lian (连允之)', wcaid: '2025LIAN01', region: 'cn' } },
    resultsByRound: { '333:f': [{ ...result, ...overrides }] },
    membersByFilter: { females: [4], children: [], newcomers: [] },
  };
  return collectInferred(data, '2026-09-13', includePersonalRecords);
}

describe('same-round personal record in recent records and Bark', () => {
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
