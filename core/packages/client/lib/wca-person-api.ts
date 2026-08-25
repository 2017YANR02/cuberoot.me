// 选手数据客户端(选手页 / 复盘页共用)。
//
// 分层(2026-07-30 改):
//   主源 = 自家库 `/v1/wca/person-page` —— 资料 + 全部成绩 + 参赛比赛一次给全,不依赖 WCA
//          官网可达性。官网从国内不通时,以前这页只有「加载中…」,因为首屏三个源都直连官网。
//   增强 = WCA 官网 —— 库是日更的(dump 天更 + 每晚 20:00 UTC 灌库),今天刚公示的成绩要靠
//          官网补;后台拿到就通过 onFresh 覆盖,拿不到静默作罢。
//   兜底 = 库里没这个人(表未 bootstrap / 极新选手)→ 退回老路:直连官网 + localStorage 缓存。
//
// Thin client for the WCA public API (https://documenter.getpostman.com/view/4584491/SVfWN6KS).

import { API_ORIGIN, apiUrl } from './api-base';
import { persistItem } from './safe-storage';

const BASE = 'https://www.worldcubeassociation.org/api/v0';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// 首屏三个源(profile / results / competitions)都直连 WCA 官网,页面在 profile 到达前
// 只有「加载中…」。官网慢/不通时 fetch 默认永不超时 → 整页永久卡住,所以自己钉一个上界:
// 超时即当失败,交给 cachedFetch 的过期缓存兜底,再不行才报错(错误态有重试按钮)。
const WCA_TIMEOUT_MS = 12 * 1000;
// 缓存命中但年龄超过这个值时,后台静默回源重验一次(stale-while-revalidate)。
// 成绩公示当天必须能自愈:比赛期间显示的「直播·非官方」行在官方收录后会被服务端删掉
// (wca_live_person_results 按 comp 清行),若官方成绩这边只认 24h 硬缓存,昨天来过的
// 访客今天会看到那场比赛整场消失 —— 直播行没了,官方行还卡在旧缓存里。
const REVALIDATE_AFTER_MS = 5 * 60 * 1000;

interface CacheEntry<T> { t: number; v: T; }

function cacheRead<T>(key: string): { v: T; age: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as CacheEntry<T>;
    return { v, age: Date.now() - t };
  } catch { return null; }
}

function cacheGet<T>(key: string): T | null {
  const hit = cacheRead<T>(key);
  return hit && hit.age <= CACHE_TTL_MS ? hit.v : null;
}

function cacheSet<T>(key: string, value: T): void {
  persistItem(key, JSON.stringify({ t: Date.now(), v: value }));
}

