import { describe, it, expect } from 'vitest';
import { groupIdxOf, groupLetter } from '@/lib/wca-scramble-group';

// Regression: WCA `group_id` overflows past single letters once a round has
// >26 groups (e.g. Asian Champs 2024 333 R1 has A..Z then AA..AF). Naive
// `charCodeAt(0) - 65` collided "A" and "AA" onto index 0, causing two
// mislabeled "A" groups and wrong ordering (AA sorted with/before A instead
// of after Z).
describe('groupIdxOf / groupLetter', () => {
  it('single letters map to 0-25 in order', () => {
    expect(groupIdxOf('A')).toBe(0);
    expect(groupIdxOf('B')).toBe(1);
    expect(groupIdxOf('Z')).toBe(25);
  });

  it('double letters continue past single letters, not collide with them', () => {
    expect(groupIdxOf('AA')).toBe(26);
    expect(groupIdxOf('AB')).toBe(27);
    expect(groupIdxOf('AF')).toBe(31);
    expect(groupIdxOf('AZ')).toBe(51);
    expect(groupIdxOf('BA')).toBe(52);
    expect(groupIdxOf('A')).not.toBe(groupIdxOf('AA'));
  });

  it('is case-insensitive', () => {
    expect(groupIdxOf('aa')).toBe(groupIdxOf('AA'));
  });

  it('sorting by index orders single letters before double letters', () => {
    const groups = ['A', 'Z', 'AA', 'B', 'AF'];
    const sorted = [...groups].sort((a, b) => groupIdxOf(a) - groupIdxOf(b));
    expect(sorted).toEqual(['A', 'B', 'Z', 'AA', 'AF']);
  });

  it('groupLetter round-trips through groupIdxOf', () => {
    for (const idx of [0, 1, 25, 26, 27, 51, 52, 100]) {
      expect(groupIdxOf(groupLetter(idx))).toBe(idx);
    }
  });

  it('groupLetter matches WCA-observed labels', () => {
    expect(groupLetter(0)).toBe('A');
    expect(groupLetter(25)).toBe('Z');
    expect(groupLetter(26)).toBe('AA');
    expect(groupLetter(31)).toBe('AF');
  });
});
