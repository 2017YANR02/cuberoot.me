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
