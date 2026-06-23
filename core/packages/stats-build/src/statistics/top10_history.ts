// NOTE: Top 10 History——bar chart race 风格的"全历史 top 10 演化"
// 输出每 metric 的 PB 事件流(每人每次刷个人最佳一行),前端按日期重放
// 体积控制:每 metric 独立做"曾经进过历史 top-K(K=30) 的选手"过滤
//
// 21 个 WCA event 全覆盖(含已废除 333ft / magic / mmagic / 333mbo)
//   - single:所有 event
//   - average:除 333mbf / 333mbo 外所有 event
//   - bao5/wao5/mo5/bpa/wpa/median/best_counting/worst_counting/worst:仅 EVENTS_WITH_AO5(13 个)
//
// 性能:Ao5 events 用 LEFT JOIN result_attempts + GROUP BY + GROUP_CONCAT 一次拉全;
// JS 端 per-metric 顺序构建 byDate(每 event 内存峰值约一个 byDate 大小)。
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Statistic } from '../core/statistic.js';
import type { StatJson } from '../core/statistic.js';
import { formatDate } from '../core/format_date.js';
import { computeMbfMo3 } from '../core/mbf_average.js';
import { query as dbQuery } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PER_EVENT_DIR = resolve(__dirname, '../../../../../stats/top10_history');

// NOTE: per-event 进度/内存日志默认静默(CI 干净),本地调 OOM 时 STATS_VERBOSE=1 打开
const VERBOSE = process.env.STATS_VERBOSE === '1';

const TOP_K_EVER = 30;
const ALL_EVENTS = [
  '333','222','444','555','666','777','333bf','333fm','333oh',
  'clock','minx','pyram','skewb','sq1','444bf','555bf','333mbf',
  '333ft','magic','mmagic','333mbo',
] as const;

// NOTE: multi-blind 系列无官方 average。但 333mbf 用「非官方 Mo3」平均(恰好 3 次成功取均值,
//   与 all-results / wr_metric 的多盲平均口径一致);333mbo(旧多盲)仍只 single。
const SINGLE_ONLY_EVENTS = new Set<string>(['333mbf', '333mbo']);
// NOTE: 用非官方 Mo3 平均的 multi-blind 项目(需拉 attempts 从 3 次算 Mo3,而非读 r.average)
const MBF_AVG_EVENTS = new Set<string>(['333mbf']);

// NOTE: Mo3 项目(一轮 3 次,无 ao5 衍生指标)
const MO3_EVENTS = new Set<string>(['666', '777', '333bf', '333fm', '444bf', '555bf']);

// NOTE: 9 个 ao5 衍生指标只对 Ao5 events 计算
//   = 全 21 - SINGLE_ONLY (333mbf/333mbo) - MO3
const AO5_EVENTS = new Set<string>(
  ALL_EVENTS.filter(e => !SINGLE_ONLY_EVENTS.has(e) && !MO3_EVENTS.has(e)),
);

type MetricKey =
  | 'single' | 'average'
  | 'bao5' | 'wao5' | 'mo5' | 'bpa' | 'wpa'
  | 'median' | 'best_counting' | 'worst_counting' | 'worst';

const ATTEMPT_METRICS: MetricKey[] = [
  'bao5', 'wao5', 'mo5', 'bpa', 'wpa',
  'median', 'best_counting', 'worst_counting', 'worst',
];

interface PbEvent { d: string; p: string; v: number; c: string }
interface PersonInfo { name: string; country: string; iso2: string | null }
interface CompInfo { name: string }

// NOTE: 紧凑行 — 已解析,后续多次 metric 遍历共享
interface CompactRow {
  d: string;
  pid: string;
  best: number;   // 0 = 无效
  avg: number;    // 0 = 无效
  comp: string;
  vals: number[] | null;  // length 5,只 Ao5 events 有
}

