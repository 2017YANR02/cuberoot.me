import { describe, expect, it } from 'vitest';
import { mixedMetricHistory } from '@/lib/wca-metric-history';
import { countryToRecordRegion, recordRegionToCountry } from '@/components/wca-stats/RegionCountrySelect';
import type { StatHeader, StatSection } from '@/components/wca-stats/WcaStatView.types';

describe('merged rankings and records', () => {
  const header: StatHeader[] = ['result', 'person', 'date', 'competition', 'details', 'days', 'improvement']
    .map(key => ({ key, label: key, labelZh: key, align: 'left' }));
  const rows = [
    ['0.86', 'same person', '2025-12-13', 'first competition', { csv: '1,2,3' }, 252, '0.0%'],
    ['0.86', 'same person', '2026-08-22', 'second competition', { csv: '4,5,6' }, 74, '0.0%'],
  ];
  const sections: StatSection[] = [
    { title: '2x2x2 Cube', titleZh: '二阶', rows },
    { title: "Rubik's Cube", titleZh: '三阶', rows: [['2.51', 'another person', '2026-10-05', 'third competition', 'attempts', 30, '10%']] },
  ];
  it('mixed layout preserves all rows and cells, including ties by the same person', () => {
    const mixed = mixedMetricHistory(header, sections, undefined, true);
    expect(mixed.header.slice(1)).toEqual(header);
    expect(mixed.rows).toEqual([
      ['三阶', ...sections[1].rows[0]], ['二阶', ...rows[1]], ['二阶', ...rows[0]],
    ]);
    expect(mixed.rows[1][5]).toBe(rows[1][4]);
    expect(sections[0].rows).toEqual(rows);
  });
  it('a selected event keeps the original column shape and every tied result', () => {
    const mixed = mixedMetricHistory(header, sections, '222', false);
    expect(mixed.header).toBe(header);
    expect(mixed.rows).toEqual([rows[1], rows[0]]);
    expect(mixed.rows[0]).toBe(rows[1]);
    expect(mixedMetricHistory(header, sections, '333bf', false).rows).toEqual([]);
  });
  const countries = [{ id: 'China', iso2: 'CN', name: 'China' }, { id: 'USA', iso2: 'US', name: 'USA' }];
  it.each(['', 'China', 'USA', '_Asia', '_North America', '_South America', '_Europe', '_Africa', '_Oceania'])(
    'preserves region %s across ranking → records → ranking', country => {
      expect(recordRegionToCountry(countryToRecordRegion(country, countries), countries)).toBe(country);
    },
  );
  it('preserves ISO2 deep links before the country directory loads', () => {
    expect(countryToRecordRegion('China', [])).toBe('cn');
    expect(countryToRecordRegion('USA', [])).toBe('us');
    expect(recordRegionToCountry('cn', [])).toBe('cn');
    expect(countryToRecordRegion('cn', [])).toBe('cn');
    expect(recordRegionToCountry('CN', countries)).toBe('China');
  });
});
