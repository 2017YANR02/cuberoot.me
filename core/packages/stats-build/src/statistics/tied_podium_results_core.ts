export type TiedPodiumMetric = 'average' | 'best';

export interface PodiumResultRow {
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

export interface TiedPodiumOccurrence {
  eventId: string;
  competitionId: string;
  competitionName: string;
  roundTypeId: string;
  startDate: string;
  value: number;
  podium: [PodiumResultRow, PodiumResultRow, PodiumResultRow];
}

/**
 * Find final-round podiums whose official 1st, 2nd and 3rd places share one result.
 * The caller supplies final-round rows only; malformed or tied-position podiums are
 * rejected here so they cannot silently become a historical occurrence.
 */
export function findTiedPodiums(
  rows: readonly PodiumResultRow[],
  metric: TiedPodiumMetric,
): TiedPodiumOccurrence[] {
  const groups = new Map<string, PodiumResultRow[]>();

  for (const row of rows) {
    const key = `${row.competitionId}|${row.eventId}|${row.roundTypeId}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const occurrences: TiedPodiumOccurrence[] = [];
  for (const group of groups.values()) {
    if (group.length !== 3) continue;

    const podium = [...group].sort((a, b) => a.position - b.position);
    if (podium[0].position !== 1 || podium[1].position !== 2 || podium[2].position !== 3) continue;
    if (new Set(podium.map(row => row.personId)).size !== 3) continue;

    const values = podium.map(row => row[metric]);
    if (values.some(value => !Number.isFinite(value) || value <= 0)) continue;
    if (values[0] !== values[1] || values[1] !== values[2]) continue;

    occurrences.push({
      eventId: podium[0].eventId,
      competitionId: podium[0].competitionId,
      competitionName: podium[0].competitionName,
      roundTypeId: podium[0].roundTypeId,
      startDate: podium[0].startDate,
      value: values[0],
      podium: podium as [PodiumResultRow, PodiumResultRow, PodiumResultRow],
    });
  }

  return occurrences.sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
    || a.competitionId.localeCompare(b.competitionId)
    || a.eventId.localeCompare(b.eventId));
}
