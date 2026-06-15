import { describe, it, expect } from 'vitest';
import { mergePersonLive } from '@/lib/person-live-merge';
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
