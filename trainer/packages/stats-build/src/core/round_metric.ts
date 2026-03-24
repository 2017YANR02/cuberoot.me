// NOTE: RoundMetric 抽象基类——从一轮的所有 attempt 中计算衍生指标
// 与 Ruby _stats_build/statistics/abstract/round_metric.rb 1:1 对应
// 产出双视图 JSON：排名（ranking）+ WR 历史（history）
// 子类只需实现 computeMetric(values, row) 方法即可
import { GroupedStatistic } from './grouped_statistic.js';
import { EVENTS_WITH_AVERAGE, EVENTS_WITH_AO5, OFFICIAL_EVENTS_RECORD, EVENTS, headerZh, eventZh } from './events.js';
import { SolveTime } from './solve_time.js';
import { ATTEMPTS_SUBQUERY, query as dbQuery } from './database.js';
import type { StatJson, StatPanel, Alignment, TableHeader } from './statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 标准排名表头（与 Ruby StatPanel::RANKING_HEADER 对应 + Details 列）
const RANKING_HEADER: TableHeader = {
  '#': 'right', 'Person': 'left', 'Result': 'right',
  'Country': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
};

export abstract class RoundMetric extends GroupedStatistic {
  // NOTE: 子类可覆写的钩子方法（提供默认值）
  protected wrRecordColumn = 'regional_average_record';
  protected valueColumn = 'average';
  protected valueType: 'single' | 'average' = 'average';

  // NOTE: 子类必须实现——从 attempt 值数组中计算指标值
  abstract computeMetric(values: number[], row: RowDataPacket): number | null;

  // NOTE: 子类可覆写——格式化指标值为显示字符串
  formatMetric(metricValue: number, eventId: string): string {
    return new SolveTime(eventId, 'single', Math.round(metricValue)).clockFormat();
  }

  // NOTE: 子类可覆写——决定哪些项目参与排名
  targetEvents(): Record<string, string> {
    return EVENTS_WITH_AVERAGE;
  }

  // NOTE: 子类可覆写——是否参与批量排名计算
  // batch = true 时加载全量数据用 computeMetric 计算排名
  // batch = false 时用高效两步 SQL（metric = 原始字段值的子类，如 Single/Average）
  batchRanking(): boolean {
    return true;
  }

  // NOTE: WR 历史查询 SQL
  query(): string {
    return `
      SELECT
        result.event_id,
        average,
        best,
        ${ATTEMPTS_SUBQUERY} AS attempts,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.name person_name,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.cell_name competition_name,
        competition.id competition_id,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE ${this.wrRecordColumn} = 'WR'
      ORDER BY competition.start_date
    `;
  }

