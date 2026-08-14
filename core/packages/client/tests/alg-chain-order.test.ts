import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import {
  casesForChainScope,
  chainScopes,
  newerChainOrder,
  normalizeChainOrder,
} from '@/lib/alg-chain-order';

function algCase(subgroup: string, name: string): AlgCase {
  return { subgroup, name } as AlgCase;
}

describe('algorithm chain order', () => {
  it('drops stale and duplicate keys, then appends newly added cases', () => {
    expect(normalizeChainOrder(['a', 'b', 'c'], ['b', 'missing', 'b', 'a'])).toEqual(['b', 'a', 'c']);
  });

  it('uses the newer snapshot and lets cloud win an exact timestamp tie', () => {
    const local = { keys: ['a'], updatedAt: 10 };
    const cloud = { keys: ['b'], updatedAt: 10 };
    expect(newerChainOrder(local, cloud)).toBe(cloud);
    expect(newerChainOrder({ ...local, updatedAt: 11 }, cloud)).toEqual({ keys: ['a'], updatedAt: 11 });
  });

  it('builds unique top-level and nested subgroup scopes', () => {
    const cases = [algCase('t/u', '1'), algCase('t/u', '2'), algCase('t/l', '3'), algCase('u/a', '4')];
    expect(chainScopes(cases)).toEqual([
      { value: 't', depth: 1 },
      { value: 't/u', depth: 2 },
      { value: 't/l', depth: 2 },
      { value: 'u', depth: 1 },
      { value: 'u/a', depth: 2 },
    ]);
  });

  it('selects a complete subgroup branch and rejects ambiguous legacy tokens', () => {
    const cases = [algCase('t/u', '1'), algCase('t/l', '2'), algCase('l/u', '3')];
    expect(casesForChainScope(cases, 't').map((c) => c.name)).toEqual(['1', '2']);
    expect(casesForChainScope(cases, 'u')).toEqual([]);
    expect(casesForChainScope(cases, 't/u')).toEqual([cases[0]]);
  });
});
