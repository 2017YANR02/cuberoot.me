// NOTE: 最短时间获得所有项目的单次和平均成绩
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 项目数实时取自 `events` 表（rank < 900 = 当前官方项目）。
// 单次用全部当前官方项目；平均额外扣 1（3x3x3 Multi-Blind 无平均）。
export class ShortestTimeToGetAllSinglesAndAverages extends Statistic {
  constructor() {
    super();
    this.title = 'Shortest time to get all singles and averages';
    this.titleZh = '最短时间获得所有项目的单次和平均成绩';
    this.note = 'Only current official events are taken into account.';
    this.noteZh = '仅考虑当前官方项目。';
    this.tableHeader = {
      'Days': 'right',
      'Person': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        event_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        start_date,
        best,
        average
      FROM (
        SELECT person_id
        FROM results
        JOIN events event ON event.id = event_id
        WHERE event.rank < 900 AND best > 0
        GROUP BY person_id
        HAVING COUNT(DISTINCT event_id) = (SELECT COUNT(*) FROM events WHERE events.rank < 900)
      ) AS all_events_people
      JOIN (
        SELECT person_id
        FROM results
        JOIN events event ON event.id = event_id
        WHERE event.rank < 900 AND average > 0
        GROUP BY person_id
        HAVING COUNT(DISTINCT event_id) = (SELECT COUNT(*) FROM events WHERE events.rank < 900) - 1
      ) AS all_average_people ON all_average_people.person_id = all_events_people.person_id
      JOIN results result ON result.person_id = all_events_people.person_id
      JOIN persons person ON person.wca_id = result.person_id and person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      ORDER BY start_date
    `;
  }

  // 按选手分组 → 找每个项目的 best 和 average 各自的首次成功日期 → 取最大日期差
  transform(rows: RowDataPacket[]): unknown[][] {
    const byPerson = new Map<string, RowDataPacket[]>();
    for (const row of rows) {
      const key = row['person_link'] as string;
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(row);
    }

    const results: [number, string][] = [];
    for (const [personLink, personRows] of byPerson) {
      const firstDate = personRows[0]['start_date'] as Date;

      // NOTE: 按项目 × 类型(best/average) 取最早成功日期
      const firstSuccesses: Date[] = [];
      for (const type of ['best', 'average'] as const) {
        const byEvent = new Map<string, Date>();
        for (const row of personRows) {
          if (Number(row[type]) > 0) {
            const eventId = row['event_id'] as string;
            const date = row['start_date'] as Date;
            if (!byEvent.has(eventId) || date < byEvent.get(eventId)!) {
              byEvent.set(eventId, date);
            }
          }
        }
        firstSuccesses.push(...byEvent.values());
      }

      const lastDate = firstSuccesses.sort((a, b) => b.getTime() - a.getTime())[0];
      const days = Math.floor((lastDate.getTime() - firstDate.getTime()) / (24 * 3600 * 1000));
      results.push([days, personLink]);
    }

    return results.sort((a, b) => a[0] - b[0]);
  }
}
