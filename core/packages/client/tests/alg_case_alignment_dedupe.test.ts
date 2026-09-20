import { describe, expect, it } from 'vitest';
import { dedupeDisplayedCaseEntries } from '@/lib/alg_case_alignment';

describe('aligned case formula dedupe', () => {
  it('keeps one row when finishing rotations are hidden from display', () => {
    expect(dedupeDisplayedCaseEntries('3x3', 'f2l', [
      { alg: "U' L' U L y'", tags: ['beginner'] },
      { alg: "U' L' U L", tags: ['oh'] },
    ])).toEqual([
      { alg: "U' L' U L y'", tags: ['beginner', 'oh'] },
    ]);
  });

  it('keeps genuinely different formulas in the same case', () => {
    const entries = [{ alg: "U' L' U L" }, { alg: "L F' L' F" }];
    expect(dedupeDisplayedCaseEntries('3x3', 'f2l', entries)).toEqual(entries);
  });
});
