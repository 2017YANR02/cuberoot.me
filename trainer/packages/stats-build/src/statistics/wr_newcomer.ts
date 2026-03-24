// NOTE: Newcomer——新人统计合并页
// 与 Ruby _stats_build/statistics/wr_newcomer.rb 1:1 对应
// 两个维度:
//   1) 指标 (metric): Single / Average
//   2) 数据源 (source): 首次还原 (1st-solve) / 首场比赛 (1st-comp)
// 每种组合有 Current Ranking + History 双视图
// 三层嵌套：MetricPanel → SourcePanel → StatPanel
import { Statistic } from '../core/statistic.js';
import { EVENTS, OFFICIAL_EVENTS_RECORD, headerZh, eventZh } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { query as dbQuery, getPool } from '../core/database.js';
import type { StatJson, StatPanel, SourcePanel, MetricPanel, StatSection, TableHeader } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 指标维度
const METRICS = [
  { label: 'Single', labelZh: '单次', id: 'single', type: 'single' as const },
  { label: 'Avg',    labelZh: '平均', id: 'average', type: 'average' as const },
] as const;

// NOTE: 数据源维度
const SOURCES = [
  { label: '1st Solve', labelZh: '首次还原', id: '1st-solve' },
  { label: '1st Comp',  labelZh: '首场比赛', id: '1st-comp' },
] as const;

// NOTE: Ranking 表头
const RANKING_HEADER: TableHeader = {
  '#': 'right', 'Person': 'left', 'Result': 'right',
  'Country': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
};

// NOTE: History 表头
const HISTORY_HEADER: TableHeader = {
  'Result': 'right', 'Improvement': 'right', 'Days': 'right',
  'Person': 'left', 'Date': 'left', 'Competition': 'left',
};

export class WrNewcomer extends Statistic {
  constructor() {
    super();
    this.title = 'Newcomer';
    this.titleZh = '新人';
    this.note = "Shows the best results from a person's very first competition for each event.";
    this.noteZh = '展示每位选手在各项目首场比赛的最佳成绩。';
  }

  query(): string { return ''; }

