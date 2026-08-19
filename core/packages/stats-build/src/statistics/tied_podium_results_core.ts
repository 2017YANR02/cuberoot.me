export type TiedResultMetric = 'average' | 'best';

export interface TopThreeResultRow {
  eventId: string;
  competitionId: string;
  competitionName: string;
  roundTypeId: string;
  personId: string;
  personName: string;
  position: number;
  best: number;
  average: number;
  startDate: string;
}

export interface TiedTopThreeOccurrence {
  eventId: string;
  competitionId: string;
  competitionName: string;
  roundTypeId: string;
  startDate: string;
  value: number;
  topThree: [TopThreeResultRow, TopThreeResultRow, TopThreeResultRow];
}

/**
 * Find rounds whose official 1st, 2nd and 3rd places share one result.
 * Malformed or tied-position top threes are rejected so they cannot silently become
 * a historical occurrence.
 */
export function findTiedTopThrees(
  rows: readonly TopThreeResultRow[],
  metric: TiedResultMetric,
): TiedTopThreeOccurrence[] {
  const groups = new Map<string, TopThreeResultRow[]>();

  for (const row of rows) {
    const key = `${row.competitionId}|${row.eventId}|${row.roundTypeId}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const occurrences: TiedTopThreeOccurrence[] = [];
  for (const group of groups.values()) {
    if (group.length !== 3) continue;

    const topThree = [...group].sort((a, b) => a.position - b.position);
    if (topThree[0].position !== 1 || topThree[1].position !== 2 || topThree[2].position !== 3) continue;
    if (new Set(topThree.map(row => row.personId)).size !== 3) continue;

    const values = topThree.map(row => row[metric]);
    if (values.some(value => !Number.isFinite(value) || value <= 0)) continue;
    if (values[0] !== values[1] || values[1] !== values[2]) continue;

    occurrences.push({
      eventId: topThree[0].eventId,
      competitionId: topThree[0].competitionId,
      competitionName: topThree[0].competitionName,
      roundTypeId: topThree[0].roundTypeId,
      startDate: topThree[0].startDate,
      value: values[0],
      topThree: topThree as [TopThreeResultRow, TopThreeResultRow, TopThreeResultRow],
    });
  }

  return occurrences.sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
    || a.competitionId.localeCompare(b.competitionId)
    || a.eventId.localeCompare(b.eventId)
    || a.roundTypeId.localeCompare(b.roundTypeId));
}
