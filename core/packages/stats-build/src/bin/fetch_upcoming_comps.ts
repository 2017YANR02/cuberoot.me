#!/usr/bin/env node
//
// NOTE: 顶尖选手近期比赛追踪 - 数据抓取脚本（faithful port of scripts/fetch_upcoming_comps.py）
// 遵循原则: DRY, 模块化, 前后端分离, 防 BUG (限流重试)
//
// 数据源:
//   1. WCA API — 全球比赛 + 选手注册信息
//   2. cubing.com（粗饼网）— 中国内地比赛（WCA API 不覆盖）
//
// 流程:
//   1. 从 stats/wr_metric.json 提取去重后的顶尖选手 WCA ID + 项目 + WR 标记
//   2. 爬取 WCA API 获取名单内所有人的 upcoming_competitions
//   3. 从 cubing.com 获取中国内地比赛列表 + 选手 HTML 页面，交叉匹配 top cubers
//   4. 数据清洗、去重、按时间线聚合
//   5. 生成极简 JSON 给前端页面使用
//
// 用法（从 core/ 跑，或仓库根）:
//   npx tsx src/bin/fetch_upcoming_comps.ts --refresh

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline/promises';

// ================= Configuration ==================
// NOTE: 位置定位仓库根（bin -> src -> stats-build -> packages -> core -> repo root，5 个 '..'），
//       与 gen_all_comps.ts 一致，独立于 process.cwd()。
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../../../../');
const WR_METRIC_PATH = resolve(ROOT_DIR, 'stats/wr_metric.json');
const OUTPUT_JSON_PATH = resolve(ROOT_DIR, 'stats/upcoming_comps.json');
// NOTE: Globe history/upcoming 模式 + UpcomingCompsPage All 模式共用，含全球全量 upcoming
const ALL_OUTPUT_JSON_PATH = resolve(ROOT_DIR, 'stats/all_upcoming_comps.json');
// NOTE: 中国内地比赛全员注册名单（前端"搜索选手"非 top 时,作为静态 fallback;WCA API 不覆盖 cubing.com）
const CN_REGISTRATIONS_JSON_PATH = resolve(ROOT_DIR, 'stats/cn_upcoming_registrations.json');
const CACHE_DIR = resolve(ROOT_DIR, '.upcoming_cache');

// 默认直连 WCA;CI 上被 WCA 403(GH runner IP 段),改经服务器代理:
// WCA_API_BASE=https://api.cuberoot.me/v1/wca-proxy/api/v0 + WCA_PROXY_SECRET(密钥头)。
const WCA_API_BASE = process.env.WCA_API_BASE || 'https://www.worldcubeassociation.org/api/v0';
const WCA_PROXY_SECRET = process.env.WCA_PROXY_SECRET;
// NOTE: cubing.com（粗饼网）管理中国内地比赛报名，WCA API 不返回这些比赛
const CUBING_CHINA_API = 'https://cubing.com/api/competition';
const CUBING_CHINA_BASE = 'https://cubing.com';
const API_DELAY_SEC = 0.5;
const MAX_RETRIES = 3;
// NOTE: 429 限流独立于失败重试——遵守 Retry-After 多等几次，别因限流就丢掉一场比赛
const MAX_RATE_LIMIT_WAITS = 10;
// NOTE: 缓存有效期（秒），默认 24 小时。用户选择刷新时会被置为 0
let CACHE_TTL_SEC = 24 * 3600;

// NOTE: 设为正整数可截断调试，生产环境为 null
// NOTE: 设为 10 方便测试，全量为 null
const DEBUG_LIMIT: number | null = null;

// NOTE: wr_metric.json section.title 全名 -> WCA 内部 ID
const EVENT_NAME_TO_ID: Record<string, string> = {
  "Rubik's Cube": '333',
  '2x2x2 Cube': '222',
  '4x4x4 Cube': '444',
  '5x5x5 Cube': '555',
  '6x6x6 Cube': '666',
  '7x7x7 Cube': '777',
  '3x3x3 Blindfolded': '333bf',
  '3x3x3 Fewest Moves': '333fm',
  '3x3x3 One-Handed': '333oh',
  Megaminx: 'minx',
  Pyraminx: 'pyram',
  "Rubik's Clock": 'clock',
  Skewb: 'skewb',
  'Square-1': 'sq1',
  '4x4x4 Blindfolded': '444bf',
  '5x5x5 Blindfolded': '555bf',
  '3x3x3 Multi-Blind': '333mbf',
  '3x3x3 With Feet': '333ft',
  "Rubik's Magic": 'magic',
  'Master Magic': 'mmagic',
  "Rubik's Cube: Multiple blind old style": '333mbo',
};

// NOTE: WCA 官方项目顺序 + 前端展示用短名
// (内部ID, 显示短名) — 排序依据此列表的顺序
const EVENT_DISPLAY_ORDER: [string, string][] = [
  ['333', '3'], ['222', '2'], ['444', '4'],
  ['555', '5'], ['666', '6'], ['777', '7'],
  ['333bf', '3bf'], ['333fm', 'fm'], ['333oh', 'oh'],
  ['minx', 'minx'], ['pyram', 'py'], ['clock', 'clock'],
  ['skewb', 'sk'], ['sq1', 'sq1'],
  ['444bf', '4bf'], ['555bf', '5bf'], ['333mbf', 'mbf'],
  ['333ft', 'ft'], ['333mbo', 'mbo'], ['magic', 'mag'],
  ['mmagic', 'mmag'],
];
// 内部ID -> (排序索引, 显示短名)
const EVENT_ORDER_MAP: Record<string, [number, string]> = {};
EVENT_DISPLAY_ORDER.forEach(([eid, short], idx) => {
  EVENT_ORDER_MAP[eid] = [idx, short];
});
// 显示短名 -> 内部ID（反查；all_comps 存短名，CN 集成存内部ID，统一回内部ID 再规范化）
const SHORT_TO_EVENT_ID: Record<string, string> = {};
for (const [eid, short] of EVENT_DISPLAY_ORDER) {
  SHORT_TO_EVENT_ID[short] = eid;
}
const USER_AGENT = 'WCA-Stats-Bot/1.0 (cuberoot.me)';
// ==================================================

// 选手数据类型: { wca_id: { name, events: { event_id: { ranking, wr, current_wr } } } }
interface EventFlags {
  ranking: boolean;
  wr: boolean;
  current_wr: boolean;
}
interface CuberInfo {
  name: string;
  events: Record<string, EventFlags>;
}
type CuberData = Record<string, CuberInfo>;

interface EventTag {
  id: string;
  wr: string | null;
}

interface TopCuber {
  id: string;
  name: string;
  events: EventTag[];
}

