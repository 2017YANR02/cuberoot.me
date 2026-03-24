// NOTE: 世锦赛纪录
// 与 Ruby _stats_build/statistics/world_championship_records.rb 1:1 对应
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 常量——DNF 的 SolveTime（用于初始化比较）
const DNF = new SolveTime(null, null, -1);

export class WorldChampionshipRecords extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'World Championship records';
    this.titleZh = '世锦赛纪录';
    this.note = 'This is a list of the best results from all World Championships. It corresponds to Olympic records for Olympic sports.';
    this.noteZh = '所有世锦赛的最佳成绩列表，类似于奥运纪录。';
    this.tableHeader = {
      'Event': 'left',
      'Result': 'right',
      'Person': 'left',
      'Citizen of': 'left',
      'Competition': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        event_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        country.name country_name,
        best single,
        average
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = person.country_id
      JOIN championships ON championships.competition_id = results.competition_id
      WHERE championship_type = 'world'
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应——按 Single/Average 分组 → 按项目找最佳
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return (['Single', 'Average'] as const).map(header => {
      const type = header.toLowerCase() as 'single' | 'average';

      // NOTE: 按项目追踪最佳纪录
      const recordsByEvent = new Map<string, { result: SolveTime; row: RowDataPacket }>();

      for (const row of rows) {
        const eventId = row['event_id'] as string;
        const st = new SolveTime(eventId, type, Number(row[type]));

        if (!recordsByEvent.has(eventId)) {
          recordsByEvent.set(eventId, { result: DNF, row });
        }

        const current = recordsByEvent.get(eventId)!;
        if (st.compareTo(current.result) <= 0) {
          recordsByEvent.set(eventId, { result: st, row });
        }
      }

      // NOTE: 按官方项目顺序输出
      const records = Object.entries(EVENTS)
        .map(([eventId, eventName]) => {
          const entry = recordsByEvent.get(eventId);
          if (!entry || !entry.result.isComplete()) return null;
          return [
            eventName,
            entry.result.clockFormat(),
            entry.row['person_link'],
            entry.row['country_name'],
            entry.row['competition_link'],
          ];
        })
        .filter((r): r is unknown[] => r !== null);

      return [header, records] as [string, unknown[][]];
    });
  }
}
