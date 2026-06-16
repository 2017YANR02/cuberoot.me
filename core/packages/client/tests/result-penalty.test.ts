import { describe, it, expect } from 'vitest';
import {
  isValidPenaltyCs,
  isValidPenaltyArray,
  isPenaltyOnlyFields,
  maxPenaltySteps,
  canPenalizeAttempt,
  PENALTY_STEP_CS,
} from '@cuberoot/shared/result-penalty';

// 自助 +2 的安全边界:服务器用 isPenaltyOnlyFields 拦非管理员的非法写入,
// 客户端用 canPenalizeAttempt gate 入口。两端同一份逻辑,这里锁住语义。

describe('isValidPenaltyCs', () => {
  it('accepts 0 and positive multiples of 200 up to the 8-step cap', () => {
    expect(isValidPenaltyCs(0)).toBe(true);
    expect(isValidPenaltyCs(200)).toBe(true);
    expect(isValidPenaltyCs(8 * PENALTY_STEP_CS)).toBe(true); // 1600 = +16, the absolute max
  });
  it('rejects non-multiples, negatives, over-cap, non-integers, non-numbers', () => {
    expect(isValidPenaltyCs(100)).toBe(false);   // 不是 200 倍数
    expect(isValidPenaltyCs(-200)).toBe(false);  // 负
    expect(isValidPenaltyCs(9 * PENALTY_STEP_CS)).toBe(false); // 超上限(>8 档)
    expect(isValidPenaltyCs(200.5)).toBe(false);
    expect(isValidPenaltyCs('200')).toBe(false);
    expect(isValidPenaltyCs(NaN)).toBe(false);
  });
});

describe('isValidPenaltyArray', () => {
  it('accepts a non-empty bounded array of valid penalties', () => {
    expect(isValidPenaltyArray([0, 200, 0, 400, 0])).toBe(true);
    expect(isValidPenaltyArray([0])).toBe(true);
  });
  it('rejects empty, too-long, or arrays with any invalid entry', () => {
    expect(isValidPenaltyArray([])).toBe(false);
    expect(isValidPenaltyArray(new Array(11).fill(0))).toBe(false);
    expect(isValidPenaltyArray([0, 100])).toBe(false);
    expect(isValidPenaltyArray([0, '200'])).toBe(false);
    expect(isValidPenaltyArray('nope')).toBe(false);
    expect(isValidPenaltyArray(null)).toBe(false);
  });
});

describe('isPenaltyOnlyFields (server self-write gate)', () => {
  it('accepts fields that are purely valid attempt_penalties', () => {
    expect(isPenaltyOnlyFields([{ field: 'attempt_penalties', old: null, new: [0, 200, 0] }])).toBe(true);
  });
  it('rejects any non-penalty field (best/average/attempts)', () => {
    expect(isPenaltyOnlyFields([{ field: 'best', old: 100, new: 300 }])).toBe(false);
    expect(isPenaltyOnlyFields([
      { field: 'attempt_penalties', new: [0, 200] },
      { field: 'best', new: 300 },
    ])).toBe(false);
    expect(isPenaltyOnlyFields([{ field: 'attempts', new: [100, 200] }])).toBe(false);
  });
  it('rejects penalty fields carrying an invalid penalty array', () => {
    expect(isPenaltyOnlyFields([{ field: 'attempt_penalties', new: [100] }])).toBe(false);
    expect(isPenaltyOnlyFields([{ field: 'attempt_penalties', new: [] }])).toBe(false);
  });
  it('rejects empty / non-array / junk', () => {
    expect(isPenaltyOnlyFields([])).toBe(false);
    expect(isPenaltyOnlyFields(null)).toBe(false);
    expect(isPenaltyOnlyFields('x')).toBe(false);
    expect(isPenaltyOnlyFields([null])).toBe(false);
  });
});

describe('maxPenaltySteps / canPenalizeAttempt (UI gate)', () => {
  it('caps by base>0 and at 8 steps', () => {
    expect(maxPenaltySteps('333', 283)).toBe(1);   // floor((283-1)/200)=1
    expect(maxPenaltySteps('333', 1000)).toBe(4);
    expect(maxPenaltySteps('333', 5000)).toBe(8);  // min(8, 24)
  });
  it('returns 0 for tiny/zero/negative values', () => {
    expect(maxPenaltySteps('222', 100)).toBe(0);   // base would be ≤0
    expect(maxPenaltySteps('333', 0)).toBe(0);
    expect(maxPenaltySteps('333', -1)).toBe(0);
  });
  it('returns 0 for non-timed events (FMC / MBLD)', () => {
    expect(maxPenaltySteps('333fm', 50)).toBe(0);
    expect(maxPenaltySteps('333mbf', 999999999)).toBe(0);
  });
  it('canPenalizeAttempt mirrors maxPenaltySteps >= 1', () => {
    expect(canPenalizeAttempt('333', 283)).toBe(true);
    expect(canPenalizeAttempt('222', 100)).toBe(false);
    expect(canPenalizeAttempt('333fm', 50)).toBe(false);
  });
});
