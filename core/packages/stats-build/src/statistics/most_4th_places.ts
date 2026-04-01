// NOTE: 最多第四名
// 与 Ruby _stats_build/statistics/most_4th_places.rb 1:1 对应
import { Statistic } from '../core/statistic.js';

export class Most4thPlaces extends Statistic {
  constructor() {
    super();
    this.title = 'Most 4th places';
    this.titleZh = '最多第四名';
    this.note = 'Only finals are taken into account.';
    this.noteZh = '仅统计决赛。';
    this.tableHeader = {
      '4th places': 'right',
      'Person': 'left',
    };
  }

  // NOTE: SQL 与 Ruby 版完全一致
  query(): string {
    return `
      SELECT
        4th_places_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
      FROM (
        SELECT
          person_id wca_id,
          COUNT(*) 4th_places_count
        FROM results
        JOIN round_types round_type ON round_type.id = round_type_id
        WHERE round_type.final = 1 AND pos = 4 AND best > 0
        GROUP BY person_id
        ORDER BY 4th_places_count DESC
        LIMIT 100
      ) AS 4th_places_count_by_person
      JOIN persons person ON person.wca_id = 4th_places_count_by_person.wca_id AND person.sub_id = 1
      ORDER BY 4th_places_count DESC
    `;
  }
}
