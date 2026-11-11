import { describe, expect, it } from 'vitest';
import { diversifyRecentScrambles, matchesRecentMoves } from '@/lib/recent-scramble-selection';

describe('recent scramble browsing', () => {
  it('spreads stages and competitions without repeating a scramble', () => {
    const rows = [
      { id: 'a', uiVariant: 'eo', metric: 'xc', comp: 'A' },
      { id: 'b', uiVariant: 'eo', metric: 'xc', comp: 'A' },
      { id: 'a', uiVariant: 'std', metric: 'cross', comp: 'A' },
      { id: 'c', uiVariant: 'std', metric: 'cross', comp: 'A' },
      { id: 'd', uiVariant: 'std', metric: 'cross', comp: 'B' },
      { id: 'e', uiVariant: 'eo', metric: 'xc', comp: 'C' },
    ];
    expect(diversifyRecentScrambles(rows, row => row.comp).map(row => row.id)).toEqual(['a', 'd', 'e', 'c', 'b']);
    expect(rows.map(row => row.id)).toEqual(['a', 'b', 'a', 'c', 'd', 'e']);
  });
  it('keeps zero-move filters and distinguishes a ceiling from an exact depth', () => {
    expect([0, 1, 4, 5, 6].filter(n => matchesRecentMoves(n, 5, 'max'))).toEqual([0, 1, 4, 5]);
    expect([0, 1, 4, 5, 6].filter(n => matchesRecentMoves(n, 5, 'exact'))).toEqual([5]);
    expect([0, 1].filter(n => matchesRecentMoves(n, 0, 'exact'))).toEqual([0]);
    expect(matchesRecentMoves(8, null, 'max')).toBe(true);
  });
});