/** WCA 官网 API GET,带超时。超时/网络错都抛,由 cachedFetch 决定怎么兜。 */
async function wcaJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WCA_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`WCA API ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 24h 缓存 + stale-while-revalidate:命中即返(重复访问仍然瞬开),旧值在后台回源,
 * 数据真变了才回调 onFresh 让调用方更新。不传 onFresh = 保持纯缓存语义。
 *
 * 回源失败时降级到过期缓存(任意年龄):数据源是第三方(WCA 官网),官网抽风时
 * 「拿去年的数据渲染」远好过整页卡在「加载中…」。真一点缓存都没有才把错误抛上去。
 */
async function cachedFetch<T>(key: string, load: () => Promise<T>, onFresh?: (v: T) => void): Promise<T> {
  const hit = cacheRead<T>(key);
  if (hit && hit.age <= CACHE_TTL_MS) {
    if (onFresh && hit.age > REVALIDATE_AFTER_MS) {
      void load()
        .then((fresh) => {
          cacheSet(key, fresh);
          if (JSON.stringify(fresh) !== JSON.stringify(hit.v)) onFresh(fresh);
        })
        .catch(() => { /* 后台重验失败:继续用旧值 */ });
    }
    return hit.v;
  }
  try {
    const fresh = await load();
    cacheSet(key, fresh);
    return fresh;
  } catch (e) {
    if (hit) return hit.v; // 过期兜底
    throw e;
  }
}

// ── 主源:自家库一次给全 ───────────────────────────────────────────────
// 三个消费者(profile / results / comps)同时挂载 → 按 wcaId 合流,一个页面只打一次。
// 失败 / 404(库里没这个人)→ null,调用方各自退回官网老路。
export interface PersonPageBundle {
  profile: WcaPersonProfile;
  results: WcaResultRow[];
  comps: WcaCompetition[];
}
const MIRROR_TIMEOUT_MS = 10 * 1000;
const _mirrorInflight = new Map<string, Promise<PersonPageBundle | null>>();

function mirrorBundle(wcaId: string): Promise<PersonPageBundle | null> {
  const hit = _mirrorInflight.get(wcaId);
  if (hit) return hit;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MIRROR_TIMEOUT_MS);
  const p = fetch(apiUrl(`/v1/wca/person-page?wcaId=${encodeURIComponent(wcaId)}&v=1`), { signal: ctrl.signal })
    .then(async (r): Promise<PersonPageBundle | null> => {
      if (!r.ok) return null;
      const j = await r.json() as Partial<PersonPageBundle>;
      if (!j.profile || !Array.isArray(j.results)) return null;
      return { profile: j.profile, results: j.results, comps: j.comps ?? [] };
    })
    .catch(() => null)
    .finally(() => { clearTimeout(timer); });
  _mirrorInflight.set(wcaId, p);
  // 合流只覆盖「同一次开页的并发调用」:软导航到别人主页再回来要重新取,
  // 否则这个 Map 会把整个会话的数据钉死(直播成绩当天会变)。
  void p.then(() => { setTimeout(() => _mirrorInflight.delete(wcaId), 30_000); });
  return p;
}

/**
 * 官网增强:库是日更的,今天刚公示的成绩只有官网有。后台打一次,成功就回调覆盖 +
 * 刷新 localStorage(供兜底路径复用);失败静默 —— 页面已经用库里的数据渲染好了。
 */
function enhanceFromOfficial<T>(key: string, load: () => Promise<T>, onFresh?: (v: T) => void): void {
  if (!onFresh) return;
  void load()
    .then((fresh) => { cacheSet(key, fresh); onFresh(fresh); })
    .catch(() => { /* 官网不通 = 本页正常工作,只是停在昨晚那份 */ });
}

export interface WcaPersonRecord {
  best: number;                  // centiseconds (or moves * 100 for fmc avg, or move count for fmc single, or MBLD code)
  world_rank: number | null;
  continent_rank: number | null;
  country_rank: number | null;
  event_id: string;
}

export interface WcaPersonProfile {
  person: {
    id: string;
    wca_id: string;
    name: string;
    country_iso2: string;
    gender: string | null;
    url: string;
    avatar?: { url?: string; thumb_url?: string };
  };
  competition_count: number;
  personal_records: Record<string, { single?: WcaPersonRecord; average?: WcaPersonRecord }>;
  medals: { gold: number; silver: number; bronze: number; total: number };
  records: { world: number; continental: number; national: number; total: number };
}

export async function fetchWcaPerson(
  wcaId: string,
  onFresh?: (p: WcaPersonProfile) => void,
): Promise<WcaPersonProfile> {
  const bundle = await mirrorBundle(wcaId);
  if (bundle) {
    enhanceFromOfficial(`wca:person:${wcaId}`, () => officialProfile(wcaId), onFresh);
    return bundle.profile;
  }
  return cachedFetch(`wca:person:${wcaId}`, () => officialProfile(wcaId), onFresh);
}

const officialProfile = (wcaId: string) =>
  wcaJson<WcaPersonProfile>(`/persons/${encodeURIComponent(wcaId)}`);

export interface WcaResultRow {
  /** WCA's person-results payload and our person-page mirror may omit the database id. */
  id?: number | null;
  competition_id: string;
  event_id: string;
  round_type_id: string;
  format_id: string;
  best: number;
  average: number;
  pos: number;
  attempts: number[];
  /** WR / NR / AfR / AsR / ER / NAR / OcR / SAR — null if not a regional record. */
  regional_single_record?: string | null;
  regional_average_record?: string | null;
  date?: string;            // not in raw API; we backfill from comp lookup if needed
  /** 直播·非官方成绩(cubing.com / WCA Live,官方尚未收录)— 仅成绩 tab 展示,不进 PR/纪录/名次和 */
  live?: boolean;
  source?: string;          // 'cubing' | 'wca_live'(仅 live 行)
}

/** A result row's actual business identity; stable across mirror / WCA / live data sources. */
export function wcaResultRowKey(
  row: Pick<WcaResultRow, 'competition_id' | 'event_id' | 'round_type_id'>,
): string {
  return `${row.competition_id}|${row.event_id}|${row.round_type_id}`;
}

async function officialResults(wcaId: string): Promise<WcaResultRow[]> {
  const arr = await wcaJson<any[]>(`/persons/${encodeURIComponent(wcaId)}/results`);
  return arr.map((r) => ({
    id: r.id,
    competition_id: r.competition_id,
    event_id: r.event_id,
    round_type_id: r.round_type_id,
    format_id: r.format_id,
    best: r.best,
    average: r.average,
    pos: r.pos,
    attempts: Array.isArray(r.attempts) ? r.attempts : [],
    regional_single_record: r.regional_single_record ?? null,
    regional_average_record: r.regional_average_record ?? null,
  })) as WcaResultRow[];
}

export async function fetchWcaPersonResults(
  wcaId: string,
  onFresh?: (rows: WcaResultRow[]) => void,
): Promise<WcaResultRow[]> {
  const bundle = await mirrorBundle(wcaId);
  if (bundle) {
    enhanceFromOfficial(`wca:results:v2:${wcaId}`, () => officialResults(wcaId), onFresh);
    return bundle.results;
  }
  // v2: 加了 regional_single_record / regional_average_record 字段,需让旧缓存 miss
  return cachedFetch(`wca:results:v2:${wcaId}`, () => officialResults(wcaId), onFresh);
}

// 历史身份(曾用名 / 曾用国籍)。WCA 公开 API 不含此项,走我们后端的 wca_person_aka 小表。
export interface WcaFormerIdentity { name: string; iso2: string | null }

export async function fetchWcaPersonFormer(wcaId: string): Promise<WcaFormerIdentity[]> {
  const key = `wca:former:${wcaId}`;
  const cached = cacheGet<WcaFormerIdentity[]>(key);
  if (cached) return cached;
  const res = await fetch(`${API_ORIGIN}/v1/wca/person-aka?wcaId=${encodeURIComponent(wcaId)}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as { former?: WcaFormerIdentity[] };
  const out = Array.isArray(json.former) ? json.former : [];
  cacheSet(key, out);
  return out;
}

