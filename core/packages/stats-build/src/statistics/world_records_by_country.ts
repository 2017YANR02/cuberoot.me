// NOTE: 各国世界纪录数量
// 与 Ruby _stats_build/statistics/world_records_by_country.rb 1:1 对应
import { Statistic } from '../core/statistic.js';

export class WorldRecordsByCountry extends Statistic {
  constructor() {
    super();
    this.title = 'World records count by country';
    this.titleZh = '各国世界纪录数量';
    this.tableHeader = {
      'WRs': 'right',
      'Country': 'left',
    };
  }

  // NOTE: SQL 与 Ruby 版完全一致
  query(): string {
    return `
      SELECT
        wrs_count,
        country.name
      FROM (
        SELECT
          country_id,
          SUM((IF(regional_single_record = 'WR', 1, 0) + IF(regional_average_record = 'WR', 1, 0))) wrs_count
        FROM results
        GROUP BY country_id
        HAVING wrs_count > 0
      ) AS wrs_count_by_country
      JOIN countries country ON country.id = country_id
      ORDER BY wrs_count DESC, country.name
    `;
  }
}
