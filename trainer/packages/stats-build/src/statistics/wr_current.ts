// NOTE: 当前世界纪录
// 与 Ruby _stats_build/statistics/wr_current.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import { EVENTS } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

export class WrCurrent extends Statistic {
  constructor() {
    super();
    this.title = 'Current world records';
    this.titleZh = '当前世界纪录';
    this.note = 'Shows the current world record single and average for each official event.';
    this.noteZh = '显示每个官方项目的当前世界纪录单次和平均。';
    this.tableHeader = {
      'Event': 'left',
      'Type': 'left',
      'Result': 'right',
      'Person': 'left',
      'Date': 'left',
      'Competition': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        r.event_id,
        r.best AS single,
        r.average,
        r.regional_single_record,
        r.regional_average_record,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date
      FROM results r
      JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = r.competition_id
      WHERE r.regional_single_record = 'WR'
         OR r.regional_average_record = 'WR'
      ORDER BY r.event_id, c.start_date
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应
  // 按项目遍历 → 找当前 WR single 和 average → 用 SolveTime 格式化
  transform(rows: RowDataPacket[]): unknown[][] {
    const result: unknown[][] = [];

    for (const [eventId, eventName] of Object.entries(EVENTS)) {
      // NOTE: 当前 WR single
      const singleRecords = rows.filter(
        r => r['event_id'] === eventId && r['regional_single_record'] === 'WR' && Number(r['single']) > 0
      );
      if (singleRecords.length > 0) {
        const minVal = Math.min(...singleRecords.map(r => Number(r['single'])));
        const ties = singleRecords
          .filter(r => Number(r['single']) === minVal)
          .sort((a, b) => new Date(a['start_date'] as Date).getTime() - new Date(b['start_date'] as Date).getTime());
        for (const best of ties) {
          const st = new SolveTime(eventId, 'single', Number(best['single']));
          const d = best['start_date'] as Date;
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          result.push([eventName, 'Single', st.clockFormat(), best['person_link'], dateStr, best['competition_link']]);
        }
      }

      // NOTE: 当前 WR average
      const avgRecords = rows.filter(
        r => r['event_id'] === eventId && r['regional_average_record'] === 'WR' && Number(r['average']) > 0
      );
      if (avgRecords.length > 0) {
        const minVal = Math.min(...avgRecords.map(r => Number(r['average'])));
        const ties = avgRecords
          .filter(r => Number(r['average']) === minVal)
          .sort((a, b) => new Date(a['start_date'] as Date).getTime() - new Date(b['start_date'] as Date).getTime());
        for (const best of ties) {
          const st = new SolveTime(eventId, 'average', Number(best['average']));
          const d = best['start_date'] as Date;
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          result.push([eventName, 'Average', st.clockFormat(), best['person_link'], dateStr, best['competition_link']]);
        }
      }
    }

    return result;
  }
}
