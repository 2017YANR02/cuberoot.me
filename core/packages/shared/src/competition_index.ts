export interface CompetitionIndexRow {
  id: string;
}

/** A generated competition index is an asserted contract, not best-effort UI data. */
export class CompetitionIndexContractError extends Error {
  override name = 'CompetitionIndexContractError';
}

export function assertUniqueCompetitionIndex<T extends CompetitionIndexRow>(
  rows: readonly T[],
  source: string,
): void {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = typeof row?.id === 'string' ? row.id.trim() : '';
    if (!id) {
      throw new CompetitionIndexContractError(`${source} contains an invalid competition id`);
    }
    if (ids.has(id)) {
      throw new CompetitionIndexContractError(
        `${source} contains duplicate competition id: ${id}`,
      );
    }
    ids.add(id);
  }
}

/**
 * Merge two independently generated indexes. Duplicates inside either source
 * are upstream bugs; overlap between past/upcoming is expected and upcoming
 * wins because it is refreshed more frequently.
 */
export function mergeCompetitionIndexes<T extends CompetitionIndexRow>(
  past: readonly T[],
  upcoming: readonly T[],
  sources: { past: string; upcoming: string } = {
    past: 'past competition index',
    upcoming: 'upcoming competition index',
  },
): T[] {
  assertUniqueCompetitionIndex(past, sources.past);
  assertUniqueCompetitionIndex(upcoming, sources.upcoming);
  const merged = new Map<string, T>();
  for (const competition of past) merged.set(competition.id, competition);
  for (const competition of upcoming) merged.set(competition.id, competition);
  return [...merged.values()];
}
