import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import { adjacentAlgCases } from '@/lib/alg_case_navigation';

function makeCase(id: number, name: string, subgroup = ''): AlgCase {
  return { id, name, subgroup, setup: '', sticker: { kind: 'raw', tag: 'sqcube', attrs: {} }, algs: [] } as AlgCase;
}

describe('adjacentAlgCases', () => {
  it('stays in the most specific subgroup and stops at its ends', () => {
    const cases = [makeCase(1, 'A', 'U/UR'), makeCase(2, 'B', 'U/UD'), makeCase(3, 'C', 'U/UR')];
    expect(adjacentAlgCases('3x3', 'zbll', cases, cases[0])).toEqual({ previous: null, next: cases[2] });
    expect(adjacentAlgCases('3x3', 'zbll', cases, cases[2])).toEqual({ previous: cases[0], next: null });
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
