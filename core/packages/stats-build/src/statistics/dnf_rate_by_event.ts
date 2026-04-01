// NOTE: DNF 率（按项目）
// 与 Ruby _stats_build/statistics/dnf_rate_by_event.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import { EVENTS } from '../core/events.js';
import type { RowDataPacket } from 'mysql2';

export class DnfRateByEvent extends Statistic {
  constructor() {
    super();
    this.title = 'DNF rate by event';
    this.titleZh = '各项目 DNF 率';
    this.tableHeader = {
      'DNF rate': 'right',
      'Event': 'left',
      'DNFs': 'right',
      'Attempts': 'right',
    };
  }

  // NOTE: SQL 与 Ruby 版完全一致——通过 result_attempts 表聚合
  query(): string {
    return `
      SELECT
        r.event_id,
        SUM(CASE WHEN ra.value = -1 THEN 1 ELSE 0 END) dnfs,
        SUM(CASE WHEN ra.value NOT IN (-2, 0) THEN 1 ELSE 0 END) attempts
      FROM results r
      JOIN result_attempts ra ON ra.result_id = r.id
      GROUP BY r.event_id
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应
  // 计算 DNF 率 → 按降序排列 → 格式化为百分比字符串
  transform(rows: RowDataPacket[]): unknown[][] {
    return rows
      .map(row => ({
        eventId: row['event_id'] as string,
        dnfs: Number(row['dnfs']),
        attempts: Number(row['attempts']),
        // NOTE: 百分比 = 100 * dnfs / attempts
        dnfRate: (100.0 * Number(row['dnfs'])) / Number(row['attempts']),
      }))
      .sort((a, b) => b.dnfRate - a.dnfRate)
      .map(r => [
        `${r.dnfRate.toFixed(2)} %`,
        EVENTS[r.eventId] ?? r.eventId,
        r.dnfs,
        r.attempts,
      ]);
  }
}