// NOTE: 从 5 次 attempt 计算指标(对齐 wr_metric/wr_*.ts 实现)
function computeAttemptMetric(key: MetricKey, vals: number[]): number | null {
  switch (key) {
    case 'bao5': {
      const valid = vals.filter(v => v > 0);
      if (valid.length < 3) return null;
      const best3 = valid.sort((a, b) => a - b).slice(0, 3);
      return best3.reduce((s, v) => s + v, 0) / 3;
    }
    case 'wao5': {
      if (!vals.every(v => v > 0)) return null;
      const worst3 = [...vals].sort((a, b) => b - a).slice(0, 3);
      return worst3.reduce((s, v) => s + v, 0) / 3;
    }
    case 'mo5': {
      if (!vals.every(v => v > 0)) return null;
      return vals.reduce((s, v) => s + v, 0) / 5;
    }
    case 'bpa': {
      const first4 = vals.slice(0, 4);
      const valid = first4.filter(v => v > 0);
      if (valid.length < 3) return null;
      const best3 = valid.sort((a, b) => a - b).slice(0, 3);
      return best3.reduce((s, v) => s + v, 0) / 3;
    }
    case 'wpa': {
      const first4 = vals.slice(0, 4);
      if (!first4.every(v => v > 0)) return null;
      const worst3 = [...first4].sort((a, b) => b - a).slice(0, 3);
      return worst3.reduce((s, v) => s + v, 0) / 3;
    }
    case 'median': {
      const valid = vals.filter(v => v > 0).sort((a, b) => a - b);
      const invalid = vals.length - valid.length;
      if (invalid >= 3) return null;
      return valid[2] ?? null;
    }
    case 'best_counting': {
      const valid = vals.filter(v => v > 0).sort((a, b) => a - b);
      const invalid = vals.length - valid.length;
      if (invalid >= 2) return null;
      return valid[1] ?? null;
    }
    case 'worst_counting': {
      const valid = vals.filter(v => v > 0).sort((a, b) => a - b);
      const invalid = vals.length - valid.length;
      if (invalid === 0) return valid[3] ?? null;
      if (invalid === 1) return valid[2] ?? null;
      return null;
    }
    case 'worst': {
      if (!vals.every(v => v > 0)) return null;
      return Math.max(...vals);
    }
    default: return null;
  }
}

export class Top10History extends Statistic {
  constructor() {
    super();
    this.title = 'Top 10 history (bar chart race)';
    this.titleZh = '历史 TOP 10 演化';
    this.note = 'For each day, the all-time top 10 best results known by that date for each WCA event and metric. Only competitors who were ever in the historical top 30 are kept.';
    this.noteZh = '每天截至当日全历史前 10 的演化,覆盖 21 个 WCA 项目和 11 种指标。仅保留曾进入过历史 TOP 30 的选手。';
  }

  query(): string { return ''; }

