import { describe, expect, it } from 'vitest';
import { mergeLiveRoundRows } from '@/hooks/useLiveStream';
import {
  normalizeWcaLiveRecordTag,
  type WcaLiveEnrichedRow,
} from '@/hooks/useWcaLiveStream';

function row(overrides: Partial<WcaLiveEnrichedRow> = {}): WcaLiveEnrichedRow {
  return {
    i: 101,
    c: 0,
    n: 7,
    e: '333oh',
    r: '1',
    f: 'a',
    b: 768,
    a: 977,
    v: [1090, 998, 768, 958, 975],
    sr: '',
    ar: '',
    ...overrides,
  };
}

describe('mergeLiveRoundRows', () => {
  it('preserves exact PR ranks and keatoned records when scores are unchanged', () => {
    const previous = row({ pS: 43, pA: 55, sk: { tag: 'NR' }, ak: { tag: 'CR' } });
    const [merged] = mergeLiveRoundRows([previous], [row()]);

    expect(merged).toMatchObject({ pS: 43, pA: 55, sk: { tag: 'NR' }, ak: { tag: 'CR' } });
  });

  it('drops only the enrichments whose underlying score changed', () => {
    const previous = row({ pS: 43, pA: 55, sk: { tag: 'NR' }, ak: { tag: 'CR' } });
    const [bestChanged] = mergeLiveRoundRows([previous], [row({ b: 700 })]);
    const [averageChanged] = mergeLiveRoundRows([previous], [row({ a: 900 })]);

    expect(bestChanged).toMatchObject({ pA: 55, ak: { tag: 'CR' } });
    expect(bestChanged.pS).toBeUndefined();
    expect(bestChanged.sk).toBeUndefined();
    expect(averageChanged).toMatchObject({ pS: 43, sk: { tag: 'NR' } });
    expect(averageChanged.pA).toBeUndefined();
    expect(averageChanged.ak).toBeUndefined();
  });

  it('keeps fresh incoming enrichments and does not copy ranks onto new rows', () => {
    const previous = row({ pS: 43, pA: 55 });
    const [updated] = mergeLiveRoundRows([previous], [row({ pS: 12, pA: 18 })]);
    const [newResult] = mergeLiveRoundRows([previous], [row({ i: 202, n: 8 })]);

    expect(updated).toMatchObject({ pS: 12, pA: 18 });
    expect(newResult.pS).toBeUndefined();
    expect(newResult.pA).toBeUndefined();
  });
});

describe('normalizeWcaLiveRecordTag', () => {
  it('leaves regional records intact but delegates personal records to pS/pA', () => {
    expect(normalizeWcaLiveRecordTag('WR')).toBe('WR');
    expect(normalizeWcaLiveRecordTag('PR')).toBe('');
    expect(normalizeWcaLiveRecordTag(null)).toBe('');
  });
});
