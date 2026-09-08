import { describe, expect, it } from 'vitest';
import { expansionStatAchievements, personalExplorerAchievements } from '@/lib/person-achievements';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import type { WcaResultRow } from '@/lib/wca-person-api';

const row = (comp = 'A', event = '333', extra: Partial<WcaResultRow> = {}): WcaResultRow => ({
  competition_id: comp, event_id: event, round_type_id: 'f', format_id: 'a', best: 400, average: 450, pos: 1, attempts: [400, 450, 460, 480, 490], date: '2020-01-01', ...extra,
});
const award = (rows: WcaResultRow[], kind: string) => personalExplorerAchievements(rows, []).filter(a => a.kind === kind);

describe('personal achievement expansion', () => {
  it('counts official final participation once including DNF, excluding DNS and live rounds', () => {
    const rows = Array.from({ length: 99 }, (_, i) => row(`C${i}`));
    expect(award([...rows, rows[0], row('DNS', '333', { best: -2 }), row('Live', '333', { live: true }), row('Round', '333', { round_type_id: '1' })], 'finals')).toEqual([]);
    expect(award([...rows, row('DNF', '333', { best: -1, average: -1 })], 'finals')[0].count).toBe(100);
  });
  it('requires active event medals and excludes unsuccessful or non-podium finals', () => {
    const active = ALL_EVENT_IDS.filter(e => !CANCELLED_EVENT_IDS.has(e));
    expect(award(active.map(e => row('A', e)), 'championPuzzle')[0].tier).toBe(17);
    const four = active.slice(0, 4).map(e => row('A', e));
    expect(award([...four, row('A', 'magic'), row('A', active[4], { pos: 4 }), row('A', active[5], { best: -1 })], 'podiumPuzzle')).toEqual([]);
    expect(award([...four, row('A', active[4], { pos: 3 })], 'podiumPuzzle')[0].count).toBe(5);
  });
  it('distinguishes lifetime blindfold quartet from same-competition relay', () => {
    const rows = ['333bf', '444bf', '555bf', '333mbf'].map((e, i) => row(`C${i}`, e));
    expect(award(rows, 'blindQuartet')[0].count).toBe(4);
    expect(award(rows, 'blindRelay')).toEqual([]);
    expect(award(rows.slice(0, 3).map(r => ({ ...r, competition_id: 'Together' })), 'blindRelay')[0].count).toBe(3);
    expect(award(rows.map(r => ({ ...r, best: -1 })), 'blindQuartet')).toEqual([]);
  });
  it('decodes perfect modern multi-blind attempts, rejecting old encoding, failures and unknown time', () => {
    const encoded = (solved: number, missed = 0, seconds = 3500) => (99 - solved + missed) * 10_000_000 + seconds * 100 + missed;
    const valid = row('A', '333mbf', { attempts: [encoded(20)] });
    expect(award([valid], 'perfectBlind')[0].count).toBe(20);
    expect(award([row('A', '333mbf', { attempts: [-1, -2, 0, encoded(30, 1), encoded(30, 0, 99999), 1_700_030_000] })], 'perfectBlind')).toEqual([]);
    expect(award([{ ...valid, event_id: '333mbo' }], 'perfectBlind')).toEqual([]);
  });
  it('breaks sub-five streaks on unsuccessful averages and excludes other events', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`C${i}`));
    expect(award(rows, 'sub5')[0].count).toBe(5);
    expect(award(rows.map((r, i) => i === 2 ? { ...r, average: -1 } : r), 'sub5')).toEqual([]);
    expect(award(rows.map((r, i) => i === 2 ? { ...r, average: 500 } : r), 'sub5')).toEqual([]);
    expect(award(rows.map(r => ({ ...r, event_id: '222' })), 'sub5')).toEqual([]);
  });
  it('counts consecutive actual participation years, not elapsed career span', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`C${i}`, '333', { date: `${2010 + i}-01-01`, best: -1 }));
    expect(award(rows, 'evergreen')[0].count).toBe(5);
    expect(award(rows.map((r, i) => i === 2 ? { ...r, best: -2 } : r), 'evergreen')).toEqual([]);
    expect(award(rows.map((r, i) => i === 2 ? { ...r, date: '' } : r), 'evergreen')).toEqual([]);
  });
  it('awards a winning event debut without letting DNS or duplicate rows move the first entry', () => {
    const win = row('Win', '222', { date: '2020-02-01' });
    const before = row('Before', '222', { date: '2020-01-01', best: -2, pos: 10 });
    expect(award([before, win, win], 'debutWin')).toHaveLength(1);
    expect(award([{ ...before, best: -1 }, win], 'debutWin')).toEqual([]);
  });
  it('does not infer first-record WR when same-day lower-level records make ordering ambiguous', () => {
    const wr = row('B', '333', { regional_single_record: 'WR' });
    expect(award([wr], 'firstRecord')).toHaveLength(1);
    expect(award([wr, row('A', '222', { regional_single_record: 'NR' })], 'firstRecord')).toEqual([]);
    expect(award([{ ...wr, live: true }], 'firstRecord')).toEqual([]);
  });
  it('requires consecutive actual World Championship editions for defense and all three medal colors', () => {
    const podium = (compId: string, place: number) => ({ compId, eventId: '333', level: 'world', place });
    const all = [podium('WC2019', 1), podium('WC2023', 1), podium('WC2025', 2), podium('WC2017', 3)];
    const actual = ['WC2017', 'WC2019', 'WC2023', 'WC2025'];
    const badges = personalExplorerAchievements([], [], '', all, actual);
    expect(badges.find(a => a.kind === 'defend')?.count).toBe(2);
    expect(badges.find(a => a.kind === 'medalTrio')?.count).toBe(3);
    expect(personalExplorerAchievements([], [], '', all, ['WC2017', 'WC2019', 'MissingEdition', 'WC2023', 'WC2025']).find(a => a.kind === 'defend')).toBeUndefined();
  });
});

