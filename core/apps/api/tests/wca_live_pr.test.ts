import { describe, expect, it } from 'vitest';

import type { InferredRecord } from '../src/routes/cubing_live.js';
import { findInferredRecordForPr, type PrAchievementIdentity } from '../src/monitors/wca_live_pr.js';

const candidate: PrAchievementIdentity = {
  compWcaId: 'GuangzhouGraDUAL3x3IV2026',
  eventId: '333',
  roundNumber: 3,
  wcaid: '2023LIAN05',
  recType: 'average',
  value: 427,
};

const inferred: InferredRecord = {
  id: 'inferred-record',
  compId: 'GuangzhouGraDUAL3x3IV2026',
  compNameEn: 'Guangzhou GraDUAL 3x3 IV 2026',
  eventId: '333',
  roundId: '3',
  type: 'average',
  tag: 'FWR',
  attemptResult: 427,
  personName: 'Yunzhi Lian',
  personWcaId: '2023LIAN05',
  personIso2: 'CN',
  startDate: '2026-09-15',
};

describe('WCA Live PR inferred-record exclusion', () => {
  it('recognizes an FWR that WCA Live exposes without a regional record tag', () => {
    expect(findInferredRecordForPr(candidate, [inferred])).toBe(inferred);
  });

  it.each([
    [{ ...candidate, compWcaId: null }, 'missing competition id'],
    [{ ...candidate, roundNumber: null }, 'missing round number'],
    [{ ...candidate, value: 428 }, 'different result'],
    [{ ...candidate, wcaid: '2024OTHER01' }, 'different person'],
    [{ ...candidate, recType: 'single' as const }, 'different result type'],
  ])('does not merge a distinct achievement: %s (%s)', (different) => {
    expect(findInferredRecordForPr(different, [inferred])).toBeUndefined();
  });

  it('does not treat a plain inferred PR as a regional record', () => {
    expect(findInferredRecordForPr(candidate, [{ ...inferred, tag: 'PR' }])).toBeUndefined();
  });
});
