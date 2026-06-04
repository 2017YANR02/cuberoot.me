/**
 * cubing.com 中国比赛纪录快讯监控 —— 移植自 Python cubing_record_monitor.py 的 RECORD 路径。
 *
 * 流程:
 *   1. GET /api/competition 取比赛列表
 *   2. 过滤「中国(含港澳台)+ live=1 + date.from 在过去 30 天内」的比赛
 *   3. 每场一条 WS 连接拉所有 round 的 result.all
 *   4. row.sr / row.ar 非空 → 破纪录,过滤后按 record_format 模板推 Bark
 *
 * dedup 走 monitor_pushed_state('cubing_record'),无首跑静默吸收 —— 用户要
 * 「过去 N 天补推 + 已推不重推」,所以未 known 的全推。
 *
 * Bark 文案保留原 emoji / 措辞,推送正文须与旧 Python 逐字一致(网页 UI 才禁 emoji)。
 *
 * ⚠️ 本阶段只移植 RECORD 检测。watched_keys / PR / result.user / _fetch_user_pr_rows /
 *    iter_pr_events 全部跳过(Phase 4),scan_comp 里留 // Phase 4 桩注释。
 */
import WebSocket from 'ws';
import { sendBark } from './bark.js';
import { getPushedSet, markPushed, type MonitorId } from './state.js';
import { RECORD_TAGS, NR_COUNTRIES, POLL_INTERVAL_MS } from './config.js';
import { COUNTRY_EN_MAP, isContinentalTag } from './region.js';
import { getWatchedMatchKeys } from './watched.js';
import { EVENT_NAME_BY_ID, type RecordEvent } from '../utils/record_format.js';
import { formatRecords } from '../routes/wca_format.js';

const MONITOR: MonitorId = 'cubing_record';
const CUBING_API = 'https://cubing.com/api/competition';
const WS_URL = 'wss://cubing.com/ws';
const UA: Record<string, string> = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

// 监控窗口(天):扫 date.from 在过去 N 天内开始的中国比赛(覆盖赛中赛后补录的纪录),
// 已推过的由 monitor_pushed_state dedup。硬编码 30(原 cfg.cubing_record_window_days)。
const WINDOW_DAYS = 30;

// 中国(含港澳台)地区在 cubing.com locations.province 中的特殊关键字 → ISO2
const PROVINCE_TO_ISO2: Record<string, string> = { 香港: 'HK', 台湾: 'TW', 澳门: 'MO' };

// ─── 类型 ──────────────────────────────────────────────────────────────────

interface CubingComp {
  id?: number | string;
  alias?: string;
  name?: string;
  name_en?: string;
  live?: number;
  date?: { from?: number; to?: number };
  locations?: { province?: string }[];
}

interface WsUser {
  name?: string;
  wcaid?: string;
  region?: string;
}

// result row(实测):i:result-id n:competitor# e:event r:round b:best(cs) a:average(cs)
// sr:"WR"/"AsR"/... ar:同上(平均)
interface LiveRow {
  i: number;
  n: number;
  e: string;
  r: string;
  b?: number | null;
  a?: number | null;
  sr?: string;
  ar?: string | number;
}