// 杂项:最亲密魔友(同场比赛最多)+ 见过的魔友(同场次数分布)。WCA API 无此项,走后端
// /v1/wca/person-misc(SQL over wca_results_flat)。数据周更,localStorage 缓存。
export interface WcaPersonMisc {
  myComps: number;                                                   // 本人参赛比赛数
  totalMet: number;                                                  // 见过的不同魔友总数(不含本人)
  closest: { wcaId: string; name: string; iso2: string | null; shared: number }[]; // 最亲密 top 20(带国旗)
  distribution: { shared: number; cubers: number }[];                // 同场次数 → 人数,升序
  recordStreak: {
    current: { compId: string; name: string; date: string | null }[];
    longest: { compId: string; name: string; date: string | null }[];
  };
}

export async function fetchWcaPersonMisc(wcaId: string): Promise<WcaPersonMisc> {
  const key = `wca:misc:v3:${wcaId}`; // v3:增加当前 / 最长连续 PR 比赛
  const cached = cacheGet<WcaPersonMisc>(key);
  if (cached) return cached;
  const res = await fetch(apiUrl(`/v1/wca/person-misc?wcaId=${encodeURIComponent(wcaId)}`));
  if (!res.ok) throw new Error(`person-misc ${res.status}`);
  const json = (await res.json()) as Partial<WcaPersonMisc>;
  const out: WcaPersonMisc = {
    myComps: json.myComps ?? 0,
    totalMet: json.totalMet ?? 0,
    closest: Array.isArray(json.closest) ? json.closest : [],
    distribution: Array.isArray(json.distribution) ? json.distribution : [],
    recordStreak: {
      current: Array.isArray(json.recordStreak?.current) ? json.recordStreak.current : [],
      longest: Array.isArray(json.recordStreak?.longest) ? json.recordStreak.longest : [],
    },
  };
  cacheSet(key, out);
  return out;
}

// 锦标赛领奖台:某选手在 世界 / 洲际 / 国家 / 多国类型 锦标赛决赛、按该锦标赛资格内重排后名次 ≤3 的成绩。
// 由后端预计算表 wca_championship_podiums 提供(资格内重排客户端算不了,见 server 端点注释)。
export interface ChampionshipPodiumRow {
  compId: string;
  compName: string | null;
  compDate: string | null;
  compCountryId: string | null;
  eventId: string;
  level: string;             // 'world' | 大洲 id('_North America') | 国家 iso2('US') | 'greater_china'
  place: number;             // 1..3
  best: number;
  average: number;           // 0 = 无平均
  attempts: number[];
  singleRecord: string | null;
  averageRecord: string | null;
}

