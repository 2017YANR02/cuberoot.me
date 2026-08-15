import { describe, expect, it } from 'vitest';
import {
  buildRecordPlaces,
  isRecordPlacesData,
  type RecordPlaceSourceRow,
} from '@cuberoot/shared/record-places';
import { rankRecordRows } from '@/lib/record-places';

describe('record place aggregation', () => {
  it('counts venue records by country and distinct same-named cities', () => {
    const rows: RecordPlaceSourceRow[] = [
      { iso2: 'US', city: 'Springfield', singleRecord: 'WR', averageRecord: 'NR' },
      { iso2: 'US', city: ' Springfield ', singleRecord: 'NAR', averageRecord: null },
      { iso2: 'CA', city: 'Springfield', singleRecord: 'NR', averageRecord: null },
      { iso2: 'US', city: '', singleRecord: 'NR', averageRecord: null },
      { iso2: 'US', city: 'Multiple cities', singleRecord: 'WR', averageRecord: null },
      { iso2: 'XW', city: 'Multiple cities', singleRecord: 'WR', averageRecord: 'WR' },
      { iso2: 'USA', city: 'Nowhere', singleRecord: 'WR', averageRecord: null },
      { iso2: 'US', city: 'Nowhere', singleRecord: 'PR', averageRecord: null },
    ];

    expect(buildRecordPlaces(rows)).toEqual({
      version: 1,
      countries: [
        { iso2: 'CA', wr: 0, cr: 0, nr: 1 },
        { iso2: 'US', wr: 2, cr: 1, nr: 2 },
      ],
      cities: [
        { iso2: 'CA', city: 'Springfield', wr: 0, cr: 0, nr: 1 },
        { iso2: 'US', city: 'Springfield', wr: 1, cr: 1, nr: 1 },
      ],
    });
  });

  it('rejects malformed generated data', () => {
    expect(isRecordPlacesData({ version: 1, countries: [], cities: [] })).toBe(true);
    expect(isRecordPlacesData({
      version: 1,
      countries: [{ iso2: 'US', wr: -1, cr: 0, nr: 0 }],
      cities: [],
    })).toBe(false);
    expect(isRecordPlacesData({
      version: 1,
      countries: [],
      cities: [{ iso2: 'US', city: '', wr: 0, cr: 0, nr: 1 }],
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
