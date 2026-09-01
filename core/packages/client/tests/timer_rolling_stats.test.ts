import { describe, expect, it } from 'vitest';
import type { Solve } from '@/app/[lang]/timer/_lib/types';
import {
  parseRollingStatKey,
  normalizeRollingStatColumns,
  projectRollingStats,
  replaceRollingStatColumn,
  rollingStatBest,
  rollingStatColumnsFromLegacy,
  rollingStatCurrent,
  rollingStatColumnsForEvent,
  rollingStatReplacementOptions,
  rollingStatSeries,
  sanitizeRollingStatColumns,
} from '@/app/[lang]/timer/_lib/rolling_stats';
import {
  parseRollingStatKey as sharedParseRollingStatKey,
  rollingStatCurrent as sharedRollingStatCurrent,
} from '@cuberoot/shared/timer';

function solve(timeMs: number, index: number): Solve {
  return {
    id: `solve-${index}`,
    timeMs,
    penalty: 'ok',
    scramble: "R U R'",
    event: '333',
    ts: 1_700_000_000_000 + index,
  };
}

describe('rolling statistic columns', () => {
  it('keeps the retired Web module as shared identity re-exports', () => {
    expect(parseRollingStatKey).toBe(sharedParseRollingStatKey);
    expect(rollingStatCurrent).toBe(sharedRollingStatCurrent);
  });

  it('keeps mo3 distinct from the trimmed ao3', () => {
    const solves = [10_000, 20_000, 60_000].map(solve);
    expect(rollingStatCurrent(solves, 'mo3')).toBe(30_000);
    expect(rollingStatCurrent(solves, 'ao3')).toBe(20_000);
  });

  it('computes the best value with the selected statistic rule', () => {
    const solves = [10_000, 20_000, 60_000, 12_000].map(solve);
    expect(rollingStatBest(solves, 'mo3')).toBe(30_000);
    expect(rollingStatBest(solves, 'ao3')).toBe(20_000);
  });

  it('projects aligned strict running PBs once for every host', () => {
    const history = [10_000, 20_000, 30_000, 10_000, 5_000].map(solve);
    expect(rollingStatSeries(history, 'mo3')).toEqual([
      { isPb: false, value: null },
      { isPb: false, value: null },
      { isPb: true, value: 20_000 },
      { isPb: false, value: 20_000 },
      { isPb: true, value: 15_000 },
    ]);

    const projected = projectRollingStats(history, ['mo3', 'ao5']);
    expect(projected.get('ao5')).toEqual(rollingStatSeries(history, 'ao5'));
    expect(projected.get('mo3')).toHaveLength(history.length);
  });

  it('drops duration rolling columns for MBLD only', () => {
    expect(rollingStatColumnsForEvent('333mbld', ['ao5', 'ao12'])).toEqual([]);
    expect(rollingStatColumnsForEvent('333fm', ['ao12', 'mo3'])).toEqual(['mo3', 'ao12']);
  });

  it('normalizes, sorts, deduplicates, caps, and rejects invalid keys', () => {
    expect(sanitizeRollingStatColumns(['ao100', 'mo3', 'ao005', 'ao5', 'ao2'], 3))
      .toEqual(['mo3', 'ao5', 'ao100']);
    expect(parseRollingStatKey('ao100001')).toBeNull();
    expect(parseRollingStatKey('mo5')).toBeNull();
  });

  it('keeps mo3 before a custom ao3', () => {
    expect(sanitizeRollingStatColumns(['ao3', 'mo3'])).toEqual(['mo3', 'ao3']);
  });

  it('fills old empty or one-column states without replacing the saved column', () => {
    expect(normalizeRollingStatColumns([])).toEqual(['ao5', 'ao12']);
    expect(normalizeRollingStatColumns(['ao100'])).toEqual(['ao5', 'ao100']);
    expect(normalizeRollingStatColumns(['ao5'])).toEqual(['ao5', 'ao12']);
  });

  it('migrates legacy ao windows without losing custom values', () => {
    expect(rollingStatColumnsFromLegacy([100, 5])).toEqual(['ao5', 'ao100']);
    expect(rollingStatColumnsFromLegacy([])).toEqual([]);
  });

  it('offers only values not already visible when replacing a header column', () => {
    const options = rollingStatReplacementOptions(['ao5', 'ao12']);
    expect(options).not.toContain('ao5');
    expect(options).not.toContain('ao12');
    expect(options).toContain('mo3');
    expect(options).toContain('ao100');
  });

  it('replaces one visible column without allowing duplicate columns', () => {
    expect(replaceRollingStatColumn(['ao5', 'ao12'], 'ao5', 'ao100'))
      .toEqual(['ao12', 'ao100']);
    expect(replaceRollingStatColumn(['ao5', 'ao12'], 'ao5', 'ao12'))
      .toEqual(['ao5', 'ao12']);
  });
});
