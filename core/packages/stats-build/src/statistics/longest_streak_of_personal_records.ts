// NOTE: 最长连续个人纪录比赛记录
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class LongestStreakOfPersonalRecords extends Statistic {
  constructor() {
    super();
    this.title = 'Longest streak of competitions with a personal record done';
    this.titleZh = '最长连续个人纪录参赛记录';
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
      ORDER BY competition.start_date, round_type.rank
    `;
  }

  // NOTE: 追踪每人在每个项目的 PB，统计连续破 PB 的比赛数
  transform(rows: RowDataPacket[]): unknown[][] {
    interface Streak { count: number; firstCompetition: string | null; lastCompetition: string | null }

    // NOTE: 按选手分组
    const byPerson = new Map<string, RowDataPacket[]>();
    for (const row of rows) {
      const key = row['person_link'] as string;
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(row);
    }

    const results: [number, string, string | null, string | null][] = [];

    for (const [personLink, personRows] of byPerson) {
      // NOTE: 按项目追踪 PB（single 和 average 分开追踪）
      const pbsByEvent = new Map<string, { single: number; average: number }>();
      let longestStreak: Streak = { count: 0, firstCompetition: null, lastCompetition: null };
      let currentStreak: Streak | null = null;

      // NOTE: 按比赛分组
      const byCompetition = new Map<string, RowDataPacket[]>();
      const compOrder: string[] = [];
      for (const row of personRows) {
        const comp = row['competition_link'] as string;
        if (!byCompetition.has(comp)) {
          byCompetition.set(comp, []);
          compOrder.push(comp);
        }
        byCompetition.get(comp)!.push(row);
      }

      for (const compLink of compOrder) {
        if (!currentStreak) {
          currentStreak = { count: 0, firstCompetition: compLink, lastCompetition: null };
        }

        let competitionWithPb = false;
        for (const result of byCompetition.get(compLink)!) {
          const eventId = result['event_id'] as string;
          if (!pbsByEvent.has(eventId)) {
            pbsByEvent.set(eventId, { single: Infinity, average: Infinity });
          }
          const pbs = pbsByEvent.get(eventId)!;

          for (const type of ['single', 'average'] as const) {
            const val = Number(result[type]);
            if (val > 0 && val <= pbs[type]) {
              pbs[type] = val;
              competitionWithPb = true;
            }
          }
        }

        if (competitionWithPb) {
          currentStreak.count += 1;
          if (currentStreak.count > longestStreak.count) {
            longestStreak = { ...currentStreak };
          }
        } else {
          currentStreak.lastCompetition = compLink;
          currentStreak = null;
        }
      }

      results.push([longestStreak.count, personLink, longestStreak.firstCompetition, longestStreak.lastCompetition]);
    }

    return results
      .sort((a, b) => (b[0] as number) - (a[0] as number))
      .slice(0, 100);
  }
}
