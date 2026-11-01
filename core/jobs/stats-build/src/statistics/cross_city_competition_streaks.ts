import type { RowDataPacket } from 'mysql2';
import { Statistic } from '../core/statistic.js';

export class CrossCityCompetitionStreaks extends Statistic {
  constructor() {
    super();
    this.title = 'Cross-city competition streaks';
    this.titleZh = '跨城连续参赛（特种兵）';
    this.note = 'At least two competitions in different adjacent cities, with touching or overlapping date ranges. Each competition requires a positive attempt or DNF; DNS-only entries do not count. Competitions are ordered by start date, end date, then ID. Same-city entries or a gap of one full day break the streak. Cities use WCA country and normalized city names; missing or multi-location cities break the streak. Overlapping schedules do not establish actual attendance dates. Only complete streaks are listed.';
    this.noteZh = '至少两场，相邻比赛城市不同，完整赛期相接或重叠。每场须有正常成绩或 DNF，纯 DNS 不算参赛。按开始日期、结束日期、比赛 ID 排序；同城比赛或中间空一天会中断。城市按 WCA 国家和规范化城市名区分，缺失或多地点城市会中断。赛期重叠不代表已确认实际到场日期。每段完整行程仅列一次。';
    this.tableHeader = {
      Competitions: 'right', Person: 'left', 'City route': 'left',
      'Start date': 'left', 'End date': 'left', List: 'left', 'Schedule overlap': 'left',
    };
  }

  query(): string {
    return `
      WITH attended AS (
        SELECT DISTINCT r.person_id, r.competition_id
        FROM results r
        WHERE EXISTS (
          SELECT 1 FROM result_attempts a WHERE a.result_id = r.id
            AND (a.value > 0 OR a.value = -1)
        )
      ), visits AS (
        SELECT a.person_id, c.id AS competition_id, c.cell_name AS competition_name,
          c.country_id, c.city_name, c.start_date, c.end_date,
          CASE WHEN c.country_id IN ('XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW')
            OR TRIM(COALESCE(c.city_name, '')) = ''
            OR LOWER(c.city_name) LIKE '%multiple%'
            THEN NULL
            ELSE CONCAT(c.country_id, ':', LOWER(REGEXP_REPLACE(TRIM(c.city_name), '[[:space:]]+', ' ')))
          END AS city_key
        FROM attended a JOIN competitions c ON c.id = a.competition_id
      ), previous_visits AS (
        SELECT visits.*,
          LAG(city_key) OVER w AS previous_city,
          LAG(end_date) OVER w AS previous_end
        FROM visits
        WINDOW w AS (PARTITION BY person_id ORDER BY start_date, end_date, competition_id)
      ), numbered AS (
        SELECT previous_visits.*,
          SUM(CASE WHEN city_key IS NOT NULL AND previous_city IS NOT NULL
            AND BINARY city_key <> BINARY previous_city
            AND start_date <= DATE_ADD(previous_end, INTERVAL 1 DAY)
            THEN 0 ELSE 1 END) OVER (
              PARTITION BY person_id ORDER BY start_date, end_date, competition_id
              ROWS UNBOUNDED PRECEDING
            ) AS streak_id
        FROM previous_visits
      ), sized AS (
        SELECT numbered.*, COUNT(*) OVER (PARTITION BY person_id, streak_id) AS streak_size
        FROM numbered
      )
      SELECT s.person_id, p.name AS person_name, s.streak_id,
        s.competition_id, s.competition_name, s.country_id, s.city_name,
        DATE_FORMAT(s.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(s.end_date, '%Y-%m-%d') AS end_date
      FROM sized s JOIN persons p ON p.wca_id = s.person_id AND p.sub_id = 1
      WHERE s.streak_size >= 2
      ORDER BY s.streak_size DESC, s.person_id, s.streak_id,
        s.start_date, s.end_date, s.competition_id
    `;
  }

  transform(rows: RowDataPacket[]): unknown[][] {
    const streaks = new Map<string, RowDataPacket[]>();
    for (const row of rows) {
      const key = `${row.person_id}:${row.streak_id}`;
      const streak = streaks.get(key) ?? [];
      streak.push(row);
      streaks.set(key, streak);
    }
    return [...streaks.values()].map(streak => {
      const first = streak[0];
      const end = streak.reduce((latest, row) => row.end_date > latest ? row.end_date : latest, first.end_date);
      const overlaps = streak.some((row, i) => i > 0 && row.start_date <= streak[i - 1].end_date);
      return [
        streak.length,
        `[${first.person_name}](https://www.worldcubeassociation.org/persons/${first.person_id})`,
        streak.map(row => `${row.city_name} (${row.country_id})`).join(' → '),
        first.start_date, end,
        { _type: 'competition-itinerary', competitions: streak.map(row => ({
          id: row.competition_id, name: row.competition_name,
          startDate: row.start_date, endDate: row.end_date,
        })) },
        overlaps ? 'Overlapping schedules' : 'Non-overlapping schedules',
      ];
    });
  }
}
