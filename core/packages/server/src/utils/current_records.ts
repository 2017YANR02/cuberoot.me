/**
 * 当前 WCA 纪录快照(WR / CR / NR)— 用于 cubing.com / WCA Live 源比赛页 fallback.
 *
 * 场景:比赛进行中或刚结束、WCA 还没公示这几天里,cubing.com / WCA Live 的
 * single_record_tag 是空,但成绩可能已破纪录.这时拿 wca_results_flat
 * (已公示数据)的当前 MIN 比一下,若 result <= 现 WR/CR/NR 就把 tag 填上.
 *
 * 性能:wca_results_flat ~11M 行,GROUP BY + MIN 即使走索引也要全扫.因此:
 *   1. 内存缓存 24h.
 *   2. peekCurrentRecords() 非阻塞 — 没缓存时立即返 null(后台 fire-and-forget 加载).
 *   3. server 启动时 warm 一次,正常运行期始终有缓存.
 *   4. CR 不查 PG,内存里用 country→continent 把 NR 数据 reduce 出来,省一条慢 SQL.
 *
 * 双端协作:enrichComp() 同时给现有 results 补 tag、解析每个 user 的
 * countryId/continentId、返回 filtered snapshot.client 拿 snapshot 给
 * WS 实时推送的新成绩做同样推断,不需要再请求 server.
 */
import { query } from '../db/connection.js';

export interface CurrentRecords {
  wr: Map<string, number>;                   // "event|isAvg(0|1)"          → min value
  cr: Map<string, number>;                   // "event|isAvg|continent_id"  → min value
  nr: Map<string, number>;                   // "event|isAvg|country_id"    → min value
  iso2ToCountryId: Map<string, string>;      // iso2 lowercase → wca country id
  nameToCountryId: Map<string, string>;      // country name lowercase → wca country id
  countryIdToContinent: Map<string, string>; // wca country id → continent_id
  countryIdToIso2: Map<string, string>;      // wca country id → iso2 lowercase
}

/** 发给 client 的 records 快照(仅本场比赛涉及的国家/洲).client 用同样的 key 规则做 lookup. */
export interface CompRecordsSnapshot {
  wr: Record<string, number>;  // 全集(项目少,~34 条)
  cr: Record<string, number>;  // 仅本场涉及的洲
  nr: Record<string, number>;  // 仅本场涉及的国家
}

let cached: CurrentRecords | null = null;
let cachedAt = 0;
let inflight: Promise<CurrentRecords | null> | null = null;
const TTL_MS = 24 * 60 * 60_000;

async function load(): Promise<CurrentRecords | null> {
  const t0 = Date.now();
  try {
    const countryRows = await query<{ id: string; iso2: string | null; name: string; continent_id: string }>(
      `SELECT id, iso2, name, continent_id FROM wca_countries`,
    );
    const iso2ToCountryId = new Map<string, string>();
    const nameToCountryId = new Map<string, string>();
    const countryIdToContinent = new Map<string, string>();
    const countryIdToIso2 = new Map<string, string>();
    for (const c of countryRows) {
      if (c.iso2) {
        iso2ToCountryId.set(c.iso2.toLowerCase(), c.id);
        countryIdToIso2.set(c.id, c.iso2.toLowerCase());
      }
      nameToCountryId.set(c.name.toLowerCase(), c.id);
      countryIdToContinent.set(c.id, c.continent_id);
    }

    const [wrRows, nrRows] = await Promise.all([
      query<{ event_id: string; is_avg: boolean; v: number }>(
        `SELECT event_id, is_avg, MIN(value)::INT AS v
         FROM wca_results_flat
         WHERE value > 0
         GROUP BY event_id, is_avg`,
      ),
      query<{ event_id: string; is_avg: boolean; person_country_id: string; v: number }>(
        `SELECT event_id, is_avg, person_country_id, MIN(value)::INT AS v
         FROM wca_results_flat
         WHERE value > 0
         GROUP BY event_id, is_avg, person_country_id`,
      ),
    ]);

    const wr = new Map<string, number>();
    for (const r of wrRows) wr.set(`${r.event_id}|${r.is_avg ? '1' : '0'}`, Number(r.v));

    const nr = new Map<string, number>();
    const cr = new Map<string, number>();
    for (const r of nrRows) {
      const k = `${r.event_id}|${r.is_avg ? '1' : '0'}`;
      const v = Number(r.v);
      nr.set(`${k}|${r.person_country_id}`, v);
      const cont = countryIdToContinent.get(r.person_country_id);
      if (cont) {
        const ck = `${k}|${cont}`;
        const prev = cr.get(ck);
        if (prev === undefined || v < prev) cr.set(ck, v);
      }
    }

    const ms = Date.now() - t0;
    console.log(`[current_records] loaded WR=${wr.size} NR=${nr.size} CR=${cr.size} in ${ms}ms`);
    return { wr, cr, nr, iso2ToCountryId, nameToCountryId, countryIdToContinent, countryIdToIso2 };
  } catch (e) {
    console.warn('[current_records] load failed:', (e as Error).message);
    return null;
  }
}

