// NOTE: 进入决赛最多
// 与 Ruby _stats_build/statistics/most_finals.rb 1:1 对应
import { Statistic } from '../core/statistic.js';

export class MostFinals extends Statistic {
  constructor() {
    super();
    this.title = 'Most finals';
    this.titleZh = '进入决赛最多';
    this.tableHeader = {
      'Finals': 'right', 'Person': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        finals_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
      FROM (
        SELECT
          person_id wca_id,
          COUNT(*) finals_count
        FROM results
        JOIN round_types round_type ON round_type.id = round_type_id
        WHERE round_type.final = 1
        GROUP BY person_id
        ORDER BY finals_count DESC
        LIMIT 100
      ) AS people_with_finals
      JOIN persons person ON person.wca_id = people_with_finals.wca_id AND person.sub_id = 1
      ORDER BY finals_count DESC
    `;
  }
}
