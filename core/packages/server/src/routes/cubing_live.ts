/**
 * /v1/cubing-live/* — cubing.com 比赛直播数据接口。
 *   GET /v1/cubing-live/:slug         — 元数据 (compId, 比赛名, events, users) + 全部 round 结果
 *
 * 流程: 抓 /live/{slug} HTML 拿 data-c (competition id) + data-events;
 *       连 wss://cubing.com/ws,subscribe competition,fetch result.all 所有 round。
 *
 * Cache: in-memory 60s。比赛实时刷新但 60s 粒度够看。
 */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import WebSocket from 'ws';
import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import type { CompPersonalRecordSlot } from '@cuberoot/shared';
import { query } from '../db/connection.js';
import { enrichComp, type CompRecordsSnapshot } from '../utils/current_records.js';
import { getCnCompZh } from '../utils/cn_comp_zh_cache.js';

export const cubingLiveRoutes = new Hono();

// ─── 类型 ──────────────────────────────────────────────────────────────────

interface User {
  number: number;
  name: string;
  wcaid: string;
  region: string;
  // 由 enrichComp() 解析填充 — client 不需要再 fetch country/continent 映射,
  // 直接用这两个字段 + comp.currentRecords 做 WS 推送的 tag 推断.
  countryId?: string;
  continentId?: string;
  // 上手报名的项目 id 列表;未来比赛 /live 还没开时由 /competitors HTML 抓出,
  // client psych sheet 据此过滤报名表(WCIF public 不含 registration 数据).
  eventIds?: string[];
}

interface RoundMeta {
  i: string;        // round id (1/2/3/f/d/etc)
  e: string;        // event id (333/222/...)
  f: string;        // format (a/m/1/2/3/5)
  co: number;       // cutoff (seconds)
  tl: number;       // time limit (seconds)
  n: number;        // advance count
  s: number;        // status (0=open, 1=finished, 2=live)
  rn: number;       // result count
  tt: number;       // total attempts
  name: string;     // "First round" / "Final" / etc
  allStatus?: string[];
  liveId?: string;  // WCA Live 内部 round id(订阅用)
}

interface EventMeta {
  i: string;        // event id
  name: string;     // "3x3x3 Cube"
  rs: RoundMeta[];  // rounds in chronological order
}

interface LiveResult {
  i: number;        // result id
  c: number;        // competition id
  n: number;        // competitor number
  e: string;        // event id
  r: string;        // round id
  f: string;        // format
  b: number;        // best (centiseconds)
  a: number;        // average (centiseconds)
  v: number[];      // attempts (centiseconds)
  sr: string;       // single record marker
  ar: string | number; // average record marker
  // 历史 PR 排名(仅 wca_db 路径填充):该值在本比赛开始日之前的该选手该项目所有历史成绩中排第几.
  // dense rank:同值同 rank;1 = PR(最快);2/3/... = 历史第 N 快.
  // 同比赛内多轮按 round_type_id 顺序累积,后置轮也参与累积排名.
  // undefined = 无历史数据或非 wca_db 路径(cubing.com 等).
  pS?: number;      // single rank
  pA?: number;      // average rank
}

type SourceId = 'cubing' | 'wca' | 'wca_live' | 'wca_db';

interface CompData {
  slug: string;     // WCA ID (无横杠),规范形态
  cubingSlug?: string; // cubing.com 用的 dash slug;source=wca 时无
  wcaLiveId?: string; // WCA Live 的内部数字 id (用于订阅)
  source: SourceId;
  /** 这场比赛 ≥2 个源都有数据时给前端展示数据源切换器 */
  availableSources?: SourceId[];
  compId: number;
  name: string;
  type: string;     // "WCA" / "Non-WCA"
  events: EventMeta[];
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>; // key = "<event>:<round>"
  membersByFilter: MembersByFilter; // 哪些 user number 属于 females / children / newcomers
  fetchedAt: number;
  /** wca_db 路径预填:形态 wcaid → eventId → CompPersonalRecordSlot.
   *  避免 client 直连 WCA API 触发 429. */
  personalRecords?: Record<string, Record<string, CompPersonalRecordSlot>>;
  /** cubing / wca_live 路径预填:WR/CR/NR 快照(仅本场涉及国家/洲),
   *  client 拿去给 WS 实时推送的成绩做同样的 tag 推断. */
  currentRecords?: CompRecordsSnapshot;
}

// ─── HTML scraping ─────────────────────────────────────────────────────────

const CUBING_BASE = 'https://cubing.com';

