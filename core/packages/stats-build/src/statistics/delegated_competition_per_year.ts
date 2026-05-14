// NOTE: 每年代表比赛数
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class DelegatedCompetitionPerYear extends Statistic {
  constructor() {
    super();
    this.title = 'Delegated competitions per year';
    this.titleZh = '每年代表比赛数';
    this.note = 'Only delegates with at least 5 competitions are taken into account. '
      + 'Delegate period is calculated as the difference between first and last delegated competition.';
    this.noteZh = '仅统计至少代表过 5 场比赛的代表。代表期间为首次和末次代表比赛之间的时间跨度。';
    this.tableHeader = {
      'Delegated per year': 'right',
      'Delegated': 'right',
      'Years': 'right',
      'Person': 'left',
      'List on WCA': 'center',
    };
  }

  query(): string {
    return `
      SELECT
        (delegated_count / years) delegated_per_year,
        delegated_count,
        years,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[List](https://www.worldcubeassociation.org/competitions?year=all+years&state=past&delegate=', user.id, ')') list_link
      FROM (
        SELECT
          COUNT(DISTINCT competition_id) delegated_count,
          (DATEDIFF(MAX(end_date), MIN(start_date)) / 365.25) years,
          delegate_id
        FROM competition_delegates
        JOIN competitions competition ON competition.id = competition_id
        WHERE show_at_all = 1 AND cancelled_at IS NULL AND start_date < CURDATE()
        GROUP BY delegate_id
      ) AS delegated_count_by_user
      JOIN users user ON user.id = delegate_id
      JOIN persons person ON person.wca_id = user.wca_id AND person.sub_id = 1
      WHERE delegated_count >= 5
      ORDER BY delegated_per_year DESC
    `;
  }

  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(r => [
      Number(r['delegated_per_year']).toFixed(2),
      r['delegated_count'],
      Number(r['years']).toFixed(2),
      r['person_link'],
      r['list_link'],
    ]);
  }
}
