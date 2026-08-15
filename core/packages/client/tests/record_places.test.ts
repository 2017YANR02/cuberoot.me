import { describe, expect, it } from 'vitest';
import {
  buildRecordPlaces,
  isRecordPlacesData,
  type RecordPlaceSourceRow,
} from '@cuberoot/shared/record-places';
import {
  cityRecordMatches,
  localizedCityCollisionKeys,
  rankRecordRows,
  recordCityDisplayName,
} from '@/lib/record-places';

describe('record place aggregation', () => {
  it('counts venue records by country and distinct same-named cities', () => {
    const rows: RecordPlaceSourceRow[] = [
      { iso2: 'US', city: 'Springfield', singleRecord: 'WR', averageRecord: 'NR' },
      { iso2: 'US', city: ' Springfield ', singleRecord: 'NAR', averageRecord: null },
      { iso2: 'CA', city: 'Springfield', singleRecord: 'NR', averageRecord: null },
      { iso2: 'US', city: '', singleRecord: 'NR', averageRecord: null },
      { iso2: 'US', city: 'Multiple cities', singleRecord: 'WR', averageRecord: null },
      { iso2: 'FR', city: 'Lieux multiples / Multiple locations', singleRecord: 'ER', averageRecord: 'NR' },
      { iso2: 'DK', city: 'Flere byer', singleRecord: 'NR', averageRecord: null },
      { iso2: 'UA', city: 'Kyiv and Kharkiv', singleRecord: 'NR', averageRecord: null },
      { iso2: 'XW', city: 'Multiple cities', singleRecord: 'WR', averageRecord: 'WR' },
      { iso2: 'USA', city: 'Nowhere', singleRecord: 'WR', averageRecord: null },
      { iso2: 'US', city: 'Nowhere', singleRecord: 'PR', averageRecord: null },
    ];

    expect(buildRecordPlaces(rows)).toEqual({
      version: 2,
      countries: [
        { iso2: 'CA', wr: 0, cr: 0, nr: 1 },
        { iso2: 'DK', wr: 0, cr: 0, nr: 1 },
        { iso2: 'FR', wr: 0, cr: 1, nr: 1 },
        { iso2: 'UA', wr: 0, cr: 0, nr: 1 },
        { iso2: 'US', wr: 2, cr: 1, nr: 2 },
      ],
      cities: [
        { iso2: 'CA', city: 'Springfield', aliases: [], wr: 0, cr: 0, nr: 1 },
        { iso2: 'US', city: 'Springfield', aliases: [], wr: 1, cr: 1, nr: 1 },
      ],
    });
  });

  it('aggregates canonical identities and keeps old names searchable', () => {
    const rows: RecordPlaceSourceRow[] = [
      { iso2: 'CN', city: 'Hefei, Anhui', cityKey: 'CN\0hefei', cityAliases: ['Hefei', 'Hefei, Anhui Province'], singleRecord: 'WR', averageRecord: 'NR' },
      { iso2: 'CN', city: 'Hefei, Anhui', cityKey: 'CN\0hefei', cityAliases: ['Hefei', 'Hefei, Anhui Province'], singleRecord: 'AsR', averageRecord: null },
    ];
    const output = buildRecordPlaces(rows);
    expect(output.cities).toEqual([{
      iso2: 'CN',
      city: 'Hefei, Anhui',
      aliases: ['Hefei', 'Hefei, Anhui Province'],
      wr: 1,
      cr: 1,
      nr: 1,
    }]);
    expect(cityRecordMatches(output.cities[0], 'Anhui Province')).toBe(true);
    expect(cityRecordMatches(output.cities[0], '合肥')).toBe(true);
  });

  it('rejects malformed generated data', () => {
    expect(isRecordPlacesData({ version: 2, countries: [], cities: [] })).toBe(true);
    expect(isRecordPlacesData({
      version: 2,
      countries: [{ iso2: 'US', wr: -1, cr: 0, nr: 0 }],
      cities: [],
    })).toBe(false);
    expect(isRecordPlacesData({
      version: 2,
      countries: [],
      cities: [{ iso2: 'US', city: '', aliases: [], wr: 0, cr: 0, nr: 1 }],
    })).toBe(false);
    expect(isRecordPlacesData({
      version: 2,
      countries: [{ iso2: 'US', wr: 0, cr: 0, nr: 1 }],
      cities: [{ iso2: 'US', city: 'Portland', aliases: ['Portland'], wr: 0, cr: 0, nr: 1 }],
    })).toBe(false);
  });
});

describe('record place ranking', () => {
  it('keeps equal selected counts at the same global rank', () => {
    const ranked = rankRecordRows([
      { key: 'a', wr: 5, cr: 0, nr: 0 },
      { key: 'b', wr: 3, cr: 8, nr: 0 },
      { key: 'c', wr: 3, cr: 2, nr: 0 },
      { key: 'd', wr: 1, cr: 0, nr: 0 },
    ], 'wr', (row) => row.key);

    expect(ranked.map(({ row, rank }) => [row.key, rank])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });
});

describe('record city display disambiguation', () => {
  it('shows the canonical raw city when localized labels collide', () => {
    const rows = [
      { iso2: 'FR', city: 'Paris', aliases: [], wr: 1, cr: 0, nr: 0 },
      { iso2: 'FR', city: 'Serris (Paris)', aliases: [], wr: 0, cr: 1, nr: 0 },
    ];
    const collisions = localizedCityCollisionKeys(rows, false);
    expect(collisions.size).toBe(1);
    expect(recordCityDisplayName(rows[0], false, collisions)).toBe('Paris');
    expect(recordCityDisplayName(rows[1], false, collisions)).toBe('Serris (Paris)');
  });
});
