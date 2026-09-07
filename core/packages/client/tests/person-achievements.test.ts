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