function attrFromHtml(html: string, attr: string): string | null {
  // simple data-* extractor that is robust to attribute order
  const re = new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`);
  const m = html.match(re);
  if (!m) return null;
  return decodeHtmlEntities(m[1]);
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

interface ScrapedMeta {
  compId: number;
  name: string;
  type: string;
  events: EventMeta[];
}

async function scrapeMeta(slug: string): Promise<ScrapedMeta> {
  // Force English locale + a real-browser UA so cubing.com renders the full
  // English HTML with data-events embedded (Chinese locale strips events to null).
  const res = await fetch(`${CUBING_BASE}/live/${encodeURIComponent(slug)}?lang=en`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`cubing.com returned ${res.status} for /live/${slug}`);
  const html = await res.text();

  // Find #live-container and read its data-* attrs. The data-* attrs come AFTER
  // the id= within the same <div ...> opening tag — slice from a bit before the
  // id (to keep the start of the opening tag) through ~16KB after (data-events
  // alone is ~7KB and stages can be larger for big comps).
  const idx = html.indexOf('id="live-container"');
  if (idx < 0) throw new Error('live-container not found (slug may be invalid or has no live page)');
  const start = Math.max(0, idx - 200);
  const end = Math.min(html.length, idx + 16000);
  const block = html.slice(start, end);

  const cRaw = attrFromHtml(block, 'data-c');
  const eventsRaw = attrFromHtml(block, 'data-events');
  const typeRaw = attrFromHtml(block, 'data-type');
  if (!cRaw || !eventsRaw || eventsRaw === 'null') {
    throw new Error('live-container missing data-c / data-events (locale or slug issue)');
  }

  const compId = Number(cRaw);
  if (!Number.isFinite(compId)) throw new Error(`invalid compId: ${cRaw}`);

  let events: EventMeta[];
  try {
    events = JSON.parse(eventsRaw);
  } catch (e) {
    throw new Error(`failed to parse data-events: ${(e as Error).message}`);
  }

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  let name = titleMatch ? titleMatch[1].trim() : slug;
  // "Xi'an Cherry Blossom 2026 - Live - Cubing China" → "Xi'an Cherry Blossom 2026"
  name = name.replace(/\s*-\s*Live\s*-\s*Cubing China\s*$/i, '');

  return { compId, name, type: typeRaw || 'WCA', events };
}

// ─── WS fetch ──────────────────────────────────────────────────────────────

interface WsMessage {
  code?: number;
  type?: string;
  data?: unknown;
}

function openCubingWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://cubing.com/ws', {
      headers: {
        'Origin': 'https://cubing.com',
        'User-Agent': 'Mozilla/5.0 (compatible; cuberoot-me/1.0)',
      },
    });
    const t = setTimeout(() => {
      ws.terminate();
      reject(new Error('WS open timeout'));
    }, 10000);
    ws.once('open', () => { clearTimeout(t); resolve(ws); });
    ws.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}

interface MembersByFilter {
  females: number[];
  children: number[];
  newcomers: number[];
}

interface WsCollectResult {
  users: Record<string, User>;
  resultsByRound: Record<string, LiveResult[]>;
  membersByFilter: MembersByFilter;
}

type SecondaryFilter = 'females' | 'children' | 'newcomers';

export interface ProgressEvent {
  step: 'meta' | 'cubing.results' | 'cubing.filter' | 'wca.fetch' | 'wca.transform' | 'wca_live.results' | 'wca_db.query' | 'wca_db.transform';
  filter?: SecondaryFilter;
  done: number;
  total: number;
}
export type ProgressFn = (p: ProgressEvent) => void;

async function collectCompData(compId: number, events: EventMeta[], onProgress?: ProgressFn, timeoutMs = 25000): Promise<WsCollectResult> {
  const ws = await openCubingWs();
  const result: WsCollectResult = {
    users: {},
    resultsByRound: {},
    membersByFilter: { females: [], children: [], newcomers: [] },
  };

  const rounds: { e: string; r: string }[] = [];
  for (const ev of events) {
    for (const rd of ev.rs) {
      // Skip rounds that have 0 results to save time on huge comps
      if (rd.rn === 0 && rd.s !== 2) continue;
      rounds.push({ e: ev.i, r: rd.i });
    }
  }

  // cubing.com 不在 result.all 消息里回传 filter,只能"一次只跑一个 filter"分相,
  // 收齐这相的所有 round 响应再发下一相 — 共 4 相 (all + 3 secondary)。
  type Phase = { filter: 'all' | SecondaryFilter; pending: Set<string>; received: number; done: () => void };
  let currentPhase: Phase | null = null;
  let gotUsers = false;

  await new Promise<void>((resolve, reject) => {
    const finish = (err?: Error) => {
      try { ws.close(); } catch {}
      if (err) reject(err); else resolve();
    };
    const overallTimeout = setTimeout(() => {
      finish(new Error(`WS collect timeout; phase=${currentPhase?.filter}, gotUsers=${gotUsers}`));
    }, timeoutMs);

    ws.on('message', (raw: WebSocket.RawData) => {
      let msg: WsMessage;
      try {
        const text = raw.toString();
        if (text === '"pong"' || text === 'pong') return;
        msg = JSON.parse(text);
      } catch { return; }
      if (msg.code !== 200) return;

      if (msg.type === 'users' && msg.data && typeof msg.data === 'object') {
        result.users = msg.data as Record<string, User>;
        gotUsers = true;
        return;
      }
      if (msg.type !== 'result.all' || !Array.isArray(msg.data)) return;
      if (!currentPhase) return;

      const arr = msg.data as LiveResult[];
      currentPhase.received += 1;

      if (currentPhase.filter === 'all') {
        if (arr.length > 0) {
          const key = `${arr[0].e}:${arr[0].r}`;
          result.resultsByRound[key] = arr;
        }
      } else {
        const bucket = result.membersByFilter[currentPhase.filter];
        for (const r of arr) if (!bucket.includes(r.n)) bucket.push(r.n);
      }

      try {
        onProgress?.({
          step: currentPhase.filter === 'all' ? 'cubing.results' : 'cubing.filter',
          filter: currentPhase.filter === 'all' ? undefined : currentPhase.filter,
          done: currentPhase.received,
          total: currentPhase.pending.size,
        });
      } catch { /* progress 异常不影响主流程 */ }

      if (currentPhase.received >= currentPhase.pending.size) {
        currentPhase.done();
      }
    });

    ws.once('close', () => {
      clearTimeout(overallTimeout);
      if (!gotUsers) finish(new Error('WS closed before users received'));
      else resolve();
    });
    ws.once('error', (e) => {
      clearTimeout(overallTimeout);
      finish(e as Error);
    });

    const runPhase = (filter: 'all' | SecondaryFilter) => new Promise<void>((res) => {
      currentPhase = {
        filter,
        pending: new Set(rounds.map(r => `${r.e}:${r.r}`)),
        received: 0,
        done: res,
      };
      for (const r of rounds) {
        ws.send(JSON.stringify({ type: 'result', action: 'fetch', params: { event: r.e, round: r.r, filter } }));
      }
    });

    (async () => {
      ws.send(JSON.stringify({ type: 'competition', competitionId: compId }));
      await runPhase('all');
      // secondary filters: 缺数据不致命,单相 timeout 用全局 overallTimeout 兜底
      for (const f of ['females', 'children', 'newcomers'] as const) {
        await runPhase(f);
      }
      clearTimeout(overallTimeout);
      finish();
    })().catch((e) => finish(e as Error));
  });

  return result;
}

// ─── Cache ─────────────────────────────────────────────────────────────────

const CUBING_CACHE_TTL_MS = 60_000;      // cubing.com 直播,1 分钟兜底
const WCA_CACHE_TTL_MS = 60 * 60_000;    // WCA 静态数据,1 小时
const cache = new Map<string, CompData>();
const inflight = new Map<string, Promise<CompData>>();
// wca_db 路径需独立去重 map — 因 tryLoadFromWcaDb 可能 resolve null(本地 dump 没此 comp).
const inflightWcaDb = new Map<string, Promise<CompData | null>>();

function ttlFor(source: SourceId): number {
  // wca_db 每周 CI 重灌,内存缓存可放心拉长到 12h.
  // wca REST 数据稳定,1h.
  // wca_live & cubing 都是实时源,缓存短.
  if (source === 'wca_db') return 12 * 60 * 60_000;
  return source === 'wca' ? WCA_CACHE_TTL_MS : CUBING_CACHE_TTL_MS;
}

/** WCA ID (e.g. XuzhouZenith2026) → cubing.com slug (Xuzhou-Zenith-2026)。
 *  在 小写↔大写 / 数字↔大写 / 小写↔数字 边界插横杠;
 *  但 NxN (3x3 / 4x4 / 5x5) 里 x 前是数字时不拆 — 否则 "League3x3IV" → "3-x-3-IV" 错的. */
function wcaIdToCubingSlug(wcaId: string): string {
  return wcaId
    .replace(/([a-z])([A-Z])/g, '$1-$2')       // lc→UC: HefeiCubing → Hefei-Cubing
    .replace(/(\d)([A-Z])/g, '$1-$2')           // digit→UC: 3IV → 3-IV
    .replace(/([A-Z])(\d)/g, '$1-$2')           // UC→digit: IV2026 → IV-2026
    .replace(/(?<!\d)([a-z])(\d)/g, '$1-$2');   // lc→digit (前面不是 digit):League3 → League-3,但 NxN 里 x3 保留
}

// ─── WCA API fallback (non-cubing.com comps) ──────────────────────────────

const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';

interface WcifPublic {
  name: string;
  events?: { id: string; rounds?: { id: string; format: string }[] }[];
}
interface WcaResultRow {
  id: number; round_id: number; pos: number;
  best: number; average: number;
  name: string; country_iso2: string; wca_id: string;
  competition_id: string; event_id: string; round_type_id: string; format_id: string;
  attempts: number[];
  regional_single_record: string | null;
  regional_average_record: string | null;
}

const ROUND_ORDER: Record<string, number> = {
  d: 0, '1': 1, e: 2, '2': 3, g: 4, '3': 5, c: 6, b: 7, f: 8, h: 9,
};

/** WCIF round 顺序 index → WCA 规范 round_type_id (非 combined 形式).
 *  WCA 约定:N=1 → ['f'];N=2 → ['1','f'];N=3 → ['1','3','f'](Semi);N=4 → ['1','2','3','f']. */
function canonicalRoundId(idx: number, total: number): string {
  if (idx === total - 1) return 'f';
  if (total >= 3 && idx === total - 2) return '3';
  if (total >= 4 && idx === total - 3) return '2';
  if (idx === 0) return '1';
  return String(idx + 1);
}
const ROUND_NAME: Record<string, string> = {
  '1': 'First round',
  '2': 'Second round',
  '3': 'Semi Final',
  f: 'Final',
  d: 'First round',
  e: 'Second round',
  g: 'Semi Final',
  c: 'Final',
  b: 'B Final',
  h: 'Final',
};

/** 给 cubing.com / WCA Live 源的 data 补 record 相关信息:
 *  - users[*].countryId / continentId 解析填充
 *  - 现有 results 的空 sr/ar 用 wca_results_top 当前 MIN 推断填充
 *  - 附加 currentRecords 快照供 client 给 WS 实时推送的成绩做同款推断
 *  非阻塞:无 records 缓存时全部跳过(首请求秒出,fallback 到原行为). */
function enrichRecordTags(data: CompData): void {
  const snapshot = enrichComp(data.users, data.resultsByRound);
  if (snapshot) data.currentRecords = snapshot;
}

/** 给 cubing / wca / wca_live 源的 data 补 Psych Sheet 用的 personalRecords + per-result pS/pA dense rank:
 *  从 wca_results_top 取每位 wcaid 在该 comp.start_date 之前的全部 distinct single / average 值,
 *    - MIN 用来填 personalRecords[wcaid][eventId].single/average (Psych Sheet)
 *    - 全部 distinct 值用来给本场每条 result 算 pS/pA dense rank (PR/PR2/PR3 标志)
 *  避免 client 直连 WCA API /persons/<id>(N 个 wcaid 触发 429,大比赛 Psych Sheet 全空).
 *  wca_competitions 没收录这场就 fallback 到 < CURRENT_DATE(刚宣布的比赛). */
async function enrichPersonalRecords(data: CompData): Promise<void> {
  const wcaIds: string[] = [];
  for (const u of Object.values(data.users)) {
    if (u.wcaid) wcaIds.push(u.wcaid);
  }
  if (wcaIds.length === 0) return;

  let compDate: string | null = null;
  try {
    const rows = await query<{ start_date: string }>(
      `SELECT start_date FROM wca_competitions WHERE id = ? LIMIT 1`,
      [data.slug],
    );
    if (rows.length > 0 && rows[0].start_date) compDate = rows[0].start_date;
  } catch { /* PG 错就 fallback */ }

  const idQs = wcaIds.map(() => '?').join(',');
  const dateClause = compDate ? 'AND comp_date < ?' : 'AND comp_date < CURRENT_DATE';
  const params: unknown[] = compDate ? [...wcaIds, compDate] : [...wcaIds];

  let priorRows: { wca_id: string; event_id: string; is_avg: boolean; value: number }[] = [];
  try {
    priorRows = await query<{ wca_id: string; event_id: string; is_avg: boolean; value: number }>(
      `SELECT DISTINCT wca_id, event_id, is_avg, value
       FROM wca_results_top
       WHERE wca_id IN (${idQs})
         AND value > 0
         ${dateClause}`,
      params,
    );
  } catch (e) {
    console.warn(`[cubing-live] prior-PR query failed for ${data.slug}:`, (e as Error).message);
    return;
  }

  let tagRows: { wca_id: string; event_id: string; is_avg: boolean; record_tag: string }[] = [];
  try {
    tagRows = await query<{ wca_id: string; event_id: string; is_avg: boolean; record_tag: string }>(
      `SELECT DISTINCT ON (wca_id, event_id, is_avg)
         wca_id, event_id, is_avg, record_tag
       FROM wca_results_top
       WHERE wca_id IN (${idQs})
         AND value > 0
         ${dateClause}
       ORDER BY wca_id, event_id, is_avg, value ASC,
         CASE record_tag
           WHEN 'WR' THEN 1
           WHEN 'AsR' THEN 2 WHEN 'OcR' THEN 2 WHEN 'AfR' THEN 2
           WHEN 'NAR' THEN 2 WHEN 'SAR' THEN 2 WHEN 'CR' THEN 2
           WHEN 'NR' THEN 3
           ELSE 4
         END ASC`,
      params,
    );
  } catch { /* tag 查不到不影响排序,继续 */ }

  // (wca_id|event_id|is_avg) → distinct historical values + best
  const seenValues = new Map<string, Set<number>>();
  const bestValueByKey = new Map<string, number>();
  for (const pr of priorRows) {
    const k = `${pr.wca_id}|${pr.event_id}|${pr.is_avg ? '1' : '0'}`;
    let set = seenValues.get(k);
    if (!set) { set = new Set(); seenValues.set(k, set); }
    set.add(pr.value);
    const curBest = bestValueByKey.get(k);
    if (curBest === undefined || pr.value < curBest) bestValueByKey.set(k, pr.value);
  }

  const personalRecords: Record<string, Record<string, CompPersonalRecordSlot>> = {};
  for (const [k, best] of bestValueByKey) {
    const [wcaId, eventId, isAvgStr] = k.split('|');
    const perEvent = (personalRecords[wcaId] ||= {});
    const slot = (perEvent[eventId] ||= {});
    if (isAvgStr === '1') slot.average = best;
    else slot.single = best;
  }
  for (const tr of tagRows) {
    if (!tr.record_tag || tr.record_tag === 'PR') continue;
    const perEvent = (personalRecords[tr.wca_id] ||= {});
    const slot = (perEvent[tr.event_id] ||= {});
    if (tr.is_avg) slot.averageTag = tr.record_tag;
    else slot.singleTag = tr.record_tag;
  }
  data.personalRecords = personalRecords;

  // pS/pA dense rank:同 tryLoadFromWcaDb 逻辑,按 ROUND_ORDER 累积本场成绩参与排名.
  // 比赛进行中(WCA 未收录),wca_results_top 不含本场,即用历史值算 PR/PR2/PR3.
  const groups = new Map<string, LiveResult[]>();
  for (const arr of Object.values(data.resultsByRound)) {
    for (const lr of arr) {
      const wcaIdForN = data.users[String(lr.n)]?.wcaid;
      if (!wcaIdForN) continue;
      const k = `${wcaIdForN}|${lr.e}`;
      let g = groups.get(k);
      if (!g) { g = []; groups.set(k, g); }
      g.push(lr);
    }
  }
  const rankFor = (v: number, seen: Set<number>): number => {
    let distinctLess = 0;
    for (const s of seen) if (s < v) distinctLess++;
    return distinctLess + 1;
  };
  for (const [k, arr] of groups) {
    arr.sort((a, b) => (ROUND_ORDER[a.r] ?? 99) - (ROUND_ORDER[b.r] ?? 99));
    const [wcaIdKey, eventIdKey] = k.split('|');
    const singleKey = `${wcaIdKey}|${eventIdKey}|0`;
    const avgKey    = `${wcaIdKey}|${eventIdKey}|1`;
    let singleSeen = seenValues.get(singleKey);
    if (!singleSeen) { singleSeen = new Set(); seenValues.set(singleKey, singleSeen); }
    let avgSeen = seenValues.get(avgKey);
    if (!avgSeen) { avgSeen = new Set(); seenValues.set(avgKey, avgSeen); }
    for (const lr of arr) {
      if (lr.b > 0) {
        lr.pS = rankFor(lr.b, singleSeen);
        singleSeen.add(lr.b);
      }
      if (lr.a > 0) {
        lr.pA = rankFor(lr.a, avgSeen);
        avgSeen.add(lr.a);
      }
    }
  }
}

async function loadFromWca(wcaId: string, onProgress?: ProgressFn): Promise<CompData> {
  onProgress?.({ step: 'wca.fetch', done: 0, total: 2 });
  // WCIF + results 并发.WCIF (~0.9s) 替代旧的 `/competitions/<id>` meta (~2.1s),省 ~1.2s 冷启.
  // WCIF 提供准确的 events 结构(含每项真实轮次数 + format),meta 只给 event_ids 列表.
  const [wcifRes, resultsRes] = await Promise.all([
    fetch(`${WCA_API_BASE}/competitions/${encodeURIComponent(wcaId)}/wcif/public`),
    fetch(`${WCA_API_BASE}/competitions/${encodeURIComponent(wcaId)}/results`),
  ]);
  if (!wcifRes.ok) throw new Error(`WCA WCIF HTTP ${wcifRes.status}`);
  if (!resultsRes.ok) throw new Error(`WCA results HTTP ${resultsRes.status}`);
  const wcif = await wcifRes.json() as WcifPublic;
  const results = await resultsRes.json() as WcaResultRow[];
  onProgress?.({ step: 'wca.fetch', done: 2, total: 2 });
  onProgress?.({ step: 'wca.transform', done: 0, total: 1 });

  // Users — competitor number 用自增序号(WCA 没有 number 概念)
  const users: Record<string, User> = {};
  const numByWcaId = new Map<string, number>();
  for (const r of results) {
    if (!r.wca_id) continue;
    if (numByWcaId.has(r.wca_id)) continue;
    const n = numByWcaId.size + 1;
    numByWcaId.set(r.wca_id, n);
    users[String(n)] = {
      number: n,
      name: r.name,
      wcaid: r.wca_id,
      region: r.country_iso2 ? r.country_iso2.toLowerCase() : '',
    };
  }

  // 1) Events 骨架来自 WCIF(announce-only 也有完整轮次结构,UI selector 立刻可显示)
  const eventMap = new Map<string, EventMeta>();
  const wcifEventOrder: string[] = [];
  for (const ev of wcif.events ?? []) {
    wcifEventOrder.push(ev.id);
    const total = ev.rounds?.length ?? 1;
    eventMap.set(ev.id, {
      i: ev.id, name: ev.id,
      rs: (ev.rounds ?? []).map((r, idx) => {
        const id = canonicalRoundId(idx, total);
        return {
          i: id, e: ev.id, f: r.format,
          co: 0, tl: 0, n: 0, s: 0, rn: 0, tt: 0,
          name: ROUND_NAME[id] || id,
        };
      }),
    });
  }

  // 2) 有 results 时(过去比赛 / 进行中),用 results 重建 rounds — 处理 combined cutoff (d/e/g/c) 等
  //    WCIF 给的是 SCHEDULED 结构,results 反映 ACTUAL,后者优先.
  if (results.length > 0) {
    for (const ev of eventMap.values()) ev.rs = [];
    for (const r of results) {
      let ev = eventMap.get(r.event_id);
      if (!ev) {
        ev = { i: r.event_id, name: r.event_id, rs: [] };
        eventMap.set(r.event_id, ev);
      }
      let rd = ev.rs.find(x => x.i === r.round_type_id);
      if (!rd) {
        rd = {
          i: r.round_type_id, e: r.event_id, f: r.format_id,
          co: 0, tl: 0, n: 0, s: 1, rn: 0, tt: 0,
          name: ROUND_NAME[r.round_type_id] || r.round_type_id,
        };
        ev.rs.push(rd);
      }
      rd.rn += 1;
      rd.tt = rd.rn;
    }
  }
  for (const ev of eventMap.values()) {
    ev.rs.sort((a, b) => (ROUND_ORDER[a.i] ?? 99) - (ROUND_ORDER[b.i] ?? 99));
  }
  // Event 顺序:WCIF events 即官方顺序;results 反推的额外 event(理论上不会发生)追加在后
  const events: EventMeta[] = [];
  for (const id of wcifEventOrder) {
    const ev = eventMap.get(id);
    if (ev) events.push(ev);
  }
  for (const ev of eventMap.values()) {
    if (!events.includes(ev)) events.push(ev);
  }

  // resultsByRound
  const resultsByRound: Record<string, LiveResult[]> = {};
  for (const r of results) {
    const key = `${r.event_id}:${r.round_type_id}`;
    if (!resultsByRound[key]) resultsByRound[key] = [];
    const n = numByWcaId.get(r.wca_id) ?? 0;
    resultsByRound[key].push({
      i: r.id, c: 0, n,
      e: r.event_id, r: r.round_type_id, f: r.format_id,
      b: r.best, a: r.average, v: r.attempts ?? [],
      sr: r.regional_single_record ?? '',
      ar: r.regional_average_record ?? '',
    });
  }
  onProgress?.({ step: 'wca.transform', done: 1, total: 1 });

  const data: CompData = {
    slug: wcaId,
    source: 'wca',
    compId: 0,
    name: wcif.name,
    type: 'WCA',
    events,
    users,
    resultsByRound,
    membersByFilter: { females: [], children: [], newcomers: [] },
    fetchedAt: Date.now(),
  };
  await enrichPersonalRecords(data);
  return data;
}

// ─── WCA dump fast-path (PG wca_results_top) ──────────────────────────────
// 已结束 & 已入库的比赛走这条:本地 PG join wca_persons/wca_countries/wca_competitions,
// 几十 ms 出全部 round 成绩;CI 每周重灌 dump 时一并填新数据.
// 命中即独占,不再 probe cubing / wca_live / wca REST.

interface WcaDbRow {
  event_id: string;
  round_type_id: string;
  format_id: string;
  is_avg: boolean;
  value: number;
  attempts: number[] | null;
  record_tag: string;
  wca_id: string;
  person_country_id: string;
  person_name: string | null;
  country_iso2: string | null;
  comp_name: string | null;
  comp_date: string;          // ISO yyyy-mm-dd — 本比赛 start_date (用于历史 PR 比较)
}

/** 返回 null 表示本地 dump 没有这场比赛 (有效信号,fall-through 给外部 probe);PG 报错才 throw. */
async function tryLoadFromWcaDb(wcaId: string, onProgress?: ProgressFn): Promise<CompData | null> {
  onProgress?.({ step: 'wca_db.query', done: 0, total: 1 });
  const rows = await query<WcaDbRow>(
    `SELECT
       rt.event_id, rt.round_type_id, rt.format_id, rt.is_avg, rt.value, rt.attempts, rt.record_tag,
       rt.wca_id, rt.person_country_id, rt.comp_date,
       p.name AS person_name,
       c.iso2 AS country_iso2,
       comp.name AS comp_name
     FROM wca_results_top rt
     LEFT JOIN wca_persons      p    ON p.wca_id   = rt.wca_id
     LEFT JOIN wca_countries    c    ON c.id       = rt.person_country_id
     LEFT JOIN wca_competitions comp ON comp.id    = rt.comp_id
     WHERE rt.comp_id = ?`,
    [wcaId],
  );
  onProgress?.({ step: 'wca_db.query', done: 1, total: 1 });
  if (rows.length === 0) return null;
  onProgress?.({ step: 'wca_db.transform', done: 0, total: 1 });

  // 单遍累积 users / merged / events 三件事(共享 rows 流),避免 3 次重复迭代 + 中间 scratch map.
  const users: Record<string, User> = {};
  const numByWcaId = new Map<string, number>();
  const merged = new Map<string, LiveResult>();
  const eventMap = new Map<string, EventMeta>();
  const roundLookup = new Map<string, RoundMeta>();      // `${ev}:${rd}` → rd
  const seenInRound = new Map<string, Set<string>>();    // `${ev}:${rd}` → distinct wca_ids(rn 计数源)

  for (const r of rows) {
    let num = numByWcaId.get(r.wca_id);
    if (num === undefined && r.wca_id) {
      num = numByWcaId.size + 1;
      numByWcaId.set(r.wca_id, num);
      users[String(num)] = {
        number: num,
        name: r.person_name ?? r.wca_id,
        wcaid: r.wca_id,
        region: r.country_iso2 ? r.country_iso2.toLowerCase() : '',
      };
    }

    let ev = eventMap.get(r.event_id);
    if (!ev) {
      ev = { i: r.event_id, name: r.event_id, rs: [] };
      eventMap.set(r.event_id, ev);
    }
    const rkey = `${r.event_id}:${r.round_type_id}`;
    let rd = roundLookup.get(rkey);
    if (!rd) {
      rd = {
        i: r.round_type_id, e: r.event_id, f: r.format_id,
        co: 0, tl: 0, n: 0, s: 1, rn: 0, tt: 0,
        name: ROUND_NAME[r.round_type_id] || r.round_type_id,
      };
      roundLookup.set(rkey, rd);
      ev.rs.push(rd);
    }
    let seen = seenInRound.get(rkey);
    if (!seen) { seen = new Set(); seenInRound.set(rkey, seen); }
    if (r.wca_id) seen.add(r.wca_id);

    const mkey = `${rkey}:${r.wca_id}`;
    let cur = merged.get(mkey);
    if (!cur) {
      cur = {
        // 递增 id — wca_db 没有真实 cubing.com result.id,这里用 merged.size+1 保证 React key 唯一.
        i: merged.size + 1, c: 0, n: num ?? 0,
        e: r.event_id, r: r.round_type_id, f: r.format_id,
        b: 0, a: 0, v: [], sr: '', ar: '',
      };
      merged.set(mkey, cur);
    }
    // 优先 best 行的 attempts(更稳),avg 行只在 best 行还没给时兜底.
    if (!r.is_avg || cur.v.length === 0) cur.v = r.attempts ?? cur.v;
    if (r.is_avg) {
      cur.a = r.value;
      if (r.record_tag) cur.ar = r.record_tag;
    } else {
      cur.b = r.value;
      if (r.record_tag) cur.sr = r.record_tag;
    }
  }

  for (const ev of eventMap.values()) {
    for (const rd of ev.rs) {
      const cnt = seenInRound.get(`${rd.e}:${rd.i}`)?.size ?? 0;
      rd.rn = cnt;
      rd.tt = cnt;
    }
    ev.rs.sort((a, b) => (ROUND_ORDER[a.i] ?? 99) - (ROUND_ORDER[b.i] ?? 99));
  }

  const events: EventMeta[] = [];
  const added = new Set<string>();
  for (const id of WCA_EVENT_ORDER) {
    const ev = eventMap.get(id);
    if (ev) { events.push(ev); added.add(id); }
  }
  for (const [id, ev] of eventMap) {
    if (!added.has(id)) events.push(ev);
  }

  const resultsByRound: Record<string, LiveResult[]> = {};
  for (const lr of merged.values()) {
    const key = `${lr.e}:${lr.r}`;
    (resultsByRound[key] ||= []).push(lr);
  }

  // ── 历史 PR rank 检测 + personalRecords 预填 ─────────────────────────
  // 对该比赛每位选手每项目,拉 wca_results_top 中 comp_date < 本比赛日期的全部 distinct 值;
  // 然后按 ROUND_ORDER 升序遍历本比赛各轮 (1 → 2 → 3 → f),为每条结果计算 dense rank:
  //   rank = (历史已见过的、严格小于本值的 distinct 值数) + 1
  //   旧成绩 rank 在它发生那一刻冻结(本算法只 prepend 历史 + 累积本场,符合时间序冻结语义).
  // personalRecords 仍预填 (slot.single/average = 该选手该项目的历史最快值),供 Psych Sheet 排序.
  const personalRecords: Record<string, Record<string, CompPersonalRecordSlot>> = {};
  const compDate = rows[0].comp_date;
  const wcaIdsInComp = [...numByWcaId.keys()];
  const eventIdsInComp = [...eventMap.keys()];
  if (compDate && wcaIdsInComp.length > 0 && eventIdsInComp.length > 0) {
    const idQs = wcaIdsInComp.map(() => '?').join(',');
    const evQs = eventIdsInComp.map(() => '?').join(',');
    const priorRows = await query<{ wca_id: string; event_id: string; is_avg: boolean; value: number }>(
      `SELECT DISTINCT wca_id, event_id, is_avg, value
       FROM wca_results_top
       WHERE wca_id IN (${idQs})
         AND event_id IN (${evQs})
         AND comp_date < ?
         AND value > 0`,
      [...wcaIdsInComp, ...eventIdsInComp, compDate],
    );
    // (wca_id|event_id|is_avg) → Set of distinct values seen historically
    const seenValues = new Map<string, Set<number>>();
    const bestValueByKey = new Map<string, number>();
    for (const pr of priorRows) {
      const k = `${pr.wca_id}|${pr.event_id}|${pr.is_avg ? '1' : '0'}`;
      let set = seenValues.get(k);
      if (!set) { set = new Set(); seenValues.set(k, set); }
      set.add(pr.value);
      const curBest = bestValueByKey.get(k);
      if (curBest === undefined || pr.value < curBest) bestValueByKey.set(k, pr.value);
    }
    // 用 bestValueByKey 填 personalRecords (供 Psych Sheet)
    for (const [k, best] of bestValueByKey) {
      const [wcaId, eventId, isAvgStr] = k.split('|');
      const perEvent = (personalRecords[wcaId] ||= {});
      const slot = (perEvent[eventId] ||= {});
      if (isAvgStr === '1') slot.average = best;
      else slot.single = best;
    }
    // best 那条 result 的 record_tag (区域纪录 marker).DISTINCT ON 按 (wca_id,event_id,is_avg)
    // 取 value 升序第一条;同值多条按 record_tag 优先级 (WR > 大洲 > NR > PR/空) 排.
    // 'PR' / '' 跳过 — PR 在 Psych Sheet 是冗余 (每条都是 PR),仅区域纪录有信息量.
    const tagRows = await query<{ wca_id: string; event_id: string; is_avg: boolean; record_tag: string }>(
      `SELECT DISTINCT ON (wca_id, event_id, is_avg)
         wca_id, event_id, is_avg, record_tag
       FROM wca_results_top
       WHERE wca_id IN (${idQs})
         AND event_id IN (${evQs})
         AND comp_date < ?
         AND value > 0
       ORDER BY wca_id, event_id, is_avg, value ASC,
         CASE record_tag
           WHEN 'WR' THEN 1
           WHEN 'AsR' THEN 2 WHEN 'OcR' THEN 2 WHEN 'AfR' THEN 2
           WHEN 'NAR' THEN 2 WHEN 'SAR' THEN 2 WHEN 'CR' THEN 2
           WHEN 'NR' THEN 3
           ELSE 4
         END ASC`,
      [...wcaIdsInComp, ...eventIdsInComp, compDate],
    );
    for (const tr of tagRows) {
      if (!tr.record_tag || tr.record_tag === 'PR') continue;
      const perEvent = (personalRecords[tr.wca_id] ||= {});
      const slot = (perEvent[tr.event_id] ||= {});
      if (tr.is_avg) slot.averageTag = tr.record_tag;
      else slot.singleTag = tr.record_tag;
    }
    // 按 (wca_id, event_id) 分组本比赛 results,按 round 升序处理
    const groups = new Map<string, LiveResult[]>();
    for (const lr of merged.values()) {
      const wcaIdForN = users[String(lr.n)]?.wcaid;
      if (!wcaIdForN) continue;
      const k = `${wcaIdForN}|${lr.e}`;
      let arr = groups.get(k);
      if (!arr) { arr = []; groups.set(k, arr); }
      arr.push(lr);
    }
    const rankFor = (v: number, seen: Set<number>): number => {
      let distinctLess = 0;
      for (const s of seen) if (s < v) distinctLess++;
      return distinctLess + 1;
    };
    for (const [k, arr] of groups) {
      arr.sort((a, b) => (ROUND_ORDER[a.r] ?? 99) - (ROUND_ORDER[b.r] ?? 99));
      const [wcaIdKey, eventIdKey] = k.split('|');
      const singleKey = `${wcaIdKey}|${eventIdKey}|0`;
      const avgKey    = `${wcaIdKey}|${eventIdKey}|1`;
      let singleSeen = seenValues.get(singleKey);
      if (!singleSeen) { singleSeen = new Set(); seenValues.set(singleKey, singleSeen); }
      let avgSeen = seenValues.get(avgKey);
      if (!avgSeen) { avgSeen = new Set(); seenValues.set(avgKey, avgSeen); }
      for (const lr of arr) {
        if (lr.b > 0) {
          lr.pS = rankFor(lr.b, singleSeen);
          singleSeen.add(lr.b);
        }
        if (lr.a > 0) {
          lr.pA = rankFor(lr.a, avgSeen);
          avgSeen.add(lr.a);
        }
      }
    }
  }
  onProgress?.({ step: 'wca_db.transform', done: 1, total: 1 });

  return {
    slug: wcaId,
    source: 'wca_db',
    compId: 0,
    name: rows[0].comp_name ?? wcaId,
    type: 'WCA',
    events,
    users,
    resultsByRound,
    membersByFilter: { females: [], children: [], newcomers: [] },
    fetchedAt: Date.now(),
    personalRecords,
  };
}

// ─── WCA Live source (GraphQL) ─────────────────────────────────────────────

const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';

interface WcaLiveCompListItem { id: string; wcaId: string }
const COMPS_LIST_TTL_MS = 60_000;
let compsListCache: { at: number; list: WcaLiveCompListItem[] } = { at: 0, list: [] };

async function gql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(WCA_LIVE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`WCA Live HTTP ${res.status}`);
  const j = await res.json() as { data?: T; errors?: { message: string }[] };
  if (j.errors?.length) throw new Error(`WCA Live: ${j.errors[0].message}`);
  if (!j.data) throw new Error('WCA Live: empty data');
  return j.data;
}

async function getWcaLiveCompsList(): Promise<WcaLiveCompListItem[]> {
  if (Date.now() - compsListCache.at < COMPS_LIST_TTL_MS) return compsListCache.list;
  const from = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const data = await gql<{ competitions: WcaLiveCompListItem[] }>(
    'query Q($from: Date!) { competitions(from: $from, limit: 5000) { id wcaId } }',
    { from },
  );
  compsListCache = { at: Date.now(), list: data.competitions };
  return data.competitions;
}

async function probeWcaLive(wcaId: string): Promise<string | null> {
  try {
    const list = await getWcaLiveCompsList();
    return list.find(c => c.wcaId === wcaId)?.id ?? null;
  } catch { return null; }
}

interface WcaLiveRound {
  id: string;
  name: string;
  number: number;
  format: { id: string };
}
interface WcaLiveCompEvent {
  event: { id: string };
  rounds: WcaLiveRound[];
}
interface WcaLiveAttempt { result: number }
interface WcaLiveResult {
  id: string;
  ranking: number | null;
  best: number | null;
  average: number | null;
  single_record_tag: string | null;
  average_record_tag: string | null;
  attempts: WcaLiveAttempt[];
  person: { name: string; wcaId: string; country: { iso2: string } };
}

async function loadFromWcaLive(wcaId: string, onProgress?: ProgressFn, prefetchedInternalId?: string): Promise<CompData> {
  const internalId = prefetchedInternalId ?? await probeWcaLive(wcaId);
  if (!internalId) throw new Error('Not on WCA Live');

  onProgress?.({ step: 'meta', done: 0, total: 1 });
  const metaData = await gql<{ competition: { id: string; wcaId: string; name: string; competitionEvents: WcaLiveCompEvent[] } }>(
    `query Q($id: ID!) {
      competition(id: $id) {
        id wcaId name
        competitionEvents {
          event { id }
          rounds { id name number format { id } }
        }
      }
    }`,
    { id: internalId },
  );
  const comp = metaData.competition;
  onProgress?.({ step: 'meta', done: 1, total: 1 });

  // 把 WCA Live 的 round.number (1/2/3/...) → 我们的 round_type_id ('1'/'2'/'3'/'f')
  // 最后一轮永远 'f',其它按 number 字符串
  const events: EventMeta[] = [];
  type RoundLink = { liveId: string; eventId: string; roundTypeId: string; format: string };
  const roundLinks: RoundLink[] = [];
  for (const ce of comp.competitionEvents) {
    const total = ce.rounds.length;
    const rs: RoundMeta[] = [];
    ce.rounds.forEach((r, idx) => {
      const isFinal = idx === total - 1;
      const roundTypeId = isFinal ? 'f' : String(r.number);
      rs.push({
        i: roundTypeId, e: ce.event.id, f: r.format.id,
        co: 0, tl: 0, n: 0, s: 1, rn: 0, tt: 0,
        name: r.name,
        liveId: r.id,
      });
      roundLinks.push({ liveId: r.id, eventId: ce.event.id, roundTypeId, format: r.format.id });
    });
    events.push({ i: ce.event.id, name: ce.event.id, rs });
  }

  const users: Record<string, User> = {};
  const numByWcaId = new Map<string, number>();
  const resultsByRound: Record<string, LiveResult[]> = {};

  onProgress?.({ step: 'wca_live.results', done: 0, total: roundLinks.length });
  // 串行,WCA Live 单 query complexity 受限,batch 容易超限。30 个 round 大约 3-5s。
  for (let i = 0; i < roundLinks.length; i++) {
    const link = roundLinks[i];
    try {
      const data = await gql<{ round: { results: WcaLiveResult[] } }>(
        `query Q($id: ID!) {
          round(id: $id) {
            results {
              id ranking best average
              singleRecordTag averageRecordTag
              attempts { result }
              person { name wcaId country { iso2 } }
            }
          }
        }`,
        { id: link.liveId },
      );
      const list = data.round.results;
      const liveResults: LiveResult[] = [];
      for (const r of list) {
        const wid = r.person.wcaId;
        let num = wid ? numByWcaId.get(wid) : undefined;
        if (!num) {
          num = numByWcaId.size + 1;
          if (wid) numByWcaId.set(wid, num);
          users[String(num)] = {
            number: num, name: r.person.name, wcaid: wid || '',
            region: (r.person.country.iso2 || '').toLowerCase(),
          };
        }
        liveResults.push({
          i: parseInt(r.id, 10) || 0, c: 0, n: num,
          e: link.eventId, r: link.roundTypeId, f: link.format,
          b: r.best ?? 0, a: r.average ?? 0,
          v: r.attempts.map(a => a.result),
          sr: r.single_record_tag ?? '',
          ar: r.average_record_tag ?? '',
        });
      }
      resultsByRound[`${link.eventId}:${link.roundTypeId}`] = liveResults;
      const rd = events.find(e => e.i === link.eventId)?.rs.find(x => x.i === link.roundTypeId);
      if (rd) { rd.rn = liveResults.length; rd.tt = liveResults.length; }
    } catch { /* 单个 round 失败不致命,继续 */ }
    onProgress?.({ step: 'wca_live.results', done: i + 1, total: roundLinks.length });
  }

  const data: CompData = {
    slug: wcaId,
    wcaLiveId: internalId,
    source: 'wca_live',
    compId: parseInt(internalId, 10) || 0,
    name: comp.name,
    type: 'WCA',
    events,
    users,
    resultsByRound,
    membersByFilter: { females: [], children: [], newcomers: [] },
    fetchedAt: Date.now(),
  };
  enrichRecordTags(data);
  await enrichPersonalRecords(data);
  return data;
}

async function loadFromCubing(wcaId: string, onProgress?: ProgressFn, prefetchedMeta?: ScrapedMeta): Promise<CompData> {
  const cubingSlug = wcaIdToCubingSlug(wcaId);
  let meta: ScrapedMeta;
  if (prefetchedMeta) {
    meta = prefetchedMeta;
    onProgress?.({ step: 'meta', done: 1, total: 1 });
  } else {
    onProgress?.({ step: 'meta', done: 0, total: 1 });
    meta = await scrapeMeta(cubingSlug);
    onProgress?.({ step: 'meta', done: 1, total: 1 });
  }

  // 没开始的比赛所有 round rn=0 && s!=2 ⇒ WS subscribe 后只回个空 users,
  // 接着 runPhase('all') 等不到任何 result.all 响应,挂到 25s overallTimeout 才返回.
  // 跳过 WS,直接落到 competitors HTML 兜底.
  const hasAnyResults = meta.events.some(ev => ev.rs.some(rd => rd.rn > 0 || rd.s === 2));
  let users: Record<string, User> = {};
  let resultsByRound: Record<string, LiveResult[]> = {};
  let membersByFilter: MembersByFilter = { females: [], children: [], newcomers: [] };
  if (hasAnyResults) {
    ({ users, resultsByRound, membersByFilter } = await collectCompData(meta.compId, meta.events, onProgress));
  }

  // WS 没返回报名表(comp 没开始,或 WS 异常)→ 抓 /competition/{slug}/competitors HTML
  if (Object.keys(users).length === 0) {
    try {
      users = await scrapeCompetitors(cubingSlug, onProgress);
    } catch (e) {
      console.warn(`[cubing-live] competitors scrape failed for ${cubingSlug}:`, (e as Error).message);
    }
  } else {
    // WS 给的 users 没 eventIds — Psych Sheet 还没出成绩的项目按报名表过滤靠这个字段.
    // 进行中的比赛 (有部分轮成绩) 抓一份 /competitors HTML 把 eventIds 合并进 WS users.
    try {
      const scraped = await scrapeCompetitors(cubingSlug);
      for (const [num, u] of Object.entries(users)) {
        const s = scraped[num];
        if (s?.eventIds && !u.eventIds) u.eventIds = s.eventIds;
      }
    } catch { /* 已有 users,enrich 失败不影响 */ }
  }

  const data: CompData = {
    slug: wcaId,
    cubingSlug,
    source: 'cubing',
    compId: meta.compId,
    name: meta.name,
    type: meta.type,
    events: meta.events,
    users,
    resultsByRound,
    membersByFilter,
    fetchedAt: Date.now(),
  };
  enrichRecordTags(data);
  await enrichPersonalRecords(data);
  return data;
}

/** /competition/{slug}/competitors HTML scrape.
 *  WS 在比赛还没开始时只回个空 users — 此时 cubing.com 的网页版报名表是唯一公开来源.
 *  tbody 第一行是列汇总(40 / 5/35 / 35/5 / ...)— 用 "name 全是数字或 / " 的启发式过滤掉.
 *  thead 的 header-event th 给出每列对应的 event id,row 里相应 td 含 event-icon-{ev}
 *  = 该选手报名了该项目;空 td = 未报名.psych sheet 据此过滤报名表. */
async function scrapeCompetitors(cubingSlug: string, onProgress?: ProgressFn): Promise<Record<string, User>> {
  onProgress?.({ step: 'cubing.results', done: 0, total: 1 });
  const url = `${CUBING_BASE}/competition/${encodeURIComponent(cubingSlug)}/competitors?lang=en`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      // cubing.com 对裸 UA 返 429 + 让浏览器 set 此 cookie 再 reload,服务器侧也按这个规则放行.
      'Cookie': 'CubingRateLimit=1',
    },
  });
  if (!res.ok) throw new Error(`cubing.com /competitors HTTP ${res.status}`);
  const html = await res.text();

  // thead → event 列顺序 (header-event th 里嵌着 event-icon-{ev}).
  const eventCols: string[] = [];
  const theadMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
  if (theadMatch) {
    const evRe = /<th class="header-event"[^>]*>[\s\S]*?event-icon-([a-z0-9]+)[\s\S]*?<\/th>/g;
    let em: RegExpExecArray | null;
    while ((em = evRe.exec(theadMatch[1])) !== null) eventCols.push(em[1]);
  }

  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return {};
  const tbody = tbodyMatch[1];

  const users: Record<string, User> = {};
  const wcaIdRe = /\/results\/person\/([A-Za-z0-9]+)/;
  const tagRe = /<[^>]+>/g;
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(tbody)) !== null) {
    const inner = trMatch[1];
    const cells: string[] = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let cm: RegExpExecArray | null;
    while ((cm = tdRe.exec(inner)) !== null) cells.push(cm[1]);
    if (cells.length < 4) continue;

    const number = parseInt(cells[0].replace(tagRe, ''), 10);
    if (!Number.isFinite(number)) continue;
    const nameCell = cells[1];
    const name = decodeHtmlEntities(nameCell.replace(tagRe, '')).trim();
    // tbody 第一行的列汇总行:name 槽位是 "5/35" 之类,过滤掉
    if (!name || /^[\d/&;\s]+$/.test(name)) continue;
    const wcaMatch = nameCell.match(wcaIdRe);
    const region = decodeHtmlEntities(cells[3]).replace(/&nbsp;/g, ' ').replace(tagRe, '').trim();

    const eventIds: string[] = [];
    for (let i = 0; i < eventCols.length; i++) {
      const cell = cells[4 + i];
      if (cell && cell.includes(`event-icon-${eventCols[i]}`)) {
        eventIds.push(eventCols[i]);
      }
    }

    users[String(number)] = {
      number,
      name,
      wcaid: wcaMatch ? wcaMatch[1] : '',
      region,
      eventIds,
    };
  }
  onProgress?.({ step: 'cubing.results', done: 1, total: 1 });
  return users;
}

// ─── Source probing ───────────────────────────────────────────────────────

const PROBE_TTL_MS = 5 * 60_000;
interface ProbeResult { wca: boolean; cubingMeta: ScrapedMeta | null; wcaLiveId: string | null; at: number }
const probeCache = new Map<string, ProbeResult>();

async function probeSources(wcaId: string): Promise<ProbeResult> {
  const hit = probeCache.get(wcaId);
  if (hit && Date.now() - hit.at < PROBE_TTL_MS) return hit;
  const [wca, cubingMeta, wcaLiveId] = await Promise.all([
    fetch(`${WCA_API_BASE}/competitions/${encodeURIComponent(wcaId)}`, { method: 'HEAD' })
      .then(r => r.ok).catch(() => false),
    scrapeMeta(wcaIdToCubingSlug(wcaId)).catch(() => null),
    probeWcaLive(wcaId),
  ]);
  const result: ProbeResult = { wca, cubingMeta, wcaLiveId, at: Date.now() };
  probeCache.set(wcaId, result);
  return result;
}

type SourceChoice = 'auto' | SourceId;

/** 默认源选择规则:
 *  - cubing+wca 都有(中国赛后) → wca (WCA REST API 数据更权威)
 *  - wca_live+wca 都有(国外比赛刚结束) → wca_live (实时数据)
 *  - 单一源 → 该源 */
function defaultSource(available: SourceId[]): SourceId {
  if (available.includes('cubing') && available.includes('wca')) return 'wca';
  if (available.includes('wca_live')) return 'wca_live';
  if (available.includes('wca')) return 'wca';
  return available[0];
}

/** WCA announce-only (results=[]) 比赛用 cubing.com 报名表填 users + 拿 wca_persons 补全名. */
async function enrichUsersWithChineseNames(competitorUsers: Record<string, User>): Promise<Record<string, User>> {
  const wcaIds = Object.values(competitorUsers).map(u => u.wcaid).filter(Boolean);
  if (wcaIds.length === 0) return competitorUsers;
  try {
    const personRows = await query<{ wca_id: string; name: string }>(
      `SELECT wca_id, name FROM wca_persons WHERE wca_id = ANY(?::text[])`,
      [wcaIds],
    );
    const nameMap = new Map(personRows.map(r => [r.wca_id, r.name]));
    for (const u of Object.values(competitorUsers)) {
      const full = u.wcaid ? nameMap.get(u.wcaid) : undefined;
      if (full) u.name = full;
    }
  } catch (e) {
    console.warn(`[cubing-live] wca_persons name lookup failed:`, (e as Error).message);
  }
  return competitorUsers;
}

async function loadComp(wcaId: string, choice: SourceChoice = 'auto', onProgress?: ProgressFn): Promise<CompData> {
  // wca_db fast-path: 命中即独占,不发外部 probe.单次 PG 查直接出全部数据.
  if (choice === 'auto' || choice === 'wca_db') {
    const cacheKey = `${wcaId}:wca_db`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < ttlFor('wca_db')) {
      return { ...cached, availableSources: ['wca_db'] };
    }
    // 去重:大比赛 tryLoadFromWcaDb 的 prior-PR 查询 5+ 分钟,并发刷新会堆爆 PG 连接池 (max=10).
    // 同 comp 已在飞就 await 同一个 promise,不开新查询.
    let pending = inflightWcaDb.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        try {
          const data = await tryLoadFromWcaDb(wcaId, onProgress);
          if (data) {
            data.availableSources = ['wca_db'];
            cache.set(cacheKey, data);
            return data;
          }
          return null;
        } catch (e) {
          console.warn(`[cubing-live] wca_db query failed for ${wcaId}:`, (e as Error).message);
          return null;  // PG 错误也走 fall-through (choice='wca_db' 时下方 throw)
        }
      })().finally(() => { inflightWcaDb.delete(cacheKey); });
      inflightWcaDb.set(cacheKey, pending);
    }
    const result = await pending;
    if (result) return result;
    if (choice === 'wca_db') throw new Error(`No data on wca_db for ${wcaId}`);
  }

  // PG-known WCA shortcut: 当 wca_competitions 已收录这场 (announce → 周更 dump 覆盖),
  // 直接跑 wca + 并行 cubing.com 报名表抓取 + probe,skip 串行 probe (~2s).
  // 缓存 / inflight dedup 跟原路径一致.过去比赛走 wca_db fast-path 不到这里.
  // wca_competitions 没收录的(刚宣布、dump 还没更新) fall through 到 probe 兜底.
  if (choice === 'auto') {
    try {
      const known = await query<{ id: string }>(
        `SELECT id FROM wca_competitions WHERE id = ? LIMIT 1`,
        [wcaId],
      );
      if (known.length > 0) {
        const fastKey = `${wcaId}:wca`;
        // 上次 fallback 到 cubing 的决策还在缓存窗内 → 秒返回,跳过 WCA + probe.
        // 全 round finished 的成绩不再变,放宽到 wca TTL(1h);否则正常 60s 兜底.
        // (WCA REST 公示成绩前的几天/几周内反复打开就走这条.)
        const cubingCacheKey = `${wcaId}:cubing`;
        const cubingCached = cache.get(cubingCacheKey);
        if (cubingCached && Object.values(cubingCached.resultsByRound).some(arr => arr.length > 0)) {
          const allFinished = cubingCached.events.every(ev => ev.rs.every(rd => rd.s === 1));
          const ttl = allFinished ? ttlFor('wca') : ttlFor('cubing');
          if (Date.now() - cubingCached.fetchedAt < ttl) return cubingCached;
        }
        const cachedFast = cache.get(fastKey);
        if (cachedFast && Date.now() - cachedFast.fetchedAt < ttlFor('wca')) {
          return { ...cachedFast, availableSources: cachedFast.availableSources ?? ['wca'] };
        }
        const pendingFast = inflight.get(fastKey);
        if (pendingFast) return pendingFast.then(d => ({ ...d, availableSources: d.availableSources ?? ['wca'] }));

        const pFast = (async () => {
          const cubingSlug = wcaIdToCubingSlug(wcaId);
          const [data, probe, scraped] = await Promise.all([
            loadFromWca(wcaId, onProgress),
            probeSources(wcaId),
            scrapeCompetitors(cubingSlug).catch(() => ({} as Record<string, User>)),
          ]);
          const available: SourceId[] = ['wca'];
          if (probe.cubingMeta) available.push('cubing');
          if (probe.wcaLiveId) available.push('wca_live');

          // WCA REST 还没公示成绩(刚结束的比赛 1~4 周内常见) + cubing.com 有数据
          // → 直接走 cubing.com,events/users/results 全替换,前端不再看空表.
          const wcaHasResults = Object.values(data.resultsByRound).some(arr => arr.length > 0);
          if (!wcaHasResults && probe.cubingMeta) {
            const cubingData = await loadFromCubing(wcaId, onProgress, probe.cubingMeta);
            cubingData.availableSources = available;
            cache.set(cubingCacheKey, cubingData);
            return cubingData;
          }

          let finalData = data;
          if (Object.keys(data.users).length === 0 && Object.keys(scraped).length > 0) {
            await enrichUsersWithChineseNames(scraped);
            finalData = { ...data, users: scraped, cubingSlug };
            // loadFromWca 时 users 为空,enrichPersonalRecords 没活干;现在补完 wcaid 再跑.
            await enrichPersonalRecords(finalData);
          }
          finalData.availableSources = available;
          cache.set(fastKey, finalData);
          return finalData;
        })().finally(() => { inflight.delete(fastKey); });

        inflight.set(fastKey, pFast);
        return pFast.then(d => ({ ...d, availableSources: d.availableSources ?? ['wca'] }));
      }
    } catch (e) {
      console.warn(`[cubing-live] PG known check failed for ${wcaId}:`, (e as Error).message);
      // fall through to probe-based path
    }
  }

  const probe = await probeSources(wcaId);
  const availableSources: SourceId[] = [];
  if (probe.cubingMeta) availableSources.push('cubing');
  if (probe.wcaLiveId) availableSources.push('wca_live');
  if (probe.wca) availableSources.push('wca');
  if (availableSources.length === 0) throw new Error('Not found on cubing.com / WCA Live / WCA');

  let useSource: SourceId;
  if (choice === 'auto') {
    useSource = defaultSource(availableSources);
  } else if (!availableSources.includes(choice)) {
    throw new Error(`No data on ${choice}`);
  } else {
    useSource = choice;
  }

  const cacheKey = `${wcaId}:${useSource}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < ttlFor(cached.source)) {
    return { ...cached, availableSources };
  }

  // SSE 也参与去重 — 第二个 waiter 看不到 progress 事件(没传 onProgress 给已在飞的 worker),
  // 但能等到 done.比让每个 SSE 各跑一份 collectCompData 强.
  const pending = inflight.get(cacheKey);
  if (pending) return pending.then(d => ({ ...d, availableSources }));

  const p = (async () => {
    let data: CompData;
    if (useSource === 'wca') data = await loadFromWca(wcaId, onProgress);
    else if (useSource === 'wca_live') data = await loadFromWcaLive(wcaId, onProgress, probe.wcaLiveId || undefined);
    else data = await loadFromCubing(wcaId, onProgress, probe.cubingMeta || undefined);

    // 未来 / 进行中比赛 WCA REST 还没公示成绩 + cubing.com 有 /live 页 → 切到 cubing 拿报名表 + 历史 PR.
    // 走 loadFromCubing 而不是只 scrape /competitors,这样能 enrichPersonalRecords (Psych Sheet 不空).
    if (choice === 'auto' && data.source === 'wca' && Object.keys(data.users).length === 0 && probe.cubingMeta) {
      try {
        data = await loadFromCubing(wcaId, onProgress, probe.cubingMeta);
      } catch (e) {
        console.warn(`[cubing-live] cubing fallback failed for ${wcaId}:`, (e as Error).message);
      }
    }

    // WCA 命中 announcement 但 users={} 且 cubing probe 也 null (未办的中国比赛 — /live 重定向)
    // → 用 WCA cell_name 推 cubing slug 直抓 /competitors 补报名表.源仍记 'wca'.
    // /competitors HTML 只给英文名,在 server 端 JOIN wca_persons 拼"English (中文)"全名.
    if (choice === 'auto' && data.source === 'wca' && Object.keys(data.users).length === 0) {
      const cubingSlug = data.name.replace(/\s+/g, '-');
      try {
        const competitorUsers = await scrapeCompetitors(cubingSlug, onProgress);
        if (Object.keys(competitorUsers).length > 0) {
          await enrichUsersWithChineseNames(competitorUsers);
          data = { ...data, users: competitorUsers, cubingSlug };
          // loadFromWca 时 users={} 跑了一遍 enrichPersonalRecords 没活干;
          // 补完报名表后再拉一遍,Psych Sheet 才能出 PR.
          await enrichPersonalRecords(data);
        }
      } catch (e) {
        console.warn(`[cubing-live] competitors fallback failed for ${cubingSlug}:`, (e as Error).message);
      }
    }

    data.availableSources = availableSources;
    cache.set(`${wcaId}:${data.source}`, data);
    return data;
  })().finally(() => { inflight.delete(cacheKey); });

  inflight.set(cacheKey, p);
  return p;
}