  async toJson(): Promise<StatJson> {
    const tAll = Date.now();

    // NOTE: 全局 person/comp 字典(所有 event 共享)
    const allPids = new Set<string>();
    const allCids = new Set<string>();
    // NOTE: 每个 event 的所有指标输出 + 元信息
    const eventOutputs: Record<string, Partial<Record<MetricKey, PbEvent[]>>> = {};
    const eventMetricCounts: Record<string, Partial<Record<MetricKey, number>>> = {};

    // NOTE: 调试 / 增量重生:TOP10_ONLY_EVENTS=333mbf,... 只跑指定 event(产物索引随之仅含这些 event,
    //   需外部 merge 回完整索引)。生产 CI 不设此变量 → 跑全 21 个。
    const onlySet = process.env.TOP10_ONLY_EVENTS
      ? new Set(process.env.TOP10_ONLY_EVENTS.split(',').map(s => s.trim()).filter(Boolean))
      : null;
    const eventsToRun = onlySet ? ALL_EVENTS.filter(e => onlySet.has(e)) : ALL_EVENTS;

    for (const eventId of eventsToRun) {
      const t = Date.now();
      const singleOnly = SINGLE_ONLY_EVENTS.has(eventId);
      const isAo5 = AO5_EVENTS.has(eventId);
      const isMbf = MBF_AVG_EVENTS.has(eventId);   // 333mbf:非官方 Mo3 平均(从 attempts 算)
      const needsAttempts = isAo5 || isMbf;        // 需拉 attempts(Ao5 5 次衍生指标 / 333mbf Mo3)
      const tag = isMbf ? 'single+mbfAvg' : (singleOnly ? 'single' : (isAo5 ? 'all' : 'single+avg'));
      if (VERBOSE) process.stdout.write(`  Top10 history ${eventId} (${tag})...`);

      // NOTE: SQL — 需 attempts 的 event(Ao5 / 333mbf)加 LEFT JOIN result_attempts + GROUP_CONCAT
      const sql = needsAttempts
        ? `SELECT r.person_id, r.best, r.average, r.competition_id AS comp_id, c.start_date AS d,
                 GROUP_CONCAT(ra.value ORDER BY ra.attempt_number) AS attempts
           FROM results r
           JOIN competitions c ON c.id = r.competition_id
           LEFT JOIN result_attempts ra ON ra.result_id = r.id
           WHERE r.event_id = '${eventId}' AND (r.best > 0 OR r.average > 0)
           GROUP BY r.id`
        : singleOnly
          ? `SELECT r.person_id, r.best, 0 AS average, r.competition_id AS comp_id, c.start_date AS d
             FROM results r JOIN competitions c ON c.id = r.competition_id
             WHERE r.event_id = '${eventId}' AND r.best > 0`
          : `SELECT r.person_id, r.best, r.average, r.competition_id AS comp_id, c.start_date AS d
             FROM results r JOIN competitions c ON c.id = r.competition_id
             WHERE r.event_id = '${eventId}' AND (r.best > 0 OR r.average > 0)`;

      let rawRows: RowDataPacket[] | null = await dbQuery(sql);
      if (rawRows.length === 0) {
        rawRows = null;
        if (global.gc) global.gc();
        if (VERBOSE) console.log(` skip (no data)`);
        continue;
      }

      // NOTE: 转 CompactRow,只保留必要字段
      const rows: CompactRow[] = rawRows.map(r => {
        const attemptsStr = r['attempts'] != null ? String(r['attempts']) : '';
        const vals = needsAttempts && attemptsStr
          ? attemptsStr.split(',').map(Number)
          : null;
        return {
          d: formatDate(r['d']),
          pid: String(r['person_id']),
          best: Number(r['best']) || 0,
          avg: Number(r['average']) || 0,
          comp: String(r['comp_id']),
          // Ao5 须满 5 次(衍生指标按 5 算);333mbf(Mo3)保留 1-3 次原样,交 computeMbfMo3 判定
          vals: vals ? (isMbf ? vals : (vals.length === 5 ? vals : null)) : null,
        };
      });
      rawRows = null;
      if (global.gc) global.gc();

      eventOutputs[eventId] = {};
      eventMetricCounts[eventId] = {};

      // NOTE: 决定本 event 跑哪些 metric
      const metricsToRun: MetricKey[] = ['single'];
      if (!singleOnly || isMbf) metricsToRun.push('average');  // 333mbf:非官方 Mo3 平均
      if (isAo5) metricsToRun.push(...ATTEMPT_METRICS);

      const summary: string[] = [];
      for (const mk of metricsToRun) {
        const result = this.runMetric(rows, mk, isMbf);
        eventOutputs[eventId][mk] = result.events;
        eventMetricCounts[eventId][mk] = result.events.length;
        for (const pid of result.everInTop) allPids.add(pid);
        for (const e of result.events) allCids.add(e.c);
        summary.push(`${mk}=${result.events.length}/${result.everInTop.size}`);
      }

      // NOTE: 释放 rows
      rows.length = 0;
      if (global.gc) global.gc();

      const dt = ((Date.now() - t) / 1000).toFixed(1);
      const mem = Math.round(process.memoryUsage.rss() / 1024 / 1024);
      if (VERBOSE) console.log(` ${summary.join(' ')} (${dt}s) [${mem}MB]`);
    }

    const persons = await this.fetchPersons(allPids);
    const comps = await this.fetchComps(allCids);

    // NOTE: per-event 拆分文件
    mkdirSync(PER_EVENT_DIR, { recursive: true });
    const eventInfo: Record<string, {
      hasAverage: boolean;
      hasAo5: boolean;
      metrics: MetricKey[];
    }> = {};
    for (const [eid, out] of Object.entries(eventOutputs)) {
      writeFileSync(
        resolve(PER_EVENT_DIR, `${eid}.json`),
        JSON.stringify(out),
        'utf-8',
      );
      const metrics = Object.keys(out) as MetricKey[];
      eventInfo[eid] = {
        hasAverage: metrics.includes('average'),
        hasAo5: metrics.includes('bao5'),
        metrics,
      };
    }

    const dtAll = ((Date.now() - tAll) / 1000).toFixed(1);
    if (VERBOSE) console.log(`  Total: ${Object.keys(eventOutputs).length} events, ` +
      `${Object.keys(persons).length} persons, ${Object.keys(comps).length} comps in ${dtAll}s`);

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh,
      note: this.note,
      noteZh: this.noteZh,
      header: [],
      events: Object.keys(eventOutputs),
      eventInfo,
      topK: TOP_K_EVER,
      persons,
      comps,
    } as unknown as StatJson;
  }

  // NOTE: 对单一 metric 构建 byDate + 跑 PB 追踪
  private runMetric(
    rows: CompactRow[],
    mk: MetricKey,
    mbfAvg = false,   // 333mbf:average 走非官方 Mo3(从 attempts 算)而非 r.average
  ): { events: PbEvent[]; everInTop: Set<string> } {
    // 1) 算 metric 值并按 (date, pid) 取 min
    const byDate = new Map<string, Map<string, { v: number; c: string }>>();
    for (const r of rows) {
      let v: number | null;
      if (mk === 'single') v = r.best > 0 ? r.best : null;
      else if (mk === 'average') {
        if (mbfAvg) {
          // 恰好 3 次成功 → Mo3(>0);DNF / 不足 3 次 → computeMbfMo3 返回 -1/0 → 排除
          const mo3 = r.vals ? computeMbfMo3(r.vals) : 0;
          v = mo3 > 0 ? mo3 : null;
        } else {
          v = r.avg > 0 ? r.avg : null;
        }
      }
      else if (r.vals) v = computeAttemptMetric(mk, r.vals);
      else v = null;
      if (v == null || !Number.isFinite(v)) continue;
      let day = byDate.get(r.d);
      if (!day) { day = new Map(); byDate.set(r.d, day); }
      const prev = day.get(r.pid);
      if (!prev || v < prev.v) day.set(r.pid, { v, c: r.comp });
    }

    // 2) 按日期升序遍历,维护"曾入历史 TOP K"集合 + PB 事件流
    const sortedDates = [...byDate.keys()].sort();
    const currentBest = new Map<string, number>();
    const everInTop = new Set<string>();
    const top: Array<{ pid: string; v: number }> = [];
    const events: PbEvent[] = [];

    for (const d of sortedDates) {
      const day = byDate.get(d)!;
      let dayHadPb = false;
      for (const [pid, st] of day) {
        const v = st.v;
        const prev = currentBest.get(pid) ?? Infinity;
        if (v >= prev) continue;

        currentBest.set(pid, v);
        events.push({ d, p: pid, v, c: st.c });
        dayHadPb = true;

        const oldIdx = top.findIndex(x => x.pid === pid);
        if (oldIdx >= 0) top.splice(oldIdx, 1);

        let lo = 0, hi = top.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (top[mid].v < v) lo = mid + 1; else hi = mid;
        }
        top.splice(lo, 0, { pid, v });
        if (top.length > TOP_K_EVER) top.length = TOP_K_EVER;
      }
      if (dayHadPb) {
        for (const x of top) everInTop.add(x.pid);
      }
    }

    const filtered = events.filter(e => everInTop.has(e.p));
    return { events: filtered, everInTop };
  }

  private async fetchPersons(ids: Set<string>): Promise<Record<string, PersonInfo>> {
    if (ids.size === 0) return {};
    const idList = [...ids].map(id => `'${id}'`).join(',');
    const rows = await dbQuery(`
      SELECT p.wca_id, p.name, p.country_id, co.iso2
      FROM persons p
      JOIN countries co ON co.id = p.country_id
      WHERE p.wca_id IN (${idList}) AND p.sub_id = 1
    `);
    const out: Record<string, PersonInfo> = {};
    for (const r of rows) {
      out[String(r['wca_id'])] = {
        name: String(r['name']),
        country: String(r['country_id']),
        iso2: r['iso2'] == null ? null : String(r['iso2']),
      };
    }
    return out;
  }

  private async fetchComps(ids: Set<string>): Promise<Record<string, CompInfo>> {
    if (ids.size === 0) return {};
    const idList = [...ids].map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const rows = await dbQuery(`
      SELECT id, cell_name FROM competitions WHERE id IN (${idList})
    `);
    const out: Record<string, CompInfo> = {};
    for (const r of rows) {
      out[String(r['id'])] = { name: String(r['cell_name']) };
    }
    return out;
  }
}
