// NOTE: Dominance（屠榜）——选手在某项目全历史成绩排行榜上完全霸占前 N 席
// 与 Ruby _stats_build/statistics/wr_dominance.rb 1:1 对应
// 算法：
//   1. 找到全局成绩最好的选手 P
//   2. 找到非 P 选手中的最佳成绩 others_best
//   3. dominance = P 的成绩中严格 < others_best 的数量（二分搜索）
// 双维度（Single + Average）× 双视图（Ranking + History）
import { Statistic } from '../core/statistic.js';
import { EVENTS, EVENTS_ENTRIES, headerZh, eventZh } from '../core/events.js';
import { query as dbQuery } from '../core/database.js';
import type { StatJson, MetricPanel, TableHeader } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 历史表头
const HISTORY_HEADER: TableHeader = {
  'Count': 'right', 'Improvement': 'right', 'Days': 'right',
  'Person': 'left', 'Start Date': 'left', 'Start Comp': 'left',
  'Date': 'left', 'Competition': 'left',
};

// NOTE: 排名表头
const RANKING_HEADER: TableHeader = {
  '#': 'right', 'Person': 'left', 'Count': 'right',
  'Date': 'left', 'Competition': 'left',
};

export class WrDominance extends Statistic {
  constructor() {
    super();
    this.title = 'Dominance';
    this.titleZh = '屠榜';
    this.note = 'A competitor completely dominates top N on the leaderboard of results. Tied results are excluded.';
    this.noteZh = '选手在某项目全历史成绩排行榜上完全霸占前 N 席。并列成绩排除。';
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

  private async computeAll() {
    const result = {
      single:  { ranking: [] as [string, unknown[][]][], history: [] as [string, unknown[][]][] },
      average: { ranking: [] as [string, unknown[][]][], history: [] as [string, unknown[][]][] },
    };

    // NOTE: Single 基于所有 individual attempts（每轮最多 5 个单次成绩）
    // 逐 event 查询避免一次加载全部 result_attempts OOM
    for (const [eventId, eventName] of EVENTS_ENTRIES) {
      console.log(`  Dominance single: ${eventId}...`);
      let rows = await this.fetchSingleAttemptsFor(eventId);
      if (rows.length === 0) continue;

      const dom = this.computeDominance(rows, 'value');
      rows = null as unknown as RowDataPacket[]; // NOTE: 释放内存（与 Ruby rows = nil 对应）
      if (dom.history.length > 0) result.single.history.push([eventName, dom.history]);
      if (dom.ranking.length > 0) result.single.ranking.push([eventName, dom.ranking]);
    }

    // NOTE: Average 基于每轮的 average 值
    for (const [eventId, eventName] of EVENTS_ENTRIES) {
      console.log(`  Dominance average: ${eventId}...`);
      let rows = await this.fetchAverageResultsFor(eventId);
      if (rows.length === 0) continue;

      const dom = this.computeDominance(rows, 'average');
      rows = null as unknown as RowDataPacket[];
      if (dom.history.length > 0) result.average.history.push([eventName, dom.history]);
      if (dom.ranking.length > 0) result.average.ranking.push([eventName, dom.ranking]);
    }

    return result;
  }

  // NOTE: Single——逐 event 查询 result_attempts（扁平化）
  private async fetchSingleAttemptsFor(eventId: string): Promise<RowDataPacket[]> {
    return dbQuery(`
      SELECT
        result.person_id,
        ra.value,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') comp_link,
        competition.start_date
      FROM result_attempts ra
      JOIN results result ON result.id = ra.result_id
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE ra.value > 0 AND result.event_id = '${eventId}'
      ORDER BY competition.start_date
    `);
  }

  // NOTE: Average——逐 event 查询每轮 average
  private async fetchAverageResultsFor(eventId: string): Promise<RowDataPacket[]> {
    return dbQuery(`
      SELECT
        result.person_id,
        result.average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') comp_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = result.person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE result.average > 0 AND result.event_id = '${eventId}'
      ORDER BY competition.start_date
    `);
  }

  // NOTE: 统一计算 dominance 的历史和排名——与 Ruby compute_dominance 1:1 对应
  // 性能优化：per-person 有序数组（二分插入 O(log n)）+ 二分搜索计数
  private computeDominance(
    rows: RowDataPacket[], valueCol: string,
  ): { history: unknown[][]; ranking: unknown[][] } {
    // per-person 排序值列表
    const pv = new Map<string, number[]>();  // person_id → sorted values
    // 每人最佳值
    const pb = new Map<string, number>();
    // 每人最新的 link/date 信息
    const pi = new Map<string, { personLink: string; compLink: string; date: string }>();

    let maxDom = 0;
    const wrRecords: Array<{
      count: number; personId: string; personLink: string;
      compLink: string; date: string;
    }> = [];
    // NOTE: 追踪每位选手首次 dominance 的比赛信息
    const firstDom = new Map<string, { compLink: string; date: string }>();

    // --- 历史追踪：按日期分组逐步构建 pv/pb ---
    const byDate = new Map<string, RowDataPacket[]>();
    for (const r of rows) {
      const dateStr = this.formatDate(r['start_date']);
      const existing = byDate.get(dateStr);
      if (existing) existing.push(r);
      else byDate.set(dateStr, [r]);
    }

    for (const [date, compRows] of byDate) {
      for (const r of compRows) {
        const pid = String(r['person_id']);
        const val = Number(r[valueCol]);

        // 二分插入，保持有序
        const arr = pv.get(pid) ?? [];
        if (!pv.has(pid)) pv.set(pid, arr);
        const idx = this.bisectLeft(arr, val);
        arr.splice(idx, 0, val);

        // 更新 best
        const currentBest = pb.get(pid);
        if (!currentBest || val < currentBest) pb.set(pid, val);

        pi.set(pid, {
          personLink: String(r['person_link']),
          compLink: String(r['comp_link']),
          date,
        });
      }

      // 找 top person 和 second_best
      let topPid: string | null = null;
      let topBest = Infinity;
      let secondBest = Infinity;

      for (const [pid, best] of pb) {
        if (best < topBest) {
          secondBest = topBest;
          topPid = pid;
          topBest = best;
        } else if (best < secondBest) {
          secondBest = best;
        }
      }

      if (secondBest === Infinity || !topPid) continue;

      // 用 binary search 统计 top_person 有多少值 < second_best
      const arr = pv.get(topPid)!;
      const cnt = this.bisectLeft(arr, secondBest);

      if (cnt > maxDom && cnt > 0) {
        maxDom = cnt;
        if (!firstDom.has(topPid)) {
          firstDom.set(topPid, { compLink: pi.get(topPid)!.compLink, date });
        }
        wrRecords.push({
          count: cnt,
          personId: topPid,
          personLink: pi.get(topPid)!.personLink,
          compLink: pi.get(topPid)!.compLink,
          date,
        });
      }
    }

    // --- 历史：计算 improvement 和 days，然后倒序 ---
    const history = wrRecords.map((r, i) => {
      const improvement = i > 0 ? `+${r.count - wrRecords[i - 1].count}` : '';

      let days: string;
      if (i < wrRecords.length - 1) {
        const nextDate = new Date(wrRecords[i + 1].date);
        const currDate = new Date(r.date);
        days = String(Math.round((nextDate.getTime() - currDate.getTime()) / 86400000));
      } else {
        days = String(Math.round((Date.now() - new Date(r.date).getTime()) / 86400000));
      }

      const first = firstDom.get(r.personId)!;
      return [r.count, improvement, days,
        r.personLink,
        first.date, first.compLink,
        r.date, r.compLink];
    }).reverse();

    // --- 排名：复用 pv/pb 最终状态 ---
    const ranking = this.computeRankingFromState(pv, pb, pi);

    return { history, ranking };
  }

  // NOTE: 从 pv/pb/pi 最终状态计算当前 dominance Top 10
  // 与 Ruby compute_ranking_from_state 1:1 对应
  private computeRankingFromState(
    pv: Map<string, number[]>,
    pb: Map<string, number>,
    pi: Map<string, { personLink: string; compLink: string; date: string }>,
  ): unknown[][] {
    let topPid: string | null = null;
    let topBest = Infinity;
    let secondBest = Infinity;

    for (const [pid, best] of pb) {
      if (best < topBest) {
        secondBest = topBest;
        topPid = pid;
        topBest = best;
      } else if (best < secondBest) {
        secondBest = best;
      }
    }

    if (secondBest === Infinity) return [];

    // 对每个 person 计算 dominance
    const candidates: Array<{ count: number; personLink: string; date: string; compLink: string }> = [];
    for (const [pid, values] of pv) {
      const othersBest = (pid === topPid) ? secondBest : topBest;
      const cnt = this.bisectLeft(values, othersBest);
      if (cnt <= 0) continue;

      const info = pi.get(pid)!;
      candidates.push({ count: cnt, personLink: info.personLink, date: info.date, compLink: info.compLink });
    }

    // 按 dominance 降序排序，取 Top 10
    candidates.sort((a, b) => b.count - a.count);
    return candidates.slice(0, 10).map((c, i) => [i + 1, c.personLink, c.count, c.date, c.compLink]);
  }

  // NOTE: 二分搜索——找到有序数组中第一个 >= target 的位置
  private bisectLeft(arr: number[], target: number): number {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private formatDate(d: unknown): string {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d || '').slice(0, 10);
  }
}