// ─── Routes ────────────────────────────────────────────────────────────────

function parseSource(s: string | undefined): SourceChoice {
  if (s === 'wca' || s === 'cubing' || s === 'wca_live' || s === 'wca_db') return s;
  return 'auto';
}

cubingLiveRoutes.get('/cubing-live-stream/:slug', async (c) => {
  const raw = c.req.param('slug');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(raw)) return c.json({ error: 'invalid slug' }, 400);
  const wcaId = raw.replace(/-/g, '');
  const source = parseSource(c.req.query('source'));

  return streamSSE(c, async (stream) => {
    const onProgress: ProgressFn = (p) => {
      stream.writeSSE({ event: 'progress', data: JSON.stringify(p) }).catch(() => {});
    };

    try {
      const data = await loadComp(wcaId, source, onProgress);
      await stream.writeSSE({ event: 'done', data: JSON.stringify(data) });
    } catch (e) {
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: (e as Error).message }) });
    }
  });
});

/** 把 CompData 裁成只含焦点轮的小响应 (events/membersByFilter 元数据保留;users/resultsByRound/personalRecords 仅保留该轮选手).
 *  /comp/<slug>?event=333&round=f 首屏只需 16 行,完整 621KB 太重 — 走 ?only=333:f 仅 ~3KB. */
