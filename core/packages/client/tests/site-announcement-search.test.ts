import {describe,it,expect} from 'vitest';
import {SEARCH_CARDS,SECTIONS} from '@/lib/landing-sections';
import {searchSiteCards} from '@/lib/site-search';
import {WC_2027_ANNOUNCEMENT,findSiteAnnouncements} from '@cuberoot/shared/site-announcements';

describe('world championship announcement search',()=>{
  it.each(['明年世锦赛在哪里办','明年的魔方世锦赛在哪','Where will next year\'s World Championship be held?','世锦赛2027','WC 2027'])('resolves the intended championship announcement: %s',query=>{
    expect(findSiteAnnouncements(query,2026).map(a=>a.id)).toEqual(['announcement:wc-2027']);
  });
  it('resolves relative years without a timeless next-year alias or unrelated matches',()=>{
    expect(findSiteAnnouncements('明年世锦赛在哪里办',2027)).toEqual([]);
    expect(findSiteAnnouncements('明年世锦赛在哪里办')).toEqual([]);
    expect(findSiteAnnouncements('今年世锦赛在哪里办',2027).map(a=>a.id)).toEqual(['announcement:wc-2027']);
    expect(findSiteAnnouncements('后年世锦赛在哪里办',2025).map(a=>a.id)).toEqual(['announcement:wc-2027']);
    expect(findSiteAnnouncements('明年 WC2025 在哪里办',2026)).toEqual([]);
    expect(findSiteAnnouncements('明年比赛在哪里办',2026)).toEqual([]);
    expect(findSiteAnnouncements('2027 年计时器新规')).toEqual([]);
  });
  it.each(['WC 2027','WC2027','wc 2027','2027年世锦赛','WCA World Championship 2027'])('finds the announcement for %s',query=>{
    expect(searchSiteCards(SEARCH_CARDS,query).map(card=>card.href)).toContain(WC_2027_ANNOUNCEMENT.href);
  });
  it('does not add an announcement card to homepage sections',()=>{
    expect(SECTIONS.flatMap(section=>section.cards).some(card=>card.href===WC_2027_ANNOUNCEMENT.href)).toBe(false);
  });
});
