// NOTE: WCA 搜索 API 模块 — 从 shared/wca_search.js 改写为 TypeScript + Axios
// 供 calc / viz / recon 三方统一使用

import { wcaApi } from './client';
import type { WcaPerson, WcaUserTimes } from '../types';

// NOTE: sessionStorage 缓存 key 前缀 — 同一会话不重复请求
const CACHE_PREFIX = 'wca_shared_';

// ── 内部工具 ──

function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

function cacheSet(key: string, data: unknown): void {
  try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data)); }
  catch { /* 容量超限静默失败 */ }
}

// ── 公开 API ──

/**
 * NOTE: 搜索 WCA 选手（调用官方搜索 API）
 * @param query - 搜索关键词（名字或 WCA ID）
 */
export async function searchPersons(query: string): Promise<WcaPerson[]> {
  try {
    const resp = await wcaApi.get('/search/users', {
      params: { q: query, persons_table: true },
    });
    const results = resp.data?.result;
    if (!results) return [];
    return results.map((p: Record<string, unknown>) => ({
      wcaId: (p.wca_id as string) || '',
      name: (p.name as string) || '',
      iso2: ((p.country_iso2 as string) || '').toLowerCase(),
      avatarUrl: (p.avatar && !(p.avatar as Record<string, unknown>).is_default)
        ? (p.avatar as Record<string, string>).thumb_url
        : '',
    }));
  } catch (e) {
    console.warn('WCA person search failed:', e);
    return [];
  }
}

/**
 * NOTE: 获取选手全部历史成绩（带缓存）
 * 返回 API 原始数组，包含 attempts[], event_id 等
 */
export async function fetchResults(wcaId: string): Promise<unknown[] | null> {
  const cached = cacheGet<unknown[]>('results_' + wcaId);
  if (cached) return cached;

  try {
    const resp = await wcaApi.get(`/persons/${wcaId}/results`);
    cacheSet('results_' + wcaId, resp.data);
    return resp.data;
  } catch (e) {
    console.warn('WCA results fetch failed:', e);
    return null;
  }
}

/**
 * NOTE: 获取选手参加的比赛列表（含 start_date，用于时间排序）
 */
export async function fetchCompetitions(
  wcaId: string
): Promise<Array<{ id: string; name: string; start_date: string }> | null> {
  const cached = cacheGet<Array<{ id: string; name: string; start_date: string }>>('comps_' + wcaId);
  if (cached) return cached;

  try {
    const resp = await wcaApi.get(`/persons/${wcaId}/competitions`);
    cacheSet('comps_' + wcaId, resp.data);
    return resp.data;
  } catch (e) {
    console.warn('WCA competitions fetch failed:', e);
    return null;
  }
}

// NOTE: WCA /competitions 列表返回的单场比赛原始结构（仅列我们用到的字段）
export interface WcaUpcomingComp {
  id: string;
  name: string;
  city: string;
  country_iso2: string;
  start_date: string;
  end_date: string;
  event_ids: string[];
  competitor_limit: number | null;
  latitude_degrees: number;
  longitude_degrees: number;
  url: string;
  cancelled_at: string | null;
  announced_at: string;
}

/**
 * NOTE: 获取从 fromDate 起的全部进行中 + 未来 WCA 比赛（自动分页）
 * 用 sessionStorage 缓存 1 小时；取消的比赛过滤掉
 * @param fromDate - YYYY-MM-DD，传进 ongoing_and_future
 */
export async function fetchAllUpcomingCompetitions(
  fromDate: string,
): Promise<WcaUpcomingComp[]> {
  const cacheKey = `upcoming_all_${fromDate}`;
  const cached = cacheGet<{ at: number; data: WcaUpcomingComp[] }>(cacheKey);
  if (cached && Date.now() - cached.at < 3600_000) return cached.data;

  const out: WcaUpcomingComp[] = [];
  const perPage = 100;
  let hadSuccess = false;
  for (let page = 1; page <= 20; page++) { // 20*100=2000 上限，足够
    try {
      const resp = await wcaApi.get('/competitions', {
        params: { ongoing_and_future: fromDate, per_page: perPage, page },
        timeout: 30000, // WCA /competitions 较慢，提高到 30s
      });
      const batch = Array.isArray(resp.data) ? resp.data as WcaUpcomingComp[] : [];
      out.push(...batch);
      hadSuccess = true;
      if (batch.length < perPage) break;
    } catch (e) {
      console.warn('WCA upcoming fetch failed at page', page, e);
      if (!hadSuccess) throw e; // 第一页就失败直接报错，不要缓存空结果
      break;
    }
  }

  const filtered = out.filter((c) => !c.cancelled_at);
  cacheSet(cacheKey, { at: Date.now(), data: filtered });
  return filtered;
}

// NOTE: 单场比赛详情——只保留前端用到的字段
export interface WcaCompDetail {
  id: string;
  name: string;
  city: string;
  country_iso2: string;
  start_date: string;
  end_date: string;
  latitude_degrees: number;
  longitude_degrees: number;
  url: string;
}

// NOTE: 坐标不会变，用 localStorage 永久缓存（超限概率极低，每条 < 200B）
const COMP_DETAIL_LS_PREFIX = 'wca_comp_coord_';

function compDetailCacheGet(id: string): WcaCompDetail | null {
  try {
    const raw = localStorage.getItem(COMP_DETAIL_LS_PREFIX + id);
    return raw ? JSON.parse(raw) as WcaCompDetail : null;
  } catch { return null; }
}

