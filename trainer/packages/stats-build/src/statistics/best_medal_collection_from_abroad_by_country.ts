// NOTE: 各国海外最佳奖牌收藏
// 与 Ruby _stats_build/statistics/best_medal_collection_from_abroad_by_country.rb 1:1 对应
import { Statistic } from '../core/statistic.js';

export class BestMedalCollectionFromAbroadByCountry extends Statistic {
  constructor() {
    super();
    this.title = 'Best medal collection from abroad by country';
    this.titleZh = '各国海外最佳奖牌收藏';
    this.note = 'Only medals got abroad are taken into account.';
    this.noteZh = '仅统计在海外比赛获得的奖牌。';
    this.tableHeader = {
      'Country': 'left', 'Gold': 'center', 'Silver': 'center', 'Bronze': 'center', 'Total': 'center',
    };
  }

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
        WHERE 1
          AND round_type_id IN ('c', 'f')
          AND best > 0
          AND competition.country_id != result.country_id
        GROUP BY result.country_id
      ) AS medals_by_country
      JOIN countries country ON country.id = country_id
      WHERE gold_medals + silver_medals + bronze_medals > 0
      ORDER BY gold_medals DESC, silver_medals DESC, bronze_medals DESC, country.name
    `;
  }
}
