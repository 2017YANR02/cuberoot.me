// NOTE: 每周比赛数量统计
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 月份英文缩写
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

// NOTE: 将 Date 或日期字符串格式化为 "d Mon YYYY"（如 "5 Jan 2025"）
// 日期无前导零
function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const day = date.getDate();
  const month = MONTH_ABBR[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export class CompetitionsCountByWeek extends Statistic {
  constructor() {
    super();
    this.title = 'Competitions count by week';
    this.titleZh = '每周比赛数量';
    this.note = 'Week is considered to start on Monday and end on Sunday.';
    this.noteZh = '一周从周一开始，周日结束。';
    this.tableHeader = {
      'Competitions': 'center',
      'Week start': 'right',
      'Week end': 'right',
      'List on WCA': 'center',
    };
  }

  query(): string {
    return `
      SELECT
        COUNT(*) competitions_count,
        DATE_ADD(start_date, INTERVAL(-WEEKDAY(start_date)) DAY) week_start_date,
        DATE_ADD(start_date, INTERVAL(6 - WEEKDAY(start_date)) DAY) week_end_date,
        CONCAT('[List](https://www.worldcubeassociation.org/competitions?state=custom&from_date=', MIN(start_date), '&to_date=', MAX(end_date), ')') list_link
      FROM competitions
      WHERE show_at_all = 1 AND cancelled_at IS NULL
      GROUP BY week_start_date, week_end_date
      ORDER BY competitions_count DESC, week_start_date DESC
    `;
  }

  // NOTE: 格式化日期
  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(row => [
      row['competitions_count'],
      formatDate(row['week_start_date'] as Date),
      formatDate(row['week_end_date'] as Date),
      row['list_link'],
    ]);
  }
}