/** await 版:有缓存返缓存,否则等加载(冷启 ~1-5s).仅启动 warm / 显式刷新场景用. */
export async function getCurrentRecords(): Promise<CurrentRecords | null> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const fresh = await load();
    if (fresh) { cached = fresh; cachedAt = Date.now(); }
    inflight = null;
    return fresh;
  })();
  return inflight;
}

/** 非阻塞版:有缓存返缓存;否则立刻返 null 并后台 fire-and-forget 加载. */
export function peekCurrentRecords(): CurrentRecords | null {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  if (!inflight) {
    inflight = (async () => {
      const fresh = await load();
      if (fresh) { cached = fresh; cachedAt = Date.now(); }
      inflight = null;
      return fresh;
    })();
  }
  return null;
}

/** region(cubing.com / WCA Live 字段)→ wca_countries.id. */
function resolveCountryId(region: string, recs: CurrentRecords): string | null {
  if (!region) return null;
  const r = region.trim();
  if (!r) return null;
  if (r.length === 2) return recs.iso2ToCountryId.get(r.toLowerCase()) ?? null;
  if (recs.countryIdToContinent.has(r)) return r;
  return recs.nameToCountryId.get(r.toLowerCase()) ?? null;
}

/** 选手 region / enrichComp 解析出的 countryId → iso2(小写).无缓存 / 无法解析返 ''.
 *  format_cli 拿 person_iso2 把通用 CR 渲染成 AsR/ER/... 的洲际记录,所以必须给准. */
export function resolvePersonIso2(region: string, countryId?: string): string {
  const recs = peekCurrentRecords();
  if (recs && countryId) {
    const iso2 = recs.countryIdToIso2.get(countryId);
    if (iso2) return iso2;
  }
  const r = (region || '').trim();
  if (r.length === 2) return r.toLowerCase();
  if (recs && r) {
    const cid = recs.nameToCountryId.get(r.toLowerCase());
    const iso2 = cid ? recs.countryIdToIso2.get(cid) : undefined;
    if (iso2) return iso2;
  }
  return '';
}

interface MinimalUser {
  region: string;
  countryId?: string;
  continentId?: string;
}

interface MinimalResult {
  e: string;
  n: number;
  b: number;
  a: number;
  sr: string;
  ar: string | number;
}

interface MinimalRound { i: string; }
interface MinimalEvent { i: string; rs: MinimalRound[]; }

/** WCA round_type_id 的大致时序(轮次 metadata 缺失时兜底). */
const DEFAULT_ROUND_RANK: Record<string, number> = {
  '0': 0,
  d: 1, '1': 1,
  e: 2, '2': 2,
  g: 3, '3': 3,
  b: 4, c: 4, f: 4, h: 4,
};
function roundRank(roundId: string, order: string[] | undefined): number {
  if (order) {
    const idx = order.indexOf(roundId);
    if (idx >= 0) return idx;
  }
  return DEFAULT_ROUND_RANK[roundId] ?? 99;
}

function valueOf(lr: MinimalResult, isAvg: boolean): number {
  return isAvg ? lr.a : lr.b;
}

/** 按 running min 判定 tag(WR>CR>NR),并把更好的成绩并入各 scope 的 running min.
 *  传进来的是赛前基线的进度副本:同场比赛里破纪录后会逐步压低门槛,
 *  这样初赛破纪录、后置轮较慢的成绩就不会再被误标(无赛前基线的 scope 不追踪,同原行为). */
