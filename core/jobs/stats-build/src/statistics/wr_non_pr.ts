// NOTE: Non-PR WR——不是个人纪录的成绩中历史最佳
// 算法：逐行扫描维护每人 PB，value > PB → Non-PR 结果
// 双维度（Single + Average）× 双视图（Ranking + History）→ 4 个 MetricPanel 内嵌 panels
import { formatDate } from '../core/format_date.js';
import { Statistic } from '../core/statistic.js';
import { EVENTS, EVENTS_ENTRIES, headerZh, eventZh } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { query as dbQuery } from '../core/database.js';
import type { StatJson, StatPanel, MetricPanel, StatSection, TableHeader } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 历史表头
const HISTORY_HEADER: TableHeader = {
  'Result': 'right', 'Improvement': 'right', 'Days': 'right',
  'Person': 'left', 'Date': 'left', 'Competition': 'left',
};

// NOTE: 排名表头
const RANKING_HEADER: TableHeader = {
  '#': 'right', 'Person': 'left', 'Result': 'right',
  'Country': 'left', 'Date': 'left', 'Competition': 'left',
};

export class WrNonPr extends Statistic {
  constructor() {
    super();
    this.title = 'Non-PR WR';
    this.titleZh = '非 PR';
    this.note = 'Best results that are NOT a personal record — the competitor already had a faster result before.';
    this.noteZh = '不是个人纪录的最佳成绩——选手之前已经有过更快的成绩。';
  }

  query(): string { return ''; }

  // NOTE: 覆写 toJson——多维度面板输出
  async toJson(): Promise<StatJson> {
    const data = await this.computeAll();

    const buildHeader = (header: TableHeader) =>
      Object.entries(header).map(([label, align]) => ({
        key: label.toLowerCase().replace(/\s+/g, '_'),
        label, labelZh: headerZh(label), align,
      }));

    const buildSections = (grouped: [string, unknown[][]][]) =>
      grouped.filter(([, rows]) => rows.length > 0)
        .map(([title, rows]) => ({ title, titleZh: eventZh(title), rows }));

    const buildMetricPanel = (id: string, labelEn: string, labelZh: string,
      metricData: { ranking: [string, unknown[][]][]; history: [string, unknown[][]][] }): MetricPanel => ({
      id, labelEn, labelZh,
      panels: [
        {
          id: 'ranking', labelEn: 'Ranking', labelZh: '排名',
          header: buildHeader(RANKING_HEADER),
          sections: buildSections(metricData.ranking),
        },
        {
          id: 'history', labelEn: 'History', labelZh: '历史',
          header: buildHeader(HISTORY_HEADER),
          sections: buildSections(metricData.history),
        },
      ],
    });

    const metricPanels: MetricPanel[] = [
      buildMetricPanel('single', 'Single', '单次', data.single),
      buildMetricPanel('average', 'Average', '平均', data.average),
    ];

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh || this.title,
      ...(this.note ? { note: this.note } : {}),
      ...(this.noteZh ? { noteZh: this.noteZh } : {}),
      header: [],
      metricPanels,
    };
  }

  // NOTE: 核心计算——逐 event 查询 + 逐行扫描
  private async computeAll() {
    const result = {
      single:  { ranking: [] as [string, unknown[][]][], history: [] as [string, unknown[][]][] },
      average: { ranking: [] as [string, unknown[][]][], history: [] as [string, unknown[][]][] },
    };

    for (const [eventId, eventName] of EVENTS_ENTRIES) {
      const rows = await this.fetchResultsFor(eventId);
      if (rows.length === 0) continue;

      // Single
      const s = this.computeNonPr(rows, 'best', eventId);
      if (s.history.length > 0) result.single.history.push([eventName, s.history]);
      if (s.ranking.length > 0) result.single.ranking.push([eventName, s.ranking]);

      // Average
      const a = this.computeNonPr(rows, 'average', eventId);
      if (a.history.length > 0) result.average.history.push([eventName, a.history]);
      if (a.ranking.length > 0) result.average.ranking.push([eventName, a.ranking]);
    }

    return result;
  }

  // NOTE: 一次查询同时取 best + average，减少查询次数
  private async fetchResultsFor(eventId: string): Promise<RowDataPacket[]> {
    return dbQuery(`
      SELECT
        result.person_id,
        result.best,
        result.average,
        person.country_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') comp_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE result.event_id = '${eventId}'
        AND (result.best > 0 OR result.average > 0)
      ORDER BY competition.start_date, result.id
    `);
  }

  // NOTE: 核心算法——从结果中筛选 non-PR 成绩，追踪 WR 演变
  private computeNonPr(
    rows: RowDataPacket[], valueCol: 'best' | 'average', eventId: string,
  ): { history: unknown[][]; ranking: unknown[][] } {
    // 每人当前 PB
    const pb = new Map<string, number>();
    // 每人最佳 non-PR 成绩
    const bestNonPr = new Map<string, {
      value: number; personLink: string; compLink: string;
      date: string; country: string;
    }>();

    // WR 追踪
    let wrBest = Infinity;
    const wrRecords: Array<{
      value: number; personLink: string; compLink: string; date: string;
    }> = [];

    // NOTE: SolveTime 格式化类型
    const vtype = valueCol === 'best' ? 'single' as const : 'average' as const;

    for (const r of rows) {
      const val = Number(r[valueCol]);
      if (!val || val <= 0) continue;

      const pid = String(r['person_id']);

      const currentPb = pb.get(pid);
      if (!currentPb || val <= currentPb) {
        // 这是 PR（首次出现或刷新/平了 PB）→ 更新 PB，跳过
        pb.set(pid, val);
        continue;
      }

      // val > pb → Non-PR
      const existing = bestNonPr.get(pid);
      if (!existing || val < existing.value) {
        bestNonPr.set(pid, {
          value: val,
          personLink: String(r['person_link']),
          compLink: String(r['comp_link']),
          date: formatDate(r['start_date']),
          country: String(r['country_id']),
        });
      }

      // 追踪 WR 演变
      if (val < wrBest) {
        wrBest = val;
        wrRecords.push({
          value: val,
          personLink: String(r['person_link']),
          compLink: String(r['comp_link']),
          date: formatDate(r['start_date']),
        });
      }
    }

    // --- 构建 History 行 ---
    const history = wrRecords.map((r, i) => {
      const resultStr = new SolveTime(eventId, vtype, r.value).clockFormat();

      let gainStr = '';
      if (i > 0) {
        const prevVal = wrRecords[i - 1].value;
        gainStr = `${((prevVal - r.value) / prevVal * 100).toFixed(2)}%`;
      }

      let daysStr: string;
      if (i < wrRecords.length - 1) {
        const nextDate = new Date(wrRecords[i + 1].date);
        const currDate = new Date(r.date);
        daysStr = String(Math.round((nextDate.getTime() - currDate.getTime()) / 86400000));
      } else {
        daysStr = String(Math.round((Date.now() - new Date(r.date).getTime()) / 86400000));
      }

      return [resultStr, gainStr, daysStr, r.personLink, r.date, r.compLink];
    }).reverse();

    // --- 构建 Ranking 行 ---
    const ranking = [...bestNonPr.values()]
      .sort((a, b) => a.value - b.value)
      .slice(0, 10)
      .map((v, i) => {
        const resultStr = new SolveTime(eventId, vtype, v.value).clockFormat();
        return [i + 1, v.personLink, resultStr, v.country, v.date, v.compLink];
      });

    return { history, ranking };
  }
}
