// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { fetchWcaStatIndex } from '@/lib/wca-stat-index';
import { WCA_STAT_NON_PAGE_IDS, WCA_STAT_PAGE_IDS } from '@cuberoot/shared/wca-stat-catalog';

afterEach(() => vi.unstubAllGlobals());

it('keeps the current competition streak entry but excludes retired links from stale published data', async () => {
  const current = { id: 'competition_streaks', titleEn: 'Competition streaks', titleZh: '特种兵：连续参赛' };
  const retired = { id: 'cross_city_competition_streaks', titleEn: 'Cross-city competition streaks', titleZh: '跨城连续参赛（特种兵）' };
  const category = { nameEn: 'Competitor Journey', nameZh: '选手经历', stats: [retired, current] };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ categories: [category] })));
  vi.stubGlobal('fetch', fetchMock);
  const signal = new AbortController().signal;

  expect(await fetchWcaStatIndex(signal)).toEqual({ categories: [{ ...category, stats: [current] }] });
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/stats/index.json'), { signal, cache: 'no-cache' });
});

it('accepts only this release\'s public pages from an older or newer index', async () => {
  const entry = (id: string) => ({ id, titleEn: id, titleZh: id });
  const category = { nameEn: 'Statistics', nameZh: '统计' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ categories: [
    { ...category, stats: [...WCA_STAT_NON_PAGE_IDS, 'new_stat_from_a_future_release'].map(entry) },
    { ...category, stats: WCA_STAT_PAGE_IDS.map(entry) },
  ] })));
  const index = await fetchWcaStatIndex();
  expect(index.categories).toEqual([{ ...category, stats: WCA_STAT_PAGE_IDS.map(entry) }]);
});

it('revalidates a subsequent load after failure or an older publication', async () => {
  const old = { categories: [] };
  const fresh = { categories: [{ nameEn: 'Journey', nameZh: '经历', stats: [
    { id: 'competition_streaks', titleEn: 'Competition streaks', titleZh: '特种兵：连续参赛' },
  ] }] };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json(old))
    .mockResolvedValueOnce(Response.json(fresh));
  vi.stubGlobal('fetch', fetchMock);
  await expect(fetchWcaStatIndex()).rejects.toThrow('HTTP 503');
  expect(await fetchWcaStatIndex()).toEqual(old);
  expect(await fetchWcaStatIndex()).toEqual(fresh);
});
