// NOTE: 最多不同参赛日期
// 与 Ruby _stats_build/statistics/most_distinct_dates_competed_on.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 月份英文全名（与 Ruby Date::MONTHNAMES 对应，index 1-12）
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

// NOTE: 每月总天数（非闰年基准，与 Ruby Date.new(2000, month, -1).day 对应）
const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export class MostDistinctDatesCompetedOn extends Statistic {
  constructor() {
    super();
    this.title = 'Most distinct dates competed on';
    this.titleZh = '最多不同参赛日期';
    this.tableHeader = {
      'Dates': 'right',
      'Person': 'left',
      'List': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        attended_dates,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        dates_list
      FROM (
        SELECT
          COUNT(DISTINCT competition_date) AS attended_dates,
          person_id,
          GROUP_CONCAT(DISTINCT competition_date ORDER BY competition_date ASC SEPARATOR ',') dates_list
        FROM (
          SELECT results.person_id, DATE_FORMAT(competition_dates.competition_date, '%m/%d') competition_date
          FROM results
          JOIN (
            SELECT
              competitions.id AS competition_id,
              DATE_ADD(competitions.start_date, INTERVAL nums.num DAY) AS competition_date
            FROM competitions
            JOIN (
              SELECT 0 AS num UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
            ) AS nums
            WHERE DATE_ADD(competitions.start_date, INTERVAL nums.num DAY) <= competitions.end_date
          ) AS competition_dates ON competition_dates.competition_id = results.competition_id
        ) AS competitions_dates
        GROUP BY person_id
        HAVING attended_dates >= 100
      ) AS comp_dates_by_person
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      ORDER BY attended_dates DESC, person.name
    `;
  }

  // NOTE: 与 Ruby transform + transform_dates 1:1 对应
  // 将日期列表按月份分组，显示覆盖百分比和具体日期
  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(r => [
      r['attended_dates'],
      r['person_link'],
      this.transformDates(r['dates_list'] as string),
    ]);
  }

  private transformDates(datesList: string): string {
    // NOTE: 解析 "MM/DD,MM/DD,..." 格式
    const parsed = datesList.split(',').map(d => {
      const [month, day] = d.split('/').map(Number);
      return { month, day };
    });

    // NOTE: 按月份分组
    const byMonth = new Map<number, number[]>();
    for (const { month, day } of parsed) {
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(day);
    }

    // NOTE: 按月份排序 → 格式化为 "Month: (xx%) d1, d2, ..."
    return [...byMonth.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([month, days]) => {
        const monthDays = DAYS_IN_MONTH[month];
        const percentage = Math.round(100 * days.length / monthDays);
        return `${MONTH_NAMES[month]}: (${percentage}%) ${days.join(', ')}`;
      })
      .join('<br />');
  }
}
