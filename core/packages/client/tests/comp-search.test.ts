import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCnProvince } from '@/lib/city-localize';
import { loadComps, searchComps, type Comp } from '@/lib/comp-search';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

const COMPS: Comp[] = [
  {
    id: 'XiamenOpen2013',
    name: 'Xiamen Open 2013',
    city: 'Xiamen',
    country: 'cn',
    start_date: '2013-09-20',
    end_date: '2013-09-22',
  },
  {
    id: 'FuzhouJiangxiOpen2026',
    name: 'Fuzhou Jiangxi Open 2026',
    city: 'Fuzhou, Jiangxi',
    country: 'cn',
    start_date: '2026-01-01',
    end_date: '2026-01-01',
  },
  {
    id: 'XiamenMalaysiaOpen2026',
    name: 'Xiamen Malaysia Open 2026',
    city: 'Kuala Lumpur',
    country: 'my',
    start_date: '2026-01-01',
    end_date: '2026-01-01',
  },
];

describe('competition province search', () => {
  it.each(['福建', 'Fujian'])('finds a Chinese competition from its bare city using %s', (query) => {
    expect(searchComps(query, COMPS).map((c) => c.id)).toEqual(['XiamenOpen2013']);
  });

  it('prefers an explicit province segment for ambiguous city names', () => {
    expect(searchComps('江西', COMPS).map((c) => c.id)).toEqual(['FuzhouJiangxiOpen2026']);
    expect(searchComps('福建', COMPS).map((c) => c.id)).not.toContain('FuzhouJiangxiOpen2026');
  });

  it('does not infer a Chinese province for a foreign competition', () => {
    expect(searchComps('福建', [COMPS[2]])).toEqual([]);
  });

  it('finds every current Fujian competition even when the source omits the province', () => {
    const all = ['stats/all_past_comps.json', 'stats/all_upcoming_comps.json']
      .flatMap((path) => JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8')) as Comp[]);
    const expected = all.filter((comp) => (
      comp.country.toUpperCase() === 'CN'
      && resolveCnProvince(comp.city ?? '')?.zh === '福建'
    ));
    const found = new Set(searchComps('福建', all, all.length).map((comp) => comp.id));

    expect(expected.length).toBeGreaterThan(0);
    expect(expected.filter((comp) => !found.has(comp.id))).toEqual([]);
  });
});

describe('competition index loading', () => {
  it('does not permanently cache an all-source failure as an empty list', async () => {
    const attempts = new Map<string, number>();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('all_past_comps') && !url.includes('all_upcoming_comps')) {
        return new Response('unavailable', { status: 503 });
      }
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      if (attempt === 1) return new Response('unavailable', { status: 503 });
      if (url.includes('all_past_comps')) {
        return new Response(JSON.stringify([{
          id: 'Recovered2026',
          name: 'Recovered Open 2026',
          city: 'Recovered City',
          country: 'US',
          start_date: '2026-08-30',
          end_date: '2026-08-30',
        }]), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    }));

    await expect(loadComps()).rejects.toThrow('competition indexes unavailable');
    await expect(loadComps()).resolves.toMatchObject([{ id: 'Recovered2026' }]);
  });
});
