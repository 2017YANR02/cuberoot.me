// NOTE: 333mbf/333mbo Mo3 平均值
// 与 Ruby _stats_build/statistics/mbf_average.rb 1:1 对应
// 333mbf：从 DB 计算 Mo3，WCA 编码 0DDTTTTTMM，DD/TTTTT/MM 分别取均值（ROUND）后拼接
// 333mbo：历史上仅 1 人完成过 3 轮，硬编码数据
// 此类同时作为独立统计页面和数据提供者（供 WrAverageHistory 委托）
import { formatDate, calcDays, filterWrHistory } from '../core/format_date.js';
import { Statistic } from '../core/statistic.js';
import { EVENTS, headerZh, eventZh } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { ATTEMPTS_SUBQUERY } from '../core/database.js';
import type { StatJson, StatPanel, StatSection, TableHeader } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 排名表头（6 列，与 Ruby StatPanel RANKING_HEADER 对应 + Details）
const RANKING_HEADER: TableHeader = {
  '#': 'right', 'Person': 'left', 'Mo3': 'right',
  'Country': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
};

// NOTE: 历史表头（7 列，含 Details）——独立页面使用
const HISTORY_HEADER: TableHeader = {
  'Mo3': 'right', 'Improvement': 'right', 'Days': 'right',
  'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
};

// NOTE: 333mbo 历史上仅 Constantin Ceausu 在 ECC 2006 完成过 Mo3
// 三次成绩均无时间记录（旧格式不记录时间），硬编码显示字符串
const MBO_EVENT_NAME = EVENTS['333mbo'];
const MBO_PERSON_LINK = '[Constantin Ceausu](https://www.worldcubeassociation.org/persons/2003CEAU01)';
const MBO_COMPETITION_LINK = '[European Championship 2006](https://www.worldcubeassociation.org/competitions/Euro2006)';
const MBO_DATE = '2006-09-23';
const MBO_DETAILS = '3/3 ?:??:??, 4/5 ?:??:??, 2/4 ?:??:??';
const MBO_MO3 = '3/4 ?:??:??';

// NOTE: 333mbo 排名数据
const MBO_RANKING: unknown[][] = [[1, MBO_PERSON_LINK, MBO_MO3, 'Romania', MBO_DATE, MBO_COMPETITION_LINK]];
// NOTE: 历史只有 1 条
const MBO_HISTORY: unknown[][] = [[MBO_MO3, '', '7000+', MBO_PERSON_LINK, MBO_DATE, MBO_COMPETITION_LINK, MBO_DETAILS]];

export class MbfAverage extends Statistic {
  // NOTE: 缓存数据——供 historyFor/rankingFor 方法使用
  private _mbfHistory: unknown[][] = [];
  private _mbfRanking6col: unknown[][] = [];
  private _ranking: Record<string, unknown[][]> = {};
  private _computed = false;

  constructor() {
    super();
    this.title = '3x3x3 Multi-Blind Mo3';
    this.titleZh = '3x3x3 多盲 Mo3';
    this.note = 'Unofficial Mo3 for 333mbf (not tracked by WCA). ' +
      'The WCA value 0DDTTTTTMM is split into DD (99 minus difference), ' +
      'TTTTT (time in seconds), and MM (missed). ' +
      'Each part is averaged across 3 attempts and rounded to the nearest integer, ' +
      'then reassembled into a single value for ranking. ' +
      '333mbo data is hardcoded (only one person has ever completed a Mo3).';
    this.noteZh = '333mbf 的非官方 Mo3（WCA 不追踪此指标）。' +
      'WCA 编码值 0DDTTTTTMM 被拆分为 DD（99 减差值）、TTTTT（秒数）和 MM（失败数）。' +
      '三次尝试各部分分别取均值并四舍五入后重新拼接，用于排名。' +
      '333mbo 数据为硬编码（历史上仅有一人完成过 Mo3）。';
    this.tableHeader = HISTORY_HEADER;
  }

  query(): string {
    return `
      SELECT
        ${ATTEMPTS_SUBQUERY} AS attempts,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.name person_name,
        result.person_id,
        person.country_id,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE result.event_id = '333mbf'
      ORDER BY competition.start_date
    `;
  }

  // NOTE: DD/TTTTT/MM 分别取均值后拼接——与 Ruby mbf_mo3 1:1 对应
  private mbfMo3(v1: number, v2: number, v3: number): number {
    const vals = [v1, v2, v3];
    const dd = Math.round(vals.reduce((s, v) => s + Math.floor(v / 10_000_000), 0) / 3);
    const ttttt = Math.round(vals.reduce((s, v) => s + Math.floor(v / 100) % 100_000, 0) / 3);
    const mm = Math.round(vals.reduce((s, v) => s + v % 100, 0) / 3);
    return dd * 10_000_000 + ttttt * 100 + mm;
  }

  private formatMo3(mo3Value: number): string {
    return new SolveTime('333mbf', 'single', mo3Value).clockFormat();
  }

