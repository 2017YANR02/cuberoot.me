import { describe, it, expect } from 'vitest';
import { mergePersonCompetitionResults, mergePersonLive } from '@/lib/person-live-merge';
import { extractPersonCompetitionResults, type WcaResultsResponse } from '@/lib/wca-results-api';
import type { WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';

function row(competition_id: string, event_id: string, round_type_id: string, opts: Partial<WcaResultRow> = {}): WcaResultRow {
  return {
    id: opts.id ?? Math.floor(Math.random() * 1e9),
    competition_id, event_id, round_type_id,
    format_id: 'a', best: 600, average: 700, pos: 1, attempts: [600, 700, 650, 800, 620],
    regional_single_record: null, regional_average_record: null,
    ...opts,
  };
}
function comp(id: string, start_date = '2026-06-14'): WcaCompetition {
  return { id, name: id, city: '', country_iso2: '', start_date, end_date: start_date };
}

describe('mergePersonLive', () => {
  it('appends live results + comps for comps the official data has not yet absorbed', () => {
    const official = [row('OldComp2025', '333', 'f', { id: 1 })];
    const officialComps = [comp('OldComp2025', '2025-01-01')];
    const live = [row('NewComp2026', '333', 'f', { id: -1, live: true })];
    const liveComps = [comp('NewComp2026')];

    const out = mergePersonLive(official, officialComps, live, liveComps);
    expect(out.results.map((r) => r.competition_id).sort()).toEqual(['NewComp2026', 'OldComp2025']);
    expect(out.comps.map((c) => c.id).sort()).toEqual(['NewComp2026', 'OldComp2025']);
  });

  it('drops the whole live comp once official results contain it (official wins)', () => {
    // 官方已收录 NewComp2026(哪怕只有一轮),直播行整场丢弃
    const official = [row('NewComp2026', '333', '1', { id: 2 })];
    const officialComps = [comp('NewComp2026')];
    const live = [
      row('NewComp2026', '333', 'f', { id: -1, live: true }),
      row('NewComp2026', '222', 'f', { id: -2, live: true }),
    ];
    const liveComps = [comp('NewComp2026')];

    const out = mergePersonLive(official, officialComps, live, liveComps);
    expect(out.results).toHaveLength(1);
    expect(out.results[0].live).toBeUndefined();
    expect(out.comps).toHaveLength(1);
  });

  it('does not duplicate a comp already present in officialComps', () => {
    const official: WcaResultRow[] = [];
    const officialComps = [comp('NewComp2026')]; // 已登记但还没成绩行
    const live = [row('NewComp2026', '333', 'f', { id: -1, live: true })];
    const liveComps = [comp('NewComp2026')];

    const out = mergePersonLive(official, officialComps, live, liveComps);
    expect(out.results).toHaveLength(1);
    expect(out.comps).toHaveLength(1); // 不重复追加
  });

  it('is a no-op shape when there are no live rows', () => {
    const official = [row('A2025', '333', 'f', { id: 1 })];
    const officialComps = [comp('A2025')];
    const out = mergePersonLive(official, officialComps, [], []);
    expect(out.results).toHaveLength(1);
    expect(out.comps).toHaveLength(1);
  });
});

describe('mergePersonCompetitionResults', () => {
  it('extracts both Maoming 3x3 rounds for the same WCA person', () => {
    const data = {
      id: 'MaomingOpen2026',
      rounds: [
        { id: 944078, roundTypeId: 'f', results: [{
          id: 8390787, wca_id: '2019WANY36', competition_id: 'MaomingOpen2026', event_id: '333',
          round_type_id: 'f', format_id: 'a', pos: 1, best: 277, average: 406,
          attempts: [387, 563, 277, 433, 399],
        }] },
        { id: 944077, roundTypeId: '1', results: [{
          id: 8390706, wca_id: '2019WANY36', competition_id: 'MaomingOpen2026', event_id: '333',
          round_type_id: '1', format_id: 'a', pos: 2, best: 361, average: 441,
          attempts: [661, 361, 432, 420, 470],
        }] },
      ],
    } satisfies WcaResultsResponse;

    const out = extractPersonCompetitionResults(data, '2019WANY36');
    expect(out.map((r) => r.round_type_id).sort()).toEqual(['1', 'f']);
    expect(out.find((r) => r.round_type_id === 'f')?.attempts).toEqual([387, 563, 277, 433, 399]);
  });

  it('fills every round when the person mirror has not absorbed the competition yet', () => {
    const fallback = [
      row('MaomingOpen2026', '333', '1', { id: 8390706, best: 361 }),
      row('MaomingOpen2026', '333', 'f', { id: 8390787, best: 277 }),
    ];

    const out = mergePersonCompetitionResults([], fallback);
    expect(out.map((r) => r.round_type_id)).toEqual(['1', 'f']);
  });

  it('replaces a stale matching round and retains the other competition rounds', () => {
    const stale = row('MaomingOpen2026', '333', '1', { live: true, best: 400 });
    const fallback = [
      row('MaomingOpen2026', '333', '1', { id: 8390706, best: 361 }),
      row('MaomingOpen2026', '333', 'f', { id: 8390787, best: 277 }),
    ];

    const out = mergePersonCompetitionResults([stale], fallback);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.round_type_id === '1')?.best).toBe(361);
    expect(out.find((r) => r.round_type_id === '1')?.live).toBeUndefined();
  });
});
