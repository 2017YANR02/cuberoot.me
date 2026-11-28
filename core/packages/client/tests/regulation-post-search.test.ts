import { describe, expect, it } from 'vitest';
import bodies from '@/app/[lang]/regulation/_data/posts-search.json';
import { NEWS_INDEX } from '@/lib/regulation-posts';
import { searchRegulationPosts } from '@/lib/regulation-post-search';

describe('WCA announcement search', () => {
  it('contains both languages for every listed announcement', () => {
    expect(Object.keys(bodies).sort()).toEqual(NEWS_INDEX.map(post => post.id).sort());
    for (const pair of Object.values(bodies)) {
      expect(pair.length).toBe(2);
      expect(pair.every(text => text.trim().length > 0)).toBe(true);
    }
  });

  it.each(['双感应区', 'speedsolving timer'])('finds a phrase only present in the body: %s', term => {
    const post = searchRegulationPosts(term).find(row => row.id === 'adoption-of-4-pad-timing-august-2026');
    expect(post?.snippet).toContain(term);
  });

  it('ranks a title above newer announcements mentioning the same term', () => {
    expect(searchRegulationPosts('4-PAD')[0].id).toBe('adoption-of-4-pad-timing-august-2026');
  });
});
