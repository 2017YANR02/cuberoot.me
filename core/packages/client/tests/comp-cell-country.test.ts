import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { CompCell } from '@/components/CompCell/CompCell';
import { loadFlagData } from '@/lib/country-flags';

const props = {
  compId: 'GuangzhouGrandOpen2026',
  compName: '2026WCA广州魔方公开赛',
  isZh: true,
  date: '2026-10-05',
};
afterEach(() => vi.unstubAllGlobals());

it('renders the host flag when a recon has a competition ID but no country', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url.includes('comp_countries.json')
      ? { GuangzhouGrandOpen2026: 'China' } : {},
  })));
  await loadFlagData({ persons: false });
  const html = renderToStaticMarkup(createElement(CompCell, props));
  expect(html).toContain('fi-cn');
  expect(html).not.toContain('fi-hk');
});

it('preserves an explicit country for competitions missing from the index', () => {
  const html = renderToStaticMarkup(createElement(CompCell, { ...props, compId: '', country: 'HK' }));
  expect(html).toContain('fi-hk');
});

it('does not invent a flag for an unknown competition', () => {
  const html = renderToStaticMarkup(createElement(CompCell, { ...props, compId: 'unknown' }));
  expect(html).not.toContain('fi-');
});