interface InternalEvent {
  uid: string;
  groupKey: string;
  tag: string;
  recType: 'single' | 'average';
  attemptResult: number;
  eventId: string;
  roundId: string;
  personName: string;
  personRegion: string;
  compIso2: string;
  compName: string;
  compNameEn: string;
  slug: string;
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────

async function httpGetJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function listCompetitions(): Promise<CubingComp[]> {
  const data = await httpGetJson<{ data?: CubingComp[] }>(CUBING_API);
  return data.data ?? [];
}

/** 中国(含港澳台)+ 启用 cubing.com live + date.from 在过去 window 秒内。now 单位:秒。 */
function isChinaInWindow(comp: CubingComp, now: number, windowSeconds: number): boolean {
  // live=0 表示没启用 cubing.com 直播,/live/<slug> 没 data-c,扫描无意义。
  if (comp.live !== 1) return false;
  const locations = comp.locations ?? [];
  if (locations.length === 0) return false;
  const province = (locations[0]?.province ?? '').trim();
  const isSpecial = Object.keys(PROVINCE_TO_ISO2).some((k) => province.includes(k));
  if (!isSpecial && !province) return false;
  const start = comp.date?.from ?? 0;
  const cutoff = now - windowSeconds;
  return cutoff <= start && start <= now + 86400;
}

/** 从 locations[0].province 推断比赛所在地区 ISO2,默认 CN。 */
function compIso2(comp: CubingComp): string {
  const province = comp.locations?.[0]?.province ?? '';
  for (const [keyword, iso] of Object.entries(PROVINCE_TO_ISO2)) {
    if (province.includes(keyword)) return iso;
  }
  return 'CN';
}

// ─── live 页 HTML 抓取 ──────────────────────────────────────────────────────

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** <title>X - Y</title> → unescape(X)(取 ' - ' 前段)。 */
function extractTitle(body: string, slug: string): string {
  const m = body.match(/<title>([^<]+)<\/title>/);
  if (!m) return slug;
  return decodeHtmlEntities(m[1].split(' - ')[0]).trim();
}

interface LiveRounds {
  cid: number;
  rounds: [string, string][]; // [eventId, roundId]
  cnTitle: string;
  enTitle: string;
}

/** 从 live 页 HTML 拿 (cid, rounds, cnTitle, enTitle)。跑两次 HTTP:默认中文 + ?lang=en。
 *  缺 data-c / data-events(下线 / 取消 / 改版)抛错,由调用方捕获跳过。 */
async function fetchLiveRounds(slug: string): Promise<LiveRounds> {
  const urlCn = `https://cubing.com/live/${slug}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  let bodyCn: string;
  try {
    const res = await fetch(urlCn, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} on /live/${slug}`);
    bodyCn = await res.text();
  } finally {
    clearTimeout(t);
  }

  const mC = bodyCn.match(/data-c="(\d+)"/);
  if (!mC) throw new Error(`data-c not found on /live/${slug} (页面无效或已下线)`);
  const mEv = bodyCn.match(/data-events="([^"]+)"/);
  if (!mEv) throw new Error(`data-events not found on /live/${slug}`);
  const cid = Number(mC[1]);
  const events = JSON.parse(decodeHtmlEntities(mEv[1])) as { i: string; rs: { i: string }[] }[];
  const rounds: [string, string][] = events.flatMap((ev) => ev.rs.map((rd) => [ev.i, rd.i] as [string, string]));
  const cnTitle = extractTitle(bodyCn, slug);

  // 再拿一次英文 title(EN 推送用),失败回退 slug 去横杠。
  let enTitle: string;
  try {
    const ctrlEn = new AbortController();
    const tEn = setTimeout(() => ctrlEn.abort(), 30000);
    try {
      const resEn = await fetch(`${urlCn}?lang=en`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctrlEn.signal });
      const bodyEn = await resEn.text();
      enTitle = extractTitle(bodyEn, slug);
    } finally {
      clearTimeout(tEn);
    }
  } catch (e) {
    console.warn(`[cubing-record] fetch en title failed slug=${slug}: ${(e as Error).message}; fallback to slug`);
    enTitle = slug.replace(/-/g, ' ');
  }

  return { cid, rounds, cnTitle, enTitle };
}

// ─── WS fetch ──────────────────────────────────────────────────────────────

function openCubingWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, {
      headers: { Origin: 'https://cubing.com', 'User-Agent': 'Mozilla/5.0' },
    });
    const t = setTimeout(() => {
      ws.terminate();
      reject(new Error('WS open timeout'));
    }, 20000);
    ws.once('open', () => { clearTimeout(t); resolve(ws); });
    ws.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}

// result.user 的 nb/na 行(破生涯 PR 标记)。schema 与 LiveRow 近似,额外带 _event/_wcaid/_name/_region。
interface PrRow {
  i: number;          // result id
  n?: number;         // competitor number
  e?: string;         // event id 字符串 "333"
  r?: string;         // round id
  b?: number | null;
  a?: number | null;
  nb?: boolean;       // 破单次生涯 PR
  na?: boolean;       // 破平均生涯 PR
  sr?: string;
  ar?: string | number;
  _event?: string | number | null;
  _wcaid: string;
  _name: string;
  _region?: string;
}

interface CompResults {
  users: Record<number, WsUser>;
  rows: LiveRow[];
  prRows: PrRow[];
}

/** cubing.com user.name → 选手 key(优先括号内中文名,否则原名)。等价 Python _match_key。 */
function matchKey(name: string): string {
  const m = (name || '').match(/\(([^)]+)\)/);
  return (m ? m[1] : name || '').trim();
}

/** 在一条 ws 上挂临时 message 监听,onMsg 返 true 即本相收齐;deadline / close 也结束。
 *  结束后摘掉监听,供分相复用同一连接(result.all 相 → result.user 相)。 */
