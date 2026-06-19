// Thin client for the WCA public API (https://documenter.getpostman.com/view/4584491/SVfWN6KS).
// CORS-enabled; cached in localStorage 24h to keep repeat visits instant.

import { API_ORIGIN } from './api-base';

const BASE = 'https://www.worldcubeassociation.org/api/v0';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> { t: number; v: T; }

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}

function cacheSet<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })); }
  catch { /* quota / private mode */ }
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

export async function fetchWcaPerson(wcaId: string): Promise<WcaPersonProfile> {
  const key = `wca:person:${wcaId}`;
  const cached = cacheGet<WcaPersonProfile>(key);
  if (cached) return cached;
  const res = await fetch(`${BASE}/persons/${encodeURIComponent(wcaId)}`);
  if (!res.ok) throw new Error(`WCA API ${res.status}`);
  const json = (await res.json()) as WcaPersonProfile;
  cacheSet(key, json);
  return json;
}

export interface WcaResultRow {
  id: number;
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

export async function fetchWcaPersonResults(wcaId: string): Promise<WcaResultRow[]> {
  // v2: 加了 regional_single_record / regional_average_record 字段,需让旧缓存 miss
  const key = `wca:results:v2:${wcaId}`;
  const cached = cacheGet<WcaResultRow[]>(key);
  if (cached) return cached;
  const res = await fetch(`${BASE}/persons/${encodeURIComponent(wcaId)}/results`);
  if (!res.ok) throw new Error(`WCA API ${res.status}`);
  const arr = (await res.json()) as any[];
  const out: WcaResultRow[] = arr.map((r) => ({
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
  }));
  cacheSet(key, out);
  return out;
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
}

export async function fetchWcaPersonMisc(wcaId: string): Promise<WcaPersonMisc> {
  const key = `wca:misc:v2:${wcaId}`; // v2: closest 加 iso2,甩掉旧缓存
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
  const key = `wca:champPodiums:v1:${wcaId}`;
  const cached = cacheGet<ChampionshipPodiumRow[]>(key);
  if (cached) return cached;
  const res = await fetch(apiUrl(`/v1/wca/person-championship-podiums?wcaId=${encodeURIComponent(wcaId)}`));
  if (!res.ok) throw new Error(`person-championship-podiums ${res.status}`);
  const json = (await res.json()) as { rows?: ChampionshipPodiumRow[] };
  const out = Array.isArray(json.rows) ? json.rows : [];
  cacheSet(key, out);
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
// core/packages/server/src/routes/wca_stats_extra.ts 提供,数据源是
// historical_ranks_snapshot 表(每天 GH Actions 灌一次,nginx 1d cache).
import { apiUrl } from './api-base';

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

export async function fetchWcaPersonCompetitions(wcaId: string): Promise<WcaCompetition[]> {
  const key = `wca:comps:${wcaId}`;
  const cached = cacheGet<WcaCompetition[]>(key);
  if (cached) return cached;
  const res = await fetch(`${BASE}/persons/${encodeURIComponent(wcaId)}/competitions`);
  if (!res.ok) throw new Error(`WCA API ${res.status}`);
  const arr = (await res.json()) as any[];
  const out: WcaCompetition[] = arr.map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city,
    country_iso2: c.country_iso2,
    start_date: c.start_date,
    end_date: c.end_date,
  }));
  cacheSet(key, out);
  return out;
}
