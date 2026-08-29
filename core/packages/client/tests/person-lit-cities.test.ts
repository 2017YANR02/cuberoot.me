import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLitFromComps } from '@/components/persons/logic/lit_cities';
import { getCanonicalCompCityLabels } from '@/lib/comp-city';
import type { WcaCompetition } from '@/lib/wca-person-api';

const comp = (id: string, city: string, country_iso2 = 'CN'): WcaCompetition => ({
  id,
  city,
  country_iso2,
  name: id,
  start_date: '2025-01-01',
  end_date: '2025-01-01',
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('person lit cities', () => {
  it('uses the shared country city index to merge WCA city-name variants', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toContain('/stats/comp_city/ZZ.json');
      return new Response(JSON.stringify({
        'Hangzhou, Zhejiang': [
          ['hangzhou-a', 'Hangzhou A', '2024-01-01', '2024-01-01'],
          ['hangzhou-b', 'Hangzhou B', '2025-01-01', '2025-01-01'],
          ['hangzhou-c', 'Hangzhou C', '2026-01-01', '2026-01-01'],
        ],
      }));
    }));

    const comps = [
      comp('hangzhou-a', 'Hangzhou', 'ZZ'),
      comp('hangzhou-b', 'Hangzhou', 'ZZ'),
      comp('hangzhou-c', 'Hangzhou, Zhejiang', 'ZZ'),
    ];
    const labels = await getCanonicalCompCityLabels(
      comps.map((item) => ({ id: item.id, country: item.country_iso2 })),
    );
    const lit = buildLitFromComps(comps, null, labels);

    expect(lit.cities).toEqual([expect.objectContaining({
      iso2: 'ZZ',
      city: 'Hangzhou, Zhejiang',
      count: 3,
      countryCount: 3,
    })]);
  });

  it('falls back to the raw WCA city for competitions absent from the index', () => {
    const lit = buildLitFromComps([comp('new-comp', 'New City')], null, new Map());
    expect(lit.cities).toEqual([expect.objectContaining({ city: 'New City', count: 1 })]);
  });
});