export async function fetchWcaPersonChampionshipPodiums(wcaId: string): Promise<ChampionshipPodiumRow[]> {
  // v2:数据由管道异步灌库,早期空表会被缓存成 []。bump key 作废旧空缓存;且只缓存非空结果,
  // 避免「暂未灌库」的空数组被缓存 24h 导致数据到位后仍显示「暂无」。
  const key = `wca:champPodiums:v2:${wcaId}`;
  const cached = cacheGet<ChampionshipPodiumRow[]>(key);
  if (cached) return cached;
  const res = await fetch(apiUrl(`/v1/wca/person-championship-podiums?wcaId=${encodeURIComponent(wcaId)}`));
  if (!res.ok) throw new Error(`person-championship-podiums ${res.status}`);
  const json = (await res.json()) as { rows?: ChampionshipPodiumRow[] };
  const out = Array.isArray(json.rows) ? json.rows : [];
  if (out.length) cacheSet(key, out);
  return out;
}

export interface WcaCompetition {
  id: string;
  name: string;
  city: string;
  country_iso2: string;
  start_date: string;
  end_date: string;
}

// ── Server endpoints (历史排名快照) ──────────────────────────────────────
// /v1/wca/person-best-ranks 与 /v1/wca/person-rank-history 由本仓库的
// core/apps/api/src/routes/wca_stats_extra.ts 提供,数据源是
// historical_ranks_snapshot 表(每天 GH Actions 灌一次,nginx 1d cache).

export interface PersonBestRankCell {
  rank: number;
  year: number;
  value: number | null;
}

export interface PersonBestRanksResponse {
  wcaId: string;
  events: Record<string, {
    single?: { world?: PersonBestRankCell; continent?: PersonBestRankCell; country?: PersonBestRankCell };
    average?: { world?: PersonBestRankCell; continent?: PersonBestRankCell; country?: PersonBestRankCell };
  }>;
}

export async function fetchPersonBestRanks(wcaId: string): Promise<PersonBestRanksResponse> {
  // v4: 后端改读 historical_best_ranks 专表(逐场重放,按比赛结束口径精确)→ 旧缓存须 miss
  const key = `wca:bestRanks:v4:${wcaId}`;
  const cached = cacheGet<PersonBestRanksResponse>(key);
  if (cached) return cached;
  const res = await fetch(apiUrl(`/v1/wca/person-best-ranks?wcaId=${encodeURIComponent(wcaId)}`));
  if (!res.ok) throw new Error(`person-best-ranks ${res.status}`);
  const json = (await res.json()) as PersonBestRanksResponse;
  cacheSet(key, json);
  return json;
}

// 选手「全项目名次和」摘要 — 三个独立指标(都是 Σ 17 现役项,只是求和的 rank 不同):
//   SoWR = Sum of World Ranks(Σ世界名次,天然按世界排) / SoCR = Sum of Continent Ranks(按本洲排)
//   SoNR = Sum of National Ranks(按本国排).每个指标各带「和值 total + 自身 scope 名次 rank」,
//   外加子排名(同指标值在更窄池子重排):SoWR 带 continentRank/countryRank,SoCR 带 countryRank.
// 单个指标为 null = 该统计无数据(如 SoCR 数据未填充);子排名缺位 = 旧缓存响应,留白即可.
// 由 /v1/wca/sum-of-ranks/person 返回.
export interface SorMetricCell { total: number; rank: number; continentRank?: number; countryRank?: number; } // 当前
export interface SorMetricBest { total: number | null; rank: number; year: number; } // 历史最佳
export interface SorMetricTriple<T> { sowr: T | null; socr: T | null; sonr: T | null; }
export interface PersonSorResponse {
  wcaId: string;
  countryId: string;
  continentId: string;
  /** true = 21 项口径(含 4 废止);此时 bestSingle/bestAverage 恒 null(历史最佳仅 17 口径) */
  inclCancelled?: boolean;
  single: (SorMetricTriple<SorMetricCell> & { eventsDone: number }) | null;
  average: (SorMetricTriple<SorMetricCell> & { eventsDone: number }) | null;
  bestSingle: SorMetricTriple<SorMetricBest> | null;
  bestAverage: SorMetricTriple<SorMetricBest> | null;
}

