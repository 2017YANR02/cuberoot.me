/**
 * /v1/comp/announced — 今日公示比赛镜像(首页「今日公示」用)
 *
 * 数据流:
 *   1. 后台每 20min 拉 WCA REST /competitions?sort=-announced_at,分页直到 announced_at 早于 48h 窗口
 *   2. 落地精简结构(含 announced_at / 项目 / 报名时段 / 人数上限),存内存快照
 *   3. 批次含 CN 比赛时,顺手抓一次 cubing.com page 1(已按日期倒序含所有未来 CN 赛),用同一套
 *      alias→WCA id 规则 + 日期回退实时解析中文名,塞进 name_zh —— 绕开每天一刷的
 *      comp_names_zh.json 管道(那条链 cron 日更 + [skip ci]/rsync,公示后最坏要等近 24h)。
 *   4. 端点直接吐快照,客户端按访客本地时区过滤出「今天」公示的比赛(48h 窗口覆盖任意时区的当天)
 *   5. nginx proxy_cache + 浏览器 5min 兜底,上游负载 ~3 req/h
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
  name_zh: string | null; // cubing.com 中文名(仅 CN 比赛实时解析,无则 null;客户端做 stripWcaPrefix)
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
    name_zh: null,
  };
}

// ── cubing.com 中文名实时解析(仅 CN 比赛) ────────────────────────────────
// 忠实复用 stats-build/fetch_comp_names_zh.ts 的 rowPattern + alias 候选规则,但只抓 page 1
// (列表按日期倒序,所有已公示的未来 CN 赛都在首页)且按 WCA id 直接 join 公示批次,无需全量映射。
const CUBING_LIST = 'https://cubing.com/competition?year=&type=&province=&event=&page=1';
// 一行:<td>YYYY-MM-DD[~END]</td><td><a class="comp-type-*" href=".../competition|live/<alias>">中文名</a>
const CUBING_ROW_RE =
  /<td>(\d{4}-\d{2}-\d{2})(?:~(?:\d{4}-)?(?:\d{2}-)?\d{2})?<\/td>\s*<td>\s*<a[^>]*class="comp-type-\w+"[^>]*href="https:\/\/cubing\.com\/(?:competition|live)\/([^"?]+)"[^>]*>(.*?)<\/a>/gs;
const TAG_STRIP = /<[^>]+>/g;

// 从 cubing.com URL alias 推测可能的 WCA ID(WCA ID 常省略 'Open' / 'Cubing' 前缀,故多候选)。
function aliasToWcaIdCandidates(alias: string): string[] {
  const tokens = alias.split('-');
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (cand: string) => {
    if (cand && !seen.has(cand)) { seen.add(cand); out.push(cand); }
  };
  push(tokens.join(''));
  if (tokens.includes('Open')) push(tokens.filter((t) => t !== 'Open').join(''));
  if (tokens.length && tokens[0] === 'Cubing') {
    const rest = tokens.slice(1);
    push(rest.join(''));
    if (rest.includes('Open')) push(rest.filter((t) => t !== 'Open').join(''));
  }
  const start = tokens.length && tokens[0] === 'Cubing' ? 1 : 0;
  const yearTokens = tokens.filter((t) => /^\d{4}$/.test(t));
  if (tokens.length - start >= 2 && yearTokens.length) {
    push(tokens[start]! + tokens[start + 1]! + yearTokens[0]!);
  }
  return out;
}

// 抓 cubing.com page 1,返回 wcaId→中文名(alias 候选) + start_date→中文名[](唯一回退)。
async function scrapeCubingCnZh(): Promise<{ byId: Map<string, string>; byDate: Map<string, string[]> }> {
  const byId = new Map<string, string>();
  const byDate = new Map<string, string[]>();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const r = await fetch(CUBING_LIST, { headers: { 'User-Agent': 'cuberoot.me' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`cubing.com HTTP ${r.status}`);
    html = await r.text();
  } finally {
    clearTimeout(t);
  }
  for (const m of html.matchAll(CUBING_ROW_RE)) {
    const date = m[1]!;
    const alias = m[2]!;
    const zh = m[3]!.replace(TAG_STRIP, '').trim();
    if (!zh || alias.startsWith('?') || !zh.includes('WCA')) continue; // 只收 WCA 赛(中文名必含 WCA)
    for (const cand of aliasToWcaIdCandidates(alias)) {
      if (!byId.has(cand)) byId.set(cand, zh);
    }
    const arr = byDate.get(date) ?? [];
    arr.push(zh);
    byDate.set(date, arr);
  }
  return { byId, byDate };
}

// 给批次里的 CN 比赛挂 name_zh(alias id 命中优先,失败按 start_date 唯一回退)。失败静默。
async function attachCnZhNames(comps: AnnouncedComp[]): Promise<void> {
  if (!comps.some((c) => c.country === 'cn')) return;
  let maps: { byId: Map<string, string>; byDate: Map<string, string[]> };
  try {
    maps = await scrapeCubingCnZh();
  } catch (err) {
    console.warn('[announced-comps] cubing.com zh fetch failed:', (err as Error).message);
    return;
  }
  for (const c of comps) {
    if (c.country !== 'cn') continue;
    let zh = maps.byId.get(c.id);
    if (!zh && c.start_date) {
      const cand = maps.byDate.get(c.start_date);
      if (cand && cand.length === 1) zh = cand[0];
    }
    if (zh) c.name_zh = zh;
  }
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
  await attachCnZhNames(out); // CN 比赛实时挂 cubing.com 中文名(失败静默,不阻断快照)
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
