// NOTE: 海外参赛最多
// 与 Ruby _stats_build/statistics/most_competitions_abroad.rb 1:1 对应
import { Statistic } from '../core/statistic.js';

export class MostCompetitionsAbroad extends Statistic {
  constructor() {
    super();
    this.title = 'Most competitions abroad';
    this.titleZh = '海外参赛最多';
    this.tableHeader = {
      'Competitions': 'right', 'Person': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        competitions_abroad,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_name
      FROM (
        SELECT
          person_id,
          COUNT(DISTINCT competition_id) competitions_abroad
        FROM results result
        JOIN competitions competition ON competition.id = competition_id
        WHERE 1
          AND result.country_id != competition.country_id
          AND competition.country_id -- Ignore Multiple Countries used for continental FMC competitions.
            NOT IN ('XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW')
        GROUP BY person_id
        ORDER BY competitions_abroad DESC
        LIMIT 100
      ) AS person_ids_with_competitions_abroad
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      ORDER BY competitions_abroad DESC
    `;
  }
}
