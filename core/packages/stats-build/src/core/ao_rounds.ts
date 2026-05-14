// NOTE: AoRounds 抽象基类——跨轮次 average of averages
// AoXR = 一场比赛中某人恰好参加了 X 轮时，各轮 average 的均值
// 支持双视图 JSON：排名（ranking）+ WR 历史（history）
//
// NOTE: 一次性计算模式——第一个子类运行时，为 ROUND_COUNTS=[1,2,3,4]
// 四种 round_count 同时计算结果。每个 event 只查 MySQL 一次，
// 4 种 rc 共享同一份数据。
import { GroupedStatistic } from './grouped_statistic.js';
import { EVENTS_WITH_AVERAGE, headerZh, eventZh } from './events.js';
import { SolveTime } from './solve_time.js';
import { query as dbQuery } from './database.js';
import { formatDate, calcDays, filterWrHistory } from './format_date.js';
import type { StatJson, StatPanel, Alignment, TableHeader } from './statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 排名表头
const RANKING_HEADER: TableHeader = {
  '#': 'right', 'Person': 'left', 'Result': 'right',
  'Country': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
};

// NOTE: round_type_id 排序权重
const ROUND_SORT_ORDER: Record<string, number> = {
  '1': 1, 'd': 1, '2': 2, 'e': 2, '3': 3, 'g': 3, 'c': 99, 'f': 99,
};

// NOTE: 所有子类的 round_count 枚举——一次性为 4 种 rc 批量计算
const ROUND_COUNTS = [1, 2, 3, 4] as const;

// --- 预计算缓存 ---
// 结构：roundCount -> { historyData, rankingData }
interface AoRoundsCache {
  historyData: [string, unknown[][]][];
  rankingData: [string, unknown[][]][];
}
let precomputed: Map<number, AoRoundsCache> | null = null;

export abstract class AoRounds extends GroupedStatistic {
  // NOTE: 子类必须实现
  abstract roundCount(): number;

  constructor() {
    super();
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  // NOTE: 按 event_id 单独查询，避免全表加载
  private queryForEvent(eventId: string): string {
    return `
      SELECT
        result.event_id,
        result.average,
        result.round_type_id,
        result.competition_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.wca_id AS person_id,
        person.country_id,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE result.average > 0 AND result.event_id = '${eventId}'
      ORDER BY competition.start_date
    `;
  }

  query(): string { return ''; }  // NOTE: 不使用统一 query，逐 event 查询

  // NOTE: toJson() 覆写了整个流程，transform 不被调用，提供空实现满足抽象类
  transform(): [string, unknown[][]][] { return []; }

  // NOTE: 一次性为所有 round_count 预计算结果
  // 每个 event 只查 MySQL 一次，4 种 rc 共享同一份数据
  static async precomputeAllRoundCounts(): Promise<void> {
    precomputed = new Map();

    // NOTE: 初始化 4 种 rc 的结果容器
    for (const rc of ROUND_COUNTS) {
      precomputed.set(rc, { historyData: [], rankingData: [] });
    }

    const events = EVENTS_WITH_AVERAGE;

    for (const [eventId, eventName] of Object.entries(events)) {
      // NOTE: 每个项目只查 MySQL 一次，4 种 rc 共享
      const eventRows = await dbQuery<RowDataPacket[]>(`
        SELECT
          result.event_id,
          result.average,
          result.round_type_id,
          result.competition_id,
          CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
          person.wca_id AS person_id,
          person.country_id,
          CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
          competition.start_date
        FROM results result
        JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
        JOIN competitions competition ON competition.id = result.competition_id
        WHERE result.average > 0 AND result.event_id = '${eventId}'
        ORDER BY competition.start_date
      `);

      // NOTE: 先做一次分组（最耗时），4 种 rc 共用
      const grouped = new Map<string, { rows: RowDataPacket[]; meta: RowDataPacket }>();
      for (const r of eventRows) {
        const key = `${r['competition_id']}:${r['person_id']}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.rows.push(r);
        } else {
          grouped.set(key, { rows: [r], meta: r });
        }
      }

      // NOTE: 对每种 rc 筛选、计算排名和 WR 历史
      for (const rc of ROUND_COUNTS) {
        const computed = filterAndCompute(grouped, rc);
        const ranking = buildRanking(computed, eventId);
        const history = buildWrHistory(computed, eventId);
        precomputed.get(rc)!.rankingData.push([eventName, ranking]);
        precomputed.get(rc)!.historyData.push([eventName, history]);
      }
      // NOTE: eventRows 和 grouped 在此 block 结束后可被 GC 回收
    }
  }

  // NOTE: 缓存清理——wr_aoxr 聚合完成后调用
  static clearPrecomputed(): void {
    precomputed = null;
  }

  // NOTE: 覆写 toJson——双视图 panels 输出
  async toJson(): Promise<StatJson> {
    const rc = this.roundCount();

    // NOTE: 如果缓存为空，一次性为所有 round_count 预计算
    if (!precomputed) {
      await AoRounds.precomputeAllRoundCounts();
    }

    const cached = precomputed!.get(rc);
    let historyData: [string, unknown[][]][];
    let rankingData: [string, unknown[][]][];

    if (cached) {
      // NOTE: 缓存命中——直接使用预计算结果
      historyData = cached.historyData;
      rankingData = cached.rankingData;
    } else {
      // NOTE: 缓存未命中（极端情况）——回退到独立计算
      const result = await this.computeIndependently();
      historyData = result.historyData;
      rankingData = result.rankingData;
    }

    // NOTE: 构建 panels
    const historyHeaderEntries = Object.entries(this.tableHeader);
    const rankingHeaderEntries = Object.entries(RANKING_HEADER);

    const buildSections = (data: [string, unknown[][]][]) =>
      data.filter(([, rows]) => rows.length > 0)
        .map(([title, rows]) => ({ title, titleZh: eventZh(title), rows }));

    const panels: StatPanel[] = [
      {
        id: 'ranking', labelEn: 'Ranking', labelZh: '排名',
        header: rankingHeaderEntries.map(([label, align]) => ({
          key: label.toLowerCase().replace(/\s+/g, '_'),
          label, labelZh: headerZh(label), align,
        })),
        sections: buildSections(rankingData),
      },
      {
        id: 'history', labelEn: 'History', labelZh: '历史',
        header: historyHeaderEntries.map(([label, align]) => ({
          key: label.toLowerCase().replace(/\s+/g, '_'),
          label, labelZh: headerZh(label), align,
        })),
        sections: buildSections(historyData),
      },
    ];

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh || this.title,
      ...(this.note ? { note: this.note } : {}),
      ...(this.noteZh ? { noteZh: this.noteZh } : {}),
      header: [],
      panels,
    };
  }

  // NOTE: 回退独立计算——仅在缓存未命中时使用
  private async computeIndependently(): Promise<AoRoundsCache> {
    const events = EVENTS_WITH_AVERAGE;
    const rc = this.roundCount();
    const historyData: [string, unknown[][]][] = [];
    const rankingData: [string, unknown[][]][] = [];

    for (const [eventId, eventName] of Object.entries(events)) {
      const eventRows = await dbQuery<RowDataPacket[]>(this.queryForEvent(eventId));

      const grouped = new Map<string, { rows: RowDataPacket[]; meta: RowDataPacket }>();
      for (const r of eventRows) {
        const key = `${r['competition_id']}:${r['person_id']}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.rows.push(r);
        } else {
          grouped.set(key, { rows: [r], meta: r });
        }
      }

      const computed = filterAndCompute(grouped, rc);
      const ranking = buildRanking(computed, eventId);
      const history = buildWrHistory(computed, eventId);
      rankingData.push([eventName, ranking]);
      historyData.push([eventName, history]);
    }

    return { historyData, rankingData };
  }
}

