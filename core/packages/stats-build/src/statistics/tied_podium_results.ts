import { roundLabel } from '@cuberoot/shared/wca-round';
import type { RowDataPacket } from 'mysql2';
import { EVENTS_ENTRIES, eventZh, headerZh } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { Statistic } from '../core/statistic.js';
import type { StatJson, StatSection, TableHeader } from '../core/statistic.js';
import {
  findTiedTopThrees,
  type TopThreeResultRow,
  type TiedTopThreeOccurrence,
} from './tied_podium_results_core.js';

const TABLE_HEADER: TableHeader = {
  Result: 'right',
  Round: 'left',
  '1st': 'left',
  '2nd': 'left',
  '3rd': 'left',
  Competition: 'left',
};

export class TiedPodiumResults extends Statistic {
  constructor() {
    super();
    this.title = 'Identical Top-Three Round Results';
    this.titleZh = '同轮前三名同分';
  }

  query(): string {
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

  async toJson(): Promise<StatJson> {
    let rawRows: RowDataPacket[] | null = await this.queryResults();
    const rows = rawRows.map(mapRow);
    rawRows = null;
    if (global.gc) global.gc();

    const averageOccurrences = findTiedTopThrees(rows, 'average');
    const singleOccurrences = findTiedTopThrees(rows, 'best');
    this.note = `Across all WCA rounds, the official 1st, 2nd and 3rd places had an identical valid average ${averageOccurrences.length} times and an identical valid single ${singleOccurrences.length} times. Fewest Moves is excluded.`;
    this.noteZh = `WCA 任意轮次官方第 1、2、3 名三人的有效成绩完全相同：平均 ${averageOccurrences.length} 次，单次 ${singleOccurrences.length} 次。不含最少步。`;

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh,
      note: this.note,
      noteZh: this.noteZh,
      header: Object.entries(TABLE_HEADER).map(([label, align]) => ({
        key: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        labelZh: headerZh(label),
        align,
      })),
      sections: [
        ...buildSections(averageOccurrences, 'average'),
        ...buildSections(singleOccurrences, 'best'),
      ],
    };
  }
}

function mapRow(row: RowDataPacket): TopThreeResultRow {
  return {
    eventId: String(row['event_id']),
    competitionId: String(row['competition_id']),
    competitionName: String(row['competition_name']),
    roundTypeId: String(row['round_type_id']),
    personId: String(row['person_id']),
    personName: String(row['person_name']),
    position: Number(row['pos']),
    best: Number(row['best']),
    average: Number(row['average']),
    startDate: String(row['start_date']),
  };
}

function buildSections(
  occurrences: readonly TiedTopThreeOccurrence[],
  metric: 'average' | 'best',
): StatSection[] {
  const metricTitle = metric === 'average' ? 'Average' : 'Single';
  const metricTitleZh = metric === 'average' ? '平均' : '单次';
  const sections: StatSection[] = [];
  for (const [eventId, eventName] of EVENTS_ENTRIES) {
    const rows = occurrences
      .filter(occurrence => occurrence.eventId === eventId)
      .map(occurrence => [
        new SolveTime(eventId, metric === 'average' ? 'average' : 'single', occurrence.value).clockFormat(),
        roundLabel(occurrence.roundTypeId),
        ...occurrence.topThree.map(personLink),
        competitionLink(occurrence),
      ]);
    if (rows.length === 0) continue;
    sections.push({
      title: `${eventName} - ${metricTitle}`,
      titleZh: `${eventZh(eventName)} - ${metricTitleZh}`,
      rows,
    });
  }
  return sections;
}

function personLink(row: TopThreeResultRow): string {
  return `[${row.personName}](https://www.worldcubeassociation.org/persons/${row.personId})`;
}

function competitionLink(occurrence: TiedTopThreeOccurrence): string {
  return `[${occurrence.competitionName}](https://www.worldcubeassociation.org/competitions/${occurrence.competitionId}/results/all#e${occurrence.eventId}_${occurrence.roundTypeId})`;
}
