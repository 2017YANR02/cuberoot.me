import { describe, expect, it } from 'vitest';
import { judgeRecordTag, refutesTag, type RecordsSnapshot } from '@/lib/record-tag';

const snap: RecordsSnapshot = { wr: { '333|1': 351 }, fwr: { '333|1': 468 } };
describe('female live record badges', () => {
  it.each([452, 468])('recognizes female %i including tied FWR', value => {
    expect(judgeRecordTag(value, '333', true, { gender: 'f' }, snap).tag).toBe('FWR');
  });
  it.each(['m', '', undefined])('does not infer female records for gender %s', gender => {
    expect(judgeRecordTag(452, '333', true, { gender }, snap).tag).toBe('');
  });
  it.each([0, -1, -2, 469, Number.NaN])('rejects invalid or slower %s', value => {
    expect(judgeRecordTag(value, '333', true, { gender: 'f' }, snap).tag).toBe('');
  });
  it('retains overall WR priority and uses the female baseline for stale FWR', () => {
    expect(judgeRecordTag(350, '333', true, { gender: 'f' }, snap).tag).toBe('WR');
    expect(refutesTag('FWR', 452, '333', true, { gender: 'f' }, snap)).toBe(false);
    expect(refutesTag('FWR', 469, '333', true, { gender: 'f' }, snap)).toBe(true);
  });
  it('suppresses slower same-day FWR', () => {
    const result = judgeRecordTag(465, '333', true, { gender: 'f' }, { ...snap, day: { wr: { 'f|333|1': { value: 452, comp: 'WuhanCrimsonAutumn2026', compName: 'Wuhan', person: '连允之', personIso2: 'CN' } } } });
    expect(result.tag).toBe('');
    expect(result.keatoned?.level).toBe('FWR');
  });
});
