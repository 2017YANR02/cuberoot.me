// NOTE: 世锦赛领奖台次数（按选手）
// 与 Ruby _stats_build/statistics/world_championship_podiums_by_person.rb 1:1 对应
import { Statistic } from '../core/statistic.js';

export class WorldChampionshipPodiumsByPerson extends Statistic {
  constructor() {
    super();
    this.title = 'World Championship podiums by person';
    this.titleZh = '世锦赛领奖台次数（按选手）';
    this.tableHeader = {
      'Person': 'left',
      'Gold': 'center',
      'Silver': 'center',
      'Bronze': 'center',
      'Total': 'center',
    };
  }

  // NOTE: SQL 与 Ruby 版完全一致
  // 从 results + championships 表统计世锦赛决赛领奖台
  query(): string {
    return `
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('**', gold_medals, '**'),
        silver_medals,
        bronze_medals,
        gold_medals + silver_medals + bronze_medals total
      FROM (
        SELECT
          person_id,
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
        GROUP BY person_id
      ) AS medals_by_country
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      WHERE gold_medals + silver_medals + bronze_medals > 0
      ORDER BY gold_medals DESC, silver_medals DESC, bronze_medals DESC, person.name
    `;
  }
}
