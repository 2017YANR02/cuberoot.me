import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import {
  availableOptimalMetrics,
  filterCasesByOptimal,
  optimalLength,
  optimalRange,
} from '@/lib/alg_case_optimal';

const caseWith = (name: string, optimal?: Record<string, number>): AlgCase => ({
  name,
  subgroup: '',
  setup: '',
  sticker: { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' },
  algs: [[]],
  meta: optimal ? {
    no: 1,
    ollcp: name,
    subset: 'fixture',
    oll: 'fixture',
    cp: 'fixture',
    optimal: Object.fromEntries(
      Object.entries(optimal).map(([metric, len]) => [metric, { len }]),
    ),
  } : undefined,
});

const cases = [
  caseWith('A', { etm: 7, htm: 8, qtm: 12, atm: 6 }),
  caseWith('B', { etm: 9, htm: 10, qtm: 14, atm: 8 }),
  caseWith('C'),
];

describe('case optimal metrics', () => {
  it('uses computed HTM only where stored metadata is absent, without mutating cases', () => {
    const computed = new Map([[cases[0], 11], [cases[2], 7]]);
    expect(optimalRange(cases, 'htm', computed)).toEqual({ min: 7, max: 10 });
    expect(availableOptimalMetrics([cases[2]], computed)).toEqual(['htm']);
    expect(filterCasesByOptimal(cases, { metric: 'htm', comparison: 'lte', moves: 8 }, computed).map(c => c.name)).toEqual(['A', 'C']);
    expect(filterCasesByOptimal(cases, { metric: 'htm', comparison: 'eq', moves: 7 }, computed).map(c => c.name)).toEqual(['C']);
    expect(filterCasesByOptimal(cases, { metric: 'htm', comparison: 'gte', moves: 8 }, computed).map(c => c.name)).toEqual(['A', 'B']);
    expect(cases[2].meta).toBeUndefined();
  });

  it('derives only metrics present in the current scope', () => {
    expect(availableOptimalMetrics(cases)).toEqual(['etm', 'htm', 'qtm', 'atm']);
    expect(optimalRange(cases, 'htm')).toEqual({ min: 8, max: 10 });
    expect(optimalRange(cases, 'atm')).toEqual({ min: 6, max: 8 });
    expect(optimalRange(cases, 'stm')).toBeNull();
  });

  it('filters with ≤, = and ≥ while excluding missing case data', () => {
    expect(filterCasesByOptimal(cases, { metric: 'htm', comparison: 'lte', moves: 8 }).map(c => c.name)).toEqual(['A']);
    expect(filterCasesByOptimal(cases, { metric: 'htm', comparison: 'eq', moves: 10 }).map(c => c.name)).toEqual(['B']);
    expect(filterCasesByOptimal(cases, { metric: 'qtm', comparison: 'gte', moves: 13 }).map(c => c.name)).toEqual(['B']);
  });

  it('ignores unavailable metrics and rejects malformed lengths', () => {
    expect(filterCasesByOptimal(cases, { metric: 'stm', comparison: 'lte', moves: 9 })).toEqual(cases);
    expect(filterCasesByOptimal(cases, { metric: 'htm', comparison: 'lte', moves: Number.NaN })).toEqual(cases);
    expect(optimalLength({
      no: 1,
      ollcp: 'fixture',
      subset: 'fixture',
      oll: 'fixture',
      cp: 'fixture',
      optimal: { htm: { len: -1 } },
    }, 'htm')).toBeNull();
  });
});
