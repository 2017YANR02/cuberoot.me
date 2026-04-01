// NOTE: 最短时间获得所有项目单次成绩
// 与 Ruby _stats_build/statistics/shortest_time_to_get_all_singles.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import { EVENTS } from '../core/events.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 官方正式项目数（rank < 900 的项目）—— 与 Ruby Events::OFFICIAL.length 对应
const OFFICIAL_EVENT_COUNT = Object.keys(EVENTS).length;

export class ShortestTimeToGetAllSingles extends Statistic {
  constructor() {
    super();
    this.title = 'Shortest time to get all singles';
    this.titleZh = '最短时间获得所有项目单次成绩';
    this.note = 'Only current official events are taken into account.';
    this.noteZh = '仅考虑当前官方项目。';
    this.tableHeader = {
      'Days': 'right',
      'Person': 'left',
    };
  }

  // NOTE: SQL 中 Ruby 的 #{Events::OFFICIAL.length} 被硬编码为常量
  query(): string {
    return `
      SELECT
        event_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        start_date,
        best
      FROM (
        SELECT person_id
        FROM results
        JOIN events event ON event.id = event_id
        WHERE event.rank < 900 AND best > 0
        GROUP BY person_id
        HAVING COUNT(DISTINCT event_id) = ${OFFICIAL_EVENT_COUNT}
      ) AS all_events_people
      JOIN results result ON result.person_id = all_events_people.person_id
      JOIN persons person ON person.wca_id = result.person_id and person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      ORDER BY start_date
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应
  // 按选手分组 → 找每个项目首次成功日期 → 最后一个项目的日期减去首场比赛日期
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

      // NOTE: 按项目分组，取最早的成功日期
      const byEvent = new Map<string, Date>();
      for (const row of personRows) {
        if (Number(row['best']) > 0) {
          const eventId = row['event_id'] as string;
          const date = row['start_date'] as Date;
          if (!byEvent.has(eventId) || date < byEvent.get(eventId)!) {
            byEvent.set(eventId, date);
          }
        }
      }

      // NOTE: 最后一个项目完成的日期 - 首场比赛日期 = 天数
      const lastEventDate = [...byEvent.values()].sort((a, b) => b.getTime() - a.getTime())[0];
      const days = Math.floor((lastEventDate.getTime() - firstDate.getTime()) / (24 * 3600 * 1000));
      results.push([days, personLink]);
    }

    return results.sort((a, b) => a[0] - b[0]);
  }
}
