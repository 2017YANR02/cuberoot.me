import {describe,it,expect} from 'vitest';
import {SEARCH_CARDS,SECTIONS} from '@/lib/landing-sections';
import {searchSiteCards} from '@/lib/site-search';
import {WC_2027_ANNOUNCEMENT} from '@cuberoot/shared/site-announcements';

describe('world championship announcement search',()=>{
  it.each(['WC 2027','WC2027','wc 2027','2027年世锦赛','WCA World Championship 2027'])('finds the announcement for %s',query=>{
    expect(searchSiteCards(SEARCH_CARDS,query).map(card=>card.href)).toContain(WC_2027_ANNOUNCEMENT.href);
  });
  it('does not add an announcement card to homepage sections',()=>{
    expect(SECTIONS.flatMap(section=>section.cards).some(card=>card.href===WC_2027_ANNOUNCEMENT.href)).toBe(false);
  });
});
