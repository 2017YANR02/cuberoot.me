// NOTE: 参赛人数最少的比赛
import { Statistic } from '../core/statistic.js';

export class FewestCompetitorsContest extends Statistic {
  constructor() {
    super();
    this.title = 'Fewest competitors contest';
    this.titleZh = '参赛人数最少的比赛';
    this.tableHeader = {
      'Competitors': 'right',
      'Competition': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        competitors_count,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition
      FROM (
        SELECT
          COUNT(DISTINCT person_id) competitors_count,
          competition_id
        FROM results
        GROUP BY competition_id
        HAVING competitors_count <= 15
      ) AS competitors_count_by_competition
      JOIN competitions competition ON competition.id = competition_id
      ORDER BY competitors_count
    `;
  }
}
