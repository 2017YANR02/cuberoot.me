import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { GrandSlamBadges } from '@/components/persons/sections/PersonAchievements';
import type { WcaResultRow } from '@/lib/wca-person-api';
import type { ReactNode } from 'react';

// Keep eligibility and evidence assertions independent of the portal's closed state.
// Actual hover, keyboard and touch behavior is exercised in the browser.
vi.mock('@/components/persons/sections/AchievementBadge', async () => {
  const { ACHIEVEMENT_TITLES } = await import('@/components/persons/sections/AchievementMedal');
  return { AchievementBadge: ({ kind, name, children }: { kind: keyof typeof ACHIEVEMENT_TITLES; name?: string; children?: ReactNode }) =>
    createElement('article', { className: 'wp-achievement', 'data-kind': kind }, `${name ?? ''} ${ACHIEVEMENT_TITLES[kind].en}`, children) };
});

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'en' }) }));

it('awards historical records per event and level, deduplicating and rejecting invalid or unofficial records', () => {
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
  expect((html.match(/<article /g) ?? []).length).toBe(5);
  expect(html).toContain('2×2 Historical world record');
  expect(html).toContain('2×2 Historical national record');
  expect(html).toContain('3×3 Historical continental record');
  expect(html).toContain('4×4 Historical national record');
  expect(html).toContain('Feet');
  expect(html).not.toContain('5×5');
  expect(html).not.toContain('6×6');
  expect(html).not.toContain('7×7');
  expect(html).not.toContain('Skewb');
  expect(html).not.toContain('Current world record holder');
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
  expect((html.match(/<article /g) ?? []).length).toBe(2);
  expect(html).toContain('World champion<ul><li>2×2</li><li>Skewb</li>');
  expect(html).toContain('Current world record holder<ul><li>2×2 Single 1.00</li><li>2×2 Average 1.00</li>');
  expect(html).not.toContain('3×3');
  expect(html).not.toContain('4×4');
  expect(html).not.toContain('5×5');
  expect(html).not.toContain('Feet');
});
