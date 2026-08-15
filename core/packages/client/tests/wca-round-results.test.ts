import { describe, expect, it } from 'vitest';
import { roundHasAnyEnteredResult } from '@/lib/wca-round-results';

describe('roundHasAnyEnteredResult', () => {
  it('treats an empty round and preallocated all-zero rows as having no results', () => {
    expect(roundHasAnyEnteredResult([])).toBe(false);
    expect(roundHasAnyEnteredResult([
      { b: 0, a: 0, v: [0, 0, 0, 0, 0] },
      { b: 0, a: 0, v: [0, 0, 0, 0, 0] },
    ])).toBe(false);
  });

  it('detects an entered attempt or aggregate result', () => {
    expect(roundHasAnyEnteredResult([{ b: 1234, a: 0, v: [1234, 0, 0] }])).toBe(true);
    expect(roundHasAnyEnteredResult([{ b: 0, a: 2345, v: [] }])).toBe(true);
  });

  it('counts DNF and DNS values as entered results', () => {
    expect(roundHasAnyEnteredResult([{ b: -1, a: -1, v: [-1, 0, 0] }])).toBe(true);
    expect(roundHasAnyEnteredResult([{ b: -2, a: 0, v: [-2, 0, 0] }])).toBe(true);
  });
});