// 比赛条目（内部 comps_map 用，events 中途是 Set，最后规范成短名数组）
interface CompEntry {
  id?: string;
  name: string;
  name_zh?: string;
  city: string;
  city_zh?: string;
  country?: string;
  start_date: string;
  end_date: string;
  events: Set<string> | string[];
  competitor_limit: number;
  registration_open: unknown;
  registration_close: unknown;
  cubing_china_url?: string;
  top_cubers: TopCuber[];
  rounds?: Record<string, number>;
  event_regs?: Record<string, number>;
  /** 已接受报名人数（WCIF accepted persons 总数）；满员判定 = registered >= competitor_limit */
  registered?: number;
  round_meta?: Record<string, RoundMeta>;
}

// ---------- small helpers ----------

function sleep(seconds: number): Promise<void> {
  return new Promise((res) => setTimeout(res, seconds * 1000));
}

// time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) 等价
function utcIsoSeconds(d: Date): string {
  return d.toISOString().slice(0, 19) + 'Z';
}

// time.strftime("%Y-%m-%d", time.gmtime(ts)) 等价（ts 为毫秒）
function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function sumValues(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ----------------------------------

function extractTopCubers(): CuberData {
  /*
   * 从 wr_metric.json 的 single/average × ranking/history 面板中提取选手。
   * - ranking 面板: 当前各项目 Top 10（最高名次的选手 = current WR holder，含并列）
   * - history 面板: 曾经打破过 WR 的选手
   * 每位选手的数据包含其上榜项目及是否持有/曾破 WR。
   */
  if (!existsSync(WR_METRIC_PATH)) {
    throw new Error(`Cannot find: ${WR_METRIC_PATH}`);
  }

  const data = JSON.parse(readFileSync(WR_METRIC_PATH, 'utf-8')) as {
    metricPanels?: {
      id: string;
      panels?: {
        id: string;
        header?: { key?: string }[];
        sections?: { title?: string; rows?: unknown[][] }[];
      }[];
    }[];
  };
  // NOTE: 选手 cell 是 markdown link `[Name](https://.../persons/WCAID)`
  const personPattern = /\[([^\]]+)\]\(https:\/\/www\.worldcubeassociation\.org\/persons\/([A-Z0-9]+)\)/;

  const cubers: CuberData = {};
  const currentWrHolders: Record<string, Set<string>> = {};

  // NOTE: 只关心 single / average 两个指标，下含 ranking / history 两个面板
  const metricPanels: Record<string, NonNullable<typeof data.metricPanels>[number]> = {};
  for (const mp of data.metricPanels ?? []) {
    metricPanels[mp.id] = mp;
  }

  for (const metricId of ['single', 'average'] as const) {
    const mp = metricPanels[metricId];
    if (!mp) {
      console.log(`  [WARN] 未找到 metric: ${metricId}`);
      continue;
    }
    const subPanels: Record<string, NonNullable<typeof mp.panels>[number]> = {};
    for (const p of mp.panels ?? []) {
      subPanels[p.id] = p;
    }

    for (const panelId of ['ranking', 'history'] as const) {
      const panel = subPanels[panelId];
      if (!panel) {
        console.log(`  [WARN] 未找到 panel: ${metricId}-${panelId}`);
        continue;
      }

      const isHistory = panelId === 'history';
      const label = isHistory ? 'WR历史' : '排名';

      // NOTE: 列索引——从 panel.header 找 person / result 列位置（防 schema 漂移）
      const headerKeys = (panel.header ?? []).map((h) => h.key ?? '');
      const personCol = headerKeys.indexOf('person');
      if (personCol === -1) {
        console.log(`  [WARN] ${metricId}-${panelId} 没有 person 列`);
        continue;
      }
      const resultCol = headerKeys.includes('result') ? headerKeys.indexOf('result') : null;

      for (const section of panel.sections ?? []) {
        const eventName = section.title ?? '';
        const eventId = EVENT_NAME_TO_ID[eventName] ?? eventName;
        const rows = section.rows ?? [];

        // NOTE: ranking 区域识别 current WR holder（与第 1 名同成绩的并列）
        if (!isHistory && resultCol !== null) {
          let rank1Result: string | null = null;
          for (const row of rows) {
            const result = String(row[resultCol]).trim();
            if (rank1Result === null) {
              rank1Result = result;
            } else if (result !== rank1Result) {
              break;
            }
            const m = String(row[personCol]).match(personPattern);
            if (m) {
              (currentWrHolders[eventId] ??= new Set()).add(m[2]!);
            }
          }
        }

        for (const row of rows) {
          const m = String(row[personCol]).match(personPattern);
          if (!m) continue;
          const name = m[1]!;
          const wcaId = m[2]!;
          if (!(wcaId in cubers)) {
            cubers[wcaId] = { name, events: {} };
          }
          if (!(eventId in cubers[wcaId]!.events)) {
            cubers[wcaId]!.events[eventId] = {
              ranking: false,
              wr: false,
              current_wr: false,
            };
          }
          if (isHistory) {
            cubers[wcaId]!.events[eventId]!.wr = true;
          } else {
            cubers[wcaId]!.events[eventId]!.ranking = true;
          }
        }
      }

      console.log(`  [${label}] ${metricId}-${panelId} 处理完毕`);
    }
  }

  for (const [evId, holderIds] of Object.entries(currentWrHolders)) {
    for (const wcaId of holderIds) {
      if (wcaId in cubers && evId in cubers[wcaId]!.events) {
        cubers[wcaId]!.events[evId]!.current_wr = true;
      }
    }
  }

  console.log(`[INFO] 提取到 ${Object.keys(cubers).length} 名选手（排名+WR历史，含已取消项目）.`);
  return cubers;
}

function isCacheValid(path: string): boolean {
  // 检查缓存文件是否存在且未过期。
  // CACHE_TTL_SEC=0（--refresh）时 (now - mtime) < 0 永远 false，每个缓存都视为失效。
  if (!existsSync(path)) return false;
  const mtimeMs = statSync(path).mtimeMs;
  return Date.now() / 1000 - mtimeMs / 1000 < CACHE_TTL_SEC;
}

function buildEventTags(cuberInfo: CuberInfo): EventTag[] {
  // 从选手数据构造事件标签列表（按 WR优先级 -> WCA 官方顺序）。
  const tags: EventTag[] = [];

  const sortKey = (item: [string, EventFlags]): [number, number] => {
    const [evId, flags] = item;
    // WR 优先级: current(0) > former(1) > 无(2)
    const wrPriority = flags.current_wr ? 0 : flags.wr ? 1 : 2;
    // 项目优先级
    const eventPriority = (EVENT_ORDER_MAP[evId] ?? [999, evId])[0] as number;
    return [wrPriority, eventPriority];
  };

  // Python sorted() 稳定；JS sort 稳定（ES2019+）。复刻 (wr_priority, event_priority) 元组比较。
  const entries = Object.entries(cuberInfo.events);
  entries.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[1] - kb[1];
  });

  for (const [evId, flags] of entries) {
    const short = (EVENT_ORDER_MAP[evId] ?? [999, evId])[1] as string;
    // NOTE: current=当前WR保持者, former=曾破WR但非当前保持者
    const wrVal = flags.current_wr ? 'current' : flags.wr ? 'former' : null;
    tags.push({ id: short, wr: wrVal });
  }

  return tags;
}