  // NOTE: 执行核心计算——同时生成 ranking 和 history 数据
  private async computeData(): Promise<void> {
    if (this._computed) return;
    let queryResults: RowDataPacket[] | null = await this.queryResults();

    // --- 333mbf ---
    const computed: Array<{
      row: RowDataPacket; metric: number;
      v1: number; v2: number; v3: number;
    }> = [];

    for (const r of queryResults) {
      const vals = String(r['attempts'] || '').split(',').map(Number);
      // NOTE: Mo3 需要恰好 3 个正值 attempt
      if (vals.length < 3 || vals[0] <= 0 || vals[1] <= 0 || vals[2] <= 0) continue;
      const [v1, v2, v3] = vals;
      const mo3 = this.mbfMo3(v1, v2, v3);
      computed.push({ row: r, metric: mo3, v1, v2, v3 });
    }
    // NOTE: 照搬 Ruby 内存管理——遍历完成后释放原始查询结果
    queryResults = null;
    if (global.gc) global.gc();

    // NOTE: filterWrHistory 内置日期排序 + <= minSoFar 过滤
    const wrRecords = filterWrHistory(
      computed,
      c => c.row['start_date'],
      c => c.metric,
    );

    this._mbfHistory = wrRecords.map((c, i) => {
      const mo3Str = this.formatMo3(c.metric);
      // NOTE: 进步列用 points 差值，百分比对复合编码无意义
      const currPts = new SolveTime('333mbf', 'single', c.metric).points;
      let gainStr = '';
      if (i > 0) {
        const prevPts = new SolveTime('333mbf', 'single', wrRecords[i - 1].metric).points;
        gainStr = `+${currPts - prevPts} pts`;
      }

      const nextDateVal = i < wrRecords.length - 1 ? wrRecords[i + 1].row['start_date'] : null;
      const daysStr = calcDays(c.row['start_date'], nextDateVal);

      const dateStr = formatDate(c.row['start_date']);
      const details = [c.v1, c.v2, c.v3]
        .map(v => new SolveTime('333mbf', 'single', v).clockFormat())
        .join(', ');

      return [mo3Str, gainStr, daysStr, c.row['person_link'], dateStr, c.row['competition_link'], details];
    }).reverse();

    // Ranking（每人最佳 Mo3，含 Details）
    const bestByPerson = new Map<string, typeof computed[0]>();
    for (const c of computed) {
      const pid = String(c.row['person_id']);
      const existing = bestByPerson.get(pid);
      if (!existing || c.metric < existing.metric) {
        bestByPerson.set(pid, c);
      }
    }

    const mbfRanking7col = [...bestByPerson.values()]
      .sort((a, b) => a.metric - b.metric)
      .slice(0, 10)
      .map((v, i) => {
        const mo3Str = this.formatMo3(v.metric);
        const dateStr = formatDate(v.row['start_date']);
        const details = [v.v1, v.v2, v.v3]
          .map(val => new SolveTime('333mbf', 'single', val).clockFormat())
          .join(', ');
        return [i + 1, v.row['person_link'], mo3Str, v.row['country_id'], dateStr, v.row['competition_link'], details];
      });

    // NOTE: 缓存供 historyFor / rankingFor 使用
    // 去掉 Details 列（7 → 6）供 wr_average_history 的 RANKING_HEADER 对齐
    this._mbfRanking6col = mbfRanking7col.map(row => row.slice(0, 6));

    const mbfName = EVENTS['333mbf'];
    this._ranking = {
      [mbfName]: mbfRanking7col,
      [MBO_EVENT_NAME]: [MBO_RANKING[0]],
    };

    this._computed = true;
  }

  // NOTE: 供 WrAverageHistory 委托调用——history 数据（7 列）
  async historyFor(eventName: string): Promise<unknown[][]> {
    await this.computeData();
    const mbfName = EVENTS['333mbf'];
    if (eventName === mbfName) return this._mbfHistory;
    if (eventName === MBO_EVENT_NAME) return MBO_HISTORY;
    return [];
  }

  // NOTE: 供 WrAverageHistory 委托调用——ranking 数据（6 列，对齐 RANKING_HEADER）
  async rankingFor(eventName: string): Promise<unknown[][]> {
    await this.computeData();
    const mbfName = EVENTS['333mbf'];
    if (eventName === mbfName) return this._mbfRanking6col;
    if (eventName === MBO_EVENT_NAME) return MBO_RANKING;
    return [];
  }

  // NOTE: 覆写 toJson——输出 panels（Ranking + History），双项目分节
  async toJson(): Promise<StatJson> {
    await this.computeData();

    const mbfName = EVENTS['333mbf'];

    const buildHeader = (header: TableHeader) =>
      Object.entries(header).map(([label, align]) => ({
        key: label.toLowerCase().replace(/\s+/g, '_'),
        label, labelZh: headerZh(label), align,
      }));

    const rankingSections: StatSection[] = Object.entries(this._ranking)
      .filter(([, rows]) => rows.length > 0)
      .map(([title, rows]) => ({ title, titleZh: eventZh(title), rows }));

    // NOTE: history 数据结构与 Ruby 一致：{ event_name => rows }
    const historyData: Record<string, unknown[][]> = {
      [mbfName]: this._mbfHistory,
      [MBO_EVENT_NAME]: MBO_HISTORY,
    };
    const historySections: StatSection[] = Object.entries(historyData)
      .filter(([, rows]) => rows.length > 0)
      .map(([title, rows]) => ({ title, titleZh: eventZh(title), rows }));

    const panels: StatPanel[] = [
      {
        id: 'ranking', labelEn: 'Ranking', labelZh: '排名',
        header: buildHeader(RANKING_HEADER),
        sections: rankingSections,
      },
      {
        id: 'history', labelEn: 'History', labelZh: '历史',
        header: buildHeader(HISTORY_HEADER),
        sections: historySections,
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
}
