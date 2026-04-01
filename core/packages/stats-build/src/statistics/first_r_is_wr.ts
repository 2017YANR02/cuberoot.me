// NOTE: 首次破纪录即世界纪录
// 与 Ruby _stats_build/statistics/first_r_is_wr.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import { EVENTS } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

export class FirstRIsWr extends Statistic {
  constructor() {
    super();
    this.title = 'First record is a World Record';
    this.titleZh = '首次破纪录即世界纪录';
    this.note = 'People whose very first record (single or average, any event) was a World Record.';
    this.noteZh = '首次打破任何纪录（单次或平均、任何项目）即为世界纪录的选手。';
    this.tableHeader = {
      '#': 'right',
      'Person': 'left',
      'Event': 'left',
      'Type': 'left',
      'Result': 'right',
      'Date': 'left',
      'Competition': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        ar.person_name,
        ar.person_id,
        ar.event_id,
        ar.record_type,
        ar.result,
        CONCAT('[', c2.cell_name, '](https://www.worldcubeassociation.org/competitions/', ar.competition_id, ')') competition_link,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', ar.person_id, ')') person_link,
        ar.start_date
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY start_date) AS rn
        FROM (
          SELECT r.person_id, r.person_name, r.event_id, r.competition_id,
                 c.start_date,
                 'single' AS record_type, r.best AS result,
                 r.regional_single_record AS record
          FROM results r
          JOIN competitions c ON r.competition_id = c.id
          WHERE r.regional_single_record IS NOT NULL

          UNION ALL

          SELECT r.person_id, r.person_name, r.event_id, r.competition_id,
                 c.start_date,
                 'average' AS record_type, r.average AS result,
                 r.regional_average_record AS record
          FROM results r
          JOIN competitions c ON r.competition_id = c.id
          WHERE r.regional_average_record IS NOT NULL
        ) all_records
      ) ar
      JOIN persons p ON p.wca_id = ar.person_id AND p.sub_id = 1
      JOIN competitions c2 ON c2.id = ar.competition_id
      WHERE ar.rn = 1 AND ar.record = 'WR'
      ORDER BY ar.start_date
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应——用 SolveTime 格式化成绩
  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map((r, i) => {
      const eventName = EVENTS[r['event_id'] as string] ?? (r['event_id'] as string);
      const typeSym: 'single' | 'average' = r['record_type'] === 'single' ? 'single' : 'average';
      const resultStr = new SolveTime(r['event_id'] as string, typeSym, Number(r['result'])).clockFormat();
      const typeStr = r['record_type'] === 'single' ? 'Single' : 'Average';
      const d = r['start_date'] as Date;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return [i + 1, r['person_link'], eventName, typeStr, resultStr, dateStr, r['competition_link']];
    });
  }
}
