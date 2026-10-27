import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import { adjacentAlgCases } from '@/lib/alg_case_navigation';
import { algCaseHref } from '@/lib/alg_case_link';

function makeCase(id: number, name: string, subgroup = ''): AlgCase {
  return { id, name, subgroup, setup: '', sticker: { kind: 'raw', tag: 'sqcube', attrs: {} }, algs: [] } as AlgCase;
}

describe('adjacentAlgCases', () => {
  it('crosses text sections within one top-level category and stops at its ends', () => {
    const cases = [makeCase(1, 'A', 'U/UR'), makeCase(2, 'B', 'U/UD'), makeCase(3, 'C', 'U/UR')];
    // UD is ordered before UR by the same CP ordering used on the list.
    expect(adjacentAlgCases('3x3', 'zbll', cases, cases[1])).toEqual({ previous: null, next: cases[0] });
    expect(adjacentAlgCases('3x3', 'zbll', cases, cases[2])).toEqual({ previous: cases[0], next: null });
    expect(algCaseHref('3x3', 'zbll', cases[0])).toBe('/alg/3x3/zbll/u#A');
  });

  it('returns PLL cases to the set instead of its Adj Swap text section', () => {
    expect(algCaseHref('3x3', 'pll', makeCase(1, 'A+', 'Adj Swap'))).toBe('/alg/3x3/pll#A%2B');
  });

  it.each([
    ['2x2', 'cll', 'U'],
    ['3x3', 'coll', 'U'],
    ['3x3', 'zbls', 'A+'],
    ['3x3', 'ollcp', '41'],
  ])('returns %s/%s to its actual umbrella list', (puzzle, set, subgroup) => {
    const current = makeCase(1, 'Example', subgroup);
    const other = makeCase(2, 'Other', 'Another group');
    expect(algCaseHref(puzzle, set, current)).toBe(`/alg/${puzzle}/${set}/${encodeURIComponent(subgroup.toLowerCase())}#Example`);
    expect(adjacentAlgCases(puzzle, set, [current, other], current)).toEqual({ previous: null, next: null });
  });

  it('uses the list ordering for ungrouped cases', () => {
    const cases = [makeCase(1, 'A-'), makeCase(2, 'A+'), makeCase(3, 'B')];
    expect(adjacentAlgCases('3x3', 'f2l', cases, cases[0])).toEqual({ previous: cases[1], next: cases[2] });
  });

  it('does not navigate when the current case is missing', () => {
    expect(adjacentAlgCases('sq1', 'obl', [makeCase(1, 'A')], makeCase(2, 'B')))
      .toEqual({ previous: null, next: null });
  });
});
