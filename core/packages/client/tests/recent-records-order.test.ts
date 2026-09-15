import { describe, expect, it } from 'vitest';
import { sortRecentRecords } from '@/components/RecentRecords';

const record = (id: string, tag: string, countryIso2 = '') => ({ id, tag, countryIso2 });
const records = [
  record('other1', 'NR', 'de'),
  record('ip1', 'NR', 'US'),
  record('asia', 'AsR', 'cn'),
  record('wca1', 'NR', 'cn'),
  record('fwr', 'FWR', 'cn'),
  record('oceania', 'OcR', 'au'),
  record('wr', 'WR', 'de'),
  record('wca2', 'NR', 'cn'),
  record('other2', 'NR'),
  record('ip2', 'NR', 'us'),
];

describe('homepage record order', () => {
  it('keeps world and continental records ahead of WCA, IP and other national records', () => {
    const original = [...records];
    expect(sortRecentRecords(records, ['cn', 'us']).map(r => r.id)).toEqual([
      'fwr', 'wr', 'asia', 'oceania', 'wca1', 'wca2', 'ip1', 'ip2', 'other1', 'other2',
    ]);
    expect(records).toEqual(original);
  });

  it.each([
    { countries: ['us'], national: ['ip1', 'ip2', 'other1', 'wca1', 'wca2', 'other2'] },
    { countries: ['cn'], national: ['wca1', 'wca2', 'other1', 'ip1', 'other2', 'ip2'] },
    { countries: [], national: ['other1', 'ip1', 'wca1', 'wca2', 'other2', 'ip2'] },
  ])('handles absent WCA/IP countries: $countries', ({ countries, national }) => {
    expect(sortRecentRecords(records, countries).filter(r => r.tag === 'NR').map(r => r.id)).toEqual(national);
  });

  it('recognizes every continental tag and keeps unknown tags after national records', () => {
    const continents = ['CR', 'AfR', 'AsR', 'ER', 'NAR', 'SAR', 'OcR'];
    const rows = [record('unknown', ''), record('national', 'NR', 'cn'), ...continents.map(tag => record(tag, tag))];
    expect(sortRecentRecords(rows, ['cn']).map(r => r.id)).toEqual([...continents, 'national', 'unknown']);
    expect(sortRecentRecords([], ['cn'])).toEqual([]);
  });
});
