import { describe, expect, it } from 'vitest';
import { SEARCH_CARDS } from '@/lib/landing-sections';
import { searchSiteCards } from '@/lib/site-search';

describe('simulator puzzle search', () => {
  it.each(['二重奏', 'Pyraminx Duo', 'pyraminx_duo'])('finds the direct simulator link for %s', query => {
    expect(searchSiteCards(SEARCH_CARDS, query).map(card => card.href))
      .toContain('/sim?puzzle=pyraminx_duo');
  });

  it.each([
    ['枫叶', '/sim?puzzle=ivy'],
    ['Gigaminx', '/sim?puzzle=gigaminx'],
    ['NxN', '/sim?puzzle=3'],
  ])('finds other catalog puzzles: %s', (query, href) => {
    expect(searchSiteCards(SEARCH_CARDS, query).map(card => card.href)).toContain(href);
  });
});