  async toJson(): Promise<StatJson> {
    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      // NOTE: 创建临时表缓存每人每项目的首场比赛日期
      await conn.query('DROP TEMPORARY TABLE IF EXISTS tmp_first_comp');
      await conn.query(`
        CREATE TEMPORARY TABLE tmp_first_comp AS
        SELECT r.person_id, r.event_id, MIN(c.start_date) AS earliest_date
        FROM results r
        JOIN competitions c ON c.id = r.competition_id
        GROUP BY r.person_id, r.event_id
      `);
      await conn.query(
        'ALTER TABLE tmp_first_comp ADD INDEX idx_pid_eid_date (person_id, event_id, earliest_date)',
      );

      const metricPanels: MetricPanel[] = [];

      for (const metric of METRICS) {
        const sourcePanels: SourcePanel[] = [];

        for (const source of SOURCES) {
          // NOTE: 按数据源类型查询
          const grouped = source.id === '1st-solve'
            ? await this.fetchFirstRoundData(conn, metric)
            : await this.fetchFirstCompData(conn, metric);

          const ranking = this.buildRanking(grouped, metric);
          const history = this.buildHistory(grouped, metric);

          const buildHeader = (header: TableHeader) =>
            Object.entries(header).map(([label, align]) => ({
              key: label.toLowerCase().replace(/\s+/g, '_'),
              label, labelZh: headerZh(label), align,
            }));

          const panels: StatPanel[] = [
            {
              id: 'ranking', labelEn: 'Ranking', labelZh: '排名',
              header: buildHeader(RANKING_HEADER),
              sections: ranking,
            },
            {
              id: 'history', labelEn: 'History', labelZh: '历史',
              header: buildHeader(HISTORY_HEADER),
              sections: history,
            },
          ];

          sourcePanels.push({
            id: `${metric.id}-${source.id}`,
            labelEn: source.label,
            labelZh: source.labelZh,
            panels,
          });
        }

        metricPanels.push({
          id: metric.id,
          labelEn: metric.label,
          labelZh: metric.labelZh,
          sourcePanels,
        });
      }

      return {
        id: this.id,
        title: this.title,
        titleZh: this.titleZh || this.title,
        ...(this.note ? { note: this.note } : {}),
        ...(this.noteZh ? { noteZh: this.noteZh } : {}),
        header: [],
        metricPanels,
      };
    } finally {
      conn.release();
    }
  }

  // NOTE: 数据源 1——首次还原（首场比赛第一轮第一个 attempt / average）
  // 与 Ruby fetch_first_round_data 1:1 对应
  private async fetchFirstRoundData(
    conn: import('mysql2/promise').PoolConnection,
    metric: typeof METRICS[number],
  ): Promise<Map<string, RowDataPacket[]>> {
    const col = metric.type === 'single'
      ? 'ra.value' : 'r.average';
    const joinRa = metric.type === 'single'
      ? 'JOIN result_attempts ra ON ra.result_id = r.id AND ra.attempt_number = 1'
      : '';
    const filter = metric.type === 'single'
      ? 'ra.value > 0' : 'r.average > 0';

    const sql = `
      SELECT
        fr.event_id,
        fr.first_result,
        (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number)
         FROM result_attempts ra WHERE ra.result_id = fr.result_id) AS attempts,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        p.country_id,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date
      FROM (
        SELECT r.person_id, r.event_id, ${col} AS first_result, r.competition_id, r.id AS result_id,
               ROW_NUMBER() OVER (PARTITION BY r.person_id, r.event_id ORDER BY
                 CASE WHEN r.round_type_id IN ('1','0','d') THEN 0 ELSE 1 END
               ) AS rn
        FROM results r
        ${joinRa}
        JOIN competitions c1 ON c1.id = r.competition_id
        JOIN tmp_first_comp fc ON fc.person_id = r.person_id
             AND fc.event_id = r.event_id
             AND c1.start_date = fc.earliest_date
        WHERE ${filter}
      ) fr
      JOIN persons p ON p.wca_id = fr.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = fr.competition_id
      WHERE fr.rn = 1
      ORDER BY fr.event_id, fr.first_result
    `;

    const [rows] = await conn.query<RowDataPacket[]>(sql);
    return this.groupBy(rows, 'event_id');
  }

  // NOTE: 数据源 2——首场比赛（所有轮次的 MIN(best) / MIN(average)）
  // 与 Ruby fetch_first_comp_data 1:1 对应
  private async fetchFirstCompData(
    conn: import('mysql2/promise').PoolConnection,
    metric: typeof METRICS[number],
  ): Promise<Map<string, RowDataPacket[]>> {
    const col = metric.type === 'single' ? 'best' : 'average';
    const filter = metric.type === 'single' ? 'r.best > 0' : 'r.average > 0';

    const sql = `
      SELECT
        fr.event_id,
        fr.first_result,
        (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number)
         FROM result_attempts ra WHERE ra.result_id = fr.result_id) AS attempts,
        CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
        p.country_id,
        CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
        c.start_date
      FROM (
        SELECT r.person_id, r.event_id, r.${col} AS first_result, r.competition_id, r.id AS result_id,
               ROW_NUMBER() OVER (PARTITION BY r.person_id, r.event_id ORDER BY r.${col}) AS rn
        FROM results r
        JOIN competitions c1 ON c1.id = r.competition_id
        JOIN tmp_first_comp fc ON fc.person_id = r.person_id
             AND fc.event_id = r.event_id
             AND c1.start_date = fc.earliest_date
        WHERE ${filter}
      ) fr
      JOIN persons p ON p.wca_id = fr.person_id AND p.sub_id = 1
      JOIN competitions c ON c.id = fr.competition_id
      WHERE fr.rn = 1
      ORDER BY fr.event_id, fr.first_result
    `;

    const [rows] = await conn.query<RowDataPacket[]>(sql);
    return this.groupBy(rows, 'event_id');
  }

  // NOTE: Current Ranking（每项目 Top 10）
  // 与 Ruby build_ranking 1:1 对应
  private buildRanking(
    grouped: Map<string, RowDataPacket[]>,
    metric: typeof METRICS[number],
  ): StatSection[] {
    return Object.entries(OFFICIAL_EVENTS_RECORD).map(([eventId, eventName]) => {
      const eventRows = (grouped.get(eventId) || []).slice(0, 10);
      const rows = eventRows.map((r, i) => {
        const resultStr = new SolveTime(eventId, metric.type, Number(r['first_result'])).clockFormat();
        const dateStr = this.formatDate(r['start_date']);
        const details = String(r['attempts'] || '').split(',')
          .map(v => new SolveTime(eventId, 'single', Number(v)).clockFormat())
          .filter(s => s.length > 0)
          .join(' ');
        return [i + 1, r['person_link'], resultStr, r['country_id'], dateStr, r['competition_link'], details];
      });
      return { title: eventName, titleZh: eventZh(eventName), rows };
    }).filter(s => s.rows.length > 0);
  }

  // NOTE: History（严格递减序列，最新在最上面）
  // 与 Ruby build_history 1:1 对应
  private buildHistory(
    grouped: Map<string, RowDataPacket[]>,
    metric: typeof METRICS[number],
  ): StatSection[] {
    return Object.entries(OFFICIAL_EVENTS_RECORD).map(([eventId, eventName]) => {
      const all = [...(grouped.get(eventId) || [])]
        .sort((a, b) => {
          const da = this.formatDate(a['start_date']);
          const db = this.formatDate(b['start_date']);
          const dc = da.localeCompare(db);
          return dc !== 0 ? dc : Number(a['first_result']) - Number(b['first_result']);
        });

      // NOTE: 严格递减扫描
      let minSoFar = Infinity;
      const nwr = all.filter(r => {
        const val = Number(r['first_result']);
        if (val < minSoFar) {
          minSoFar = val;
          return true;
        }
        return false;
      });

      const rows = nwr.map((r, i) => {
        const resultStr = new SolveTime(eventId, metric.type, Number(r['first_result'])).clockFormat();

        let gainStr = '';
        if (i > 0) {
          const prevVal = Number(nwr[i - 1]['first_result']);
          const currVal = Number(r['first_result']);
          gainStr = `${((prevVal - currVal) / prevVal * 100).toFixed(1)}%`;
        }

        let daysStr: string;
        if (i < nwr.length - 1) {
          const nextDate = new Date(this.formatDate(nwr[i + 1]['start_date']));
          const currDate = new Date(this.formatDate(r['start_date']));
          daysStr = String(Math.round((nextDate.getTime() - currDate.getTime()) / 86400000));
        } else {
          const currDate = new Date(this.formatDate(r['start_date']));
          daysStr = String(Math.round((Date.now() - currDate.getTime()) / 86400000));
        }

        const dateStr = this.formatDate(r['start_date']);
        return [resultStr, gainStr, daysStr, r['person_link'], dateStr, r['competition_link']];
      }).reverse();

      return { title: eventName, titleZh: eventZh(eventName), rows };
    }).filter(s => s.rows.length > 0);
  }

  private groupBy(rows: RowDataPacket[], key: string): Map<string, RowDataPacket[]> {
    const map = new Map<string, RowDataPacket[]>();
    for (const r of rows) {
      const k = String(r[key]);
      const existing = map.get(k);
      if (existing) existing.push(r);
      else map.set(k, [r]);
    }
    return map;
  }

  private formatDate(d: unknown): string {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d || '').slice(0, 10);
  }
}
