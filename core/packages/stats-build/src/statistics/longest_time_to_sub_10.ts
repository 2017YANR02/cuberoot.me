// NOTE: 最长达到 sub-10 三阶平均的时间
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class LongestTimeToSub10 extends Statistic {
  constructor() {
    super();
    this.title = 'Longest time to achieve sub 10 3x3x3 average';
    this.titleZh = '最长达到 sub-10 三阶平均的时间';
    this.tableHeader = {
      'Person': 'left',
      'Years': 'right',
    };
  }

  query(): string {
    return `
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        (DATEDIFF(first_sub_10_competition.start_date, first_competition.start_date) / 365.25) years
      FROM (
        SELECT DISTINCT person_id
        FROM results
        WHERE event_id = '333' AND average > 0 AND average < 1000
      ) AS sub_10_person
      JOIN (
        SELECT person_id, MIN(start_date) start_date
        FROM results
        JOIN competitions competition ON competition.id = competition_id
        GROUP BY person_id
      ) AS first_competition ON first_competition.person_id = sub_10_person.person_id
      JOIN (
        SELECT person_id, MIN(start_date) start_date
        FROM results
        JOIN competitions competition ON competition.id = competition_id
        WHERE event_id = '333' AND average > 0 AND average < 1000
        GROUP BY person_id
      ) AS first_sub_10_competition ON first_sub_10_competition.person_id = sub_10_person.person_id
      JOIN persons person ON person.wca_id = sub_10_person.person_id AND sub_id = 1
      ORDER BY years DESC
      LIMIT 100
    `;
  }

  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(r => [r['person_link'], Number(r['years']).toFixed(2)]);
  }
}
