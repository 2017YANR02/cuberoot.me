import { GroupedStatistic, type GroupedSection } from '../core/grouped_statistic.js';
import { EVENTS_ENTRIES } from '../core/events.js';
import type { RowDataPacket } from 'mysql2';

/** Count people before combining events; round rows are not individual solves. */
export class AnnualParticipation extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Annual participation and solves';
    this.titleZh = '每年参赛人数与还原盘数';
    this.note = 'People are unique WCA IDs with at least one attempt that year (including DNF, excluding DNS). All events deduplicates across events and includes discontinued events. Successful solves exclude DNF; attempts include DNF. A multi-blind attempt counts once. Years use competition start dates, including 1982. The latest year may be incomplete; figures reflect the database export.';
    this.noteZh = '人数按当年至少尝试一次的 WCA ID 去重（含 DNF，不含 DNS）；全部项目跨项目去重，包含已停办项目。成功还原不计 DNF，尝试盘数包含 DNF，均不计 DNS；多盲每次尝试计一盘。年份按比赛开始日期，包含 1982 年。最新年份可能尚未结束，数据截至数据库导出时。';
    this.tableHeader = { Year: 'right', People: 'right', 'Successful solves': 'right', Attempts: 'right' };
  }

  query(): string {
    return `
      WITH attempts AS (
        SELECT result_id, SUM(value > 0) AS solves, COUNT(*) AS attempts
        FROM result_attempts WHERE value > 0 OR value = -1 GROUP BY result_id
      ), participation AS (
        SELECT YEAR(c.start_date) AS year, r.event_id, r.person_id, a.solves, a.attempts
        FROM results r
        JOIN attempts a ON a.result_id = r.id
        JOIN competitions c ON c.id = r.competition_id
      )
      SELECT year, event_id, COUNT(DISTINCT person_id) AS people,
        SUM(solves) AS solves, SUM(attempts) AS attempts
      FROM participation GROUP BY year, event_id
      UNION ALL
      SELECT year, '' AS event_id, COUNT(DISTINCT person_id) AS people,
        SUM(solves) AS solves, SUM(attempts) AS attempts
      FROM participation GROUP BY year
      ORDER BY year, event_id
    `;
  }

  transform(rows: RowDataPacket[]): GroupedSection[] {
    return [['', 'All events'], ...EVENTS_ENTRIES].flatMap(([id, name]) => {
      const values = rows.filter(row => row.event_id === id).map(row =>
        [Number(row.year), Number(row.people), Number(row.solves), Number(row.attempts)]);
      return values.length ? [[name, values] as GroupedSection] : [];
    });
  }

  override async toJson() {
    const json = await super.toJson();
    const labels = ['年份', '参赛人数', '成功还原盘数', '尝试盘数'];
    json.header.forEach((column, i) => { column.labelZh = labels[i]; });
    const all = json.sections?.find(section => section.title === 'All events');
    if (all) all.titleZh = '全部项目';
    return json;
  }
}
