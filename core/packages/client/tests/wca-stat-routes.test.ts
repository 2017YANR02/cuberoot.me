import { expect, it, vi } from 'vitest';
import { WCA_STAT_NON_PAGE_IDS, WCA_STAT_PAGE_IDS } from '@cuberoot/shared/wca-stat-catalog';
import { isRetiredRoute } from '@/lib/retired-routes';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { readdirSync } from 'node:fs';
import nextConfig from '../next.config';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_HTTP_ERROR_FALLBACK;404'); } }));
vi.mock('@/app/[lang]/wca/[statId]/WcaStatClient', () => ({ default: () => null }));
import Page from '@/app/[lang]/wca/[statId]/page';

it('serves every catalog page and never retires its URL', async () => {
  for (const statId of WCA_STAT_PAGE_IDS) {
    expect(isRetiredRoute(`/wca/${statId}`)).toBe(false);
    await expect(Page({ params: Promise.resolve({ statId }) })).resolves.toBeTruthy();
  }
});

it('returns 404 for every non-page ID and unknown IDs', async () => {
  for (const statId of WCA_STAT_NON_PAGE_IDS) {
    expect(isRetiredRoute(`/wca/${statId}`)).toBe(true);
    await expect(Page({ params: Promise.resolve({ statId }) })).rejects.toThrow('404');
  }
  await expect(Page({ params: Promise.resolve({ statId: 'not_a_registered_stat' }) })).rejects.toThrow('404');
});

it('rejects unknown IDs before streaming without swallowing public stats or named WCA pages', async () => {
  const rewrites = await nextConfig.rewrites!();
  if (Array.isArray(rewrites)) throw new Error('Expected ordered rewrites');
  const rule = rewrites.afterFiles?.find(rule => rule.destination === '/404');
  expect(rule).toBeDefined();
  const match = getPathMatch(rule!.source);
  const siblings = readdirSync(new URL('../app/[lang]/wca', import.meta.url), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !/^[\[(_@]/.test(entry.name))
    .map(entry => entry.name);
  for (const prefix of ['', '/zh', '/en']) {
    expect(match(`${prefix}/wca/not_a_registered_stat`)).toBeTruthy();
    expect(match(`${prefix}/wca/competition_streaks_typo`)).toBeTruthy();
    for (const id of [...WCA_STAT_PAGE_IDS, ...siblings]) {
      expect(match(`${prefix}/wca/${id}`), id).toBe(false);
      expect(match(`${prefix}/wca/${id}/`), id).toBe(false);
    }
    expect(match(`${prefix}/wca/persons/2017YANR02`)).toBe(false);
  }
});
