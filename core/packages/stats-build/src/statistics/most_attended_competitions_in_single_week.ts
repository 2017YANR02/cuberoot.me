// NOTE: 单周内最多参加比赛数
// 与 Ruby _stats_build/statistics/most_attended_competitions_in_single_week.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 月份英文缩写
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// NOTE: 格式化日期为 "d&nbsp;Mon&nbsp;YYYY"（与 Ruby strftime "%e&nbsp;%b&nbsp;%Y" 对应）
function formatDateNbsp(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getDate()}&nbsp;${MONTH_ABBR[date.getMonth()]}&nbsp;${date.getFullYear()}`;
}

export class MostAttendedCompetitionsInSingleWeek extends Statistic {
  constructor() {
    super();
    this.title = 'Most attended competitions in a single week';
    this.titleZh = '单周内最多参加比赛数';
    this.tableHeader = {
      'Competitions': 'right',
      'Person': 'left',
      'Start date': 'left',
      'End date': 'left',
      'List': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        attended_within_week,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        week_start_date,
        week_end_date,
        competition_links
      FROM (
        SELECT
          COUNT(*) attended_within_week,
          person_id,
          DATE_ADD(competition.start_date, INTERVAL(-WEEKDAY(competition.start_date)) DAY) week_start_date,
          DATE_ADD(competition.start_date, INTERVAL(6-WEEKDAY(competition.start_date)) DAY) week_end_date,
          GROUP_CONCAT(
            CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')')
            ORDER BY competition.start_date ASC
            SEPARATOR ', '
          ) competition_links
        FROM (
          SELECT DISTINCT competition_id, person_id
          FROM results
        ) AS results
        JOIN competitions competition ON competition.id = competition_id
        GROUP BY person_id, week_start_date, week_end_date, YEAR(competition.start_date)
        HAVING attended_within_week >= 3
      ) AS comps_within_single_week_by_person
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      ORDER BY attended_within_week DESC, person.name
    `;
  }

  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(r => [
      r['attended_within_week'],
      r['person_link'],
      formatDateNbsp(r['week_start_date'] as Date),
      formatDateNbsp(r['week_end_date'] as Date),
      r['competition_links'],
    ]);
  }
}
