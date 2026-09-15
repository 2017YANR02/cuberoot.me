import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { stripRecordNewsPrefix } from '@/lib/record-news';
import { RecentRecordsList } from '@/components/RecentRecords';

vi.mock('@/components/AppLink', () => ({
  default: ({ children }: { children: React.ReactNode }) => createElement('a', null, children),
}));

describe('record news presentation', () => {
  it.each(['纪录快讯!', 'PR快讯!', 'Breaking News!', 'BREAKING NEWS!', 'PR News!', '纪录快讯！'])(
    'strips %s without changing the result, rank or flag', prefix => {
      expect(stripRecordNewsPrefix(`${prefix} 4.52 FWR/WR10 连允之🇨🇳`)).toBe('4.52 FWR/WR10 连允之🇨🇳');
    },
  );

  it.each(['', '4.52 FWR/WR10 连允之🇨🇳', 'Other! 4.52'])('preserves text without a news heading: %s', text => {
    expect(stripRecordNewsPrefix(text)).toBe(text);
  });

  it.each([true, false])('renders a whole FWR badge and flag in the homepage list (zh=%s)', isZh => {
    const html = renderToStaticMarkup(createElement(RecentRecordsList, {
      isZh,
      filled: [{
        id: 'female-record', tag: 'FWR', type: 'average', eventId: '333',
        competitionId: 'WuhanCrimsonAutumn2026', attemptResult: 452,
        personName: 'Yunzhi Lian (连允之)', countryIso2: 'CN',
        formattedCn: '纪录快讯! 4.52三阶魔方平均女子世界纪录FWR/WR10 连允之🇨🇳',
        formattedEn: 'BREAKING NEWS! 4.52 3x3 FWR/WR10 Avg Yunzhi Lian🇨🇳',
      }],
    }));
    expect(html).toMatch(/class="[^"]*record-badge[^"]*">FWR<\/span>/);
    expect(html).toContain('/WR10');
    expect(html).toContain('fi-cn');
    expect(html).not.toContain('快讯!');
    expect(html).not.toContain('BREAKING NEWS!');
  });
});
