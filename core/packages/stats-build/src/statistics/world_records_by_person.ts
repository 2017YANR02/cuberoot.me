// NOTE: 个人世界纪录数量
import { Statistic } from '../core/statistic.js';

export class WorldRecordsByPerson extends Statistic {
  constructor() {
    super();
    this.title = 'World records count by person';
    this.titleZh = '个人世界纪录数量';
    this.tableHeader = {
      'WRs': 'right',
      'Person': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        wrs_count,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
      FROM (
        SELECT
          person_id,
          SUM((IF(regional_single_record = 'WR', 1, 0) + IF(regional_average_record = 'WR', 1, 0))) wrs_count
        FROM results
        GROUP BY person_id
        HAVING wrs_count > 0
      ) AS wrs_count_by_person
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      ORDER BY wrs_count DESC, person.name
    `;
  }
}
