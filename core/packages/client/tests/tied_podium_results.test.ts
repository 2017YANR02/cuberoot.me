import { describe, expect, it } from 'vitest';
import { TiedPodiumResults } from '../../stats-build/src/statistics/tied_podium_results';
import {
  findTiedTopThrees,
  type TopThreeResultRow,
} from '../../stats-build/src/statistics/tied_podium_results_core';

describe('tied top-three query scope', () => {
  it('selects valid top threes from every round instead of filtering to finals', () => {
    const query = new TiedPodiumResults().query();

    expect(query).not.toMatch(/round_types|\.final\s*=|round_type_id\s+IN\s*\(\s*'c'/i);
    expect(query).toContain('COUNT(DISTINCT pos) = 3');
    expect(query).toContain('COUNT(DISTINCT person_id) = 3');
  });
});

function podium(
  overrides: Partial<TopThreeResultRow> = {},
): TopThreeResultRow[] {
  return [1, 2, 3].map(position => ({
    eventId: 'clock',
    competitionId: 'Example2026',
    competitionName: 'Example 2026',
    roundTypeId: '1',
    personId: `2026TEST0${position}`,
    personName: `Person ${position}`,
    position,
    best: 400 + position,
    average: 423,
    startDate: '2026-08-15',
    ...overrides,
  }));
}

describe('findTiedTopThrees', () => {
  it('finds one non-final official 1st/2nd/3rd average tie and restores place order', () => {
    const rows = podium();
    const result = findTiedTopThrees([rows[2], rows[0], rows[1]], 'average');

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(423);
    expect(result[0].topThree.map(row => row.position)).toEqual([1, 2, 3]);
  });

  it('rejects invalid averages, missing places, duplicate places and duplicate people', () => {
    const invalidAverage = podium({ average: 0, competitionId: 'InvalidAverage' });
    const missingPlace = podium({ competitionId: 'MissingPlace' }).slice(0, 2);
    const duplicatePlace = podium({ competitionId: 'DuplicatePlace' });
    duplicatePlace[2].position = 2;
    const duplicatePerson = podium({ competitionId: 'DuplicatePerson' });
    duplicatePerson[2].personId = duplicatePerson[1].personId;

    expect(findTiedTopThrees([
      ...invalidAverage,
      ...missingPlace,
      ...duplicatePlace,
      ...duplicatePerson,
    ], 'average')).toEqual([]);
  });

  it('keeps different competition rounds separate and orders occurrences newest first', () => {
    const older = podium({ competitionId: 'Older2024', startDate: '2024-01-01' });
    const newer = podium({ competitionId: 'Newer2025', startDate: '2025-01-01' });
    const newerSecondRound = podium({
      competitionId: 'Newer2025',
      roundTypeId: '2',
      startDate: '2025-01-01',
    });

    expect(findTiedTopThrees([...older, ...newer, ...newerSecondRound], 'average')
      .map(row => `${row.competitionId}:${row.roundTypeId}`))
      .toEqual(['Newer2025:1', 'Newer2025:2', 'Older2024:1']);
  });

  it('finds identical singles independently from different averages', () => {
    const rows = podium({ best: 434, average: 500 });
    rows[1].average = 520;
    rows[2].average = 540;

    expect(findTiedTopThrees(rows, 'best')).toHaveLength(1);
    expect(findTiedTopThrees(rows, 'average')).toEqual([]);
  });
});
