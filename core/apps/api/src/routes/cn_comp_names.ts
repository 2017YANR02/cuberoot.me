/**
 * /v1/cn-comp-names — 中国大陆新比赛中文名兜底
 *
 * 静态 stats/comp_names_zh.json 每天 UTC 20:00 才刷一次,新公示的中国比赛最坏要等 24h
 * 才出中文。这个端点抓 cubing.com 当前 page 1,配合 all_upcoming_comps.json
 * 里已有的 WCA name 做匹配,把"已进 upcoming 但 zh 还没刷"的窗口收到 ≤1h。
 *
 * 与离线生成器共用 Nuxt 数据解析器,优先使用上游英文名和明确的 WCA ID。
 *
 * Cache: in-memory 1h + nginx proxy_cache_valid 1h (use_stale 兜 cubing.com 挂的情况)
 */
import { Hono } from 'hono';
import { getUpcomingComps } from '../utils/upcoming_comps_cache.js';
import { parseCubingCompetitionList } from '@cuberoot/shared/cubing-competitions';

export const cnCompNamesRoutes = new Hono();

const CUBING_LIST_URL = 'https://cubing.com/competition?page=1';
const TTL_MS = 60 * 60 * 1000; // 1h
const FETCH_TIMEOUT_MS = 10_000;

interface CachedPayload {
  updated_at: string;
  names: Record<string, string>;
}

let cache: { data: CachedPayload; expiresAt: number } | null = null;
let inflight: Promise<CachedPayload> | null = null;

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'cuberoot.me-server/1.0 (+https://cuberoot.me)' },
    });
  } finally {
    clearTimeout(t);
  }
}

async function build(): Promise<CachedPayload> {
  const [pageRes, upcoming] = await Promise.all([
    fetchWithTimeout(CUBING_LIST_URL, FETCH_TIMEOUT_MS),
    getUpcomingComps(),
  ]);
  if (!pageRes.ok) throw new Error(`cubing.com page1 HTTP ${pageRes.status}`);

  const html = await pageRes.text();

  // CN comp WCA ID → comp.name
  const idToName = new Map<string, string>();
  for (const c of upcoming) {
    if (c.country === 'CN') idToName.set(c.id, c.name);
  }

  const names: Record<string, string> = {};
  for (const comp of parseCubingCompetitionList(html).competitions) {
    if (comp.name) names[comp.name] = comp.nameZh;
    const candidate = comp.wcaCompetitionId || comp.alias.replace(/-/g, '');
    const wcaName = idToName.get(candidate);
    if (wcaName) names[wcaName] = comp.nameZh;
  }
  if (!Object.keys(names).length) throw new Error('No Chinese competition names parsed');

  return { updated_at: new Date().toISOString(), names };
}

async function getPayload(): Promise<CachedPayload> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  if (inflight) return inflight;
  inflight = build()
    .then((data) => {
      cache = { data, expiresAt: Date.now() + TTL_MS };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

cnCompNamesRoutes.get('/cn-comp-names', async (c) => {
  try {
    const data = await getPayload();
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=3600');
    return c.json(data);
  } catch (e) {
    // 失败时返回空 names + 旧 cache (如有),客户端走静态 JSON 不掉链子
    const fallback: CachedPayload = cache?.data ?? { updated_at: new Date(0).toISOString(), names: {} };
    console.warn('[cn-comp-names] build failed:', e instanceof Error ? e.message : String(e));
    c.header('Cache-Control', 'no-store');
    return c.json(fallback);
  }
});
