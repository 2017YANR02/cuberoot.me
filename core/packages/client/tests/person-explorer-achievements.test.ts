import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXPLORER_ACHIEVEMENTS, explorerTier, personalExplorerAchievements, statExplorerAchievements, standingRecordAchievements, fetchExplorerAchievements, type AchievementStat, type RecordHistoryBundle } from '@/lib/person-achievements';
import type { WcaResultRow, WcaCompetition } from '@/lib/wca-person-api';
const row = (n: number, extra: Partial<WcaResultRow> = {}): WcaResultRow => ({ competition_id: 'C' + n, event_id: '333', round_type_id: 'f', format_id: 'a', best: 100, average: 200, pos: 2, attempts: [100, 200, -1, -2, 0], date: new Date(Date.UTC(2020, 0, n + 1)).toISOString().slice(0, 10), ...extra });
const comp = (n: number, country: string): WcaCompetition => ({ id: 'C' + n, name: 'Competition', city: '', country_iso2: country, start_date: row(n).date!, end_date: row(n).date! });
const get = (rows: WcaResultRow[], kind: string, comps: WcaCompetition[] = [], country = '') => personalExplorerAchievements(rows, comps, country).filter(a => a.kind === kind);
const person = '[Person](https://www.worldcubeassociation.org/persons/2010TEST01)';
const link = '[Competition](https://www.worldcubeassociation.org/competitions/Test2020/results/all#e333_1)';
afterEach(() => vi.unstubAllGlobals());

