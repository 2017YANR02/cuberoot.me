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

const WCA_EXPORT_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function tiedTopThreeQuery(): string {
  return `
      WITH candidate_rounds AS (
        SELECT competition_id, event_id, round_type_id
        FROM results
        WHERE pos BETWEEN 1 AND 3
          AND event_id <> '333fm'
        GROUP BY competition_id, event_id, round_type_id
        HAVING COUNT(*) = 3
          AND COUNT(DISTINCT pos) = 3
          AND COUNT(DISTINCT person_id) = 3
          AND (
            (MIN(average) > 0 AND MIN(average) = MAX(average))
            OR (MIN(best) > 0 AND MIN(best) = MAX(best))
          )
      )
      SELECT
        r.event_id,
        r.competition_id,
        r.round_type_id,
        r.person_id,
        COALESCE(p.name, r.person_name) AS person_name,
        r.pos,
        r.best,
        r.average,
        c.cell_name AS competition_name,
        DATE_FORMAT(c.start_date, '%Y-%m-%d') AS start_date
      FROM candidate_rounds candidate
      INNER JOIN results r
        ON r.competition_id = candidate.competition_id
        AND r.event_id = candidate.event_id
        AND r.round_type_id = candidate.round_type_id
      INNER JOIN competitions c ON c.id = r.competition_id
      LEFT JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
      WHERE r.pos BETWEEN 1 AND 3
      ORDER BY c.start_date DESC, r.competition_id, r.event_id, r.round_type_id, r.pos
    `;
}

export function parseWcaExportDate(value: unknown): string {
  if (typeof value !== 'string' || !WCA_EXPORT_TIMESTAMP_RE.test(value)) {
    throw new Error('WCA export metadata is missing a canonical UTC export_timestamp');
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error('WCA export metadata contains an invalid export_timestamp');
  }

  return value.slice(0, 10);
}

export function tiedTopThreeNotes(
  averageCount: number,
  singleCount: number,
  exportDate: string,
): { note: string; noteZh: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exportDate)) {
    throw new Error('Tied top-three statistics require a WCA export date');
  }

  return {
    note: `Across all WCA rounds, the official 1st, 2nd and 3rd places had an identical valid average ${averageCount} times and an identical valid single ${singleCount} times. Fewest Moves is excluded. Data uses the WCA export dated ${exportDate}.`,
    noteZh: `WCA 任意轮次官方第 1、2、3 名三人的有效成绩完全相同：平均 ${averageCount} 次，单次 ${singleCount} 次。不含最少步。数据使用 ${exportDate} 的 WCA 导出。`,
  };
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
