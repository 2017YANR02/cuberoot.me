import { roundLabel } from '@cuberoot/shared/wca-round';
import type { RowDataPacket } from 'mysql2';
import { EVENTS_ENTRIES, eventZh, headerZh } from '../core/events.js';
import { query as dbQuery } from '../core/database.js';
import { SolveTime } from '../core/solve_time.js';
import { Statistic } from '../core/statistic.js';
import type { StatJson, StatSection, TableHeader } from '../core/statistic.js';
import {
  findTiedTopThrees,
  parseWcaExportDate,
  tiedTopThreeQuery,
  tiedTopThreeNotes,
  type TopThreeResultRow,
  type TiedTopThreeOccurrence,
} from './tied_podium_results_core.js';

interface ExportTimestampRow extends RowDataPacket {
  value: string;
}

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
    return tiedTopThreeQuery();
  }

  async toJson(): Promise<StatJson> {
    const [queriedRows, exportTimestampRows] = await Promise.all([
      this.queryResults(),
      dbQuery<ExportTimestampRow[]>(`
        SELECT value
        FROM wca_statistics_metadata
        WHERE field = 'export_timestamp'
      `),
    ]);
    if (exportTimestampRows.length !== 1) {
      throw new Error('Expected exactly one WCA export_timestamp metadata row');
    }

    let rawRows: RowDataPacket[] | null = queriedRows;
    const rows = rawRows.map(mapRow);
    rawRows = null;
    if (global.gc) global.gc();

    const averageOccurrences = findTiedTopThrees(rows, 'average');
    const singleOccurrences = findTiedTopThrees(rows, 'best');
    const notes = tiedTopThreeNotes(
      averageOccurrences.length,
      singleOccurrences.length,
      parseWcaExportDate(exportTimestampRows[0].value),
    );
    this.note = notes.note;
    this.noteZh = notes.noteZh;

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
