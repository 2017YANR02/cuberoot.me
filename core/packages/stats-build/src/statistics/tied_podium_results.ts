import type { RowDataPacket } from 'mysql2';
import { EVENTS_ENTRIES, eventZh, headerZh } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { Statistic } from '../core/statistic.js';
import type { StatJson, StatSection, TableHeader } from '../core/statistic.js';
import {
  findTiedPodiums,
  type PodiumResultRow,
  type TiedPodiumOccurrence,
} from './tied_podium_results_core.js';

const TABLE_HEADER: TableHeader = {
  Result: 'right',
  '1st': 'left',
  '2nd': 'left',
  '3rd': 'left',
  Competition: 'left',
};

export class TiedPodiumResults extends Statistic {
  constructor() {
    super();
    this.title = 'Identical Final Podium Results';
    this.titleZh = '决赛前三名同分';
  }

  query(): string {
    return `
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
      FROM results r
      INNER JOIN round_types rt ON rt.id = r.round_type_id AND rt.final = 1
      INNER JOIN competitions c ON c.id = r.competition_id
      LEFT JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
      WHERE r.pos BETWEEN 1 AND 3
        AND r.event_id <> '333fm'
      ORDER BY c.start_date DESC, r.competition_id, r.event_id, r.round_type_id, r.pos
    `;
  }

  async toJson(): Promise<StatJson> {
    let rawRows: RowDataPacket[] | null = await this.queryResults();
    const rows = rawRows.map(mapRow);
    rawRows = null;
    if (global.gc) global.gc();

    const averageOccurrences = findTiedPodiums(rows, 'average');
    const singleOccurrences = findTiedPodiums(rows, 'best');
    this.note = `Found ${averageOccurrences.length} final podiums with an identical valid average and ${singleOccurrences.length} with an identical valid single for the official 1st, 2nd and 3rd places. Fewest Moves is excluded.`;
    this.noteZh = `WCA 决赛官方第 1、2、3 名三人的有效成绩完全相同：平均 ${averageOccurrences.length} 次，单次 ${singleOccurrences.length} 次。不含最少步。`;

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

function mapRow(row: RowDataPacket): PodiumResultRow {
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
  occurrences: readonly TiedPodiumOccurrence[],
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
        ...occurrence.podium.map(personLink),
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

function personLink(row: PodiumResultRow): string {
  return `[${row.personName}](https://www.worldcubeassociation.org/persons/${row.personId})`;
}

function competitionLink(occurrence: TiedPodiumOccurrence): string {
  return `[${occurrence.competitionName}](https://www.worldcubeassociation.org/competitions/${occurrence.competitionId})`;
}