function compDetailCacheSet(id: string, detail: WcaCompDetail): void {
  try { localStorage.setItem(COMP_DETAIL_LS_PREFIX + id, JSON.stringify(detail)); }
  catch { /* quota exceeded 等静默 */ }
}

/**
 * NOTE: 获取单场比赛详情（含经纬度）——永久缓存到 localStorage
 * 用途：选手生涯轨迹图需要每场比赛的 lat/lng
 */
export async function fetchCompetitionDetail(id: string): Promise<WcaCompDetail | null> {
  const cached = compDetailCacheGet(id);
  if (cached) return cached;

  // 重试：429/5xx/无 response（网络/超时/CORS）都重试，仅 4xx（除 429）直接放弃
  const delays = [0, 1500, 4000, 9000, 18000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
    try {
      const resp = await wcaApi.get(`/competitions/${id}`, { timeout: 20000 });
      const d = resp.data;
      if (!d?.id || typeof d.latitude_degrees !== 'number') return null;
      const detail: WcaCompDetail = {
        id: d.id,
        name: d.name ?? d.id,
        city: d.city ?? '',
        country_iso2: d.country_iso2 ?? '',
        start_date: d.start_date ?? '',
        end_date: d.end_date ?? d.start_date ?? '',
        latitude_degrees: d.latitude_degrees,
        longitude_degrees: d.longitude_degrees,
        url: d.url ?? `https://www.worldcubeassociation.org/competitions/${d.id}`,
      };
      compDetailCacheSet(id, detail);
      return detail;
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const isLast = attempt === delays.length - 1;
      // 4xx (非 429) 是真错误，不重试；其余（429 / 5xx / 网络超时无 status）都重试到最后一次
      const isHardFail = !!status && status >= 400 && status < 500 && status !== 429;
      if (isLast || isHardFail) {
        console.warn('WCA comp detail fetch failed:', id, status ?? e);
        return null;
      }
    }
  }
  return null;
}

/**
 * NOTE: 获取选手头像 URL（通过 /persons/{id} API）
 */
export async function fetchAvatar(wcaId: string): Promise<string> {
  const cached = cacheGet<string>('avatar_' + wcaId);
  if (cached !== null) return cached;

  try {
    const resp = await wcaApi.get(`/persons/${wcaId}`);
    const url = resp.data?.person?.avatar?.thumb_url || '';
    cacheSet('avatar_' + wcaId, url);
    return url;
  } catch {
    return '';
  }
}

/**
 * NOTE: 通过 WCA ID 直接拉一个 WcaPerson（用于 URL 状态恢复，没经过 search）
 */
export async function fetchPersonByWcaId(wcaId: string): Promise<WcaPerson | null> {
  const cached = cacheGet<WcaPerson>('person_' + wcaId);
  if (cached) return cached;
  try {
    const resp = await wcaApi.get(`/persons/${wcaId}`);
    const p = resp.data?.person;
    if (!p) return null;
    const person: WcaPerson = {
      wcaId: (p.wca_id as string) || wcaId,
      name: (p.name as string) || wcaId,
      iso2: ((p.country_iso2 as string) || '').toLowerCase(),
      avatarUrl: (p.avatar && !p.avatar.is_default) ? (p.avatar.thumb_url || '') : '',
    };
    cacheSet('person_' + wcaId, person);
    return person;
  } catch {
    return null;
  }
}

/**
 * NOTE: 获取指定项目的最近 N 个有效单次 + Ao100
 * @param wcaId - 选手 WCA ID
 * @param eventId - 项目 ID（如 '333'）
 * @param maxSolves - 最多取多少个（默认 100）
 */
export async function fetchUserTimes(
  wcaId: string,
  eventId: string,
  maxSolves = 100
): Promise<WcaUserTimes | null> {
  const allResults = await fetchResults(wcaId);
  if (!allResults) return null;

  // NOTE: 过滤当前项目 + 按时间倒序（API 按时间正序返回）
  const eventResults: Array<Record<string, unknown>> = [];
  for (let i = allResults.length - 1; i >= 0; i--) {
    const r = allResults[i] as Record<string, unknown>;
    if (r.event_id === eventId) eventResults.push(r);
  }

  // NOTE: 从每轮的 attempts 中提取有效单次（>0 = 非 DNF/DNS/空）
  const validSolves: number[] = [];
  for (let r = 0; r < eventResults.length && validSolves.length < maxSolves; r++) {
    const attempts = eventResults[r].attempts as number[] | undefined;
    if (!attempts) continue;
    for (let a = 0; a < attempts.length && validSolves.length < maxSolves; a++) {
      if (attempts[a] > 0) validSolves.push(attempts[a]);
    }
  }

  if (validSolves.length < 5) return null;

  // NOTE: Ao100 trimmed average — 去掉首尾各 5%
  const sorted = validSolves.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const trim = Math.ceil(n * 0.05);
  const mid = sorted.slice(trim, n - trim);
  const ao100 = Math.round(mid.reduce((s, v) => s + v, 0) / mid.length);

  // NOTE: 官方最好 average
  let avgPR: number | null = null;
  for (const r of eventResults) {
    const avg = r.average as number;
    if (avg > 0 && (avgPR === null || avg < avgPR)) avgPR = avg;
  }

  return {
    times: validSolves,
    ao100,
    averagePR: avgPR,
    name: (eventResults[0].name as string) || wcaId,
    country: (eventResults[0].country_iso2 as string) || '',
  };
}
