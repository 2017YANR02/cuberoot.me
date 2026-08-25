// NOTE: 每年每人比赛数
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class CompetitionsPerYearByPerson extends Statistic {
  constructor() {
    super();
    this.title = 'Competitions per year by person';
    this.titleZh = '每年每人比赛数';
    this.tableHeader = {
      'Competitions per year': 'right',
      'Competitions': 'right',
      'Years': 'right',
      'Person': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        (competitions / years) competitions_per_year,
        competitions,
        years,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link
      FROM (
          SELECT
            COUNT(DISTINCT competition_id) competitions,
            (DATEDIFF(CURDATE(), MIN(start_date)) / 365.25) years,
            person_id wca_id
          FROM results result
          JOIN competitions competition ON competition.id = competition_id
          GROUP BY person_id
          HAVING years >= 1
      ) AS data_by_person
      JOIN persons person ON person.wca_id = data_by_person.wca_id
      ORDER BY competitions_per_year DESC
      LIMIT 100
    `;
  }

  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(r => [
      Number(r['competitions_per_year']).toFixed(2),
      r['competitions'],
      Number(r['years']).toFixed(2),
      r['person_link'],
    ]);
  }
}