// --- 辅助函数 ---

interface ComputedEntry {
  metric: number;
  roundValues: number[];
  meta: RowDataPacket;
}

// NOTE: 从已分组数据中筛选恰好有 rc 条记录的组，计算 AoXR
function filterAndCompute(
  grouped: Map<string, { rows: RowDataPacket[]; meta: RowDataPacket }>,
  rc: number,
): ComputedEntry[] {
  const result: ComputedEntry[] = [];
  for (const [, info] of grouped) {
    if (info.rows.length !== rc) continue;
    const sorted = info.rows.sort((a, b) =>
      (ROUND_SORT_ORDER[String(a['round_type_id'])] ?? 50)
      - (ROUND_SORT_ORDER[String(b['round_type_id'])] ?? 50));
    const values = sorted.map(r => Number(r['average']));
    const avg = values.reduce((s, v) => s + v, 0) / rc;
    result.push({ metric: avg, roundValues: values, meta: info.meta });
  }
  return result;
}

// NOTE: 每人最佳 metric，按项目排 top 10
function buildRanking(computed: ComputedEntry[], eventId: string): unknown[][] {
  const bestByPerson = new Map<string, ComputedEntry>();
  for (const c of computed) {
    const pid = String(c.meta['person_id']);
    const existing = bestByPerson.get(pid);
    if (!existing || c.metric < existing.metric) {
      bestByPerson.set(pid, c);
    }
  }

  return [...bestByPerson.values()]
    .sort((a, b) => a.metric - b.metric)
    .slice(0, 10)
    .map((v, i) => {
      const metricStr = new SolveTime(eventId, 'average', Math.round(v.metric)).clockFormat();
      const detailsCsv = v.roundValues
        .map(val => new SolveTime(eventId, 'average', val).clockFormat())
        .join(',');
      const dateStr = formatDate(v.meta['start_date']);
      return [i + 1, v.meta['person_link'], metricStr, v.meta['country_id'], dateStr, v.meta['competition_link'], { _type: 'solves' as const, csv: detailsCsv }];
    });
}

// NOTE: WR 历史——按日期正序扫描，只保留刷新最小值的记录
function buildWrHistory(computed: ComputedEntry[], eventId: string): unknown[][] {
  // NOTE: filterWrHistory 内置 formatDate 日期排序（YYYY-MM-DD）+ 同日期大值先扫描 + <= minSoFar
  // strict: true 保持原来的 < minSoFar 语义（AoXR 不含平 WR）
  const wrRecords = filterWrHistory(
    computed,
    c => c.meta['start_date'],
    c => c.metric,
    { strict: true },
  );

  const historyRows = wrRecords.map((c, i) => {
    const metricStr = new SolveTime(eventId, 'average', Math.round(c.metric)).clockFormat();
    const detailsCsv = c.roundValues
      .map(v => new SolveTime(eventId, 'average', v).clockFormat())
      .join(',');

    // NOTE: 进步百分比
    let gainStr = '';
    if (i > 0) {
      const prev = wrRecords[i - 1].metric;
      gainStr = `${((prev - c.metric) / prev * 100).toFixed(1)}%`;
    }

    // NOTE: 天数——用共享 calcDays 工具
    const nextDateVal = i < wrRecords.length - 1 ? wrRecords[i + 1].meta['start_date'] : null;
    const daysStr = calcDays(c.meta['start_date'], nextDateVal);

    const dateStr = formatDate(c.meta['start_date']);
    return [metricStr, gainStr, daysStr, c.meta['person_link'], dateStr, c.meta['competition_link'], { _type: 'solves' as const, csv: detailsCsv }];
  });

  return historyRows.reverse();
}