function trimToOnlyRound(data: CompData, eventId: string, roundId: string): CompData {
  const key = `${eventId}:${roundId}`;
  const rows = data.resultsByRound[key] ?? [];
  const userNums = new Set<string>();
  for (const r of rows) userNums.add(String(r.n));
  const trimmedUsers: Record<string, User> = {};
  for (const [k, v] of Object.entries(data.users)) {
    if (userNums.has(k)) trimmedUsers[k] = v;
  }
  let trimmedPR: CompData['personalRecords'] = undefined;
  if (data.personalRecords) {
    trimmedPR = {};
    for (const u of Object.values(trimmedUsers)) {
      if (u.wcaid && data.personalRecords[u.wcaid]) {
        trimmedPR[u.wcaid] = data.personalRecords[u.wcaid];
      }
    }
  }
  return {
    ...data,
    users: trimmedUsers,
    resultsByRound: { [key]: rows },
    personalRecords: trimmedPR,
  };
}

// ─── /v1/cubing-zh: 中国大陆比赛中文元数据 ───────
// cubing.com 详情页的"地点"(合并 venue/address/details) + 退赛/重开报名时间。
// 走 PG cn_comp_zh 写穿:DB 命中秒返回,miss → scrape → upsert;启动 + 每日 warm batch
// 已预填全部 upcoming CN 比赛。详 utils/cn_comp_zh_cache.ts。
cubingLiveRoutes.get('/cubing-zh/:wcaId', async (c) => {
  const wcaId = c.req.param('wcaId');
  if (!/^[A-Za-z0-9]{1,80}$/.test(wcaId)) return c.json({ error: 'invalid id' }, 400);
  try {
    const meta = await getCnCompZh(wcaId);
    const isEmpty = !meta.location && !meta.withdrawDeadline && !meta.reopenAt;
    // 命中数据缓存 7d;空(非 CN / cubing.com 无页面)只缓存 1h
    c.header('Cache-Control', isEmpty ? 'public, max-age=3600' : 'public, max-age=604800');
    return c.json(meta);
  } catch (e) {
    console.warn(`[cubing-zh] ${wcaId}:`, (e as Error).message);
    return c.json({ location: null, withdrawDeadline: null, reopenAt: null });
  }
});

cubingLiveRoutes.get('/cubing-live/:slug', async (c) => {
  const raw = c.req.param('slug');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(raw)) return c.json({ error: 'invalid slug' }, 400);
  const wcaId = raw.replace(/-/g, '');
  const source = parseSource(c.req.query('source'));
  const onlyRaw = c.req.query('only');
  const onlyMatch = onlyRaw && /^([A-Za-z0-9]+):([A-Za-z0-9]+)$/.exec(onlyRaw);
  try {
    const data = await loadComp(wcaId, source);
    // wca_db = 过去比赛 (CI 周更),响应可放心 1d immutable;实时源 30s 兜底.
    c.header(
      'Cache-Control',
      data.source === 'wca_db' ? 'public, max-age=86400, immutable' : 'public, max-age=30',
    );
    if (onlyMatch) {
      return c.json(trimToOnlyRound(data, onlyMatch[1], onlyMatch[2]));
    }
    return c.json(data);
  } catch (e) {
    const msg = (e as Error).message;
    return c.json({ error: msg }, 502);
  }
});