export async function fetchPersonSor(wcaId: string, inclCancelled = false): Promise<PersonSorResponse> {
  // v5: v4 期间全 null 响应(21 口径 _21 未填充)曾被缓存 24h,数据灌上后用户还看一天「—」→ 换键甩掉毒缓存
  const key = `wca:sor:v5:${wcaId}:${inclCancelled ? 21 : 17}`;
  const cached = cacheGet<PersonSorResponse>(key);
  if (cached) return cached;
  // v=5 进 URL:响应带 max-age=86400,浏览器 HTTP 缓存按 URL 钉 24h(nginx purge/localStorage 清除都管不到);
  // 换 URL 才能甩掉曾被钉住的全 null 响应
  const qs = `wcaId=${encodeURIComponent(wcaId)}${inclCancelled ? '&cancelled=1' : ''}&v=5`;
  const res = await fetch(apiUrl(`/v1/wca/sum-of-ranks/person?${qs}`));
  if (!res.ok) throw new Error(`sum-of-ranks/person ${res.status}`);
  const json = (await res.json()) as PersonSorResponse;
  // 全空 = 暂态(数据未灌/未收录),不入 24h 缓存,下次访问重查
  if (json.single || json.average) cacheSet(key, json);
  return json;
}

// 自选组合:任意项目子集下该选手的 SoWR/SoCR/SoNR 三指标(PR 表行多选驱动,/sum-of-ranks/person-subset 现算).
// 不走 localStorage(浏览器 HTTP 缓存 300s + nginx 24h 已够);events 按 RANK_EVENTS 顺序拼,URL 唯一保缓存命中.
// socr 为 null = ranks_continent 未灌(stats 管道跑完自动恢复)或选手无洲;cell 结构与 Σ 块主行一致.
export interface PersonSubsetResponse {
  wcaId: string; isAvg: boolean; events: string[]; eventsDone: number;
  sowr: SorMetricCell | null;
  socr: SorMetricCell | null;
  sonr: SorMetricCell | null;
}

export async function fetchPersonSubset(wcaId: string, events: string[], isAvg: boolean, signal?: AbortSignal): Promise<PersonSubsetResponse> {
  // v=2: 2026-06-10 响应从单 total/rank 改三指标(sowr/socr/sonr),bump 甩掉浏览器 HTTP 缓存里的旧 shape
  const qs = `wcaId=${encodeURIComponent(wcaId)}&isAvg=${isAvg ? '1' : '0'}&events=${encodeURIComponent(events.join(','))}&v=2`;
  const res = await fetch(apiUrl(`/v1/wca/sum-of-ranks/person-subset?${qs}`), { signal });
  if (!res.ok) throw new Error(`sum-of-ranks/person-subset ${res.status}`);
  return (await res.json()) as PersonSubsetResponse;
}

// 「最优项目组合」原始响应。选手页有两个消费者(PR 表拿它预选行 + 组合卡渲染整块),
// 两者同时挂载 → 同一个 URL 会被打两遍(浏览器 HTTP 缓存对并发中的请求不起作用)。
// 按 URL 合流:同一 URL 的并发调用共用一个 Promise,settle 后清掉(重复访问交给 HTTP 缓存)。
// 返回 null = 该选手不在 sor_player_best(极新选手 / 无有效成绩),调用方各自降级。
// 泛型:两个消费者只读各自需要的字段,形状定义留在 BestComboBody(PlayerBest)。
const _playerBestInflight = new Map<string, Promise<unknown>>();

export function fetchPlayerBest<T>(wcaId: string, includeCancelled = false): Promise<T | null> {
  // v=5: 2026-06-10 响应加 eventCounts/listedCount(剖析行),bump 甩掉浏览器 HTTP 缓存里的旧 shape
  const qs = new URLSearchParams({ wcaId, v: '5' });
  if (includeCancelled) qs.set('cancelled', '1');
  const url = apiUrl(`/v1/wca/sum-of-ranks/player-best?${qs.toString()}`);
  const inflight = _playerBestInflight.get(url);
  if (inflight) return inflight as Promise<T | null>;
  // 合流的 Promise 不接受调用方的 signal —— 一个消费者卸载不能顺手掐掉另一个的请求;
  // 各调用方用自己的 done 标志忽略结果即可。超时上界靠这里的 AbortController。
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  const p = fetch(url, { signal: ctrl.signal })
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => { clearTimeout(timer); _playerBestInflight.delete(url); });
  _playerBestInflight.set(url, p);
  return p as Promise<T | null>;
}

