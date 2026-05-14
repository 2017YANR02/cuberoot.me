// NOTE: RoundMetric 抽象基类——从一轮的所有 attempt 中计算衍生指标
// 产出双视图 JSON：排名（ranking）+ WR 历史（history）
// 子类只需实现 computeMetric(values, row) 方法即可
//
// NOTE: 一次性计算模式——第一个 batch 子类运行时，为所有 batch 子类
// 按 (valueColumn, targetEvents) 分组，逐 event 查询一次 MySQL，
// 同组每个子类的 computeMetric 共享同一份数据计算排名。
import { GroupedStatistic } from './grouped_statistic.js';
import { EVENTS_WITH_AVERAGE, EVENTS_WITH_AO5, OFFICIAL_EVENTS_RECORD, EVENTS, headerZh, eventZh } from './events.js';
import { SolveTime } from './solve_time.js';
import { ATTEMPTS_SUBQUERY, query as dbQuery } from './database.js';
import { formatDate, calcDays, filterWrHistory } from './format_date.js';
import type { StatJson, StatPanel, Alignment, TableHeader } from './statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 标准排名表头
const RANKING_HEADER: TableHeader = {
  '#': 'right', 'Person': 'left', 'Result': 'right',
  'Country': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
};

// --- 预计算排名缓存 ---
// 结构：className -> [eventName, top10Rows][]
let precomputedRankings: Map<string, [string, unknown[][]][]> | null = null;

