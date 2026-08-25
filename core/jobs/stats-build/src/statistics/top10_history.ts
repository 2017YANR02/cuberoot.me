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
// 「按国家」拆分文件:country/{event}/{ISO2}.json,选了国家才懒加载;按国家拆分 → 仅
// 极少数国家(当天有人刷进本国 TOP K)的小文件会变,git 日更近乎零 churn。
const PER_COUNTRY_DIR = resolve(PER_EVENT_DIR, 'country');

// NOTE: per-event 进度/内存日志默认静默(CI 干净),本地调 OOM 时 STATS_VERBOSE=1 打开
const VERBOSE = process.env.STATS_VERBOSE === '1';

const TOP_K_EVER = 30;
// 「按国家」流的 top-K:前端只显示 TOP 10,K=15 足够重建任意日期的 top-10 且省体积
const TOP_K_COUNTRY = 15;
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
  rc: string;     // 参赛时代表国 id(results.country_id),供「按国家」流分组
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
    //   key 含「按人」指标(single/average/bao5...)与「按成绩」流(single_r/average_r —— 不按人去重,
    //   同一选手可占多条,对应 /wca/results 的「成绩」榜)。故用 string key。
    const eventOutputs: Record<string, Record<string, PbEvent[]>> = {};
    const eventMetricCounts: Record<string, Record<string, number>> = {};

    // NOTE: 调试 / 增量重生:TOP10_ONLY_EVENTS=333mbf,... 只跑指定 event(产物索引随之仅含这些 event,
    //   需外部 merge 回完整索引)。生产 CI 不设此变量 → 跑全 21 个。
    const onlySet = process.env.TOP10_ONLY_EVENTS
      ? new Set(process.env.TOP10_ONLY_EVENTS.split(',').map(s => s.trim()).filter(Boolean))
      : null;
    const eventsToRun = onlySet ? ALL_EVENTS.filter(e => onlySet.has(e)) : ALL_EVENTS;

    mkdirSync(PER_EVENT_DIR, { recursive: true });
    const iso2Map = await this.fetchCountryIso2();   // country_id -> iso2(拆分文件名用 iso2)
    // 「按国家」文件延迟到事件循环之后再写:循环内只算 + 暂存 streams。
    // 原因:fetchAllPersons/fetchAllComps 是大结果集,放在 per-event(含 DATE 列)查询之前会让
    // mysql2 连接 parseDate 撞 "Should not reach here";放到所有 per-event 查询之后则安全。
    const countryFilesPending: Array<{ eid: string; iso2: string; out: Record<string, PbEvent[]> }> = [];

    for (const eventId of eventsToRun) {
      const t = Date.now();
      const singleOnly = SINGLE_ONLY_EVENTS.has(eventId);
      const isAo5 = AO5_EVENTS.has(eventId);
      const isMbf = MBF_AVG_EVENTS.has(eventId);   // 333mbf:非官方 Mo3 平均(从 attempts 算)
      const needsAttempts = isAo5 || isMbf;        // 需拉 attempts(Ao5 5 次衍生指标 / 333mbf Mo3)
      const tag = isMbf ? 'single+mbfAvg' : (singleOnly ? 'single' : (isAo5 ? 'all' : 'single+avg'));
      if (VERBOSE) process.stdout.write(`  Top10 history ${eventId} (${tag})...`);

      // NOTE: SQL — 需 attempts 的 event(Ao5 / 333mbf)加 LEFT JOIN result_attempts + GROUP_CONCAT
      // r.country_id = 参赛时代表国(对齐 wca_results_flat.person_country_id),供「按国家」bar race 分组
      const sql = needsAttempts
        ? `SELECT r.person_id, r.country_id AS rc, r.best, r.average, r.competition_id AS comp_id, c.start_date AS d,
                 GROUP_CONCAT(ra.value ORDER BY ra.attempt_number) AS attempts
           FROM results r
           JOIN competitions c ON c.id = r.competition_id
           LEFT JOIN result_attempts ra ON ra.result_id = r.id
           WHERE r.event_id = '${eventId}' AND (r.best > 0 OR r.average > 0)
           GROUP BY r.id`
        : singleOnly
          ? `SELECT r.person_id, r.country_id AS rc, r.best, 0 AS average, r.competition_id AS comp_id, c.start_date AS d
             FROM results r JOIN competitions c ON c.id = r.competition_id
             WHERE r.event_id = '${eventId}' AND r.best > 0`
          : `SELECT r.person_id, r.country_id AS rc, r.best, r.average, r.competition_id AS comp_id, c.start_date AS d
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
          rc: String(r['rc'] ?? ''),
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

      // NOTE: 「按成绩」流 — 不按人去重,每条成绩是独立实体,同一选手可占多条
      //   (对齐 /wca/results 的「成绩」榜:每条 result 行各算一名次)。只做 single/average。
      const resultMetrics: MetricKey[] = ['single'];
      if (!singleOnly || isMbf) resultMetrics.push('average');  // 333mbf:非官方 Mo3
      for (const mk of resultMetrics) {
        const res = this.runResultMetric(rows, mk, isMbf && mk === 'average');
        eventOutputs[eventId][`${mk}_r`] = res.events;
        eventMetricCounts[eventId][`${mk}_r`] = res.events.length;
        for (const pid of res.pids) allPids.add(pid);
        for (const cid of res.cids) allCids.add(cid);
        summary.push(`${mk}_r=${res.events.length}`);
      }

      // NOTE: 「按国家」流 — 为每个代表国(results.country_id)单独算「曾进该国 TOP K」的
      //   single/average × 选手/成绩 流,拆成 country/{event}/{ISO2}.json,选了国家才懒加载;
      //   小国家整体进各自 TOP K(数据少则 race 短),与全球流互不影响。K=15 足够重建 top-10。
      {
        const byCountry = new Map<string, CompactRow[]>();
        for (const r of rows) {
          if (!r.rc) continue;
          let arr = byCountry.get(r.rc);
          if (!arr) { arr = []; byCountry.set(r.rc, arr); }
          arr.push(r);
        }
        const countryMetrics: MetricKey[] = ['single'];
        if (!singleOnly || isMbf) countryMetrics.push('average');
        let nCountries = 0;
        for (const [cc, crows] of byCountry) {
          const iso2 = iso2Map.get(cc);
          if (!iso2) continue;  // 无 iso2 的伪国家(多国 / 历史实体)跳过
          const out: Record<string, PbEvent[]> = {};
          for (const mk of countryMetrics) {
            const pres = this.runMetric(crows, mk, isMbf, TOP_K_COUNTRY);
            if (pres.events.length > 0) out[mk] = pres.events;
            const rres = this.runResultMetric(crows, mk, isMbf && mk === 'average', TOP_K_COUNTRY);
            if (rres.events.length > 0) out[`${mk}_r`] = rres.events;
          }
          if (Object.keys(out).length === 0) continue;
          // runMetric/runResultMetric 返回的是独立 PbEvent 副本(不引用 crows),故 rows 释放后仍有效
          countryFilesPending.push({ eid: eventId, iso2: iso2.toUpperCase(), out });
          nCountries++;
        }
        if (VERBOSE) console.log(`    country: ${nCountries} pending`);
      }

      // NOTE: 释放 rows
      rows.length = 0;
      if (global.gc) global.gc();

      const dt = ((Date.now() - t) / 1000).toFixed(1);
      const mem = Math.round(process.memoryUsage.rss() / 1024 / 1024);
      if (VERBOSE) console.log(` ${summary.join(' ')} (${dt}s) [${mem}MB]`);
    }

    // 所有 per-event(含 DATE 列)查询已结束 → 现在 fetch 大结果集字典安全(避免 mysql2 parseDate desync)
    const personMap = await this.fetchAllPersons();
    const compMap = await this.fetchAllComps();

    // 全局 index 字典:仅全局流引用的 person/comp(per-country 引用已下沉进各国文件,不进这里)
    const persons: Record<string, PersonInfo> = {};
    for (const p of allPids) { const pi = personMap.get(p); if (pi) persons[p] = pi; }
    const comps: Record<string, CompInfo> = {};
    for (const c of allCids) { const ci = compMap.get(c); if (ci) comps[c] = ci; }

    // 「按国家」自包含文件:循环内暂存的 streams 现在配上各自引用的 person/comp 字典落盘
    for (const { eid, iso2, out } of countryFilesPending) {
      const cdir = resolve(PER_COUNTRY_DIR, eid);
      mkdirSync(cdir, { recursive: true });
      const cpids = new Set<string>();
      const ccids = new Set<string>();
      for (const arr of Object.values(out)) for (const e of arr) { cpids.add(e.p); ccids.add(e.c); }
      const cpersons: Record<string, PersonInfo> = {};
      for (const p of cpids) { const pi = personMap.get(p); if (pi) cpersons[p] = pi; }
      const ccomps: Record<string, CompInfo> = {};
      for (const cid of ccids) { const ci = compMap.get(cid); if (ci) ccomps[cid] = ci; }
      writeFileSync(resolve(cdir, `${iso2}.json`), JSON.stringify({ ...out, persons: cpersons, comps: ccomps }), 'utf-8');
    }

    // NOTE: per-event 拆分文件
    mkdirSync(PER_EVENT_DIR, { recursive: true });
    const eventInfo: Record<string, {
      hasAverage: boolean;
      hasAo5: boolean;
      metrics: MetricKey[];
      hasResultsAverage: boolean;
    }> = {};
    for (const [eid, out] of Object.entries(eventOutputs)) {
      writeFileSync(
        resolve(PER_EVENT_DIR, `${eid}.json`),
        JSON.stringify(out),
        'utf-8',
      );
      const allKeys = Object.keys(out);
      // 「按人」指标列表(给前端 metric 选择器),排除 *_r 成绩流
      const metrics = allKeys.filter(k => !k.endsWith('_r')) as MetricKey[];
      eventInfo[eid] = {
        hasAverage: metrics.includes('average'),
        hasAo5: metrics.includes('bao5'),
        metrics,
        hasResultsAverage: allKeys.includes('average_r'),
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
    topK = TOP_K_EVER,
  ): { events: PbEvent[]; everInTop: Set<string> } {
    // 1) 算 metric 值并按 (date, pid) 取 min
    const byDate = new Map<string, Map<string, { v: number; c: string }>>();
    for (const r of rows) {
      const v = this.metricValue(r, mk, mbfAvg);
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
        if (top.length > topK) top.length = topK;
      }
      if (dayHadPb) {
        for (const x of top) everInTop.add(x.pid);
      }
    }

    const filtered = events.filter(e => everInTop.has(e.p));
    return { events: filtered, everInTop };
  }

  // NOTE: 单行 → 指标值(single/average/ao5 衍生);mbfAvg=333mbf 非官方 Mo3。无效返回 null。
  private metricValue(r: CompactRow, mk: MetricKey, mbfAvg: boolean): number | null {
    if (mk === 'single') return r.best > 0 ? r.best : null;
    if (mk === 'average') {
      if (mbfAvg) {
        // 恰好 3 次成功 → Mo3(>0);DNF / 不足 3 次 → computeMbfMo3 返回 -1/0 → 排除
        const mo3 = r.vals ? computeMbfMo3(r.vals) : 0;
        return mo3 > 0 ? mo3 : null;
      }
      return r.avg > 0 ? r.avg : null;
    }
    return r.vals ? computeAttemptMetric(mk, r.vals) : null;
  }

  // NOTE: 「按成绩」流 — 每条 result 行各为独立实体,不按人去重。
  //   产出「曾进过历史 TOP K 条成绩」的全部成绩(每条 {d,p,v,c}),按日期升序。
  //   判定:一条成绩曾进 TOP K ⟺ 它出现当日,严格更优的已有成绩 < K 条
  //   (它的名次随时间只会变差,故「曾进 TOP K」等价「出现即在 TOP K」)。
  //   前端只渲染 TOP 10,K=TOP_K_EVER=30 留安全余量(与「按人」流一致)。
  private runResultMetric(
    rows: CompactRow[],
    mk: MetricKey,
    mbfAvg = false,
    topK = TOP_K_EVER,
  ): { events: PbEvent[]; pids: Set<string>; cids: Set<string> } {
    // 1) 算每条成绩的值
    const ents: PbEvent[] = [];
    for (const r of rows) {
      const v = this.metricValue(r, mk, mbfAvg);
      if (v == null || !Number.isFinite(v)) continue;
      ents.push({ d: r.d, p: r.pid, v, c: r.comp });
    }
    // 2) 按 (日期升序, 值升序) 排:同日内更优成绩先处理,使阈值正确计入同日更优者
    ents.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.v - b.v));

    // 3) 维护「至今最优 K 个值」升序数组(末位 = 第 K 优 = 阈值),逐条判定是否曾进 TOP K
    const bestK: number[] = [];
    const insertSorted = (v: number) => {
      let lo = 0, hi = bestK.length;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (bestK[mid] < v) lo = mid + 1; else hi = mid; }
      bestK.splice(lo, 0, v);
    };
    let seen = 0;
    const events: PbEvent[] = [];
    const pids = new Set<string>();
    const cids = new Set<string>();
    for (const e of ents) {
      const qualifies = seen < topK || e.v <= bestK[bestK.length - 1];
      if (qualifies) { events.push(e); pids.add(e.p); cids.add(e.c); }
      if (bestK.length < topK) insertSorted(e.v);
      else if (e.v < bestK[bestK.length - 1]) { bestK.pop(); insertSorted(e.v); }
      seen++;
    }
    // events 已按日期升序(前端二分查找需要)
    return { events, pids, cids };
  }

  // NOTE: 全表 person 字典(sub_id=1)。一次性载入,供全局 index subset + per-country 文件自包含。
  private async fetchAllPersons(): Promise<Map<string, PersonInfo>> {
    const rows = await dbQuery(`
      SELECT p.wca_id, p.name, p.country_id, co.iso2
      FROM persons p
      JOIN countries co ON co.id = p.country_id
      WHERE p.sub_id = 1
    `);
    const out = new Map<string, PersonInfo>();
    for (const r of rows) {
      out.set(String(r['wca_id']), {
        name: String(r['name']),
        country: String(r['country_id']),
        iso2: r['iso2'] == null ? null : String(r['iso2']),
      });
    }
    return out;
  }

  // NOTE: country_id -> iso2 全表映射(「按国家」拆分文件名用 iso2)。无 iso2 的伪国家不返回。
  private async fetchCountryIso2(): Promise<Map<string, string>> {
    const rows = await dbQuery(`SELECT id, iso2 FROM countries WHERE iso2 IS NOT NULL AND iso2 <> ''`);
    const out = new Map<string, string>();
    for (const r of rows) out.set(String(r['id']), String(r['iso2']));
    return out;
  }

  // NOTE: 全表 comp 字典(id -> cell_name)。
  private async fetchAllComps(): Promise<Map<string, CompInfo>> {
    const rows = await dbQuery(`SELECT id, cell_name FROM competitions`);
    const out = new Map<string, CompInfo>();
    for (const r of rows) out.set(String(r['id']), { name: String(r['cell_name']) });
    return out;
  }
}
