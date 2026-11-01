import { describe, expect, it } from 'vitest';
import { addCountryBest, rankCountryBests, type CountryBest } from '../src/core/result_country.js';
import { Top10History } from '../src/statistics/top10_history.js';

const continents = new Map([['China', '_Asia'], ['Hong Kong', '_Asia'], ['USA', '_North America']]);
const row = (wcaId: string, country: string, val: number, date: string): CountryBest => ({
  wcaId, country, val, date, compId: `${country}-${date}`,
});

describe('result-time representation', () => {
  it('carries result countries through both historical Top10 streams', () => {
    const stat = new Top10History();
    const rows = [
      { d: '2024-08-25', pid: 'p', rc: 'China', best: 100, avg: 213, comp: 'old', vals: null },
      { d: '2026-01-01', pid: 'p', rc: 'Hong Kong', best: 90, avg: 220, comp: 'new', vals: null },
    ];
    const pb = stat['runMetric'](rows, 'average').events;
    expect(pb.map(r => [r.v, r.rc])).toEqual([[213, 'China']]);
    const results = stat['runResultMetric'](rows, 'average').events;
    expect(results.map(r => [r.v, r.rc])).toEqual([[213, 'China'], [220, 'Hong Kong']]);
  });
  it('does not move an old PB or its record date to the new country', () => {
    const bests = new Map<string, CountryBest>();
    const china = row('2016CAIY03', 'China', 213, '2024-08-25');
    const hongKong = row('2016CAIY03', 'Hong Kong', 250, '2026-01-01');
    [china, hongKong, row('other', 'Hong Kong', 240, '2025-01-01')].forEach(r => addCountryBest(bests, r));
    const ranked = rankCountryBests(bests.values(), continents);
    expect(ranked.world.get(china.wcaId)).toEqual(china);
    expect(ranked.countries.get('China')?.get(china.wcaId)).toEqual(china);
    expect(ranked.countries.get('Hong Kong')?.values().next().value?.val).toBe(240);
    expect(ranked.countries.get('Hong Kong')?.get(china.wcaId)).toEqual(hongKong);
    expect(ranked.continents.get('_Asia')?.size).toBe(2);
    expect(ranked.ranks(hongKong)).toEqual({ wr: 3, kr: 3, cr: 2 });
  });

  it('preserves old countries and continents when transferring back, and ignores invalid results', () => {
    const bests = new Map<string, CountryBest>();
    [row('p', 'China', 100, '2020-01-01'), row('p', 'USA', 120, '2021-01-01'),
      row('p', 'China', 90, '2022-01-01'), row('p', 'USA', -1, '2023-01-01'),
      row('p', 'USA', 0, '2024-01-01')].forEach(r => addCountryBest(bests, r));
    const ranked = rankCountryBests(bests.values(), continents);
    expect(ranked.countries.get('China')?.get('p')?.val).toBe(90);
    expect(ranked.continents.get('_North America')?.get('p')?.val).toBe(120);
    expect(ranked.world.size).toBe(1);
  });

  it('selects the earliest achievement among ties, independent of input order', () => {
    const bests = new Map<string, CountryBest>();
    [row('p', 'China', 213, '2025-01-01'), row('q', 'China', 213, '2023-01-01'),
      row('p', 'China', 213, '2024-01-01')].forEach(r => addCountryBest(bests, r));
    const ranked = rankCountryBests(bests.values(), continents);
    const record = ranked.countries.get('China')!.values().next().value!;
    expect(record.wcaId).toBe('q');
    expect(record.date).toBe('2023-01-01');
    expect(ranked.ranks(record)).toEqual({ wr: 1, cr: 1, kr: 1 });
    expect(ranked.countries.get('China')?.get('p')?.date).toBe('2024-01-01');
  });
});