// NOTE: 11 个 batchRanking=true 的子类定义
// JS 无法自动发现子类，硬编码 import 列表
// 所有 11 个子类都使用 (valueColumn='average', targetEvents=EVENTS_WITH_AO5)
const BATCH_SUBCLASS_IMPORTS = [
  { name: 'WrBao5',             module: () => import('../statistics/wr_bao5.js') },
  { name: 'WrWao5',             module: () => import('../statistics/wr_wao5.js') },
  { name: 'WrMo5',              module: () => import('../statistics/wr_mo5.js') },
  { name: 'WrBpa',              module: () => import('../statistics/wr_bpa.js') },
  { name: 'WrWpa',              module: () => import('../statistics/wr_wpa.js') },
  { name: 'WrMedian',           module: () => import('../statistics/wr_median.js') },
  { name: 'WrBestCounting',     module: () => import('../statistics/wr_best_counting.js') },
  { name: 'WrWorstCounting',    module: () => import('../statistics/wr_worst_counting.js') },
  { name: 'WrWorst',            module: () => import('../statistics/wr_worst.js') },
  { name: 'WrVariance',         module: () => import('../statistics/wr_variance.js') },
  { name: 'WrBestAverageRatio', module: () => import('../statistics/wr_best_average_ratio.js') },
] as const;

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

  // NOTE: transform 生成 WR 历史数据
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    const events = this.targetEvents();
    return Object.entries(events).map(([eventId, eventName]) => {
      const records = rows
        .filter(r => r['event_id'] === eventId && Number(r[this.valueColumn]) > 0);

      // NOTE: 对每条记录计算指标值
      const computed: Array<{ row: RowDataPacket; metric: number }> = [];
      for (const r of records) {
        const values = String(r['attempts'] || '').split(',').map(Number);
        const metric = this.computeMetric(values, r);
        if (metric !== null) computed.push({ row: r, metric });
      }

      // NOTE: filterWrHistory 内置日期排序（formatDate YYYY-MM-DD）+ <= minSoFar 过滤
      const wrRecords = filterWrHistory(
        computed,
        c => c.row['start_date'],
        c => c.metric,
      );

      const results = wrRecords.map((c, i) => {
        const metricStr = this.formatMetric(c.metric, eventId);
        const histRow = this.wrHistoryRow(wrRecords, i, eventId, c2 => c2.metric);
        return [metricStr, ...histRow];
      });

      return [eventName, results.reverse()] as [string, unknown[][]];
    });
  }

  // NOTE: 排名数据——batch = true 走缓存/批量计算，batch = false 走两步 SQL
  async rankingData(): Promise<[string, unknown[][]][]> {
    if (this.batchRanking()) {
      // NOTE: 如果缓存为空，一次性为所有 batch 子类预计算排名
      if (!precomputedRankings) {
        await RoundMetric.precomputeAllRankings();
      }
      // NOTE: 从缓存取当前子类的排名数据
      const className = this.constructor.name;
      const cached = precomputedRankings!.get(className);
      if (cached) return cached;
      // NOTE: 缓存中没有（极端情况），回退到独立计算
      return this.computeBatchRanking();
    }
    return this.computeOwnRanking();
  }

  // NOTE: 一次性为所有 batch 子类预计算排名数据
  // 每个 event 只查 MySQL 一次，同组所有子类共享查询结果
  static async precomputeAllRankings(): Promise<void> {
    precomputedRankings = new Map();

    // NOTE: 动态导入所有 batch 子类，实例化用于 computeMetric
    const instances: Array<{ name: string; inst: RoundMetric }> = [];
    for (const def of BATCH_SUBCLASS_IMPORTS) {
      const mod = await def.module();
      const Cls = Object.values(mod).find(v => typeof v === 'function') as
        new () => RoundMetric;
      instances.push({ name: def.name, inst: new Cls() });
    }

    // NOTE: 初始化每个子类的结果容器
    for (const { name } of instances) {
      precomputedRankings.set(name, []);
    }

    // NOTE: 所有 11 个 batch 子类使用相同的 (valueColumn='average', targetEvents=EVENTS_WITH_AO5)
    // 因此只有一个分组，每个 event 只查一次
    const events = EVENTS_WITH_AO5;

    for (const [eventId, eventName] of Object.entries(events)) {
      // NOTE: 每个项目只查 MySQL 一次，11 个子类共享同一份数据
      const eventRows = await dbQuery<RowDataPacket[]>(
        `SELECT person_id, ${ATTEMPTS_SUBQUERY} AS attempts, average, best,
         CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
         person.country_id,
         CONCAT('[', c.cell_name, '](https://www.worldcubeassociation.org/competitions/', c.id, ')') competition_link,
         c.start_date
         FROM results result
         JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
         JOIN competitions c ON c.id = competition_id
         WHERE average > 0 AND event_id = '${eventId}'`,
      );

      // NOTE: 遍历每个子类，用各自的 computeMetric 计算排名
      for (const { name, inst } of instances) {
        const bestByPerson = new Map<string, { metric: number; row: RowDataPacket }>();
        for (const r of eventRows) {
          const values = String(r['attempts'] || '').split(',').map(Number);
          const metric = inst.computeMetric(values, r);
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
            const metricStr = inst.formatMetric(v.metric, eventId);
            const dateStr = formatDate(v.row['start_date']);
            const details = String(v.row['attempts'] || '').split(',')
              .map(a => new SolveTime(eventId, 'single', Number(a)).clockFormat())
              .filter(s => s.length > 0)
              .join(' ');
            return [i + 1, v.row['person_link'], metricStr, v.row['country_id'], dateStr, v.row['competition_link'], details];
          });

        precomputedRankings!.get(name)!.push([eventName, top]);
      }
      // NOTE: eventRows 在此 block 结束后可被 GC 回收
    }
  }

  // NOTE: 缓存清理——wr_metric 聚合完成后调用
  static clearPrecomputed(): void {
    precomputedRankings = null;
  }

  // NOTE: 覆写 toJson——输出 panels 而非 sections
  async toJson(): Promise<StatJson> {
    let rawRows: RowDataPacket[] | null = await this.queryResults();
    const historyData = this.transform(rawRows);
    // NOTE: 内存管理——transform 后释放原始查询结果
    rawRows = null;
    if (global.gc) global.gc();
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

  // NOTE: WR 历史行生成
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

    // NOTE: 天数——用共享 calcDays 工具
    const nextDateVal = i < records.length - 1 ? records[i + 1].row['start_date'] : null;
    const daysStr = calcDays(r.row['start_date'], nextDateVal);

    const dateStr = this.formatDate(r.row['start_date']);
    const details = customDetails ?? String(r.row['attempts'] || '').split(',')
      .map(v => new SolveTime(eventId, 'single', Number(v)).clockFormat())
      .filter(s => s.length > 0)
      .join(' ');

    return [gainStr, daysStr, r.row['person_link'], dateStr, r.row['competition_link'], details];
  }

  // NOTE: 独立批量排名计算——仅在缓存未命中时回退使用
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

  // NOTE: 日期格式化——委托共享工具
  protected formatDate(d: unknown): string {
    return formatDate(d);
  }
}
