import { describe, expect, it } from 'vitest';
import { ALG_CATALOG } from '@cuberoot/shared/alg';
import { searchKnownAlgSets } from '@/lib/site-search';

describe('site search algorithm sets', () => {
  it('finds every canonical set by its English and Chinese names', () => {
    for (const [puzzle, sets] of Object.entries(ALG_CATALOG)) {
      for (const meta of sets) {
        const expected = expect.objectContaining({ puzzle, setSlug: meta.slug });
        expect(searchKnownAlgSets(meta.en)).toContainEqual(expected);
        expect(searchKnownAlgSets(meta.zh)).toContainEqual(expected);
      }
    }
  });

  it.each([
    ['LSLL', 'lsll', '/alg/lsll'],
    ['十字', 'cross', '/alg/3x3/cross'],
  ])('finds the 3x3 page-only %s card', (query, setSlug, path) => {
    expect(searchKnownAlgSets(query)).toContainEqual(expect.objectContaining({ puzzle: '3x3', setSlug, path }));
  });

  it('returns no formula cards for an empty query', () => {
    expect(searchKnownAlgSets('')).toEqual([]);
  });
});