/**
 * 带限流和防封禁重试机制的网络请求。raw=true 时返回原始文本，否则解析 JSON。
 * 失败兜底返回 {}（与 Python 一致：callers 用 isinstance(x,dict)/truthiness 判定）。
 *
 * 超时语义：Python urllib timeout=10 是读/不活动超时；这里用 AbortController 是硬总超时。
 * 小响应（列表分页 / 单 HTML / 单场详情）用默认 10s；大响应（championship WCIF 的完整
 * persons 数组可达数 MB）必须由调用方传更大的 timeoutMs，否则慢 runner 上会下到一半被 abort。
 */
async function fetchWithRetry(url: string, raw = false, timeoutMs = 10_000): Promise<unknown> {
  let attempt = 0;
  let rateLimitWaits = 0;
  while (attempt < MAX_RETRIES) {
    await sleep(API_DELAY_SEC);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let text: string;
    try {
      const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
      // 仅对经代理的 WCA 请求带密钥头;cubing.com 等其它 host 直连,不泄露 secret。
      if (WCA_PROXY_SECRET && url.startsWith(WCA_API_BASE)) headers['X-Proxy-Secret'] = WCA_PROXY_SECRET;
      const resp = await fetch(url, {
        headers,
        signal: ctrl.signal,
      });

      // urllib 对非 2xx 抛 HTTPError；fetch 不抛，手动按 status 分支（在读 body 前）。
      if (!resp.ok) {
        clearTimeout(timer);
        if (resp.status === 404 || resp.status === 403) {
          // NOTE: 404 = 无 WCA 账号；403 = 端点需要认证，重试无意义
          return {};
        }
        if (resp.status === 429) {
          // NOTE: 429 = 速率限流，不是失败。遵守 Retry-After 耐心等待，且不消耗
          //       attempt（否则 3 次 429 就丢掉这场比赛）；仅独立上限防无限卡死。
          if (rateLimitWaits >= MAX_RATE_LIMIT_WAITS) {
            console.log(`[ERROR] 429 连续 ${MAX_RATE_LIMIT_WAITS} 次仍限流，放弃: ${url}`);
            return {};
          }
          const retryAfter = resp.headers.get('Retry-After');
          // 仅采信非负整数秒；其余(空/非数字/负数)落回 2s，并至少等 1s 防 busy-retry。
          const wait = Math.max(1, retryAfter !== null && /^\s*\d+\s*$/.test(retryAfter)
            ? parseInt(retryAfter, 10)
            : 2);
          console.log(`[WARN] 触发 429 限制，等待 ${wait} 秒...`);
          await sleep(wait);
          rateLimitWaits += 1;
          continue;
        }
        console.log(`[ERROR] API 返回 ${resp.status}: ${url}`);
        await sleep(1);
        attempt += 1;
        continue;
      }

      // NOTE: body 读取必须在 try + timer 之内（对应 Python resp.read() 仍受 timeout 约束）——
      //       mid-body 中断 → 落入下方 catch 重试；stalled body → timer abort → 重试。
      text = await resp.text();
    } catch (e) {
      // urllib.error.URLError / OSError 对应：网络异常 / abort（超时）/ body 读取中断
      clearTimeout(timer);
      console.log(`[WARN] 请求异常 ${(e as Error).message ?? e}, 重试 ${attempt + 1}/${MAX_RETRIES}...`);
      await sleep(2);
      attempt += 1;
      continue;
    }
    clearTimeout(timer);
    // NOTE: JSON.parse 在 try 之外 —— 与 Python json.loads 一致（JSONDecodeError 不在 except 内，向上抛）。
    return raw ? text : JSON.parse(text);
  }

  return {};
}

interface CnComp {
  alias: string;
  name: string;
  city: string;
  start_date: string;
  end_date: string;
  competitor_limit: number;
  /** cubing.com 实际报名人数(含无 WCA ID 的新人,故比 WCA-ID 名单准);满员判定用它 */
  registered_competitors?: number;
}

async function fetchCubingChinaComps(): Promise<CnComp[]> {
  /*
   * 从 cubing.com API 获取即将举行的中国内地 WCA 比赛列表。
   * 返回 [{alias, name, city, start_date, end_date, competitor_limit}, ...]
   */
  const cacheFile = resolve(CACHE_DIR, '_cubing_china_list.json');
  if (isCacheValid(cacheFile)) {
    const data = JSON.parse(readFileSync(cacheFile, 'utf-8')) as CnComp[];
    console.log(`[CN] 比赛列表: ${data.length} 场 [缓存]`);
    return data;
  }

  const rawData = await fetchWithRetry(CUBING_CHINA_API);
  if (
    !rawData ||
    typeof rawData !== 'object' ||
    (rawData as { status?: unknown }).status !== 0
  ) {
    console.log('[CN] 获取比赛列表失败');
    return [];
  }

  const nowTs = Date.now() / 1000;
  const comps: CnComp[] = [];
  for (const c of ((rawData as { data?: unknown[] }).data ?? []) as Record<string, unknown>[]) {
    // NOTE: 只要 WCA 认证赛、未结束、日期在未来
    if (c.type !== 'WCA' || c.live !== 0) {
      continue;
    }
    const dateObj = (c.date ?? {}) as { from?: number; to?: number };
    const dateFrom = dateObj.from ?? 0;
    if (dateFrom <= nowTs) {
      continue;
    }

    // NOTE: 时间戳 → YYYY-MM-DD（UTC）
    const start = utcDate(dateFrom * 1000);
    const dateTo = dateObj.to ?? dateFrom;
    const end = utcDate(dateTo * 1000);

    // NOTE: 多地点比赛顶级 competitor_limit 可能为 0，fallback 到各 location 限额之和
    const locations = (c.locations ?? []) as { competitor_limit?: number; province?: string; city?: string }[];
    let limit = (c.competitor_limit as number | undefined) ?? 0;
    if (!limit) {
      limit = sumValues(locations.map((loc) => loc.competitor_limit ?? 0));
    }

    // NOTE: 拼接省份+城市（取第一个 location）
    const locs = locations.length ? locations : [{} as { province?: string; city?: string }];
    const province = locs[0]!.province ?? '';
    const city = locs[0]!.city ?? '';

    comps.push({
      alias: c.alias as string,
      name: c.name as string,
      city: province !== city ? `${province}, ${city}` : city,
      start_date: start,
      end_date: end,
      competitor_limit: limit,
      registered_competitors: typeof c.registered_competitors === 'number' ? c.registered_competitors : undefined,
    });
  }

  // 写入缓存
  writeFileSync(cacheFile, JSON.stringify(comps), 'utf-8');
  console.log(`[CN] 比赛列表: ${comps.length} 场`);
  return comps;
}