export interface PersonRankHistoryRow {
  year: number;
  /** 月级数据有 month (1..12),年级数据没有 */
  month?: number;
  single: number | null;
  average: number | null;
  singleWorldRank: number | null;
  singleCountryRank: number | null;
  singleContinentRank: number | null;
  avgWorldRank: number | null;
  avgCountryRank: number | null;
  avgContinentRank: number | null;
}

export interface PersonRankHistoryResponse {
  wcaId: string;
  eventId: string;
  granularity?: 'month' | 'year';
  rows: PersonRankHistoryRow[];
}

export async function fetchPersonRankHistory(wcaId: string, eventId: string): Promise<PersonRankHistoryResponse> {
  // v3: 切月级 (granularity=month, response 加 month 字段)
  const key = `wca:rankHist:v3:${wcaId}:${eventId}`;
  const cached = cacheGet<PersonRankHistoryResponse>(key);
  if (cached) return cached;
  const res = await fetch(apiUrl(`/v1/wca/person-rank-history?wcaId=${encodeURIComponent(wcaId)}&eventId=${encodeURIComponent(eventId)}&granularity=month`));
  if (!res.ok) throw new Error(`person-rank-history ${res.status}`);
  const json = (await res.json()) as PersonRankHistoryResponse;
  cacheSet(key, json);
  return json;
}

// 直播·非官方成绩(官方 API 尚未收录的近期比赛 — cubing.com 中国比赛 / WCA Live 国外比赛)。
// 由 server /v1/wca/person-live-results 提供(cubing_live.ts prewarm 写穿)。短命可变数据,
// 不入 localStorage(server 已 60s 浏览器缓存),每次开页拉最新。
export interface PersonLiveResultsResponse {
  wcaId: string;
  comps: WcaCompetition[];
  results: WcaResultRow[];   // 已打上 live:true
}

export async function fetchWcaPersonLiveResults(wcaId: string): Promise<PersonLiveResultsResponse> {
  const res = await fetch(apiUrl(`/v1/wca/person-live-results?wcaId=${encodeURIComponent(wcaId)}&v=1`));
  if (!res.ok) throw new Error(`person-live-results ${res.status}`);
  const json = (await res.json()) as { wcaId?: string; comps?: WcaCompetition[]; results?: (WcaResultRow & { source?: string })[] };
  const results: WcaResultRow[] = (json.results ?? []).map((r) => ({
    ...r,
    live: true,
    // 非官方成绩不声称区域纪录(cubing 源的 tag 是推断的,可能不准)
    regional_single_record: null,
    regional_average_record: null,
  }));
  return { wcaId, comps: json.comps ?? [], results };
}

async function officialComps(wcaId: string): Promise<WcaCompetition[]> {
  const arr = await wcaJson<any[]>(`/persons/${encodeURIComponent(wcaId)}/competitions`);
  return arr.map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city,
    country_iso2: c.country_iso2,
    start_date: c.start_date,
    end_date: c.end_date,
  })) as WcaCompetition[];
}

export async function fetchWcaPersonCompetitions(
  wcaId: string,
  onFresh?: (comps: WcaCompetition[]) => void,
): Promise<WcaCompetition[]> {
  const bundle = await mirrorBundle(wcaId);
  if (bundle) {
    enhanceFromOfficial(`wca:comps:${wcaId}`, () => officialComps(wcaId), onFresh);
    return bundle.comps;
  }
  return cachedFetch(`wca:comps:${wcaId}`, () => officialComps(wcaId), onFresh);
}

// 头像:官方 dump 里没有,由服务器懒回源 + 入库缓存(见 server routes/wca_person.ts)。
// 整页不为一张图等待 —— 页面先用首字母占位渲染,这个请求回来再补上。
export async function fetchWcaPersonAvatar(wcaId: string): Promise<{ url: string | null; thumbUrl: string | null }> {
  const res = await fetch(apiUrl(`/v1/wca/person-avatar?wcaId=${encodeURIComponent(wcaId)}`));
  if (!res.ok) throw new Error(`person-avatar ${res.status}`);
  const j = await res.json() as { url?: string | null; thumbUrl?: string | null };
  return { url: j.url ?? null, thumbUrl: j.thumbUrl ?? null };
}
