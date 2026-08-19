import { describe, expect, it } from 'vitest';
import {
  findTiedPodiums,
  type PodiumResultRow,
} from '../../stats-build/src/statistics/tied_podium_results_core';

function podium(
  overrides: Partial<PodiumResultRow> = {},
): PodiumResultRow[] {
  return [1, 2, 3].map(position => ({
    eventId: 'clock',
    competitionId: 'Example2026',
    competitionName: 'Example 2026',
    roundTypeId: 'f',
    personId: `2026TEST0${position}`,
    personName: `Person ${position}`,
    position,
    best: 400 + position,
    average: 423,
    startDate: '2026-08-15',
    ...overrides,
  }));
}

describe('findTiedPodiums', () => {
  it('finds one official 1st/2nd/3rd average tie and restores podium order', () => {
    const rows = podium();
    const result = findTiedPodiums([rows[2], rows[0], rows[1]], 'average');

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(423);
    expect(result[0].podium.map(row => row.position)).toEqual([1, 2, 3]);
  });

  it('rejects invalid averages, missing places, duplicate places and duplicate people', () => {
    const invalidAverage = podium({ average: 0, competitionId: 'InvalidAverage' });
    const missingPlace = podium({ competitionId: 'MissingPlace' }).slice(0, 2);
    const duplicatePlace = podium({ competitionId: 'DuplicatePlace' });
    duplicatePlace[2].position = 2;
    const duplicatePerson = podium({ competitionId: 'DuplicatePerson' });
    duplicatePerson[2].personId = duplicatePerson[1].personId;

    expect(findTiedPodiums([
      ...invalidAverage,
      ...missingPlace,
      ...duplicatePlace,
      ...duplicatePerson,
    ], 'average')).toEqual([]);
  });

  it('keeps different final rounds separate and orders occurrences newest first', () => {
    const older = podium({ competitionId: 'Older2024', startDate: '2024-01-01' });
    const newer = podium({ competitionId: 'Newer2025', startDate: '2025-01-01' });

    expect(findTiedPodiums([...older, ...newer], 'average').map(row => row.competitionId))
      .toEqual(['Newer2025', 'Older2024']);
  });
});
