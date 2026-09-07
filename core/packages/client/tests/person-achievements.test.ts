import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { GrandSlamBadges } from '@/components/persons/sections/PersonAchievements';

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('next/navigation', () => ({ useParams: () => ({ lang: 'en' }) }));

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
  expect((html.match(/wp-achievement-medal is-gold/g) ?? []).length).toBe(1);
  expect(html).toContain('All-gold Grand Slam');
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
  expect((html.match(/<details /g) ?? []).length).toBe(2);
  expect(html).toContain('World champion: 2×2, Skewb');
  expect(html).toContain('Current world record holder: 2×2 Single, 2×2 Average');
  expect(html).not.toContain('3×3');
  expect(html).not.toContain('4×4');
  expect(html).not.toContain('5×5');
  expect(html).not.toContain('Feet');
});
