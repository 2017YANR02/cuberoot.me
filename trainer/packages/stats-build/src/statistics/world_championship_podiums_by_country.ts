// NOTE: 世锦赛领奖台次数（按国家）
// 与 Ruby _stats_build/statistics/world_championship_podiums_by_country.rb 1:1 对应
import { Statistic } from '../core/statistic.js';

export class WorldChampionshipPodiumsByCountry extends Statistic {
  constructor() {
    super();
    this.title = 'World Championship podiums by country';
    this.titleZh = '各国世锦赛领奖台次数';
    this.tableHeader = {
      'Country': 'left',
      'Gold': 'center',
      'Silver': 'center',
      'Bronze': 'center',
      'Total': 'center',
    };
  }

  // NOTE: SQL 与 Ruby 版完全一致
  query(): string {
    return `
      SELECT
        country.name,
        CONCAT('**', gold_medals, '**'),
        silver_medals,
        bronze_medals,
        gold_medals + silver_medals + bronze_medals total
      FROM (
        SELECT
          result.country_id,
          SUM(IF(pos = 1, 1, 0)) gold_medals,
          SUM(IF(pos = 2, 1, 0)) silver_medals,
          SUM(IF(pos = 3, 1, 0)) bronze_medals
        FROM results result
        JOIN competitions competition ON competition.id = competition_id
        JOIN championships ON championships.competition_id = result.competition_id
        WHERE 1
          AND round_type_id IN ('c', 'f')
          AND best > 0
          AND championship_type = 'world'
        GROUP BY result.country_id
      ) AS medals_by_country
      JOIN countries country ON country.id = country_id
      WHERE gold_medals + silver_medals + bronze_medals > 0
      ORDER BY gold_medals DESC, silver_medals DESC, bronze_medals DESC, country.name
    `;
  }
}