async function fetchCubingChinaCompetitors(alias: string): Promise<Set<string>> {
  /*
   * 从 cubing.com 比赛选手页面提取所有参赛者的 WCA ID。
   * 返回 set of WCA IDs。
   */
  const cacheFile = resolve(CACHE_DIR, `_cubing_china_${alias}.html`);
  let html: string;
  if (isCacheValid(cacheFile)) {
    html = readFileSync(cacheFile, 'utf-8');
  } else {
    const url = `${CUBING_CHINA_BASE}/competition/${alias}/competitors`;
    const raw = await fetchWithRetry(url, true);
    // NOTE: raw=true 失败时返回空 dict（fetchWithRetry 的兜底）
    if (!raw || typeof raw !== 'string') {
      return new Set();
    }
    html = raw;
    writeFileSync(cacheFile, html, 'utf-8');
  }

  // NOTE: cubing.com 使用完整 URL（href="https://cubing.com/results/person/..."）
  const ids = new Set<string>();
  for (const m of html.matchAll(/person\/([A-Z0-9]+)/g)) {
    ids.add(m[1]!);
  }
  // NOTE: 0 个 ID 通常意味着 cubing.com 页面结构变更，需要更新正则
  if (ids.size === 0) {
    console.log(`[CN][WARN] ${alias}: 选手页面未解析到任何 WCA ID，请检查 cubing.com 页面结构`);
  }
  return ids;
}

async function integrateCubingChina(
  compsMap: Record<string, CompEntry>,
  cubers: CuberData,
): Promise<void> {
  /*
   * 集成 cubing.com 上的中国内地比赛到 compsMap。
   * 只有当比赛中有 top cubers 参赛时才加入（与 WCA 数据逻辑一致）。
   * 整体 try/except 保护：失败时优雅降级，不影响 WCA 数据。
   */
  try {
    const cnComps = await fetchCubingChinaComps();
    if (!cnComps.length) {
      return;
    }

    let cnAdded = 0;
    const cuberKeys = new Set(Object.keys(cubers));
    for (const comp of cnComps) {
      const alias = comp.alias;
      // NOTE: alias 去连字符 = WCA comp ID，确保前端链接正确
      const compId = alias.replaceAll('-', '');

      // NOTE: WCA API 可能已创建此条目，但缺少 cubing.com 独有字段
      if (compId in compsMap) {
        // NOTE: 补充中文名、中文城市、cubing.com 链接
        compsMap[compId]!.name_zh = comp.name;
        compsMap[compId]!.city_zh = comp.city;
        compsMap[compId]!.cubing_china_url = `https://cubing.com/competition/${alias}`;
        continue;
      }

      const competitorIds = await fetchCubingChinaCompetitors(alias);
      if (competitorIds.size === 0) {
        continue;
      }

      // NOTE: 与 top cubers 名单交叉匹配
      const matched: string[] = [];
      for (const id of competitorIds) {
        if (cuberKeys.has(id)) matched.push(id);
      }
      if (!matched.length) {
        continue;
      }

      // NOTE: 从 WCA API 获取英文名、英文城市和比赛项目（带缓存）
      const wcaCache = resolve(CACHE_DIR, `_wca_comp_${compId}.json`);
      let wcaData: Record<string, unknown>;
      if (isCacheValid(wcaCache)) {
        wcaData = JSON.parse(readFileSync(wcaCache, 'utf-8')) as Record<string, unknown>;
      } else {
        wcaData = (await fetchWithRetry(`${WCA_API_BASE}/competitions/${compId}`)) as Record<string, unknown>;
        writeFileSync(wcaCache, JSON.stringify(wcaData), 'utf-8');
      }

      // NOTE: WCA API 提供英文名和城市；cubing.com 提供中文名和城市
      const enName = (wcaData.name as string | undefined) ?? comp.name;
      const enCity = (wcaData.city as string | undefined) ?? comp.city;
      const eventIds = new Set<string>((wcaData.event_ids as string[] | undefined) ?? []);

      // 创建比赛条目
      compsMap[compId] = {
        id: compId,
        name: enName,
        name_zh: comp.name,
        city: enCity,
        city_zh: comp.city,
        country: 'CN',
        start_date: comp.start_date,
        end_date: comp.end_date,
        events: eventIds,
        competitor_limit: comp.competitor_limit,
        registration_open: wcaData.registration_open ?? null,
        registration_close: wcaData.registration_close ?? null,
        // NOTE: 中国内地比赛链接跳转粗饼网而非 WCA 官网
        cubing_china_url: `https://cubing.com/competition/${alias}`,
        top_cubers: [],
      };

      for (const wcaId of matched) {
        compsMap[compId]!.top_cubers.push({
          id: wcaId,
          name: cubers[wcaId]!.name,
          events: buildEventTags(cubers[wcaId]!),
        });
      }

      cnAdded += 1;
    }

    if (cnAdded > 0) {
      console.log(`[CN] 成功集成 ${cnAdded} 场中国内地比赛`);
    } else {
      console.log('[CN] 未找到有 top cubers 参赛的中国内地比赛');
    }
  } catch (e) {
    // NOTE: 优雅降级 — CN 集成失败不影响 WCA 数据
    console.log(`[CN][WARN] cubing.com 集成失败，已跳过: ${(e as Error).message ?? e}`);
  }
}

async function buildCnRegistrations(): Promise<Record<string, string[]>> {
  /*
   * 抓 cubing.com 上每场即将举行的中国比赛的全员注册 WCA ID 名单。
   * 返回 {comp_id: [wca_id, ...]}（已排序）。
   */
  const out: Record<string, string[]> = {};
  let cnComps: CnComp[];
  try {
    cnComps = await fetchCubingChinaComps();
  } catch (e) {
    console.log(`[CN-REG][WARN] 比赛列表拉取失败: ${(e as Error).message ?? e}`);
    return out;
  }
  if (!cnComps.length) {
    return out;
  }

  const total = cnComps.length;
  let totalIds = 0;
  let i = 0;
  for (const comp of cnComps) {
    i += 1;
    const alias = comp.alias;
    const compId = alias.replaceAll('-', '');
    try {
      const ids = await fetchCubingChinaCompetitors(alias);
      // Python sorted(set) 按 Unicode code point；WCA ID 为 ASCII，JS 默认 sort 等价。
      out[compId] = [...ids].sort();
      totalIds += ids.size;
      console.log(`[CN-REG] [${i}/${total}] ${compId}: ${ids.size} 人`);
    } catch (e) {
      console.log(`[CN-REG][WARN] ${compId}: ${(e as Error).message ?? e}`);
      out[compId] = [];
    }
  }
  console.log(`[CN-REG] 共 ${total} 场,合计 ${totalIds} 个 WCA ID`);
  return out;
}

