import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { GrandSlamBadges } from '@/components/persons/sections/PersonAchievements';
import type { WcaResultRow } from '@/lib/wca-person-api';
import type { ReactNode } from 'react';
import { AchievementMedal, recordAchievementTier } from '@/components/persons/sections/AchievementMedal';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import type { ExplorerAchievement } from '@/lib/person-achievements';

// Keep eligibility and evidence assertions independent of the portal's closed state.
// Actual hover, keyboard and touch behavior is exercised in the browser.
vi.mock('@/components/persons/sections/AchievementBadge', async () => {
  const { ACHIEVEMENT_TITLES } = await import('@/components/persons/sections/AchievementMedal');
  return { AchievementBadge: ({ kind, name, children, recordCount }: { kind: keyof typeof ACHIEVEMENT_TITLES; name?: string; children?: ReactNode; recordCount?: number }) =>
    createElement('article', { className: 'wp-achievement', 'data-kind': kind, 'data-count': recordCount }, `${name ?? ''} ${ACHIEVEMENT_TITLES[kind].en}`, children) };
});

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'en' }) }));

it('combines historical events by record level and rejects invalid or unofficial records', () => {
  const result = (event: string, single: string | null, average: string | null = null, extra: Partial<WcaResultRow> = {}): WcaResultRow => ({
    competition_id: 'Test2026', event_id: event, round_type_id: 'f', format_id: 'a',
    best: 100, average: 200, pos: 1, attempts: [],
    regional_single_record: single, regional_average_record: average, ...extra,
  });
  const html = renderToStaticMarkup(createElement(GrandSlamBadges, {
    rows: [], wcaId: '2018KHAN28', isZh: false,
    results: [
      result('222', 'WR', 'WR'), result('222', 'WR'),
      ...['AsR', 'AfR', 'ER', 'NAR', 'OcR', 'SAR', 'CR'].map(marker => result('333', marker)),
      result('444', null, 'NR'), result('222', 'NR'), result('333ft', 'WR'),
      result('555', 'WR', 'NR', { best: -1, average: 0 }),
      result('666', 'WR', null, { live: true }), result('777', 'PR'), result('skewb', null),
    ],
  }));
  expect((html.match(/data-kind="historical/g) ?? []).length).toBe(3);
  expect(html).toContain('data-kind="haul"');
  expect(html).toContain('data-kind="historicalWR" data-count="4"> Historical world record');
  expect(html).toContain('data-kind="historicalCR" data-count="7">3×3');
  expect(html).toContain('data-kind="historicalNR" data-count="2"> Historical national record');
  expect(html).toContain('2×2 Single');
  expect(html).toContain('2×2 Average');
  expect(html).toContain('3×3 Historical continental record');
  expect(html).toContain('4×4 Average');
  expect(html).toContain('Feet');
  expect(html).not.toContain('5×5');
  expect(html).not.toContain('6×6');
  expect(html).not.toMatch(/>7×7 Historical/);
  expect(html).not.toMatch(/>Skewb Historical/);
  expect(html).not.toContain('Current world record holder');
});

it.each([
  [1, 1], [9, 1], [10, 10], [49, 10], [50, 50], [99, 50], [100, 100],
  [199, 100], [200, 200], [499, 200], [500, 200], [999, 200], [1000, 200], [1250, 200],
  [0, undefined], [-1, undefined], [1.5, undefined], [NaN, undefined], [Infinity, undefined], [undefined, undefined],
])('selects the highest earned tier for %s records', (count, expected) => {
  expect(recordAchievementTier(count)?.count).toBe(expected);
});

it('keeps the actual count above the highest tier on historical and current record badges', () => {
  const html = renderToStaticMarkup(createElement(AchievementMedal, { kind: 'historicalWR', recordCount: 1250, event: '333' }));
  expect(html).toContain('data-tier="200"');
  expect(html).toContain('×1250');
  const current = renderToStaticMarkup(createElement(AchievementMedal, { kind: 'wr', recordCount: 1250 }));
  expect(current).toContain('data-tier="200"');
  expect(current).toContain('×1250');
});

it('combines female historical events while keeping current holders distinct', () => {
  const row = { e: '333', t: 'a' as const, v: 452, l: 'FWR', c: 'Test2026', d: '2026-09-13', currentWorld: true };
  const html = renderToStaticMarkup(createElement(GrandSlamBadges, {
    rows: [], wcaId: 'TEST', isZh: false, countryIso2: 'CN',
    femaleRecords: [row, { ...row, c: 'Earlier2026', v: 480, currentWorld: false }, { ...row, e: '444', currentWorld: false }, { ...row, e: '333fm', v: 2500, currentWorld: false }],
  }));
  expect((html.match(/data-kind="wr"/g) ?? []).length).toBe(1);
  expect(html).toContain('data-kind="wr" data-count="2">3×3');
  expect((html.match(/data-kind="historicalWR"/g) ?? []).length).toBe(1);
  expect(html).toContain('data-kind="historicalWR" data-count="2"> Historical world record');
  expect(html).toContain('4×4 Average');
  expect(html).toContain('>25.00</strong>');
  expect((html.match(/Currently held/g) ?? []).length).toBe(1);
  expect(html).not.toContain('data-kind="historicalCR"');
  expect(html).not.toContain('data-kind="historicalNR"');
  const medal = renderToStaticMarkup(createElement(AchievementMedal, { kind: 'historicalCR', female: true, record: 'FAsR', recordCount: 2 }));
  expect(medal).toContain('>FAsR<');
  expect(medal).not.toContain('>FCR<');
});

it('retains female continent labels and current event scopes while grouping history', () => {
  const row = { e: '333', t: 's' as const, v: 500, l: 'FAsR', c: 'Test2026', d: '2026-09-13' };
  const html = renderToStaticMarkup(createElement(GrandSlamBadges, {
    rows: [], wcaId: 'TEST', isZh: false, femaleNationalComplete: true,
    femaleRecords: [row, { ...row, e: '333oh' }, { ...row, e: '444', l: 'FER' },
      { ...row, e: '555', l: 'FNR' }, { ...row, e: '666', l: 'FNR' },
      { ...row, e: '222', l: 'FWR', currentWorld: true }, { ...row, e: 'skewb', l: 'FWR', currentWorld: true }],
  }));
  expect((html.match(/data-kind="historicalCR"/g) ?? []).length).toBe(2);
  expect(html).toContain('data-kind="historicalCR" data-count="2"> Historical continental record');
  expect(html).toContain('data-kind="historicalCR" data-count="1">4×4');
  expect(html).toContain('data-kind="historicalNR" data-count="2"> Historical national record');
  expect((html.match(/data-kind="wr"/g) ?? []).length).toBe(2);
  expect((html.match(/Currently held/g) ?? []).length).toBe(2);
  expect(html).toContain('>FAsR<');
  expect(html).toContain('>FER<');
});

it('renders one experience badge with all event headings and competition links', () => {
  const extraAchievements: ExplorerAchievement[] = [
    { kind: 'podiumStreak', event: '333', count: 6, tier: 5, evidence: [{ compId: 'Three2026', date: '2026-01-01' }] },
    { kind: 'podiumStreak', event: '444', count: 7, tier: 5, evidence: [{ compId: 'Four2026', date: '2026-02-01' }] },
  ];
  const html = renderToStaticMarkup(createElement(GrandSlamBadges, { rows: [], wcaId: 'TEST', isZh: false, extraAchievements }));
  expect((html.match(/data-kind="podiumStreak"/g) ?? []).length).toBe(1);
  expect(html).toContain('<h4>3×3 ×6</h4>');
  expect(html).toContain('<h4>4×4 ×7</h4>');
  expect(html).toContain('href="/wca/comp/Three2026"');
  expect(html).toContain('href="/wca/comp/Four2026"');
});

const participation = (competition_id: string, event_id = '333', best = 100, live = false): WcaResultRow => ({
  competition_id, event_id, best, live, average: 0, pos: 1, attempts: [], round_type_id: 'f', format_id: '3',
});
const renderParticipation = (results: WcaResultRow[]) => renderToStaticMarkup(createElement(GrandSlamBadges, { rows: [], wcaId: 'TEST', isZh: false, results }));

it('awards a century for 100 distinct official competitions, including DNF but not DNS or live rows', () => {
  const results = Array.from({ length: 99 }, (_, i) => participation(`Competition${i}`));
  expect(renderParticipation([...results, results[0], participation('DNS', '333', -2), participation('Live', '333', 100, true)])).toBe('');
  const html = renderParticipation([...results, participation('Hundredth', '333', -1)]);
  expect(html).toContain('data-kind="hundred"');
  expect(html).toContain('100 competitions attended');
});

it('requires successful official results in every active event, without substituting retired or unknown events', () => {
  const active = ALL_EVENT_IDS.filter(event => !CANCELLED_EVENT_IDS.has(event));
  const results = active.map(event => participation('OneCompetition', event));
  expect(renderParticipation(results)).toContain('data-kind="allEvents"');
  const partial = results.slice(1);
  expect(renderParticipation([...partial, participation('Other', 'magic'), participation('Other', 'unknown')])).not.toContain('data-kind="allEvents"');
  expect(renderParticipation([...partial, participation('Other', active[0], -1)])).not.toContain('data-kind="allEvents"');
  expect(renderParticipation([...partial, participation('Other', active[0], 100, true)])).not.toContain('data-kind="allEvents"');
});

it('awards only the requested person’s listed events, distinguishes all-gold and hides empty sections', () => {
  const rows = [
    { wcaId: '2018KHAN28', eventId: '222', isOnlyFirst: false },
    { wcaId: '2018KHAN28', eventId: 'skewb', isOnlyFirst: true },
    { wcaId: '2009ZEMD01', eventId: '333', isOnlyFirst: true },
  ];
  const render = (wcaId: string) => renderToStaticMarkup(createElement(GrandSlamBadges, { rows, wcaId, isZh: false }));
  const html = render('2018KHAN28');
  expect((html.match(/class="wp-achievement"/g) ?? []).length).toBe(2);
  expect(html).toContain('href="/wca/grand-slam?event=222"');
  expect(html).toContain('href="/wca/grand-slam?event=skewb"');
  expect(html).not.toContain('event=333');
  expect((html.match(/data-kind="gold"/g) ?? []).length).toBe(1);
  expect(html).toContain('Gold Medal Grand Slam');
  expect(render('2017YANR02')).toBe('');
  expect(renderToStaticMarkup(createElement(GrandSlamBadges, { rows: [], wcaId: '2018KHAN28', isZh: false }))).toBe('');
});

it('groups world titles and current records, excluding other podiums, retired events and invalid results', () => {
  const record = (rank: number | null, best = 100) => ({ world_rank: rank, best, continent_rank: null, country_rank: null, event_id: '222' });
  const html = renderToStaticMarkup(createElement(GrandSlamBadges, {
    rows: [], wcaId: '2018KHAN28', isZh: false,
    podiums: [
      { level: 'world', place: 1, eventId: '222' },
      { level: 'world', place: 1, eventId: '222' },
      { level: 'world', place: 1, eventId: 'skewb' },
      { level: 'world', place: 2, eventId: '333' },
      { level: 'US', place: 1, eventId: '444' },
    ],
    records: {
      '222': { single: record(1), average: record(1) },
      '333': { single: record(2) },
      '444': { single: record(null) },
      '555': { single: record(1, -1) },
      '333ft': { single: record(1) },
    },
  }));
  expect((html.match(/<article /g) ?? []).length).toBe(5);
  expect((html.match(/data-kind="worldPodium"/g) ?? []).length).toBe(3);
  expect(html).toContain('World champion<ul><li>2×2</li><li>Skewb</li>');
  expect(html).toContain('Current world record holder<ul><li>2×2 Single 1.00</li><li>2×2 Average 1.00</li>');
  expect(html).toContain('3×3 World Championship podium');
  expect(html).not.toContain('4×4');
  expect(html).not.toContain('5×5');
  expect(html).not.toContain('Feet');
});
