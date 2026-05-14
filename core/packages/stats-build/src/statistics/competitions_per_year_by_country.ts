// NOTE: 每年每国比赛数
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class CompetitionsPerYearByCountry extends Statistic {
  constructor() {
    super();
    this.title = 'Competitions per year by country';
    this.titleZh = '每年每国比赛数';
    this.tableHeader = {
      'Competitions per year': 'right',
      'Competitions': 'right',
      'Years': 'right',
      'Country': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        competitions / years competitions_per_year,
        competitions,
        years,
        country.name country
      FROM (
          SELECT
            COUNT(DISTINCT competition_id) competitions,
            (DATEDIFF(CURDATE(), MIN(start_date)) / 365.25) years,
            competition.country_id
          FROM results result
          JOIN competitions competition ON competition.id = competition_id
          GROUP BY competition.country_id
          HAVING years >= 1
      ) AS data_by_country
      JOIN countries country ON country.id = country_id
      ORDER BY competitions_per_year DESC
    `;
  }

  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(r => [
      Number(r['competitions_per_year']).toFixed(2),
      r['competitions'],
      Number(r['years']).toFixed(2),
      r['country'],
    ]);
  }
}
