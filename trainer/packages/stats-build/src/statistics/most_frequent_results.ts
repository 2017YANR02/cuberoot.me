// NOTE: 最常出现的成绩
// 与 Ruby _stats_build/statistics/most_frequent_results.rb 1:1 对应
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { ATTEMPTS_SUBQUERY } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

export class MostFrequentResults extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Most frequent results';
    this.titleZh = '最常出现的成绩';
    this.tableHeader = {
      'Count': 'right',
      'Result': 'right',
    };
  }

  query(): string {
    return `
      SELECT
        event_id,
        ${ATTEMPTS_SUBQUERY} AS attempts
      FROM results result
      WHERE event_id != '333mbo'
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应——拆分 attempts、按值频率排序
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return Object.entries(EVENTS).map(([eventId, eventName]) => {
      // NOTE: 收集所有正值 attempt
      const valueCounts = new Map<number, number>();
      for (const row of rows) {
        if (row['event_id'] !== eventId) continue;
        const attempts = ((row['attempts'] as string) || '').split(',').map(Number);
        for (const v of attempts) {
          if (v > 0) {
            valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1);
          }
        }
      }

      const results = [...valueCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => [
          count,
          new SolveTime(eventId, 'single', value).clockFormat(),
        ]);

      return [eventName, results] as [string, unknown[][]];
    });
  }
}
