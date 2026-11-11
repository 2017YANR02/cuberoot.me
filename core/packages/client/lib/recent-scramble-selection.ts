/** Round-robin stages, then prefer a new competition within each stage.
 * Input is ordered by rarity. A scramble appears once even if several stages qualify.
 * This is an editorial selection of recent examples, not a probability ranking.
 */
export function diversifyRecentScrambles<T extends { id: string; uiVariant: string; metric: string }>(
  entries: readonly T[], competitionOf: (entry: T) => string,
): T[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = `${entry.uiVariant}:${entry.metric}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  const seen = new Set<string>();
  const competitionCounts = new Map<string, number>();
  const result: T[] = [];
  while (groups.size) {
    for (const [key, group] of groups) {
      const candidates = group.filter(entry => !seen.has(entry.id));
      if (!candidates.length) { groups.delete(key); continue; }
      // Keep the shortlist close to the rare end; avoid letting one competition
      // occupy every slot when comparably rare examples are available.
      let best = 0;
      for (let i = 1; i < Math.min(12, candidates.length); i++) {
        if ((competitionCounts.get(competitionOf(candidates[i])) ?? 0)
          < (competitionCounts.get(competitionOf(candidates[best])) ?? 0)) best = i;
      }
      const entry = candidates.splice(best, 1)[0];
      seen.add(entry.id);
      const competition = competitionOf(entry);
      competitionCounts.set(competition, (competitionCounts.get(competition) ?? 0) + 1);
      result.push(entry);
      if (candidates.length) groups.set(key, candidates);
      else groups.delete(key);
    }
  }
  return result;
}

export function matchesRecentMoves(step: number, limit: number | null, comparison: 'max' | 'exact') {
  return limit === null || (comparison === 'exact' ? step === limit : step <= limit);
}
