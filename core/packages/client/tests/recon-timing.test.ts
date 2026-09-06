import { describe, expect, it } from 'vitest';
import { validateReconTiming } from '@cuberoot/shared/recon-completion';
import type { ReconSolve } from '@cuberoot/shared';
import { buildReconAttemptMap, computeReconTimingMean } from '@/lib/recon-attempt-lookup';

describe('pickup and putdown durations', () => {
  it('accepts independent durations, including zero, and rejects incomplete or invalid input', () => {
    expect(validateReconTiming({ recordType: 'timing', pickupTime: 0.3, putdownTime: 0 })).toBeNull();
    expect(validateReconTiming({})).toBeNull();
    for (const value of [undefined, null, -1, NaN, Infinity, '0.2', 360000, 0.0001]) {
      expect(validateReconTiming({ recordType: 'timing', pickupTime: value, putdownTime: 0.2 })).not.toBeNull();
    }
    expect(validateReconTiming({ recordType: 'timing', pickupTime: 0.2, putdownTime: 0.1, solution: 'R' })).not.toBeNull();
    expect(validateReconTiming({ recordType: 'reconstruction', pickupTime: 0.2, putdownTime: 0.1, solution: 'R' })).toBeNull();
  });

  it('counts each attempt once, keeps measured entries and scopes arithmetic means by event', () => {
    const base = { compWcaId: 'Example2026', event: '3x3', round: '2', solveNum: 1 };
    const records = [
      { ...base, id: 1, pickupTime: 0.2, putdownTime: 0.1 },
      { ...base, id: 2, pickupTime: 0.4, putdownTime: 0.2 },
      { ...base, id: 3 },
      { ...base, id: 4, solveNum: 2, pickupTime: 0, putdownTime: 0.4 },
      { ...base, id: 5, event: '2x2', pickupTime: 2, putdownTime: 3 },
    ] as ReconSolve[];
    for (const input of [records, [...records].reverse()]) {
      const mean = computeReconTimingMean(buildReconAttemptMap(input), '333');
      expect(mean.count).toBe(2);
      expect(mean.pickup).toBe(0.2);
      expect(mean.putdown).toBeCloseTo(0.3, 12);
    }
    expect(computeReconTimingMean(null, '333')).toEqual({ count: 0, pickup: null, putdown: null });
  });
});