function awaitMessages(
  ws: WebSocket,
  onMsg: (msg: { code?: number; type?: string; data?: unknown }) => boolean,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      ws.off('message', handler);
      ws.off('close', onClose);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    const onClose = (): void => finish();
    const handler = (raw: WebSocket.RawData): void => {
      let msg: { code?: number; type?: string; data?: unknown };
      try {
        const text = raw.toString();
        if (text === '"pong"' || text === 'pong') return;
        msg = JSON.parse(text);
      } catch { return; }
      if (msg.code !== undefined && msg.code !== 200) return;
      if (onMsg(msg)) finish();
    };
    ws.on('message', handler);
    ws.once('close', onClose);
  });
}

/** 单场比赛一条 WS 连接:相 1 拉所有 round 的 result.all(收 users + rows);
 *  相 2 对参赛且被关注的选手发 result.user 收 nb/na 生涯 PR rows。
 *  收齐(gotUsers && receivedRounds>=rounds.length)或各相 deadline 停。watchedKeys 空则跳过相 2。 */
async function fetchCompResults(
  cid: number,
  rounds: [string, string][],
  watchedKeys: Set<string>,
): Promise<CompResults> {
  const ws = await openCubingWs();
  const users: Record<number, WsUser> = {};
  const rows: LiveRow[] = [];
  const prRows: PrRow[] = [];

  try {
    // 相 1:result.all
    let gotUsers = false;
    let receivedRounds = 0;
    ws.send(JSON.stringify({ type: 'competition', competitionId: cid }));
    for (const [eid, rid] of rounds) {
      ws.send(JSON.stringify({ type: 'result', action: 'fetch', params: { event: eid, round: rid, filter: 'all' } }));
    }
    await awaitMessages(ws, (msg) => {
      if (msg.type === 'users' && msg.data && typeof msg.data === 'object') {
        for (const [k, v] of Object.entries(msg.data as Record<string, WsUser>)) users[Number(k)] = v;
        gotUsers = true;
      } else if (msg.type === 'result.all' && Array.isArray(msg.data)) {
        receivedRounds += 1;
        for (const row of msg.data as LiveRow[]) rows.push(row);
      }
      return gotUsers && receivedRounds >= rounds.length;
    }, 30000);

    // 相 2:result.user PR(仅关注选手)。串行,每人一个 10s 窗口。
    if (watchedKeys.size > 0 && gotUsers) {
      const watchedPairs: { number: number; wcaid: string; name: string }[] = [];
      for (const [num, u] of Object.entries(users)) {
        if (!u.wcaid) continue;
        if (watchedKeys.has(matchKey(u.name || ''))) {
          watchedPairs.push({ number: Number(num), wcaid: u.wcaid, name: u.name || '' });
        }
      }
      for (const p of watchedPairs) {
        ws.send(JSON.stringify({ type: 'result', action: 'user', user: { number: p.number, wcaid: p.wcaid } }));
        let currentEvent: string | number | null = null;
        await awaitMessages(ws, (msg) => {
          if (msg.type !== 'result.user') return false; // 等到本人 result.user 这相才结束
          const data = (msg.data as { t?: string; e?: string | number; sr?: string; ar?: string | number; nb?: boolean; na?: boolean }[]) || [];
          for (const entry of data) {
            if (entry.t === 'e') {
              currentEvent = entry.e ?? null;
            } else if (entry.t === 'r') {
              // sr/ar 已由 record 路径覆盖,跳过
              if (entry.sr || entry.ar) continue;
              if (entry.nb || entry.na) {
                prRows.push({ ...(entry as unknown as PrRow), _event: currentEvent, _wcaid: p.wcaid, _name: p.name });
              }
            }
          }
          return true;
        }, 10000);
      }
    }
  } finally {
    try { ws.terminate(); } catch { /* ignore */ }
  }

  return { users, rows, prRows };
}

// ─── 纪录检测 ───────────────────────────────────────────────────────────────

/** 遍历一场比赛的所有 result row,产出可推送的内部 event。
 *  每条 sr / ar 标记一个 event;同 row 的两条共享 groupKey,后续可合并推送。 */
