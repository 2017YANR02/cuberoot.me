import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import {
  casesForTimeAttackScope,
  newerTimeAttackOrder,
  normalizeTimeAttackOrder,
  readLocalTimeAttackOrder,
  timeAttackOrderStorageKey,
  timeAttackScopes,
} from '@/lib/alg-time-attack-order';

function algCase(subgroup: string, name: string): AlgCase {
  return { subgroup, name } as AlgCase;
}

describe('algorithm time attack order', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the time attack storage namespace', () => {
    expect(timeAttackOrderStorageKey('3x3', 'zbll', 'u/h')).toBe('alg:time-attack-order:v1:3x3/zbll/u/h');
    expect(timeAttackOrderStorageKey('sq1', 'pbl', '')).toBe('alg:time-attack-order:v1:sq1/pbl/all');
  });

  it('keeps reading orders saved under the legacy namespace', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => key === 'alg:chain-order:v1:3x3/oll/all'
        ? JSON.stringify({ keys: ['a', 'b'], updatedAt: 10 })
        : null),
    });
    expect(readLocalTimeAttackOrder('3x3', 'oll', '')).toEqual({ keys: ['a', 'b'], updatedAt: 10 });
  });

  it('drops stale and duplicate keys, then appends newly added cases', () => {
    expect(normalizeTimeAttackOrder(['a', 'b', 'c'], ['b', 'missing', 'b', 'a'])).toEqual(['b', 'a', 'c']);
  });

  it('uses the newer snapshot and lets cloud win an exact timestamp tie', () => {
    const local = { keys: ['a'], updatedAt: 10 };
    const cloud = { keys: ['b'], updatedAt: 10 };
    expect(newerTimeAttackOrder(local, cloud)).toBe(cloud);
    expect(newerTimeAttackOrder({ ...local, updatedAt: 11 }, cloud)).toEqual({ keys: ['a'], updatedAt: 11 });
  });

  it('builds unique top-level and nested subgroup scopes', () => {
    const cases = [algCase('t/u', '1'), algCase('t/u', '2'), algCase('t/l', '3'), algCase('u/a', '4')];
    expect(timeAttackScopes(cases)).toEqual([
      { value: 't', depth: 1 },
      { value: 't/u', depth: 2 },
      { value: 't/l', depth: 2 },
      { value: 'u', depth: 1 },
      { value: 'u/a', depth: 2 },
    ]);
  });

  it('selects a complete subgroup branch and rejects ambiguous legacy tokens', () => {
    const cases = [algCase('t/u', '1'), algCase('t/l', '2'), algCase('l/u', '3')];
    expect(casesForTimeAttackScope(cases, 't').map((c) => c.name)).toEqual(['1', '2']);
    expect(casesForTimeAttackScope(cases, 'u')).toEqual([]);
    expect(casesForTimeAttackScope(cases, 't/u')).toEqual([cases[0]]);
  });
});