interface AllComp {
  id: string;
  name: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  events: string[];
  competitor_limit: number;
  registration_open: unknown;
  registration_close: unknown;
  latitude_degrees: number;
  longitude_degrees: number;
  url: string;
  // 项目修改截止时刻（ISO，单场端点专属，列表端点不返回）。94% 比赛有设；拉不到为 null。
  event_change_deadline?: string | null;
  rounds?: Record<string, number>;
  event_regs?: Record<string, number>;
  /** 已接受报名人数（WCIF accepted persons 总数）；满员判定 = registered >= competitor_limit */
  registered?: number;
  round_meta?: Record<string, RoundMeta>;
}

async function buildUpcomingCompsFromWcif(
  cubers: CuberData,
  allComps: AllComp[],
  wcifMap: Record<string, WcifEntry>,
): Promise<CompEntry[]> {
  /*
   * WCA 限制 /users/:id?upcoming_competitions=true（返回 403）后的替代方案。
   * 用每场 WCIF public 端点的 persons 数组（含 wcaId + registration.status）
   * 与 top cubers 交叉匹配。
   */
  const cuberIds = new Set(Object.keys(cubers));
  const compsMap: Record<string, CompEntry> = {};

  for (const comp of allComps) {
    const compId = comp.id;
    const competitors = wcifMap[compId]?.competitors ?? [];
    const matched = competitors.filter((w) => cuberIds.has(w));
    if (!matched.length) {
      continue;
    }

    // NOTE: all_comps 存短名 → 转回内部ID，与 CN 集成统一，最后再规范化成短名
    const events = new Set<string>();
    for (const e of comp.events ?? []) {
      events.add(SHORT_TO_EVENT_ID[e] ?? e);
    }

    compsMap[compId] = {
      id: compId,
      name: comp.name ?? '',
      city: comp.city ?? '',
      country: comp.country ?? '',
      start_date: comp.start_date ?? '',
      end_date: comp.end_date ?? '',
      events,
      competitor_limit: comp.competitor_limit ?? 0,
      registration_open: comp.registration_open ?? null,
      registration_close: comp.registration_close ?? null,
      top_cubers: [],
    };
    for (const wcaId of matched) {
      const cuberInfo = cubers[wcaId]!;
      compsMap[compId]!.top_cubers.push({
        id: wcaId,
        name: cuberInfo.name,
        events: buildEventTags(cuberInfo),
      });
    }
  }

  console.log(`[REG] ${Object.keys(compsMap).length} 场比赛有 top cubers 参赛`);

  // 集成 cubing.com CN 比赛（不在 WCA all_comps 里）
  await integrateCubingChina(compsMap, cubers);

  // NOTE: 过滤太遥远的比赛（仅到明年底），排除占位赛事如 2028 年欧锦赛
  // datetime.now().year 用本地年份。
  const maxYear = new Date().getFullYear() + 1;
  const results: CompEntry[] = Object.values(compsMap).filter((info) => {
    const yr = info.start_date.slice(0, 4);
    return /^\d+$/.test(yr) && parseInt(yr, 10) <= maxYear;
  });

  // events 统一从内部ID 按 WCA 官方顺序排序 → 转短名
  for (const info of results) {
    const evList = [...(info.events as Set<string>)];
    evList.sort((a, b) => {
      const ia = (EVENT_ORDER_MAP[a] ?? [999, a])[0] as number;
      const ib = (EVENT_ORDER_MAP[b] ?? [999, b])[0] as number;
      return ia - ib;
    });
    info.events = evList.map((e) => (EVENT_ORDER_MAP[e] ?? [999, e])[1] as string);

    // top_cubers 多键排序：current 数降序、former 数降序、name 升序。JS sort 稳定。
    info.top_cubers.sort((a, b) => {
      const ac = a.events.filter((e) => e.wr === 'current').length;
      const bc = b.events.filter((e) => e.wr === 'current').length;
      if (ac !== bc) return bc - ac;
      const af = a.events.filter((e) => e.wr === 'former').length;
      const bf = b.events.filter((e) => e.wr === 'former').length;
      if (af !== bf) return bf - af;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }

  results.sort((a, b) =>
    a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0,
  );
  return results;
}

// 紧凑 round-1 meta，与 shared RoundMeta / gen_all_comps 一致（键省略即无）
interface RoundMeta {
  tl?: number;
  cum?: 1;
  co?: [number, number];
  adv?: string;
  q?: string;
}
function encodeAdv(a: { type?: string; level?: number } | null | undefined): string | undefined {
  if (!a || a.level == null) return undefined;
  if (a.type === 'ranking') return `r${a.level}`;
  if (a.type === 'percent') return `p${a.level}`;
  if (a.type === 'attemptResult') return `a${a.level}`;
  return undefined;
}
function encodeQual(q: { type?: string; resultType?: string; level?: number | null } | null | undefined): string | undefined {
  if (!q || !q.type) return undefined;
  return `${q.type}:${q.resultType ?? ''}:${q.level ?? ''}`;
}

interface WcifEntry {
  rounds: Record<string, number>;
  competitors: string[];
  // event 短码 → 报名该项目的人数（accepted persons 的 registration.eventIds 聚合）
  eventRegs: Record<string, number>;
  // event 短码 → round-1 WCIF 配置（限时/及格/晋级/资格）
  roundMeta: Record<string, RoundMeta>;
}

function wcifCacheOk(cached: unknown): cached is WcifEntry {
  // 新缓存格式必须含 rounds + competitors + eventRegs + roundMeta；旧格式（缺任一）视为失效，重拉。
  return (
    typeof cached === 'object' &&
    cached !== null &&
    'rounds' in cached &&
    'competitors' in cached &&
    'eventRegs' in cached &&
    'roundMeta' in cached
  );
}

async function fetchWcif(compId: string): Promise<WcifEntry | Record<string, never>> {
  /*
   * 拉取单场比赛 WCIF 公开端点，一次性提取轮次数 + 报名选手 wcaId。
   * 返回 { rounds: {短名: rounds_count}, competitors: [wcaId, ...] }。
   * 失败 / 无 events → {}（不缓存，下次重试）。单文件缓存（24h）。
   */
  const cacheFile = resolve(CACHE_DIR, `_wcif_${compId}.json`);
  if (isCacheValid(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));
      if (wcifCacheOk(cached)) {
        return cached;
      }
    } catch {
      // 缓存损坏 / 旧格式 → 重新拉
    }
  }

  const url = `${WCA_API_BASE}/competitions/${compId}/wcif/public`;
  // WCIF persons 数组大型赛可达数 MB，给 60s 硬总超时上限（默认 10s 会下到一半 abort，丢整场报名）。
  const data = await fetchWithRetry(url, false, 120_000);
  // NOTE: fetchWithRetry 网络失败 / 429 重试耗尽 / 404 都返回 {}（无 events 键）。
  //       区分"真无 events"和"fetch 失败"很重要：失败不写缓存，让下次重试；
  //       成功（哪怕 events 列表为空）才缓存。否则一次 429 → 缓存 24h 内永远空。
  if (typeof data !== 'object' || data === null || !('events' in data)) {
    return {};
  }
  type WcifRound = {
    timeLimit?: { centiseconds?: number; cumulativeRoundIds?: string[] } | null;
    cutoff?: { numberOfAttempts?: number; attemptResult?: number } | null;
    advancementCondition?: { type?: string; level?: number } | null;
  };
  const d = data as {
    events?: { id?: string; rounds?: WcifRound[]; qualification?: { type?: string; resultType?: string; level?: number | null } | null }[] | null;
    persons?: { wcaId?: string; registration?: { status?: string; eventIds?: string[] } | null }[] | null;
  };
  const rounds: Record<string, number> = {};
  const roundMeta: Record<string, RoundMeta> = {};
  for (const ev of d.events ?? []) {
    const eid = ev.id;
    if (!eid) {
      continue;
    }
    const rs = ev.rounds ?? [];
    const short = (EVENT_ORDER_MAP[eid] ?? [999, eid])[1] as string;
    rounds[short] = rs.length;
    // round-1 配置 + event 级 qualification → 紧凑 meta
    const r1 = rs[0];
    const m: RoundMeta = {};
    if (typeof r1?.timeLimit?.centiseconds === 'number') {
      m.tl = r1.timeLimit.centiseconds;
      if ((r1.timeLimit.cumulativeRoundIds?.length ?? 0) > 0) m.cum = 1;
    }
    if (typeof r1?.cutoff?.numberOfAttempts === 'number' && typeof r1?.cutoff?.attemptResult === 'number') {
      m.co = [r1.cutoff.numberOfAttempts, r1.cutoff.attemptResult];
    }
    const adv = encodeAdv(r1?.advancementCondition);
    if (adv) m.adv = adv;
    const q = encodeQual(ev.qualification);
    if (q) m.q = q;
    if (Object.keys(m).length > 0) roundMeta[short] = m;
  }
  // NOTE: persons[].registration 可能为 null（纯 staff/delegate）；只取 accepted 报名者。
  //       同一遍里按 registration.eventIds 累加每个项目的报名人数（短名 key，与 rounds 对齐）。
  const competitors: string[] = [];
  const eventRegs: Record<string, number> = {};
  for (const p of d.persons ?? []) {
    const wid = p.wcaId;
    const reg = p.registration ?? {};
    if (reg.status !== 'accepted') continue;
    if (wid) competitors.push(wid);
    for (const eid of reg.eventIds ?? []) {
      const short = (EVENT_ORDER_MAP[eid] ?? [999, eid])[1] as string;
      eventRegs[short] = (eventRegs[short] ?? 0) + 1;
    }
  }
  const out: WcifEntry = { rounds, competitors, eventRegs, roundMeta };
  writeFileSync(cacheFile, JSON.stringify(out), 'utf-8');
  return out;
}