it('validates every tier boundary and rejects non-integer, negative and infinite counts', () => {
  for (const kind of Object.keys(EXPLORER_ACHIEVEMENTS) as (keyof typeof EXPLORER_ACHIEVEMENTS)[]) {
    const levels = EXPLORER_ACHIEVEMENTS[kind].tiers;
    for (const level of levels) expect(explorerTier(kind, level)).toBe(level);
    expect(explorerTier(kind, levels[0] - 1)).toBeUndefined();
    for (const invalid of [NaN, Infinity, -1, 0, 5.1]) expect(explorerTier(kind, invalid)).toBeUndefined();
  }
});
it('counts distinct official countries and continents, including DNF but excluding DNS and live rows', () => {
  const countries = ['US', 'CN', 'AU', 'BR', 'DE', 'ZA', 'FR', 'CA'];
  const comps = countries.map((c, i) => comp(i, c));
  const rows = countries.map((_, i) => row(i, i === 5 ? { best: -1 } : i === 6 ? { best: -2 } : i === 7 ? { live: true } : {}));
  const awards = personalExplorerAchievements([...rows, rows[0]], comps);
  expect(awards.find(a => a.kind === 'traveler')?.count).toBe(6);
  expect(awards.find(a => a.kind === 'continents')?.count).toBe(6);
  expect(get(rows, 'traveler', [])).toEqual([]);
  expect(get(rows, 'passport', comps, 'US')[0]?.count).toBe(4);
  expect(get(rows, 'passport', comps, '')).toEqual([]);
});
it('preserves longest PR ties and podium streaks after they end; absent dates cannot establish streaks', () => {
  const rows = Array.from({ length: 6 }, (_, i) => row(i, i === 5 ? { best: 300, average: 400, pos: 4 } : {}));
  expect(get(rows.reverse(), 'breakthrough')[0]?.count).toBe(5);
  expect(get(rows, 'podiumStreak')[0]?.count).toBe(5);
  expect(get(rows.map(r => ({ ...r, date: undefined })), 'breakthrough')).toEqual([]);
  expect(get(rows.map(r => ({ ...r, round_type_id: 'b' })), 'podiumStreak')).toEqual([]);
  expect(get(rows.map(r => ({ ...r, round_type_id: '1' })), 'podiumStreak')).toEqual([]);
});
it('awards the first win only after twenty prior event entries, never counting the winning competition', () => {
  const prior = Array.from({ length: 20 }, (_, i) => row(i));
  expect(get([...prior, row(20, { pos: 1 })], 'firstWin')[0]?.count).toBe(20);
  expect(get([...prior.slice(1), row(20, { pos: 1 })], 'firstWin')).toEqual([]);
  expect(get([row(0, { pos: 1 }), ...prior.slice(1), row(20, { pos: 1 })], 'firstWin')).toEqual([]);
});
it('counts only DNF before the first blind success, excluding DNS and failures afterwards', () => {
  const prior = Array.from({ length: 4 }, (_, i) => row(i, { event_id: '333bf', best: -1, attempts: [-1, -1, -1] }));
  const success = row(4, { event_id: '333bf', attempts: [-2, 200, -1] });
  expect(get([...prior, success, row(5, { event_id: '333bf', attempts: [-1, -1, -1] })], 'butterfly')[0]?.count).toBe(12);
  expect(get([...prior.map(r => ({ ...r, attempts: [-2, -2, -2] })), success], 'butterfly')).toEqual([]);
  expect(get(prior, 'butterfly')).toEqual([]);
});
it('counts successful attempts exactly once and records the milestone crossing', () => {
  const rows = Array.from({ length: 2000 }, (_, i) => row(i, { attempts: [100, 100, 100, 100, 100] }));
  expect(get([...rows, rows[0], row(2001, { live: true })], 'solves')[0]).toMatchObject({ count: 10000, tier: 10000, evidence: [{ compId: 'C1999', text: '10000' }] });
  expect(get(rows.slice(1), 'solves')).toEqual([]);
});
it('counts one podium per event and separates WR, CR and NR markers including single and average', () => {
  const rows = ['333', '222', '444', '555', '666'].map(event_id => row(0, { event_id, regional_single_record: 'NR' }));
  expect(get([...rows, rows[0]], 'haul')[0]?.count).toBe(5);
  expect(get(rows, 'constellation')[0]).toMatchObject({ record: 'NR', count: 5 });
  expect(get(rows, 'storm')[0]).toMatchObject({ record: 'NR', count: 5 });
  const mixed = [row(0, { regional_single_record: 'WR', regional_average_record: 'WR' }), row(0, { event_id: '222', regional_single_record: 'WR', regional_average_record: 'NR' })];
  expect(get(mixed, 'storm')).toMatchObject([{ record: 'WR', count: 3 }]);
});
it('includes silver and bronze world medals per event while ignoring other championships', () => {
  const a = personalExplorerAchievements([], [], '', [
    { level: 'world', place: 3, eventId: '333' }, { level: 'world', place: 2, eventId: '333' },
    { level: 'world', place: 3, eventId: '222' }, { level: 'country', place: 1, eventId: '444' },
  ]);
  expect(a.map(x => [x.kind, x.event, x.place])).toEqual([['worldPodium', '333', 2], ['worldPodium', '222', 3]]);
});
it('uses full sweep rankings, calendar ranking only and all three tied podium positions', () => {
  expect(statExplorerAchievements('sweep', { rows: [[3, person, 'US', link], [10, person, 'US', link]] }, '2010TEST01')[0]?.count).toBe(10);
  const section = { title: "Rubik's Cube - Single", rows: [[1, person, '5.20', '2020-05-20', link]] };
  expect(statExplorerAchievements('calendar', { panels: [{ id: 'history', sections: [section] }] }, '2010TEST01')).toEqual([]);
  expect(statExplorerAchievements('calendar', { panels: [{ id: 'ranking', sections: [section] }] }, '2010TEST01')[0]).toMatchObject({ event: '333', count: 1, evidence: [{ compId: 'Test2020' }] });
  for (let i = 0; i < 3; i++) {
    const people = ['-', '-', '-']; people[i] = person;
    expect(statExplorerAchievements('triplets', { sections: [{ title: '2x2x2 Cube - Average', rows: [['2.42', 'R1', ...people, link]] }] }, '2010TEST01')[0]?.event).toBe('222');
  }
});
describe('record duration', () => {
  const record = (d: string, v: number, p = '2010TEST01', extra: Partial<RecordHistoryBundle['rows'][number]> = {}): RecordHistoryBundle['rows'][number] => ({ e: '333', t: 's', l: 'WR', c: 'C0', p, d, v, ...extra });
  it('ties do not end a record; better results do, even another record by the same person', () => {
    const rows = [record('2020-01-01', 100), record('2020-06-01', 100, 'OTHER'), record('2021-01-01', 90, 'OTHER')];
    expect(standingRecordAchievements({ updated: '2026-01-01', rows }, '2010TEST01', 'WR')[0]?.count).toBe(366);
    expect(standingRecordAchievements({ updated: '2020-06-01', rows: rows.slice(0, 1) }, '2010TEST01', 'WR')).toEqual([]);
  });
  it('caps retired events, ignores unofficial multi-blind means and excludes WR candidates from CR awards', () => {
    const rows = [record('2012-01-01', 100, undefined, { e: 'magic' }), record('2010-01-01', 100, undefined, { e: '333mbf', t: 'a' })];
    expect(standingRecordAchievements({ updated: '2026-01-01', rows }, '2010TEST01', 'WR').map(a => [a.event, a.count])).toEqual([['magic', 366]]);
    expect(standingRecordAchievements({ updated: '2026-01-01', rows }, '2010TEST01', 'CR')).toEqual([]);
    expect(standingRecordAchievements({ updated: 'invalid', rows: [record('2020-01-01', 100)] }, '2010TEST01', 'WR')).toEqual([]);
  });
});
it('isolates failed feeds so available achievements remain visible', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('complete_competition_winners')) return { ok: true, json: async () => ({ rows: [[5, person, 'US', link]] }) };
    throw new Error('offline');
  }));
  const awards = await fetchExplorerAchievements('2010TEST01', [], new AbortController().signal);
  expect(awards.map(a => a.kind)).toEqual(['sweep']);
});
it('maps every event and person in the complete static coincidence and sweep fixtures', () => {
  for (const kind of ['calendar', 'triplets', 'sweep'] as const) {
    const data = JSON.parse(readFileSync(resolve(process.cwd(), '../../../stats', EXPLORER_ACHIEVEMENTS[kind].stat + '.json'), 'utf8')) as AchievementStat;
    const sections = kind === 'calendar' ? data.panels!.find(p => p.id === 'ranking')!.sections! : data.sections ?? [{ title: '', rows: data.rows! }];
    let checked = 0;
    for (const section of sections) for (const r of section.rows) {
      if (kind === 'sweep' && Number(r[0]) < 3) continue;
      for (const cell of kind === 'triplets' ? r.slice(2, 5) : [r[1]]) {
        const id = String(cell).match(/persons\/([^/)]+)/)![1];
        const result = statExplorerAchievements(kind, { sections: [section], panels: [{ id: 'ranking', sections: [section] }] }, id);
        expect(result.length, kind + ' ' + section.title + ' ' + id).toBe(1);
        checked++;
      }
    }
    expect(checked > 0).toBe(true);
  }
});
