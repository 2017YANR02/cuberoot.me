import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildRecordPlaces,
  isRecordPlaceDetailShard,
  isRecordPlacesData,
  type RecordPlaceDetailShard,
  type RecordPlaceSourceRow,
} from '@cuberoot/shared/record-places';
import {
  cityRecordMatches,
  countryRecordMatches,
  localizedCityCollisionKeys,
  rankRecordRows,
  recordPlaceDetailRows,
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

  it('matches countries by Chinese name, English name, and ISO code', () => {
    const row = { iso2: 'US', wr: 5, cr: 4, nr: 3 };
    expect(countryRecordMatches(row, '美国')).toBe(true);
    expect(countryRecordMatches(row, 'usa')).toBe(true);
    expect(countryRecordMatches(row, 'us')).toBe(true);
    expect(countryRecordMatches(row, 'China')).toBe(false);
  });
});

describe('record place details', () => {
  const shard: RecordPlaceDetailShard = {
    version: 2,
    iso2: 'CN',
    comps: {
      OlderOpen2024: { n: 'Older Open 2024', s: '2024-05-01', d: '2024-05-02', c: 'Hefei, Anhui' },
      NewerOpen2025: { n: 'Newer Open 2025', s: '2025-06-01', d: '2025-06-01', c: 'Beijing' },
    },
    records: {
      OlderOpen2024: [
        { t: 'WR', k: 's', e: '333', p: '2020TEST01', n: 'Test Cuber', v: 500, a: [500, 520, 540, 560, 580] },
        { t: 'AsR', k: 'a', e: '333', p: '2020TEST01', n: 'Test Cuber', v: 600, a: [550, 580, 600, 620, 650] },
        { t: 'NR', k: 's', e: '222', p: '2020TEST01', n: 'Test Cuber', v: 100, a: [100, -1] },
      ],
      NewerOpen2025: [
        { t: 'WR', k: 'a', e: '333', p: '2021TEST01', n: 'Other Cuber', v: 550, a: [500, 525, 550, 575, 600] },
      ],
    },
  };

  it('validates generated shards and rejects dangling competition records', () => {
    expect(isRecordPlaceDetailShard(shard)).toBe(true);
    expect(isRecordPlaceDetailShard({
      ...shard,
      records: {
        ...shard.records,
        OlderOpen2024: [{ ...shard.records.OlderOpen2024[0], a: Array.from({ length: 21 }, (_, i) => i + 1) }],
      },
    })).toBe(true);
    expect(isRecordPlaceDetailShard({
      ...shard,
      records: { ...shard.records, MissingOpen2025: shard.records.NewerOpen2025 },
    })).toBe(false);
  });

  it('filters by metric and canonical city, newest competition first', () => {
    expect(recordPlaceDetailRows(shard, 'wr', null).map((row) => row.compId)).toEqual([
      'NewerOpen2025',
      'OlderOpen2024',
    ]);
    expect(recordPlaceDetailRows(shard, 'wr', 'Hefei, Anhui').map((row) => row.id)).toEqual([
      'OlderOpen2024:0',
    ]);
    expect(recordPlaceDetailRows(shard, 'cr', 'Hefei, Anhui')[0]?.entry.t).toBe('AsR');
  });

  it('combines every record metric when no metric filter is selected', () => {
    expect(recordPlaceDetailRows(shard, null, 'Hefei, Anhui').map((row) => row.entry.t)).toEqual([
      'WR',
      'AsR',
      'NR',
    ]);
  });

  it('keeps both record pages on the shared row table', () => {
    const recordsPage = readFileSync(new URL('../app/[lang]/wca/records/page.tsx', import.meta.url), 'utf8');
    const placeRankings = readFileSync(new URL('../app/[lang]/wca/comp/stats/RecordPlaceRankings.tsx', import.meta.url), 'utf8');
    expect(recordsPage).toContain("@/components/wca-records/WcaRecordRowsTable");
    expect(placeRankings).toContain("@/components/wca-records/WcaRecordRowsTable");
    expect(recordsPage).not.toContain('function RowsTable');
    expect(placeRankings).not.toContain('cs-record-detail-list');
  });

  it('reuses the shared paginator for place rankings', () => {
    const placeRankings = readFileSync(new URL('../app/[lang]/wca/comp/stats/RecordPlaceRankings.tsx', import.meta.url), 'utf8');
    expect(placeRankings).toContain("@/components/wca-stats/Paginator");
    expect(placeRankings).not.toContain('function Paginator');
    expect(placeRankings).toContain("scrollIntoView({ behavior: 'auto', block: 'start' })");
  });

  it('opens place names with every metric and keeps the title concise', () => {
    const placeRankings = readFileSync(new URL('../app/[lang]/wca/comp/stats/RecordPlaceRankings.tsx', import.meta.url), 'utf8');
    expect(placeRankings).toContain('metric: null');
    expect(placeRankings).not.toContain('纪录明细');
    expect(placeRankings).not.toContain('record details');
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
