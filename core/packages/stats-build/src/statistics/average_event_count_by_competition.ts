// NOTE: 每场比赛平均参赛项目数
// 与 Ruby _stats_build/statistics/average_event_count_by_competition.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class AverageEventCountByCompetition extends Statistic {
  constructor() {
    super();
    this.title = 'Average event count by competition';
    this.titleZh = '每场比赛平均参赛项目数';
    this.note = 'In other words, average number of events competitors participated in.';
    this.noteZh = '即参赛选手平均参加的项目数。';
    this.tableHeader = {
      'Competition': 'left',
      'Average event count': 'right',
      'Competitors': 'right',
      'Country': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        AVG(event_count) average_event_count,
        COUNT(*) competitors,
        country.name country
      FROM (
        SELECT
          competition_id,
          person_id,
          COUNT(DISTINCT event_id) event_count
        FROM results
        GROUP BY competition_id, person_id
      ) AS competitors_with_event_count
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = competition.country_id
      GROUP BY competition_id
      ORDER BY average_event_count DESC
      LIMIT 100
    `;
  }

  // NOTE: 格式化平均值为 2 位小数
  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(r => [
      r['competition_link'],
      Number(r['average_event_count']).toFixed(2),
      r['competitors'],
      r['country'],
    ]);
  }
}
