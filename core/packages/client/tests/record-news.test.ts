import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { stripRecordNewsPrefix } from '@/lib/record-news';
import { RecentRecordsList } from '@/components/RecentRecords';
import { COMP_RECORD_NEWS, competitionRecordNews, withNewcomerRecords } from '@/app/[lang]/wca/comp/[slug]/record-news';
import { formatRecord } from '@/lib/recon-utils';

vi.mock('@/components/AppLink', () => ({
  default: ({ children }: { children: React.ReactNode }) => createElement('a', null, children),
}));

describe('record news presentation', () => {
  it('shows Rhys Caskey\'s exact final average NWR without changing his single or other rounds', () => {
    const row = { e: '444', r: 'f', n: 1, b: 2562, a: 2759, sr: '', ar: '' };
    const rows = { '444:f': [row, { ...row, n: 2 }, { ...row, a: 2760 }], '444:d': [{ ...row, r: 'd' }] };
    const record = { eventId: '444', roundId: 'f', personNumber: 1, type: 'average' as const, source: '1st-comp' as const, value: 2759 };
    const enriched = withNewcomerRecords(rows, [record]);
    expect(enriched['444:f'].map(r => r.ar)).toEqual(['NWR', '', '']);
    expect(enriched['444:f'][0].sr).toBe('');
    expect(enriched['444:d'][0].ar).toBe('');
    expect(row.ar).toBe('');
    expect(withNewcomerRecords(rows)).toBe(rows);
    expect(withNewcomerRecords(rows, [{ ...record, value: -1 }])['444:f'][0].ar).toBe('');
    expect(withNewcomerRecords(rows, [{ ...record, type: 'single', value: 2562 }])['444:f'][0].sr).toBe('NWR');
    expect(withNewcomerRecords({ '444:f': [{ ...row, ar: 'WR' }] }, [record])['444:f'][0].ar).toBe('WR');
  });
  it('generates record news for any competition without a curated entry', () => {
    const users = { '1': { name: 'Yunzhi Lian (连允之)', region: 'CN' } };
    const record = { ev: { i: '333' }, res: { n: 1 }, roundId: 'f', type: 'average' as const, tag: 'FWR', value: 427 };
    for (const slug of ['GuangzhouGraDUAL3x3IV2026', 'FutureCompetition2027']) {
      const news = competitionRecordNews(slug, [], users, [{ i: '333', rs: [{ i: '1' }, { i: '2' }, { i: 'f' }] }], [record]);
      expect(news).toHaveLength(1);
      expect(news[0].results[0].text.zh).toContain('4.27 三阶平均女子世界纪录');
      expect(news[0].round).toBe(3);
      expect(news[0].results[0].tag).toBe('FWR');
    }
    expect(competitionRecordNews('Invalid', [], users, [], [{ ...record, value: -1 }])).toEqual([]);
    expect(competitionRecordNews('Invalid', [], users, [], [{ ...record, tag: '1' }])).toEqual([]);
    expect(competitionRecordNews('WuhanCrimsonAutumn2026', [], users, [], [{ ...record, value: 452 }])).toHaveLength(COMP_RECORD_NEWS.WuhanCrimsonAutumn2026!.length);
  });
  it('retains both newcomer sources and both metrics, while deduplicating curated news', () => {
    const records = (['1st-solve', '1st-comp'] as const).flatMap(source => (['single', 'average'] as const).map(type => ({ eventId: '444', roundId: 'f', personNumber: 1, source, type, value: 2763 })));
    const users = { '1': { name: 'Xuanyi Geng (耿暄一)', region: 'CN' } };
    const news = competitionRecordNews('WuhanGoldenAutumn2026', records, users, []);
    expect(news.filter(row => row.event === '444')).toHaveLength(4);
    expect(news.filter(row => row.newcomerSource === '1st-solve')).toHaveLength(2);
    expect(news.filter(row => row.newcomerSource === '1st-comp')).toHaveLength(2);
    expect(news.find(row => row.newcomerSource === '1st-comp' && row.newcomerType === 'average')?.message.zh).toContain('25.81');
  });
  it('colors newcomer world records as world records without changing national records', () => {
    expect(formatRecord('NWR')).toEqual({ text: 'NWR', className: 'record-badge record-wr' });
    expect(formatRecord('NR')).toEqual({ text: 'NR', className: 'record-badge record-nr' });
    expect(formatRecord('NWR cancelled')).toEqual({ text: 'NWR', className: 'record-badge record-cancelled' });
  });

  it.each([true, false])('preserves the newcomer scope and full red NWR badge (zh=%s)', isZh => {
    const news = COMP_RECORD_NEWS.WuhanGoldenAutumn2026!.find(row => row.event === '444')!;
    expect(news.message.zh).toContain('（首场比赛）');
    expect(news.message.en).toContain('(1st competition)');
    expect(news.results[0].text.zh).toContain('（首场比赛）');
    expect(news.results[0].text.en).toContain('(1st competition)');
    const html = renderToStaticMarkup(createElement(RecentRecordsList, {
      isZh,
      filled: [{
        id: 'newcomer-record', tag: 'NWR', type: 'average', eventId: '444',
        competitionId: 'WuhanGoldenAutumn2026', attemptResult: 2763,
        personName: news.person, countryIso2: news.country,
        formattedCn: news.message.zh, formattedEn: news.message.en,
      }],
    }));
    expect(html).toMatch(/class="[^"]*record-wr[^"]*">NWR<\/span>/);
    expect(html).toContain(isZh ? '（首场比赛）' : '(1st competition)');
  });

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
        formattedCn: '纪录快讯! 4.52三阶平均女子世界纪录FWR/WR10 连允之🇨🇳| 3.54单次个人纪录PR/WR17 | 武汉丹秋魔方赛🇨🇳',
        formattedEn: 'BREAKING NEWS! 4.52 3x3 FWR/WR10 Avg Yunzhi Lian🇨🇳| 3.54 PR/WR17 Single | Wuhan Crimson Autumn 2026🇨🇳',
      }],
    }));
    expect(html).toMatch(/class="[^"]*record-badge[^"]*">FWR<\/span>/);
    expect(html).toContain('/WR10');
    expect(html).toMatch(/class="[^"]*record-badge[^"]*">PR<\/span>/);
    expect(html).toContain('/WR17');
    expect(html.indexOf('3.54')).toBeLessThan(html.indexOf(isZh ? '武汉丹秋魔方赛' : 'Wuhan Crimson Autumn'));
    expect(html).not.toContain('三阶魔方');
    expect(html).toContain('fi-cn');
    expect(html).not.toContain('快讯!');
    expect(html).not.toContain('BREAKING NEWS!');
  });
});