async function fetchWcifBatch(compIds: Iterable<string>): Promise<Record<string, WcifEntry>> {
  /*
   * 拉一批比赛的 WCIF（轮次 + 报名名单）。已缓存的直接读，未缓存的用有界并发池拉取
   * (WCIF_CONCURRENCY 默认 8)——WCA 对服务器出口按每连接限带宽,并发近似线性提速。
   * 返回 { comp_id: {rounds: {...}, competitors: [...]} }。
   */
  const out: Record<string, WcifEntry> = {};
  const pending: string[] = [];
  for (const cid of compIds) {
    const cacheFile = resolve(CACHE_DIR, `_wcif_${cid}.json`);
    if (isCacheValid(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));
        if (wcifCacheOk(cached)) {
          out[cid] = cached;
          continue;
        }
      } catch {
        // 损坏 / 旧格式 → 重拉
      }
    }
    pending.push(cid);
  }

  if (!pending.length) {
    console.log(`[WCIF] 全部 ${Object.keys(out).length} 场命中缓存`);
    return out;
  }

  console.log(`[WCIF] 缓存命中 ${Object.keys(out).length} 场，待拉取 ${pending.length} 场...`);
  // NOTE: WCA 对经代理的服务器出口按「每连接」限带宽(实测 ~18KB/s,4 并发 ≈ 单个耗时),
  //       串行会把 ~440 场拖到 2+ 小时。改有界并发池(WCIF_CONCURRENCY,默认 8)近似线性提速;
  //       429 仍由 fetchWithRetry 内的自适应退避兜底(每连接独立遵守 Retry-After)。
  //       直连 WCA(本地)单请求本就 1-2s,并发同样适用,无副作用。
  const CONCURRENCY = Math.max(1, Number(process.env.WCIF_CONCURRENCY) || 8);
  let done = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    // next++ 在单线程事件循环里取号无竞态;out[cid] 各 worker 写不同键。
    for (let i = next++; i < pending.length; i = next++) {
      const cid = pending[i]!;
      try {
        const r = await fetchWcif(cid);
        out[cid] = wcifCacheOk(r) ? r : { rounds: {}, competitors: [], eventRegs: {}, roundMeta: {} };
      } catch (e) {
        console.log(`[WCIF][WARN] ${cid}: ${(e as Error).message ?? e}`);
        out[cid] = { rounds: {}, competitors: [], eventRegs: {}, roundMeta: {} };
      }
      done += 1;
      if (done % 50 === 0 || done === pending.length) {
        console.log(`[WCIF] ${done}/${pending.length} 已拉取`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  return out;
}

async function fetchChangeDeadline(compId: string): Promise<string | null> {
  /*
   * 拉单场 /competitions/:id 取 event_change_deadline_date（项目修改截止）。
   * 列表端点不返回此字段，只能逐场拉。单文件缓存（24h），与 WCIF 同策略。
   * 失败 / 无字段 → null（不缓存空，下次重试）。
   */
  const cacheFile = resolve(CACHE_DIR, `_compinfo_${compId}.json`);
  if (isCacheValid(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf-8')) as { ecd?: string | null };
      if (typeof cached === 'object' && cached !== null && 'ecd' in cached) return cached.ecd ?? null;
    } catch { /* 损坏 → 重拉 */ }
  }
  const data = await fetchWithRetry(`${WCA_API_BASE}/competitions/${compId}`, false, 30_000);
  if (typeof data !== 'object' || data === null || !('id' in data)) return null;
  const ecd = (data as { event_change_deadline_date?: unknown }).event_change_deadline_date;
  const val = typeof ecd === 'string' && ecd ? ecd : null;
  writeFileSync(cacheFile, JSON.stringify({ ecd: val }), 'utf-8');
  return val;
}

async function fetchChangeDeadlineBatch(compIds: string[]): Promise<Record<string, string | null>> {
  /*
   * 有界并发拉一批比赛的 event_change_deadline_date。payload 小（单场 JSON 几 KB），
   * 与 WCIF 批量同 CONCURRENCY 池；429 由 fetchWithRetry 内退避兜底。
   */
  const out: Record<string, string | null> = {};
  if (!compIds.length) return out;
  const CONCURRENCY = Math.max(1, Number(process.env.WCIF_CONCURRENCY) || 8);
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < compIds.length; i = next++) {
      const cid = compIds[i]!;
      try {
        out[cid] = await fetchChangeDeadline(cid);
      } catch (e) {
        console.log(`[CHG][WARN] ${cid}: ${(e as Error).message ?? e}`);
        out[cid] = null;
      }
      done += 1;
      if (done % 100 === 0 || done === compIds.length) {
        console.log(`[CHG] ${done}/${compIds.length} 修改截止已拉`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, compIds.length) }, worker));
  return out;
}