describe('complete global achievement evidence', () => {
  it('never treats visible top-N lists as complete eligibility data', () => {
    expect(expansionStatAchievements('together', { sections: [{ title: 'Pairs', rows: [[740, '[A](/persons/TEST) & [B](/persons/OTHER)']] }] }, 'TEST')).toEqual([]);
  });
  it('awards both partners and retains all qualifying partners in one badge', () => {
    const data = { achievementRows: [['TEST', 'OTHER', 50, 'A', 'B'], ['THIRD', 'TEST', 100, 'C', 'A'], ['TEST', 'TEST', 999]] };
    const [badge] = expansionStatAchievements('together', data, 'TEST');
    expect(badge.count).toBe(100);
    expect(badge.evidence.map(e => e.personId)).toEqual(['THIRD', 'OTHER']);
    expect(badge.evidence[0].personName).toBe('C');
  });
  it('keeps weekly counts per event and includes tied Worlds best holders independently', () => {
    const weekly = expansionStatAchievements('weekly', { achievementRows: [['TEST', '333', 67], ['TEST', '222', 9], ['TEST', 'unknown', 100], ['OTHER', '444', 100]] }, 'TEST');
    expect(weekly.map(a => [a.event, a.tier])).toEqual([['333', 50]]);
    const world = expansionStatAchievements('worldsBest', { achievementRows: [['TEST', '333', 'single', 346, 'WC2025'], ['OTHER', '333', 'single', 346, 'WC2025'], ['TEST', '333', 'average', 423, 'WC2025'], ['TEST', '333mbf', 'average', 1234, 'WC2025']] }, 'TEST');
    expect(world).toHaveLength(1);
    expect(world[0].evidence.map(e => e.type)).toEqual(['single', 'average']);
  });
});