  // NOTE: transform 生成 WR 历史数据（与 Ruby transform 1:1 对应）
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    const events = this.targetEvents();
    return Object.entries(events).map(([eventId, eventName]) => {
      const records = rows
        .filter(r => r['event_id'] === eventId && Number(r[this.valueColumn]) > 0)
        .sort((a, b) => {
          const da = String(a['start_date']);
          const db = String(b['start_date']);
          return da.localeCompare(db);
        });

      // NOTE: 对每条记录计算指标值
      const computed: Array<{ row: RowDataPacket; metric: number }> = [];
      for (const r of records) {
        const values = String(r['attempts'] || '').split(',').map(Number);
        const metric = this.computeMetric(values, r);
        if (metric !== null) computed.push({ row: r, metric });
      }

      // NOTE: <= 包含平 WR，同日期加 -metric 降序确保不遗漏
      computed.sort((a, b) => {
        const da = String(a.row['start_date']);
        const db = String(b.row['start_date']);
        return da.localeCompare(db) || b.metric - a.metric;
      });

      let minSoFar = Infinity;
      const wrRecords = computed.filter(c => {
        if (c.metric <= minSoFar) {
          minSoFar = c.metric;
          return true;
        }
        return false;
      });

      const results = wrRecords.map((c, i) => {
        const metricStr = this.formatMetric(c.metric, eventId);
        const histRow = this.wrHistoryRow(wrRecords, i, eventId, c2 => c2.metric);
        return [metricStr, ...histRow];
      });

      return [eventName, results.reverse()] as [string, unknown[][]];
    });
  }

  // NOTE: 排名数据——batch = true 走批量计算，batch = false 走两步 SQL
  async rankingData(): Promise<[string, unknown[][]][]> {
    if (this.batchRanking()) {
      return this.computeBatchRanking();
    }
    return this.computeOwnRanking();
  }

  // NOTE: 覆写 toJson——输出 panels 而非 sections
  async toJson(): Promise<StatJson> {
    const rawRows = await this.queryResults();
    const historyData = this.transform(rawRows);
    const rankingData = await this.rankingData();

    const historyHeader = Object.entries(this.tableHeader);
    const rankingHeader = Object.entries(RANKING_HEADER);

    const buildSections = (data: [string, unknown[][]][], header: [string, Alignment][]) => {
      return data
        .filter(([, rows]) => rows.length > 0)
        .map(([title, rows]) => ({ title, titleZh: eventZh(title), rows }));
    };

    const panels: StatPanel[] = [
      {
        id: 'ranking',
        labelEn: 'Ranking',
        labelZh: '排名',
        header: rankingHeader.map(([label, align]) => ({
          key: label.toLowerCase().replace(/\s+/g, '_'),
          label, labelZh: headerZh(label), align,
        })),
        sections: buildSections(rankingData, rankingHeader),
      },
      {
        id: 'history',
        labelEn: 'History',
        labelZh: '历史',
        header: historyHeader.map(([label, align]) => ({
          key: label.toLowerCase().replace(/\s+/g, '_'),
          label, labelZh: headerZh(label), align,
        })),
        sections: buildSections(historyData, historyHeader),
      },
    ];

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh || this.title,
      ...(this.note ? { note: this.note } : {}),
      ...(this.noteZh ? { noteZh: this.noteZh } : {}),
      header: [],  // NOTE: panels 自带 header
      panels,
    };
  }

  // NOTE: WR 历史行生成——与 Ruby wr_history_row 1:1 对应
  // 返回: [gain_str, days_str, person_link, date_str, competition_link, details]
  protected wrHistoryRow<T extends { row: RowDataPacket }>(
    records: T[], i: number, eventId: string,
    getMetric: (r: T) => number,
    customDetails?: string,
  ): unknown[] {
    const r = records[i];

    // NOTE: 进步百分比
    let gainStr = '';
    if (i > 0) {
      const prevVal = getMetric(records[i - 1]);
      const currVal = getMetric(r);
      gainStr = `${((prevVal - currVal) / prevVal * 100).toFixed(1)}%`;
    }

    // NOTE: 天数——该纪录保持了多久
    let daysStr: string;
    if (i < records.length - 1) {
      const nextDate = new Date(String(records[i + 1].row['start_date']));
      const currDate = new Date(String(r.row['start_date']));
      daysStr = String(Math.round((nextDate.getTime() - currDate.getTime()) / 86400000));
    } else {
      const currDate = new Date(String(r.row['start_date']));
      daysStr = String(Math.round((Date.now() - currDate.getTime()) / 86400000));
    }

    const dateStr = this.formatDate(r.row['start_date']);
    const details = customDetails ?? String(r.row['attempts'] || '').split(',')
      .map(v => new SolveTime(eventId, 'single', Number(v)).clockFormat())
      .filter(s => s.length > 0)
      .join(', ');

    return [gainStr, daysStr, r.row['person_link'], dateStr, r.row['competition_link'], details];
  }

  // NOTE: 批量排名计算——加载全量数据用 computeMetric 计算每人最佳
  private async computeBatchRanking(): Promise<[string, unknown[][]][]> {
    const events = this.targetEvents();
    const result: [string, unknown[][]][] = [];

    for (const [eventId, eventName] of Object.entries(events)) {
      const vc = this.valueColumn;
      const eventRows = await dbQuery<RowDataPacket[]>(
        `SELECT person_id, ${ATTEMPTS_SUBQUERY} AS attempts, average, best,
         CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
         person.country_id,
         CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
         c.start_date
         FROM results result
         JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
         JOIN competitions c ON c.id = competition_id
         WHERE ${vc} > 0 AND event_id = '${eventId}'`,
      );

      // NOTE: 每人最佳 metric
      const bestByPerson = new Map<string, { metric: number; row: RowDataPacket }>();
      for (const r of eventRows) {
        const values = String(r['attempts'] || '').split(',').map(Number);
        const metric = this.computeMetric(values, r);
        if (metric === null) continue;
        const pid = String(r['person_id']);
        const existing = bestByPerson.get(pid);
        if (!existing || metric < existing.metric) {
          bestByPerson.set(pid, { metric, row: r });
        }
      }

      const top = [...bestByPerson.values()]
        .sort((a, b) => a.metric - b.metric)
        .slice(0, 10)
        .map((v, i) => {
          const metricStr = this.formatMetric(v.metric, eventId);
          const dateStr = this.formatDate(v.row['start_date']);
          const details = String(v.row['attempts'] || '').split(',')
            .map(a => new SolveTime(eventId, 'single', Number(a)).clockFormat())
            .filter(s => s.length > 0)
            .join(' ');
          return [i + 1, v.row['person_link'], metricStr, v.row['country_id'], dateStr, v.row['competition_link'], details];
        });

      result.push([eventName, top]);
    }

    return result;
  }

  // NOTE: 高效排名——两步 SQL（用于 batch = false 的子类）
  private async computeOwnRanking(): Promise<[string, unknown[][]][]> {
    const events = this.targetEvents();
    const result: [string, unknown[][]][] = [];

    for (const [eventId, eventName] of Object.entries(events)) {
      const vc = this.valueColumn;

      // Step 1: SQL 聚合找每人最佳
      const topPersons = await dbQuery<RowDataPacket[]>(
        `SELECT person_id, MIN(${vc}) as min_val
         FROM results
         WHERE ${vc} > 0 AND event_id = '${eventId}'
         GROUP BY person_id
         ORDER BY min_val
         LIMIT 10`,
      );

      if (topPersons.length === 0) {
        result.push([eventName, []]);
        continue;
      }

      const personIds = topPersons.map(r => `'${r['person_id']}'`).join(',');

      // Step 2: 取详细信息
      const details = await dbQuery<RowDataPacket[]>(
        `SELECT r.person_id, r.${vc},
         (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number) FROM result_attempts ra WHERE ra.result_id = r.id) AS attempts,
         CONCAT('[', p.name, '](https://www.worldcubeassociation.org/persons/', p.wca_id, ')') person_link,
         p.country_id,
         CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
         c.start_date
         FROM results r
         JOIN persons p ON p.wca_id = r.person_id AND p.sub_id = 1
         JOIN competitions c ON c.id = r.competition_id
         WHERE r.${vc} > 0 AND r.event_id = '${eventId}'
         AND r.person_id IN (${personIds})`,
      );

      // NOTE: 每人最佳
      const bestByPerson = new Map<string, RowDataPacket>();
      for (const r of details) {
        const pid = String(r['person_id']);
        const existing = bestByPerson.get(pid);
        if (!existing || Number(r[vc]) < Number(existing[vc])) {
          bestByPerson.set(pid, r);
        }
      }

      const top = [...bestByPerson.values()]
        .sort((a, b) => Number(a[vc]) - Number(b[vc]))
        .slice(0, 10)
        .map((r, i) => {
          const valStr = this.formatMetric(Number(r[vc]), eventId);
          const dateStr = this.formatDate(r['start_date']);
          const detailsStr = String(r['attempts'] || '').split(',')
            .map(a => new SolveTime(eventId, 'single', Number(a)).clockFormat())
            .filter(s => s.length > 0)
            .join(' ');
          return [i + 1, r['person_link'], valStr, r['country_id'], dateStr, r['competition_link'], detailsStr];
        });

      result.push([eventName, top]);
    }

    return result;
  }

  // NOTE: 日期格式化辅助
  protected formatDate(d: unknown): string {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d || '').slice(0, 10);
  }
}
