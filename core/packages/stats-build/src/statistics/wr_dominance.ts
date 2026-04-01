// NOTE: Dominance（屠榜）——选手在某项目全历史成绩排行榜上完全霸占前 N 席
// 与 Ruby _stats_build/statistics/wr_dominance.rb 1:1 对应
// 算法：
//   1. 找到全局成绩最好的选手 P
//   2. 找到非 P 选手中的最佳成绩 others_best
//   3. dominance = P 的成绩中严格 < others_best 的数量（二分搜索）
// 双维度（Single + Average）× 双视图（Ranking + History）
//
// ⚠️ 内存优化（v2）——SQL 不返回 CONCAT 链接字符串
//   原版每行 RowDataPacket 含 person_link (~80B) + comp_link (~100B) = ~180B 额外
//   333 single ~500万行 × 180B = ~900MB 纯字符串。改为仅返 person_id + comp_id，
//   最终结果行（几十条）才 resolveLinks 查出链接。
import { formatDate } from '../core/format_date.js';
import { Statistic } from '../core/statistic.js';
import { EVENTS_ENTRIES, headerZh, eventZh } from '../core/events.js';
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

// NOTE: computeDominance 的中间结果类型（ID only，无链接字符串）
type DomHistoryEntry = {
  count: number; improvement: string; days: string;
  personId: string; firstCompId: string; firstDate: string; compId: string; date: string;
};
type DomRankingEntry = {
  rank: number; personId: string; count: number; compId: string; date: string;
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
    // NOTE: 中间结果用 ID-only 类型，最终 resolveLinks 后转为 unknown[][]
    const singleHistRaw: [string, DomHistoryEntry[]][] = [];
    const singleRankRaw: [string, DomRankingEntry[]][] = [];
    const avgHistRaw: [string, DomHistoryEntry[]][] = [];
    const avgRankRaw: [string, DomRankingEntry[]][] = [];

    // NOTE: 收集所有出现在结果中的 person/comp ID
    const allPersonIds = new Set<string>();
    const allCompIds = new Set<string>();

    const collectIds = (hist: DomHistoryEntry[], rank: DomRankingEntry[]) => {
      for (const h of hist) {
        allPersonIds.add(h.personId);
        allCompIds.add(h.compId);
        allCompIds.add(h.firstCompId);
      }
      for (const r of rank) {
        allPersonIds.add(r.personId);
        allCompIds.add(r.compId);
      }
    };

    // NOTE: Single 基于所有 individual attempts
    for (const [eventId, eventName] of EVENTS_ENTRIES) {
      const t = Date.now();
      process.stdout.write(`  Dominance single: ${eventId}...`);
      let rows = await this.fetchSingleAttemptsFor(eventId);
      if (rows.length === 0) { console.log(' skip'); continue; }

      const dom = this.computeDominance(rows, 'value');
      rows = null as unknown as RowDataPacket[];
      if (typeof globalThis.gc === 'function') globalThis.gc();

      if (dom.history.length > 0) singleHistRaw.push([eventName, dom.history]);
      if (dom.ranking.length > 0) singleRankRaw.push([eventName, dom.ranking]);
      collectIds(dom.history, dom.ranking);

      const mem = Math.round(process.memoryUsage.rss() / 1024 / 1024);
      console.log(` ${dom.history.length} records (${((Date.now() - t) / 1000).toFixed(1)}s) [${mem}MB]`);
    }

    // NOTE: Average 基于每轮的 average 值
    for (const [eventId, eventName] of EVENTS_ENTRIES) {
      const t = Date.now();
      process.stdout.write(`  Dominance average: ${eventId}...`);
      let rows = await this.fetchAverageResultsFor(eventId);
      if (rows.length === 0) { console.log(' skip'); continue; }

      const dom = this.computeDominance(rows, 'average');
      rows = null as unknown as RowDataPacket[];
      if (typeof globalThis.gc === 'function') globalThis.gc();

      if (dom.history.length > 0) avgHistRaw.push([eventName, dom.history]);
      if (dom.ranking.length > 0) avgRankRaw.push([eventName, dom.ranking]);
      collectIds(dom.history, dom.ranking);

      const mem = Math.round(process.memoryUsage.rss() / 1024 / 1024);
      console.log(` ${dom.history.length} records (${((Date.now() - t) / 1000).toFixed(1)}s) [${mem}MB]`);
    }

    // NOTE: 所有 event 完成后，一次性查出链接（几十个 person + 几十个 comp）
    const { personMap, compMap } = await this.resolveLinks(allPersonIds, allCompIds);

    const resolveHist = (raw: [string, DomHistoryEntry[]][]): [string, unknown[][]][] =>
      raw.map(([name, entries]) => [name, entries.map(e => [
        e.count, e.improvement, e.days,
        personMap.get(e.personId) ?? e.personId,
        e.firstDate, compMap.get(e.firstCompId) ?? e.firstCompId,
        e.date, compMap.get(e.compId) ?? e.compId,
      ])]);

    const resolveRank = (raw: [string, DomRankingEntry[]][]): [string, unknown[][]][] =>
      raw.map(([name, entries]) => [name, entries.map(e => [
        e.rank, personMap.get(e.personId) ?? e.personId, e.count,
        e.date, compMap.get(e.compId) ?? e.compId,
      ])]);

    return {
      single:  { ranking: resolveRank(singleRankRaw), history: resolveHist(singleHistRaw) },
      average: { ranking: resolveRank(avgRankRaw),     history: resolveHist(avgHistRaw) },
    };
  }

  // NOTE: Single——逐 event 查询 result_attempts（瘦行，无 CONCAT 链接字符串）
  // ⚠️ 不拼 person_link/comp_link——每行省 ~450 bytes，500万行省 ~2GB
  private async fetchSingleAttemptsFor(eventId: string): Promise<RowDataPacket[]> {
    return dbQuery(`
      SELECT
        result.person_id,
        ra.value,
        result.competition_id AS comp_id,
        competition.start_date
      FROM result_attempts ra
      JOIN results result ON result.id = ra.result_id
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE ra.value > 0 AND result.event_id = '${eventId}'
      ORDER BY competition.start_date
    `);
  }

  // NOTE: Average——逐 event 查询每轮 average（瘦行）
  private async fetchAverageResultsFor(eventId: string): Promise<RowDataPacket[]> {
    return dbQuery(`
      SELECT
        result.person_id,
        result.average,
        result.competition_id AS comp_id,
        competition.start_date
      FROM results result
      JOIN competitions competition ON competition.id = result.competition_id
      WHERE result.average > 0 AND result.event_id = '${eventId}'
      ORDER BY competition.start_date
    `);
  }

  // NOTE: 仅为最终结果行（几十行）查询 person/competition 的链接字符串
  private async resolveLinks(personIds: Set<string>, compIds: Set<string>): Promise<{
    personMap: Map<string, string>;
    compMap: Map<string, string>;
  }> {
    const personMap = new Map<string, string>();
    const compMap = new Map<string, string>();

    if (personIds.size > 0) {
      const pids = [...personIds].map(id => `'${id}'`).join(',');
      const rows = await dbQuery(`
        SELECT wca_id,
          CONCAT('[', name, '](https://www.worldcubeassociation.org/persons/', wca_id, ')') AS link
        FROM persons WHERE wca_id IN (${pids}) AND sub_id = 1
      `);
      for (const r of rows) personMap.set(String(r['wca_id']), String(r['link']));
    }

    if (compIds.size > 0) {
      const cids = [...compIds].map(id => `'${id}'`).join(',');
      const rows = await dbQuery(`
        SELECT id,
          CONCAT('[', cell_name, '](https://www.worldcubeassociation.org/competitions/', id, ')') AS link
        FROM competitions WHERE id IN (${cids})
      `);
      for (const r of rows) compMap.set(String(r['id']), String(r['link']));
    }

    return { personMap, compMap };
  }

  // NOTE: 统一计算 dominance 的历史和排名——与 Ruby compute_dominance 1:1 对应
  // 性能优化：per-person 有序数组（二分插入 O(log n)）+ 二分搜索计数
  // NOTE: 瘦行模式——rows 无 person_link/comp_link，返回 ID 以便后续 resolveLinks
  private computeDominance(
    rows: RowDataPacket[], valueCol: string,
  ): { history: DomHistoryEntry[]; ranking: DomRankingEntry[] } {
    const pv = new Map<string, number[]>();
    const pb = new Map<string, number>();
    const pi = new Map<string, { compId: string; date: string }>();

    let maxDom = 0;
    const wrRecords: Array<{
      count: number; personId: string; compId: string; date: string;
    }> = [];
    const firstDom = new Map<string, { compId: string; date: string }>();

    // NOTE: rows 已按 start_date 排序，逐行处理
    // ⚠️ 不建 byDate Map——避免持有全部 rows 引用
    let currentDate = '';

    for (const r of rows) {
      const pid = String(r['person_id']);
      const val = Number(r[valueCol]);
      const dateStr = formatDate(r['start_date']);
      const compId = String(r['comp_id']);

      // 日期切换时检查前一日期组的 dominance
      if (dateStr !== currentDate && currentDate !== '') {
        this.checkDominance(pv, pb, pi, currentDate, maxDom, wrRecords, firstDom);
        if (wrRecords.length > 0 && wrRecords[wrRecords.length - 1].count > maxDom) {
          maxDom = wrRecords[wrRecords.length - 1].count;
        }
      }
      currentDate = dateStr;

      // 二分插入，保持有序
      const arr = pv.get(pid) ?? [];
      if (!pv.has(pid)) pv.set(pid, arr);
      const idx = this.bisectLeft(arr, val);
      arr.splice(idx, 0, val);

      // 更新 best
      const currentBest = pb.get(pid);
      if (!currentBest || val < currentBest) pb.set(pid, val);

      pi.set(pid, { compId, date: dateStr });
    }
    // 最后一个日期组
    if (currentDate !== '') {
      this.checkDominance(pv, pb, pi, currentDate, maxDom, wrRecords, firstDom);
      if (wrRecords.length > 0 && wrRecords[wrRecords.length - 1].count > maxDom) {
        maxDom = wrRecords[wrRecords.length - 1].count;
      }
    }

    // --- 历史：计算 improvement 和 days，然后倒序 ---
    const history: DomHistoryEntry[] = wrRecords.map((r, i) => {
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
      return {
        count: r.count, improvement, days,
        personId: r.personId,
        firstCompId: first.compId, firstDate: first.date,
        compId: r.compId, date: r.date,
      };
    }).reverse();

    // --- 排名：复用 pv/pb 最终状态 ---
    const ranking = this.computeRankingFromState(pv, pb, pi);

    return { history, ranking };
  }

  // NOTE: checkDominance——检查当前日期组的 dominance 并记录 WR
  private checkDominance(
    pv: Map<string, number[]>,
    pb: Map<string, number>,
    pi: Map<string, { compId: string; date: string }>,
    date: string,
    maxDom: number,
    wrRecords: Array<{ count: number; personId: string; compId: string; date: string }>,
    firstDom: Map<string, { compId: string; date: string }>,
  ): void {
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

    if (secondBest === Infinity || !topPid) return;

    const arr = pv.get(topPid)!;
    const cnt = this.bisectLeft(arr, secondBest);

    if (cnt > maxDom && cnt > 0) {
      if (!firstDom.has(topPid)) {
        firstDom.set(topPid, { compId: pi.get(topPid)!.compId, date });
      }
      wrRecords.push({
        count: cnt,
        personId: topPid,
        compId: pi.get(topPid)!.compId,
        date,
      });
    }
  }

  // NOTE: 从 pv/pb/pi 最终状态计算当前 dominance Top 10
  private computeRankingFromState(
    pv: Map<string, number[]>,
    pb: Map<string, number>,
    pi: Map<string, { compId: string; date: string }>,
  ): DomRankingEntry[] {
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

    const candidates: Array<{ count: number; personId: string; compId: string; date: string }> = [];
    for (const [pid, values] of pv) {
      const othersBest = (pid === topPid) ? secondBest : topBest;
      const cnt = this.bisectLeft(values, othersBest);
      if (cnt <= 0) continue;
      const info = pi.get(pid)!;
      candidates.push({ count: cnt, personId: pid, compId: info.compId, date: info.date });
    }

    candidates.sort((a, b) => b.count - a.count);
    return candidates.slice(0, 10).map((c, i) => ({
      rank: i + 1, personId: c.personId, count: c.count, date: c.date, compId: c.compId,
    }));
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
}
