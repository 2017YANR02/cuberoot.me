import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderCell, rowPersonCountry } from '@/components/wca-stats/WcaStatView.cells';
import type { StatHeader } from '@/components/wca-stats/WcaStatView.types';

vi.mock('@/lib/country-flags', () => ({
  extractWcaId: (url: string) => url.includes('/persons/') ? '2016CAIY03' : '',
  extractCompId: () => '', personFlagIso2: () => 'hk', compFlagIso2: () => '',
}));

describe('historical stat country flags', () => {
  const header: StatHeader[] = [
    { key: 'person', label: 'Person', labelZh: '选手', align: 'left' },
    { key: 'country', label: 'Country', labelZh: '国家', align: 'left' },
  ];
  const row = ['[Coral Yuxin Cai](https://www.worldcubeassociation.org/persons/2016CAIY03)', 'China'];
  it('uses the hidden result country on the person cell instead of their current country', () => {
    const html = renderToStaticMarkup(renderCell(row[0], 'person', false, rowPersonCountry(row, header, 'person')));
    expect(html).toContain('fi-cn');
    expect(html).not.toContain('fi-hk');
  });
  it('keeps profile-country fallback for rows with no historical country, without overriding other people', () => {
    expect(rowPersonCountry(row, header, 'other_person')).toBeUndefined();
    const html = renderToStaticMarkup(renderCell(row[0], 'person', false));
    expect(html).toContain('fi-hk');
  });
});
