import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompData } from '../src/routes/cubing_live';

const mocks = vi.hoisted(() => ({ query: vi.fn(), fetch: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));

const stat = {
  metricPanels: ['single', 'average'].map(metric => ({ id: metric,
    sourcePanels: ['1st-solve', '1st-comp'].map(source => ({ id: `${metric}-${source}`, panels: [{ id: 'history', sections: [{
      title: '4x4x4 Cube', rows: [['30.00', '', '', '', '2026-01-01', '[Previous](https://www.worldcubeassociation.org/competitions/Previous2026)']],
    }] }] })),
  })),
};
function fixture(): CompData {
  const round = (i: string) => ({ i, e: '444', f: 'a', co: 0, tl: 0, n: 0, s: 1, rn: 1, tt: 5, name: i });
  const result = (r: string, a: number, v: number[]) => ({ i: 1, c: 0, n: 1, e: '444', r, f: 'a', b: Math.min(...v.filter(n => n > 0)), a, v, sr: '', ar: '' });
  return {
    slug: 'Current2026', name: 'Current', compId: 0, type: 'WCA', source: 'wca', fetchedAt: 0,
    events: [{ i: '444', name: '4x4x4 Cube', rs: [round('d'), round('f')] }],
    users: { '1': { number: 1, name: 'Test Person', wcaid: '2026TEST01', region: 'CN' } },
    resultsByRound: { '444:d': [result('d', 2900, [2800, 2700, 3000, 2900, 2900])], '444:f': [result('f', 2600, [2500, 2600, 2600, 2700, 2600])] },
    membersByFilter: { females: [], children: [], newcomers: [] },
  };
}
beforeEach(() => {
  vi.resetModules();
  mocks.query.mockReset().mockResolvedValue([]);
  mocks.fetch.mockReset().mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes('/stats/') ? stat : [] }));
  vi.stubGlobal('fetch', mocks.fetch);
});

describe('newcomer world record sources', () => {
  it('uses first attempt / first-round average separately from the first competition best', async () => {
    const { newcomerCandidates, newcomerHistory } = await import('../src/utils/newcomer_records');
    expect(newcomerCandidates(fixture(), '2026-09-12', newcomerHistory(stat))).toEqual([
      { eventId: '444', roundId: 'd', personNumber: 1, type: 'single', source: '1st-solve', value: 2800 },
      { eventId: '444', roundId: 'd', personNumber: 1, type: 'average', source: '1st-solve', value: 2900 },
      { eventId: '444', roundId: 'f', personNumber: 1, type: 'single', source: '1st-comp', value: 2500 },
      { eventId: '444', roundId: 'f', personNumber: 1, type: 'average', source: '1st-comp', value: 2600 },
    ]);
  });
  it('never substitutes a later solve or round after first-attempt DNF or first-round DNS', async () => {
    const { newcomerCandidates, newcomerHistory } = await import('../src/utils/newcomer_records');
    const data = fixture();
    data.resultsByRound['444:d']![0]!.v[0] = -1;
    data.resultsByRound['444:d']![0]!.a = -2;
    expect(newcomerCandidates(data, '2026-09-12', newcomerHistory(stat)).map(r => r.source)).toEqual(['1st-comp', '1st-comp']);
  });
  it('rejects ties, absent history, partial data, and non-WCA competitions', async () => {
    const { newcomerCandidates, newcomerHistory } = await import('../src/utils/newcomer_records');
    const data = fixture();
    expect(newcomerCandidates(data, '2025-01-01', newcomerHistory(stat))).toEqual([]);
    expect(newcomerCandidates(data, '2026-09-12', newcomerHistory(stat).map(row => ({ ...row, value: 2500 })))).toEqual([]);
    expect(newcomerCandidates({ ...data, partial: true }, '2026-09-12', newcomerHistory(stat))).toEqual([]);
    expect(newcomerCandidates({ ...data, type: 'non-WCA' } as CompData, '2026-09-12', newcomerHistory(stat))).toEqual([]);
  });
  it('recognizes an event debut even for an experienced cuber in other events', async () => {
    const { findNewcomerRecords } = await import('../src/utils/newcomer_records');
    mocks.query.mockResolvedValue([{ wca_id: '2026TEST01', event_id: '333' }]);
    expect(await findNewcomerRecords(fixture(), '2026-09-12', async () => null)).toHaveLength(4);
    expect(mocks.query.mock.calls[0][0]).toContain('UNION SELECT DISTINCT wca_id, event_id FROM wca_live_person_results');
    expect(mocks.query.mock.calls[0][0]).not.toMatch(/best|average|> 0/);
  });
  it('rejects prior participation including all-DNF rounds retained in either database table', async () => {
    const { findNewcomerRecords } = await import('../src/utils/newcomer_records');
    mocks.query.mockResolvedValue([{ wca_id: '2026TEST01', event_id: '444' }]);
    expect(await findNewcomerRecords(fixture(), '2026-09-12', async () => null)).toEqual([]);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('closes the dump gap with official results and fails closed when eligibility is unknown', async () => {
    const { findNewcomerRecords } = await import('../src/utils/newcomer_records');
    mocks.fetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes('/stats/') ? stat : [{ event_id: '444', competition_id: 'Earlier2026' }] }));
    expect(await findNewcomerRecords(fixture(), '2026-09-12', async () => '2026-09-01')).toEqual([]);
    expect(await findNewcomerRecords(fixture(), '2026-09-12', async () => null)).toEqual([]);
  });
  it('does not invent a record when the official API fails', async () => {
    const { findNewcomerRecords } = await import('../src/utils/newcomer_records');
    mocks.fetch.mockImplementation(async (url: string) => ({ ok: url.includes('/stats/'), json: async () => stat }));
    expect(await findNewcomerRecords(fixture(), '2026-09-12', async () => null)).toEqual([]);
  });
  it('requires explicit newcomer registration for a person without a WCA ID', async () => {
    const { findNewcomerRecords } = await import('../src/utils/newcomer_records');
    const data = fixture();
    data.users['1']!.wcaid = '';
    expect(await findNewcomerRecords(data, '2026-09-12', async () => null)).toEqual([]);
    data.membersByFilter.newcomers.push(1);
    expect(await findNewcomerRecords(data, '2026-09-12', async () => null)).toHaveLength(4);
    data.membersByFilter.newcomers = [];
    data.source = 'wca_live';
    expect(await findNewcomerRecords(data, '2026-09-12', async () => null)).toHaveLength(4);
  });
});