function iterRecordEvents(rows: LiveRow[], users: Record<number, WsUser>, comp: CubingComp): InternalEvent[] {
  const cIso2 = compIso2(comp);
  const compName = comp.name || comp.alias || '';
  const compNameEn = comp.name_en || comp.name || comp.alias || '';
  const slug = comp.alias || '';
  const out: InternalEvent[] = [];

  for (const row of rows) {
    const fields: [string, 'single' | 'average', number | null | undefined][] = [
      ['sr', 'single', row.b],
      ['ar', 'average', row.a],
    ];
    for (const [field, recType, value] of fields) {
      const tagRaw = field === 'sr' ? row.sr : row.ar;
      const tag = (tagRaw || '') as string;
      if (!tag) continue;
      // 纪录但成绩 DNF/缺失 — 不应该出现,跳过
      if (value == null || value <= 0) continue;
      const user = users[row.n];
      if (!user) continue;
      out.push({
        uid: `cubing-${row.i}-${field}`,
        groupKey: `cubing-row-${row.i}`,
        tag,
        recType,
        attemptResult: value,
        eventId: row.e,
        roundId: row.r,
        personName: user.name || '',
        personRegion: user.region || '',
        compIso2: cIso2,
        compName,
        compNameEn,
        slug,
      });
    }
  }
  return out;
}

/** result.user 的 nb/na rows → PR 内部 event(对应 Python iter_pr_events)。
 *  按 (wcaid, eventId, recType) 去重取最快;同选手同事件 single+avg 共享 groupKey 合并推送。 */
function iterPrEvents(prRows: PrRow[], comp: CubingComp): InternalEvent[] {
  const cIso2 = compIso2(comp);
  const compName = comp.name || comp.alias || '';
  const compNameEn = comp.name_en || comp.name || comp.alias || '';
  const slug = comp.alias || '';

  // (wcaid|eventId|recType) → 最快的那条
  const best = new Map<string, { row: PrRow; value: number }>();
  for (const row of prRows) {
    const wcaid = row._wcaid || '';
    // r.e 优先(字符串 "333");否则 fallback str(_event)
    const eventId = row.e || String(row._event ?? '');
    const kinds: [keyof PrRow, 'single' | 'average', number | null | undefined][] = [
      ['nb', 'single', row.b],
      ['na', 'average', row.a],
    ];
    for (const [flag, recType, v] of kinds) {
      if (!row[flag]) continue;
      if (v == null || v <= 0) continue;
      const k = `${wcaid}|${eventId}|${recType}`;
      const cur = best.get(k);
      if (!cur || v < cur.value) best.set(k, { row, value: v });
    }
  }

  const out: InternalEvent[] = [];
  for (const [k, { row, value }] of best) {
    if (!row.i) continue;
    const [wcaid, eventId, recType] = k.split('|') as [string, string, 'single' | 'average'];
    const field = recType === 'single' ? 'nb' : 'na';
    out.push({
      uid: `cubing-${row.i}-${field}`,
      groupKey: `cubing-pr-${wcaid}-${eventId}`,
      tag: 'PR',
      recType,
      attemptResult: value,
      eventId,
      roundId: row.r || '',
      personName: row._name || '',
      personRegion: row._region || 'China',
      compIso2: cIso2,
      compName,
      compNameEn,
      slug,
    });
  }
  return out;
}

/** 扫描单场比赛,返回所有 record + PR 事件。 */
async function scanComp(comp: CubingComp, watchedKeys: Set<string>): Promise<InternalEvent[]> {
  const slug = comp.alias;
  if (!slug) {
    console.warn(`[cubing-record] comp without alias: id=${comp.id} name=${comp.name}`);
    return [];
  }
  let live: LiveRounds;
  try {
    live = await fetchLiveRounds(slug);
  } catch (e) {
    console.warn(`[cubing-record] fetch live page failed slug=${slug}: ${(e as Error).message}`);
    return [];
  }
  if (live.rounds.length === 0) return [];

  // 比赛名缺失 / 等于 slug 时用 live 页中文标题补全;英文标题填 name_en。
  const enriched: CubingComp = { ...comp, name_en: live.enTitle };
  if (!enriched.name || enriched.name === slug) enriched.name = live.cnTitle;

  let results: CompResults;
  try {
    results = await fetchCompResults(live.cid, live.rounds, watchedKeys);
  } catch (e) {
    console.warn(`[cubing-record] fetch ws results failed cid=${live.cid}: ${(e as Error).message}`);
    return [];
  }

  // PR row 补 region(从 users map 反查)
  for (const pr of results.prRows) {
    const u = pr.n != null ? results.users[pr.n] : undefined;
    if (u) pr._region = u.region;
  }

  const events = iterRecordEvents(results.rows, results.users, enriched);
  events.push(...iterPrEvents(results.prRows, enriched));
  return events;
}

// ─── 过滤 + 聚合 + 推送 ─────────────────────────────────────────────────────