function stepRecord(
  value: number,
  eventId: string,
  isAvg: boolean,
  u: MinimalUser | undefined,
  runWr: Map<string, number>,
  runCr: Map<string, number>,
  runNr: Map<string, number>,
): string {
  const k = `${eventId}|${isAvg ? '1' : '0'}`;
  const wrMin = runWr.get(k);
  const crKey = u?.continentId ? `${k}|${u.continentId}` : null;
  const nrKey = u?.countryId ? `${k}|${u.countryId}` : null;
  const crMin = crKey ? runCr.get(crKey) : undefined;
  const nrMin = nrKey ? runNr.get(nrKey) : undefined;

  let tag = '';
  if (wrMin !== undefined && value <= wrMin) tag = 'WR';
  else if (crMin !== undefined && value <= crMin) tag = 'CR';
  else if (nrMin !== undefined && value <= nrMin) tag = 'NR';

  if (wrMin !== undefined && value < wrMin) runWr.set(k, value);
  if (crKey && crMin !== undefined && value < crMin) runCr.set(crKey, value);
  if (nrKey && nrMin !== undefined && value < nrMin) runNr.set(nrKey, value);
  return tag;
}

/** 综合处理一场比赛的数据:
 *  1) 解析每个 user 的 countryId/continentId,attach 进 users (mutate).
 *  2) 给现有 results 的空 sr/ar 推断 tag (mutate).
 *  3) 返回本场比赛涉及国家/洲的 CompRecordsSnapshot — client 拿去给 WS 推的新成绩同款推断.
 *
 *  无 records 缓存时全部跳过,返 null;调用方 fallback 到原行为(显示 PR). */
export function enrichComp(
  users: Record<string, MinimalUser>,
  resultsByRound: Record<string, MinimalResult[]>,
  events?: MinimalEvent[],
): CompRecordsSnapshot | null {
  const recs = peekCurrentRecords();
  if (!recs) return null;

  const countriesInComp = new Set<string>();
  for (const u of Object.values(users)) {
    const cid = resolveCountryId(u.region, recs);
    if (cid) {
      u.countryId = cid;
      countriesInComp.add(cid);
      const cont = recs.countryIdToContinent.get(cid);
      if (cont) u.continentId = cont;
    }
  }

  // running min:赛前基线的进度副本.按 (event → round 时序) 处理,轮内按成绩升序(先处理本轮最好的),
  // 破纪录后压低门槛 → 同场后置轮的较慢成绩不再被误标(snapshot 仍返回赛前基线供 WS 推断).
  const runWr = new Map(recs.wr);
  const runCr = new Map(recs.cr);
  const runNr = new Map(recs.nr);

  const orderByEvent: Record<string, string[]> = {};
  if (events) for (const ev of events) orderByEvent[ev.i] = ev.rs.map(r => r.i);

  const groupsByEvent: Record<string, { roundId: string; list: MinimalResult[] }[]> = {};
  for (const [key, list] of Object.entries(resultsByRound)) {
    const sep = key.indexOf(':');
    const eventId = sep >= 0 ? key.slice(0, sep) : key;
    const roundId = sep >= 0 ? key.slice(sep + 1) : '';
    (groupsByEvent[eventId] ||= []).push({ roundId, list });
  }

  for (const [eventId, groups] of Object.entries(groupsByEvent)) {
    const order = orderByEvent[eventId];
    groups.sort((a, b) => roundRank(a.roundId, order) - roundRank(b.roundId, order));
    for (const isAvg of [false, true] as const) {
      for (const g of groups) {
        const ordered = [...g.list].sort((x, y) => valueOf(x, isAvg) - valueOf(y, isAvg));
        for (const lr of ordered) {
          const val = valueOf(lr, isAvg);
          if (val <= 0) continue;
          const already = isAvg ? lr.ar : lr.sr;
          const tag = stepRecord(val, eventId, isAvg, users[String(lr.n)], runWr, runCr, runNr);
          if (tag && !already) {
            if (isAvg) lr.ar = tag;
            else lr.sr = tag;
          }
        }
      }
    }
  }

  const continentsInComp = new Set<string>();
  for (const cid of countriesInComp) {
    const cont = recs.countryIdToContinent.get(cid);
    if (cont) continentsInComp.add(cont);
  }
  const wr: Record<string, number> = {};
  for (const [k, v] of recs.wr) wr[k] = v;
  const cr: Record<string, number> = {};
  for (const [k, v] of recs.cr) {
    const continent = k.split('|')[2];
    if (continentsInComp.has(continent)) cr[k] = v;
  }
  const nr: Record<string, number> = {};
  for (const [k, v] of recs.nr) {
    const country = k.split('|')[2];
    if (countriesInComp.has(country)) nr[k] = v;
  }
  return { wr, cr, nr };
}
