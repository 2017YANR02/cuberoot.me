// NOTE: Top 10 History——bar chart race 风格的"全历史 top 10 演化"
// 输出 PB 事件流(每人每次刷个人最佳一行),前端按日期重放即可重建任意时刻的 top-10
// 体积控制:只保留"曾经进过历史 top-K(K=30) 的选手",其他选手的 PB 不输出
// 仅做 3x3(event_id='333'),single + average 两个面板
import { Statistic } from '../core/statistic.js';
import type { StatJson } from '../core/statistic.js';
import { formatDate } from '../core/format_date.js';
import { query as dbQuery } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

const EVENT_ID = '333';
const TOP_K_EVER = 30;

// NOTE: 输出 JSON 里使用短键省字节(events 是最大数组,占了 90%+ 体积)
//   d = date (YYYY-MM-DD)
//   p = personId (WCA ID)
//   v = value (centiseconds)
//   c = competitionId
interface PbEvent { d: string; p: string; v: number; c: string }

interface PersonInfo { name: string; country: string; iso2: string | null }
interface CompInfo { name: string }
interface PanelData {
  event: string;
  topK: number;
  persons: Record<string, PersonInfo>;
  comps: Record<string, CompInfo>;
  events: PbEvent[];
}

export class Top10History extends Statistic {
  constructor() {
    super();
    this.title = 'Top 10 history (bar chart race)';
    this.titleZh = '历史 TOP 10 演化';
    this.note = 'For each day, the all-time top 10 fastest 3x3 singles/averages known by that date. Only competitors who were ever in the historical top 30 are kept.';
    this.noteZh = '展示每一天截至当日全历史 3x3 最快前 10 的演化。仅保留曾进入过历史 TOP 30 的选手。';
  }

  query(): string { return ''; }

  async toJson(): Promise<StatJson> {
    const single = await this.computeMetric('best', 'single');
    if (global.gc) global.gc();
    const average = await this.computeMetric('average', 'average');
    if (global.gc) global.gc();

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh,
      note: this.note,
      noteZh: this.noteZh,
      header: [],
      // NOTE: 自定义结构,前端定制页消费;不走 rows/sections/panels 通用 schema
      panels: { single, average },
    } as unknown as StatJson;
  }

  private async computeMetric(valueCol: 'best' | 'average', label: string): Promise<PanelData> {
    const t = Date.now();
    process.stdout.write(`  Top10 history ${EVENT_ID} ${label}...`);

    // NOTE: SQL 端先用 window function 把 1.7M 行原始成绩缩到 ~580k PB 流
    //   prev_min IS NULL 等价于这是该选手的首条成绩
    //   v < prev_min 表示刷新了 PB
    //   ORDER BY d, v 同日多场时小值在前(更稳的入榜判定)
    const sql = `
      WITH solves AS (
        SELECT r.person_id, r.${valueCol} AS v, r.competition_id AS comp_id,
               c.start_date AS d
        FROM results r JOIN competitions c ON c.id = r.competition_id
        WHERE r.event_id = '${EVENT_ID}' AND r.${valueCol} > 0
      ),
      running AS (
        SELECT person_id, v, comp_id, d,
          MIN(v) OVER (
            PARTITION BY person_id ORDER BY d, v
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
          ) AS prev_min
        FROM solves
      )
      SELECT person_id, v, comp_id, d
      FROM running
      WHERE prev_min IS NULL OR v < prev_min
      ORDER BY d, v
    `;

    let rows: RowDataPacket[] | null = await dbQuery(sql);

    // NOTE: 单次扫描——同时维护 (a) 完整 PB 事件流, (b) 当前 top-K 排序数组,
    //   (c) "曾入过 top-K 的选手 ID 集合"
    //   每次插入是 O(K)(K=30),总 O(N·K)≈580k×30=17M ops,几秒级
    const everInTop = new Set<string>();
    const top: Array<{ pid: string; v: number }> = []; // 按 v 升序,最长 TOP_K_EVER
    const allEvents: PbEvent[] = new Array(rows!.length);
    let writeIdx = 0;

    for (const row of rows!) {
      const pid = String(row['person_id']);
      const v = Number(row['v']);
      const compId = String(row['comp_id']);
      const d = formatDate(row['d']);
      allEvents[writeIdx++] = { d, p: pid, v, c: compId };

      // 该选手已在 top 数组里,先移除旧条目(他刚刷了 PB)
      const oldIdx = top.findIndex(x => x.pid === pid);
      if (oldIdx >= 0) top.splice(oldIdx, 1);

      // 二分插入(按 v 升序)
      let lo = 0, hi = top.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (top[mid].v < v) lo = mid + 1; else hi = mid;
      }
      top.splice(lo, 0, { pid, v });

      // 截断到 K
      if (top.length > TOP_K_EVER) top.length = TOP_K_EVER;

      // 此次插入若落在 [0..K-1] 内,代表入榜——记入 everInTop
      if (lo < TOP_K_EVER) everInTop.add(pid);
    }

    allEvents.length = writeIdx;
    rows = null;
    if (global.gc) global.gc();

    // NOTE: 过滤——只保留曾进过 top-K 选手的事件
    const filteredEvents = allEvents.filter(e => everInTop.has(e.p));

    // NOTE: 收集涉及的 personIds / compIds,一次性查 dictionary
    const compIdSet = new Set<string>();
    for (const e of filteredEvents) compIdSet.add(e.c);

    const persons = await this.fetchPersons(everInTop);
    const comps = await this.fetchComps(compIdSet);

    const dt = ((Date.now() - t) / 1000).toFixed(1);
    const mem = Math.round(process.memoryUsage.rss() / 1024 / 1024);
    console.log(` ${filteredEvents.length} events / ${everInTop.size} persons (${dt}s) [${mem}MB]`);

    return {
      event: EVENT_ID,
      topK: TOP_K_EVER,
      persons,
      comps,
      events: filteredEvents,
    };
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
