import { describe, expect, it } from 'vitest';
import { personalExplorerAchievements } from '@/lib/person-achievements';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import type { WcaCompetition, WcaResultRow } from '@/lib/wca-person-api';

const row = (id: string, date: string, extra: Partial<WcaResultRow> = {}): WcaResultRow => ({ competition_id: id, date, event_id: '333', round_type_id: 'f', format_id: 'a', best: 1000, average: 1200, attempts: [1000], pos: 5, ...extra });
const awards = (rows: WcaResultRow[], kind: string, comps: WcaCompetition[] = []) => personalExplorerAchievements(rows, comps).filter(a => a.kind === kind);

describe('competition story achievements', () => {
  it('requires a three-year absence and success at the first competition back', () => {
    const old = row('Old', '2020-04-01'), back = row('Back', '2023-04-01');
    expect(awards([back, old, back], 'reunion')[0].evidence.map(e => e.compId)).toEqual(['Old', 'Back']);
    expect(awards([old, { ...back, date: '2023-03-31' }], 'reunion')).toEqual([]);
    expect(awards([old, row('DNF', '2022-01-01', { best: -1 }), back], 'reunion')).toEqual([]);
    expect(awards([old, row('DNS', '2022-01-01', { best: -2 }), back], 'reunion')).toHaveLength(1);
    expect(awards([old, { ...back, best: -1 }, row('Later', '2023-04-02')], 'reunion')).toEqual([]);
  });
  it('uses the previous competition end date and rejects missing or invalid dates', () => {
    const rows = [row('Old', '2020-04-01'), row('Back', '2023-04-01')];
    const comp: WcaCompetition = { id: 'Old', name: 'Old', city: '', country_iso2: 'US', start_date: '2020-04-01', end_date: '2020-04-03' };
    expect(awards(rows, 'reunion', [comp])).toEqual([]);
    for (const date of ['', '2020-02-30']) expect(awards([{ ...rows[0], date }, rows[1]], 'reunion')).toEqual([]);
    expect(awards([row('Leap', '2020-02-29'), row('Back', '2023-02-28')], 'reunion')).toEqual([]);
  });
  it('tracks strict PB improvements separately; ties do not reset their original date', () => {
    const rows = [row('Old', '2020-01-01'), row('Tie', '2022-01-01'), row('New', '2023-01-01', { best: 900, average: 1100 })];
    const result = awards(rows, 'thaw');
    expect(result).toHaveLength(1);
    expect(result[0].event).toBe('333');
    expect(result[0].evidence.map(e => e.value)).toEqual([1000, 900, 1200, 1100]);
    expect(awards(rows.slice(0, 2), 'thaw')).toEqual([]);
    expect(awards([rows[0], { ...rows[1], best: 950, average: 1150 }, rows[2]], 'thaw')).toEqual([]);
  });
  it('ignores failures, live results and unofficial multi-blind averages', () => {
    const old = row('Old', '2020-01-01');
    expect(awards([old, row('New', '2024-01-01', { best: -1, average: -1 })], 'thaw')).toEqual([]);
    expect(awards([old, row('Live', '2024-01-01', { best: 900, average: 1100, live: true })], 'thaw')).toEqual([]);
    expect(awards([old, row('New', '2024-01-01', { average: 1100 })].map(r => ({ ...r, event_id: '333mbf' })), 'thaw')).toEqual([]);
  });
  it('counts twelve distinct start months within one year, including DNF but excluding DNS', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`C${i}`, `2024-${String(i + 1).padStart(2, '0')}-01`, { best: -1 }));
    expect(awards(rows, 'twelveMonths')[0].evidence).toHaveLength(12);
    expect(awards([...rows.slice(1), rows[1]], 'twelveMonths')).toEqual([]);
    expect(awards(rows.map((r, i) => i === 0 ? { ...r, date: '2023-01-01' } : r), 'twelveMonths')).toEqual([]);
    expect(awards(rows.map((r, i) => i === 0 ? { ...r, best: -2 } : r), 'twelveMonths')).toEqual([]);
  });
  it('requires all active events at one competition, excluding retired events and unsuccessful singles', () => {
    const active = ALL_EVENT_IDS.filter(e => !CANCELLED_EVENT_IDS.has(e));
    const rows = active.map(event_id => row('All', '2024-01-01', { event_id }));
    expect(awards([...rows, rows[0]], 'allInOne')[0].count).toBe(17);
    expect(awards(rows.map((r, i) => i === 0 ? { ...r, competition_id: 'Other' } : r), 'allInOne')).toEqual([]);
    expect(awards(rows.map((r, i) => i === 0 ? { ...r, event_id: 'magic' } : r), 'allInOne')).toEqual([]);
    expect(awards(rows.map((r, i) => i === 0 ? { ...r, best: -1 } : r), 'allInOne')).toEqual([]);
    expect(awards([], 'allInOne')).toEqual([]);
  });
});
