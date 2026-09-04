// NOTE: 连续取得个人纪录的最多参赛场数
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';
import { calculatePersonalRecordStreak } from '@cuberoot/shared/pr-streak';

export class LongestStreakOfPersonalRecords extends Statistic {
  constructor() {
    super();
    this.title = 'Longest streak of competitions with a personal record done';
    this.titleZh = '连续取得个人纪录的最多参赛场数';
    this.tableHeader = {
      'Competitions': 'right',
      'Person': 'left',
      'Started at': 'left',
      'Ended at': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        event_id,
        best single,
        average
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      ORDER BY competition.start_date, competition.id, round_type.rank
    `;
  }

  // NOTE: 追踪每人在每个项目的 PB，统计连续破 PB 的比赛数
  transform(rows: RowDataPacket[]): unknown[][] {
    // NOTE: 按选手分组
    const byPerson = new Map<string, RowDataPacket[]>();
    for (const row of rows) {
      const key = row['person_link'] as string;
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(row);
    }

    const results: [number, string, string | null, string | null][] = [];

    for (const [personLink, personRows] of byPerson) {
      const { longest } = calculatePersonalRecordStreak(personRows.map(row => ({
        competitionId: row['competition_link'] as string,
        eventId: row['event_id'] as string,
        single: Number(row['single']),
        average: Number(row['average']),
      })));
      results.push([
        longest.length,
        personLink,
        longest[0] ?? null,
        longest[longest.length - 1] ?? null,
      ]);
    }

    return results
      .sort((a, b) => (b[0] as number) - (a[0] as number))
      .slice(0, 100);
  }
}