/** 内部 event → RecordEvent(供 formatRecords)。 */
function toRecordEvent(ev: InternalEvent): RecordEvent {
  return {
    tag: ev.tag,
    rec_type: ev.recType,
    attempt_result: ev.attemptResult,
    event_id: ev.eventId,
    event_name: EVENT_NAME_BY_ID[ev.eventId] || ev.eventId,
    person_name: ev.personName,
    person_iso2: COUNTRY_EN_MAP[ev.personRegion] || '',
    person_country_en: ev.personRegion,
    comp_name: ev.compName,
    comp_name_en: ev.compNameEn,
    comp_iso2: ev.compIso2,
    url: `https://cubing.com/live/${ev.slug}?event=${ev.eventId}&round=${ev.roundId}`,
  };
}

/** tag 过滤:RECORD_TAGS 精确匹配;洲缩写命中 RECORD_TAGS 含 'CR' 时通配;NR 走国家白名单。
 *  PR 一律跳过(Phase 4)。 */
function wanted(ev: InternalEvent): boolean {
  const tag = ev.tag;
  // PR 已被 watchedKeys 过滤,无条件放行(对齐 Python _wanted: if tag=='PR': return True)。
  if (tag === 'PR') return true;
  if (!(RECORD_TAGS.has(tag) || (isContinentalTag(tag) && RECORD_TAGS.has('CR')))) return false;
  if (tag === 'NR' && NR_COUNTRIES.size > 0) {
    const personIso2 = COUNTRY_EN_MAP[ev.personRegion] || '';
    if (!NR_COUNTRIES.has(personIso2)) return false;
  }
  return true;
}

/** 对一批纪录事件过滤 + 按 groupKey 聚合 + 推送。无首跑静默吸收(未 known 全推)。 */
async function processEvents(events: InternalEvent[]): Promise<void> {
  const candidates = events.filter(wanted);
  if (candidates.length === 0) return;

  const pushed = await getPushedSet(MONITOR, candidates.map((e) => e.uid));
  const fresh = candidates.filter((e) => !pushed.has(e.uid));
  if (fresh.length === 0) return;

  // 按 groupKey 聚合(同一 row 的 sr+ar 落到同一组),组内 single 先。
  const groups = new Map<string, InternalEvent[]>();
  for (const ev of fresh) {
    let arr = groups.get(ev.groupKey);
    if (!arr) { arr = []; groups.set(ev.groupKey, arr); }
    arr.push(ev);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => (a.recType === 'single' ? 0 : 1) - (b.recType === 'single' ? 0 : 1));
    const uids = group.map((e) => e.uid);
    try {
      const { cn, en, url } = await formatRecords(group.map(toRecordEvent));
      console.log(`[cubing-record] 🆕 新纪录${group.length > 1 ? '(合并)' : ''}: ${cn}`);
      if (await sendBark({ title: cn, body: en, url, group: 'WCA Records', sound: 'multiwayinvitation' })) {
        await markPushed(MONITOR, uids);
      } else {
        console.warn(`[cubing-record] push failed, will retry: ${uids.join(',')}`);
      }
    } catch (e) {
      console.warn(`[cubing-record] format/push error for ${uids.join(',')}: ${(e as Error).message}`);
    }
  }
}

// ─── 主循环 ─────────────────────────────────────────────────────────────────

/** 单次扫描全部目标比赛(每场一条 WS 连接,串行)。每场错误捕获后跳过,不让整轮崩。 */
async function runOnce(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  let comps: CubingComp[];
  try {
    comps = await listCompetitions();
  } catch (e) {
    console.warn(`[cubing-record] list competitions failed: ${(e as Error).message}`);
    return;
  }
  const windowSec = WINDOW_DAYS * 86400;
  const targets = comps.filter((c) => isChinaInWindow(c, now, windowSec));
  console.log(`[cubing-record] CN comps in last ${WINDOW_DAYS} days: ${targets.length}`);

  // 关注选手 key(PR 监控用),空则相 2 跳过。每轮取一次(watched.ts 内有 60s 缓存)。
  const watchedKeys = await getWatchedMatchKeys();

  for (const comp of targets) {
    try {
      const events = await scanComp(comp, watchedKeys);
      if (events.length > 0) console.log(`[cubing-record] ${comp.alias}: ${events.length} record events`);
      await processEvents(events);
    } catch (e) {
      console.warn(`[cubing-record] scan comp ${comp.alias} failed: ${(e as Error).message}`);
    }
  }
}

export function startCubingRecordMonitor(): void {
  runOnce().catch((e) => console.error('[cubing-record] runOnce error:', e));
  setInterval(() => {
    runOnce().catch((e) => console.error('[cubing-record] runOnce error:', e));
  }, POLL_INTERVAL_MS.cubingRecord);
}