function shortifyEvents(eventIds: string[]): string[] {
  // WCA 内部 event_id → 前端短名，按 WCA 官方顺序排序。
  const pairs: [number, string][] = [];
  for (const eid of eventIds) {
    const [idx, short] = EVENT_ORDER_MAP[eid] ?? [999, eid];
    pairs.push([idx, short]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  return pairs.map((p) => p[1]);
}

async function buildAllUpcomingComps(): Promise<AllComp[] | null> {
  /*
   * 从 WCA /competitions?ongoing_and_future=... 分页拉全球全量 upcoming 比赛。
   * 与 top-cubers 那份 upcoming_comps.json 不同，这份不过滤选手，是"地图+日历 All 模式"的源数据。
   */
  // NOTE: cutoff 取 14 天前 —— 刚结束、还没进下一次 stats.yml(周日) dump 的比赛留在 JSON 里。
  // time.strftime("%Y-%m-%d", time.gmtime(time.time() - 14*86400)) 等价（UTC）。
  const cutoff = utcDate(Date.now() - 14 * 86400 * 1000);
  const perPage = 100;
  const out: Record<string, unknown>[] = [];
  for (let page = 1; page < 21; page += 1) {
    // 20 * 100 = 2000 上限
    const url =
      `${WCA_API_BASE}/competitions` +
      `?ongoing_and_future=${cutoff}&per_page=${perPage}&page=${page}`;
    // per_page=100 的 list 响应可达 ~725KB;经代理走服务器出口(被 WCA 限带宽 ~18KB/s)时
    // 单页可能要 ~40s,默认 10s 必 abort → 给 90s。直连(本地)仍 1-2s,不受影响。
    const batch = await fetchWithRetry(url, false, 90_000);
    // NOTE: fetchWithRetry 404/失败时返回 {}；list 端点正常返回 list
    if (!Array.isArray(batch)) {
      if (page === 1) {
        console.log('[ALL] 第一页就拿不到 list，放弃生成 all_upcoming_comps.json');
        return null;
      }
      break;
    }
    out.push(...(batch as Record<string, unknown>[]));
    if (batch.length < perPage) {
      break;
    }
    console.log(`[ALL] 已取 ${out.length} 场（page ${page}）`);
  }

  // 过滤已取消 + 精简字段 + 按 id 去重
  // NOTE: WCA API 分页期间排序可能漂移（新增 / cancel 状态变化），同一 id 会跨页重复出现
  const result: AllComp[] = [];
  const seenIds = new Set<string>();
  for (const c of out) {
    if (c.cancelled_at) {
      continue;
    }
    const cid = c.id as string;
    if (seenIds.has(cid)) {
      continue;
    }
    seenIds.add(cid);
    result.push({
      id: c.id as string,
      name: (c.name as string | undefined) ?? '',
      city: (c.city as string | undefined) ?? '',
      country: (c.country_iso2 as string | undefined) ?? '',
      start_date: (c.start_date as string | undefined) ?? '',
      end_date: (c.end_date as string | undefined) ?? '',
      events: shortifyEvents((c.event_ids as string[] | undefined) ?? []),
      competitor_limit: (c.competitor_limit as number | undefined) || 0,
      registration_open: c.registration_open ?? null,
      registration_close: c.registration_close ?? null,
      latitude_degrees: (c.latitude_degrees as number | undefined) ?? 0,
      longitude_degrees: (c.longitude_degrees as number | undefined) ?? 0,
      url: (c.url as string | undefined) ?? `https://www.worldcubeassociation.org/competitions/${c.id}`,
    });
  }
  result.sort((a, b) =>
    a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0,
  );
  return result;
}

// Top 模式输出的比赛条目（events 已规范成短名数组）。仅用于精确控制写出 JSON 的字段集。
type CompOut = Omit<CompEntry, 'events'> & { events: string[] };

function relToRoot(p: string): string {
  // 模拟 Path.relative_to(ROOT_DIR) 的展示用相对路径（正斜杠）。
  let rel = p.startsWith(ROOT_DIR) ? p.slice(ROOT_DIR.length) : p;
  rel = rel.replace(/^[\\/]+/, '');
  return rel.replaceAll('\\', '/');
}

async function main(): Promise<void> {
  console.log('=== 开始构建 Top Cubers 近期比赛追踪数据 ===');
  const startTime = Date.now();

  // NOTE: 交互式询问缓存策略；CI 环境用 --refresh 参数跳过交互
  if (process.argv.includes('--refresh')) {
    console.log('[INFO] 检测到 --refresh 参数，强制刷新缓存。');
    CACHE_TTL_SEC = 0;
  } else if (existsSync(CACHE_DIR) && readdirSync(CACHE_DIR).length > 0) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let ans: string;
    try {
      ans = (await rl.question('发现已有缓存，是否刷新? (y=重新拉取 / 回车=用缓存): ')).trim().toLowerCase();
    } finally {
      rl.close();
    }
    if (ans === 'y') {
      CACHE_TTL_SEC = 0;
      console.log('[INFO] 将重新拉取所有数据。');
    } else {
      console.log('[INFO] 使用已有缓存（24h 内有效）。');
    }
  }

  // 1. 抽取白名单（含事件标签和 WR 标记）
  const cubers = extractTopCubers();
  if (!Object.keys(cubers).length) {
    console.log('[ERROR] 提取到的选手列表为空，退出。');
    return;
  }

  // NOTE: 在此显式建缓存目录（下游 fetchWcifBatch / CN 集成写缓存前依赖它存在）
  mkdirSync(CACHE_DIR, { recursive: true });

  // 2. 先拉全量 upcoming（Globe + All 模式），同时作 Top 模式的比赛来源
  console.log('\n[ALL] 开始拉取 WCA 全球全量 upcoming 比赛...');
  const allComps = await buildAllUpcomingComps();

  // 3. 批量拉每场 WCIF（轮次 + 报名名单）。
  // NOTE: WCA /users/:id?upcoming_competitions=true 现返回 403（端点级限流，非 IP 段封）。
  //       改用 WCIF public 的 persons 数组拿报名 wcaId，同份请求顺带拿轮次，避免双拉。
  const allIds = new Set<string>(allComps ? allComps.map((c) => c.id) : []);
  let wcifMap: Record<string, WcifEntry>;
  if (allIds.size) {
    console.log(`\n[WCIF] 拉取 ${allIds.size} 场比赛的 WCIF（轮次 + 报名名单）...`);
    wcifMap = await fetchWcifBatch(allIds);
  } else {
    wcifMap = {};
  }

  // 4. 用 WCIF 报名名单与 top cubers 交叉匹配，构建 Top 模式
  let compsData: CompEntry[];
  if (allComps) {
    console.log(
      `\n[REG] WCIF 报名名单匹配（${allComps.length} 场 × top ${Object.keys(cubers).length} 名选手）...`,
    );
    compsData = await buildUpcomingCompsFromWcif(cubers, allComps, wcifMap);
  } else {
    console.log('[WARN] all_comps 为空，Top 模式无数据源');
    compsData = [];
  }

  // 5. 补拉 CN 集成新建（不在 all_ids 里）的比赛 WCIF 轮次，再统一填 rounds
  const cnOnlyIds = new Set<string>();
  for (const c of compsData) {
    if (c.id && !allIds.has(c.id)) cnOnlyIds.add(c.id);
  }
  if (cnOnlyIds.size) {
    console.log(`\n[WCIF] 补拉 ${cnOnlyIds.size} 场 CN 比赛轮次...`);
    Object.assign(wcifMap, await fetchWcifBatch(cnOnlyIds));
  }
  // CN 内地比赛的报名走 cubing.com,WCA WCIF 多为 0;用 cubing.com 的 registered_competitors(含新人)
  // 覆盖,满员判定才准(comp id = cubing.com alias 去横线)。已缓存,二次调用近免费。
  const cnRegById = new Map<string, number>();
  for (const cn of await fetchCubingChinaComps()) {
    if (typeof cn.registered_competitors === 'number') cnRegById.set(cn.alias.replace(/-/g, ''), cn.registered_competitors);
  }
  const regOf = (id: string | undefined): number =>
    Math.max(wcifMap[id ?? '']?.competitors?.length ?? 0, (id && cnRegById.get(id)) || 0);
  for (const c of compsData) {
    c.rounds = wcifMap[c.id!]?.rounds ?? {};
    c.event_regs = wcifMap[c.id!]?.eventRegs ?? {};
    c.registered = regOf(c.id);
    c.round_meta = wcifMap[c.id!]?.roundMeta ?? {};
  }
  if (allComps) {
    for (const c of allComps) {
      c.rounds = wcifMap[c.id]?.rounds ?? {};
      c.event_regs = wcifMap[c.id]?.eventRegs ?? {};
      c.registered = regOf(c.id);
      c.round_meta = wcifMap[c.id]?.roundMeta ?? {};
    }
  }

  // 5b. 拉每场「项目修改截止」（event_change_deadline_date）—— 列表端点不含，逐场单拉（小 payload）。
  if (allComps && allComps.length) {
    console.log(`\n[CHG] 拉取 ${allComps.length} 场修改截止...`);
    const chgMap = await fetchChangeDeadlineBatch(allComps.map((c) => c.id));
    for (const c of allComps) {
      c.event_change_deadline = chgMap[c.id] ?? null;
    }
  }

  // 6 + 7. 写出 Top 模式 / All 模式 JSON
  // GUARD: allComps 为 null/空 = WCA /competitions 列表拉不到(CI 的 Azure IP 被 WCA/Cloudflare
  // 403,本机/服务器 IP 不受影响)。此时 compsData 也为空 —— 绝不能用空结果覆盖线上已有的好数据,
  // 否则 upcoming_comps.json 被清空,Top 模式 + 选手筛选的 top_cubers 全没(2026-06-13 真实事故)。
  // 与 comp_names_zh "拉失败保留已有,跳过本次更新" 同策略:跳过写入,git add 自然无 diff,线上保持
  // 上一份好数据。CN 注册名单(下方 step 8)走 cubing.com 不受影响,照常更新。
  let wcaListUnavailable = false;
  if (!allComps || allComps.length === 0) {
    wcaListUnavailable = true;
    console.log('[GUARD] WCA all_comps 不可用,保留已有 upcoming_comps.json / all_upcoming_comps.json,跳过写入(绝不写空);本次将以非零码退出标红 CI');
  } else {
    const outputObj = {
      updated_at: utcIsoSeconds(new Date()),
      total_cubers_tracked: !DEBUG_LIMIT ? Object.keys(cubers).length : DEBUG_LIMIT,
      competitions: compsData as CompOut[],
    };
    mkdirSync(dirname(OUTPUT_JSON_PATH), { recursive: true });
    writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(outputObj), 'utf-8');
    console.log(`\n[INFO] 成功！共找到 ${compsData.length} 场即将举行的比赛。`);
    console.log(`[INFO] 数据已写入: ${relToRoot(OUTPUT_JSON_PATH)}`);

    mkdirSync(dirname(ALL_OUTPUT_JSON_PATH), { recursive: true });
    writeFileSync(ALL_OUTPUT_JSON_PATH, JSON.stringify(allComps), 'utf-8');
    console.log(`[ALL] 共 ${allComps.length} 场 → ${relToRoot(ALL_OUTPUT_JSON_PATH)}`);
  }

  // 8. 写出 CN 全员注册名单（前端搜选手非 top 时的静态兜底）
  console.log('\n[CN-REG] 开始构建中国内地比赛全员注册名单...');
  const cnReg = await buildCnRegistrations();
  if (Object.keys(cnReg).length) {
    mkdirSync(dirname(CN_REGISTRATIONS_JSON_PATH), { recursive: true });
    writeFileSync(CN_REGISTRATIONS_JSON_PATH, JSON.stringify(cnReg), 'utf-8');
    console.log(`[CN-REG] 写入 ${relToRoot(CN_REGISTRATIONS_JSON_PATH)}`);
  }

  console.log(`[INFO] 总耗时: ${((Date.now() - startTime) / 1000).toFixed(2)} 秒`);

  // 拉不到 WCA 列表时:旧数据已保留(上面 guard 不写空),但这里主动非零退出让本次 CI 标红,
  // 这样会收到 GitHub Actions 失败通知 —— 数据默默变旧不可接受,要让人知道。
  // 常见原因:WCA 把服务器出口 IP 从限速升级成 403、代理挂了、或 WCA 临时故障。
  if (wcaListUnavailable) {
    console.error('[FAIL] WCA upcoming 列表本次拉取失败:已保留上一份好数据(未写空),但主动失败本次 CI 以触发通知。请查代理 / WCA 是否封了服务器 IP。');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
