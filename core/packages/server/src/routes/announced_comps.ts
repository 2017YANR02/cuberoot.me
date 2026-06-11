/**
 * /v1/comp/announced — 今日公示比赛镜像(首页「今日公示」用)
 *
 * 数据流:
 *   1. 后台每 20min 拉 WCA REST /competitions?sort=-announced_at,分页直到 announced_at 早于 48h 窗口
 *   2. 落地精简结构(含 announced_at / 项目 / 报名时段 / 人数上限),存内存快照
 *   3. 端点直接吐快照,客户端按访客本地时区过滤出「今天」公示的比赛(48h 窗口覆盖任意时区的当天)
 *   4. nginx proxy_cache + 浏览器 5min 兜底,上游负载 ~3 req/h
 *
 * 与 monitors/wca_comp.ts 互补:那个负责推 Bark(每 5min 拉 page1 去重),本端点为首页提供
 * 可读快照,独立运行(不受 MONITORS_ENABLED 门控,休眠监控时本端点照常工作)。
 */
import { Hono } from 'hono';

export const announcedCompsRoutes = new Hono();

const WCA_API = 'https://www.worldcubeassociation.org/api/v0/competitions';
const UA: Record<string, string> = { 'User-Agent': 'WCA-Monitor/1.0', Accept: 'application/json' };

const POLL_INTERVAL_MS = 20 * 60_000;
const FETCH_TIMEOUT_MS = 25_000;
const WINDOW_MS = 48 * 60 * 60 * 1000; // 覆盖任意时区的「今天」,客户端再按本地日精确过滤
const PER_PAGE = 25;
const MAX_PAGES = 6;

// WCA /competitions 列表项(仅取用到的字段)。
interface WcaComp {
  id: string;
  name: string;
  city?: string;
  country_iso2?: string;
  start_date?: string;
  end_date?: string;
  event_ids?: string[];
  competitor_limit?: number | null;
  registration_open?: string | null;
  registration_close?: string | null;
  announced_at?: string | null;
  cancelled_at?: string | null;
}

// 前端契约 — 精简到首页卡片所需。
export interface AnnouncedComp {
  id: string;
  name: string;
  city: string;
  country: string; // ISO2 小写
  start_date: string;
  end_date: string;
  events: string[]; // WCA event id ('333' / '222' ...)
  competitor_limit: number | null;
  registration_open: string | null;
  registration_close: string | null;
  announced_at: string; // ISO 8601 UTC
}

interface Snapshot {
  fetchedAt: number;
  comps: AnnouncedComp[];
}

let snapshot: Snapshot = { fetchedAt: 0, comps: [] };
let inflight: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page: number): Promise<WcaComp[]> {
  const url = `${WCA_API}?sort=-announced_at&per_page=${PER_PAGE}&page=${page}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!r.ok) throw new Error(`WCA HTTP ${r.status}`);
    const text = await r.text();
    if (!text.trim()) return [];
    const data = JSON.parse(text);
    return Array.isArray(data) ? (data as WcaComp[]) : [];
  } finally {
    clearTimeout(t);
  }
}

function mapComp(c: WcaComp): AnnouncedComp {
  return {
    id: c.id,
    name: c.name,
    city: c.city ?? '',
    country: (c.country_iso2 ?? '').toLowerCase(),
    start_date: c.start_date ?? '',
    end_date: c.end_date ?? c.start_date ?? '',
    events: c.event_ids ?? [],
    competitor_limit: c.competitor_limit ?? null,
    registration_open: c.registration_open ?? null,
    registration_close: c.registration_close ?? null,
    announced_at: c.announced_at ?? '',
  };
}

async function fetchOnce(): Promise<void> {
  const cutoff = Date.now() - WINDOW_MS;
  const out: AnnouncedComp[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchPage(page);
    if (batch.length === 0) break;
    let passedCutoff = false;
    for (const c of batch) {
      const annMs = c.announced_at ? Date.parse(c.announced_at) : NaN;
      if (Number.isNaN(annMs)) continue;
      if (annMs < cutoff) {
        passedCutoff = true; // 已排到窗口外,本页之后不会更新
        continue;
      }
      if (c.cancelled_at) continue; // 已取消的不算公示
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(mapComp(c));
    }
    // sort=-announced_at 降序:一旦本页出现窗口外的,或不足一页,后续都在窗口外,停。
    if (passedCutoff || batch.length < PER_PAGE) break;
    await sleep(500);
  }
  out.sort((a, b) => b.announced_at.localeCompare(a.announced_at));
  snapshot = { fetchedAt: Date.now(), comps: out };
}

function refresh(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetchOnce()
    .catch((err) => {
      console.warn('[announced-comps] poll failed:', (err as Error).message);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function startAnnouncedCompsPoller(): void {
  // 启动 90s 后首拉,错开 wca_comp 监控/其他启动任务对同一 WCA 端点的争用;之后每 20min 刷一遍。
  setTimeout(() => {
    refresh();
    setInterval(refresh, POLL_INTERVAL_MS);
  }, 90_000);
}

announcedCompsRoutes.get('/comp/announced', (c) => {
  if (snapshot.fetchedAt === 0) refresh();
  if (snapshot.comps.length === 0) {
    // 冷启/空快照不缓存,避免空态被钉
    c.header('Cache-Control', 'no-store');
  } else {
    c.header('Cache-Control', 'public, max-age=300, s-maxage=900');
  }
  return c.json({ fetchedAt: snapshot.fetchedAt, comps: snapshot.comps });
});
