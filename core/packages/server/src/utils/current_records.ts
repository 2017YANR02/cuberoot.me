/**
 * 当前 WCA 纪录快照(WR / CR / NR)— 用于 cubing.com / WCA Live 源比赛页 fallback.
 *
 * 场景:比赛刚结束、WCA 还没公示这几天里,cubing.com 的 single_record_tag 是空,
 * 但成绩已破纪录.这时拿 wca_results_top(已公示数据)的当前 MIN 比一下:
 * 若 result <= 现 WR/CR/NR 就把 tag 填上,避免显示成 "PR".
 *
 * 性能:wca_results_top ~11M 行,GROUP BY + MIN 即使走索引也要全扫 ~5s.
 * 因此:
 *   1. 内存缓存 24h.
 *   2. 用 peekCurrentRecords() 非阻塞访问 — 没缓存时立即返 null 并后台 fire-and-forget.
 *   3. server 启动时 warm 一次,正常运行期始终有缓存.
 *   4. CR 不查 PG,直接在内存里用 country→continent 把 NR 数据 reduce 出来,省一条慢 SQL.
 */
import { query } from '../db/connection.js';

export interface CurrentRecords {
  wr: Map<string, number>;                   // "event|isAvg(0|1)"          → min value
  cr: Map<string, number>;                   // "event|isAvg|continent_id"  → min value
  nr: Map<string, number>;                   // "event|isAvg|country_id"    → min value
  iso2ToCountryId: Map<string, string>;      // iso2 lowercase → wca country id
  nameToCountryId: Map<string, string>;      // country name lowercase → wca country id
  countryIdToContinent: Map<string, string>; // wca country id → continent_id
}

let cached: CurrentRecords | null = null;
let cachedAt = 0;
let inflight: Promise<CurrentRecords | null> | null = null;
const TTL_MS = 24 * 60 * 60_000;

async function load(): Promise<CurrentRecords | null> {
  const t0 = Date.now();
  try {
    // 先拉国家表(小,~200 行)— NR→CR 推导要用
    const countryRows = await query<{ id: string; iso2: string | null; name: string; continent_id: string }>(
      `SELECT id, iso2, name, continent_id FROM wca_countries`,
    );
    const iso2ToCountryId = new Map<string, string>();
    const nameToCountryId = new Map<string, string>();
    const countryIdToContinent = new Map<string, string>();
    for (const c of countryRows) {
      if (c.iso2) iso2ToCountryId.set(c.iso2.toLowerCase(), c.id);
      nameToCountryId.set(c.name.toLowerCase(), c.id);
      countryIdToContinent.set(c.id, c.continent_id);
    }

    // WR + NR 并行(都走 wca_results_top,各自有专用索引)
    const [wrRows, nrRows] = await Promise.all([
      query<{ event_id: string; is_avg: boolean; v: number }>(
        `SELECT event_id, is_avg, MIN(value)::INT AS v
         FROM wca_results_top
         WHERE value > 0
         GROUP BY event_id, is_avg`,
      ),
      query<{ event_id: string; is_avg: boolean; person_country_id: string; v: number }>(
        `SELECT event_id, is_avg, person_country_id, MIN(value)::INT AS v
         FROM wca_results_top
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
      // 推 CR:取该洲内所有 (event, is_avg, country) NR 最小值
      const cont = countryIdToContinent.get(r.person_country_id);
      if (cont) {
        const ck = `${k}|${cont}`;
        const prev = cr.get(ck);
        if (prev === undefined || v < prev) cr.set(ck, v);
      }
    }

    const ms = Date.now() - t0;
    console.log(`[current_records] loaded WR=${wr.size} NR=${nr.size} CR=${cr.size} in ${ms}ms`);
    return { wr, cr, nr, iso2ToCountryId, nameToCountryId, countryIdToContinent };
  } catch (e) {
    console.warn('[current_records] load failed:', (e as Error).message);
    return null;
  }
}

/** await 版:有缓存返缓存,否则等加载完成(可能 5-10s).
 *  仅 server 启动 warm + 显式刷新场景用,**不要**给 request hot path 用. */
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

/** 非阻塞版:有缓存返缓存;否则立刻返 null 并后台 fire-and-forget 加载.
 *  request hot path 用这个 — 首请求不会被卡 5s, 第二次开始就有数据. */
export function peekCurrentRecords(): CurrentRecords | null {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  // 后台触发加载,不 await
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

/** region(cubing.com / WCA Live 字段)→ wca_countries.id.
 *  region 可能是 iso2 小写、国家全名、或已经是 wca id. */
function resolveCountryId(region: string, recs: CurrentRecords): string | null {
  if (!region) return null;
  const r = region.trim();
  if (!r) return null;
  if (r.length === 2) return recs.iso2ToCountryId.get(r.toLowerCase()) ?? null;
  if (recs.countryIdToContinent.has(r)) return r;
  return recs.nameToCountryId.get(r.toLowerCase()) ?? null;
}

/** 推断成绩对应的 record tag(WR > CR > NR).value 须 > 0;无破纪录返 ''. */
export function inferRecordTag(
  value: number,
  eventId: string,
  isAvg: boolean,
  region: string,
  recs: CurrentRecords,
): string {
  if (!value || value <= 0) return '';
  const k = `${eventId}|${isAvg ? '1' : '0'}`;
  const wrMin = recs.wr.get(k);
  if (wrMin !== undefined && value <= wrMin) return 'WR';
  const countryId = resolveCountryId(region, recs);
  if (!countryId) return '';
  const continent = recs.countryIdToContinent.get(countryId);
  if (continent) {
    const crMin = recs.cr.get(`${k}|${continent}`);
    if (crMin !== undefined && value <= crMin) return 'CR';
  }
  const nrMin = recs.nr.get(`${k}|${countryId}`);
  if (nrMin !== undefined && value <= nrMin) return 'NR';
  return '';
}
