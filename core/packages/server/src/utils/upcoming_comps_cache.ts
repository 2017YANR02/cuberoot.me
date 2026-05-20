/**
 * stats/all_upcoming_comps.json 在 server 端的 1h 内存缓存。
 *
 * 为什么这里需要它:
 * - /v1/cn-comp-names: 拿 CN 比赛 id → name 做 cubing.com alias 匹配
 * - /v1/cubing-zh/:wcaId: 新公示比赛还没进 wca_competitions 表 (WCA dump 周更),
 *   走这里兜底拿 name 去 scrape cubing.com 的中文地点
 *
 * Server 跑在跟 nginx 同机,fetch 自己域名走本地 loopback,不走公网。
 */

const SOURCE_URL = 'https://cuberoot.me/stats/all_upcoming_comps.json';
const TTL_MS = 60 * 60 * 1000; // 1h
const FETCH_TIMEOUT_MS = 10_000;

export interface UpcomingComp {
  id: string;
  name: string;
  country?: string; // ISO2,如 'CN' / 'US'
}

let cache: { data: UpcomingComp[]; expiresAt: number } | null = null;
let inflight: Promise<UpcomingComp[]> | null = null;

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, {
    signal: ctrl.signal,
    headers: { 'User-Agent': 'cuberoot.me-server/1.0 (+https://cuberoot.me)' },
  }).finally(() => clearTimeout(t));
}

async function load(): Promise<UpcomingComp[]> {
  const res = await fetchWithTimeout(SOURCE_URL, FETCH_TIMEOUT_MS);
  if (!res.ok) throw new Error(`all_upcoming_comps.json HTTP ${res.status}`);
  const data = (await res.json()) as UpcomingComp[];
  cache = { data, expiresAt: Date.now() + TTL_MS };
  return data;
}

export async function getUpcomingComps(): Promise<UpcomingComp[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  if (inflight) return inflight;
  inflight = load().finally(() => { inflight = null; });
  return inflight;
}

/** 在 upcoming_comps 里查 CN 比赛 → name (用于 scrape cubing.com)。非 CN / 找不到 → null。 */
export async function getUpcomingCnCompName(wcaId: string): Promise<string | null> {
  try {
    const list = await getUpcomingComps();
    const c = list.find((x) => x.id === wcaId);
    return c && c.country === 'CN' ? c.name : null;
  } catch {
    return null;
  }
}
