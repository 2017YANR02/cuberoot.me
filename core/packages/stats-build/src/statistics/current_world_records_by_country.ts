// NOTE: 各国当前世界纪录数量
// 与 Ruby _stats_build/statistics/current_world_records_by_country.rb 1:1 对应
import { Statistic } from '../core/statistic.js';

export class CurrentWorldRecordsByCountry extends Statistic {
  constructor() {
    super();
    this.title = 'Current world records count by country';
    this.titleZh = '各国当前世界纪录数量';
    this.tableHeader = {
      'WRs': 'right',
      'Country': 'left',
      'People': 'left',
    };
  }

  // NOTE: SQL 与 Ruby 版完全一致
  // 从 results 表直接计算每个项目的 WR 持有者
  query(): string {
    return `
      SELECT
        wrs_count,
        country.name,
        people
      FROM (
        SELECT
          country_id,
          COUNT(*) wrs_count,
          GROUP_CONCAT(
            DISTINCT CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')')
            ORDER BY person.name
            SEPARATOR ', '
          ) people
        FROM (
          -- 当前 single WR 持有者：个人最佳 = 该项目全局最佳
          SELECT DISTINCT ps.person_id
          FROM (
            SELECT person_id, event_id, MIN(best) AS pb
            FROM results WHERE best > 0 GROUP BY person_id, event_id
          ) ps
          JOIN (
            SELECT event_id, MIN(best) AS wr
            FROM results WHERE best > 0 GROUP BY event_id
          ) wr ON ps.event_id = wr.event_id AND ps.pb = wr.wr
          JOIN events e ON e.id = ps.event_id AND e.rank < 900
          UNION ALL
          -- 当前 average WR 持有者
          SELECT DISTINCT pa.person_id
          FROM (
            SELECT person_id, event_id, MIN(average) AS pb
            FROM results WHERE average > 0 GROUP BY person_id, event_id
          ) pa
          JOIN (
            SELECT event_id, MIN(average) AS wr
            FROM results WHERE average > 0 GROUP BY event_id
          ) wr ON pa.event_id = wr.event_id AND pa.pb = wr.wr
          JOIN events e ON e.id = pa.event_id AND e.rank < 900
        ) AS ranks
        JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
        GROUP BY country_id
      ) AS wrs_count_by_country
      JOIN countries country ON country.id = country_id
      ORDER BY wrs_count DESC, country.name
    `;
  }
}
