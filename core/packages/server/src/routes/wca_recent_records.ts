/**
 * /v1/wca/recent-records — WCA Live "recent records" 镜像 + Bark 推送文案
 *
 * 数据流:
 *   1. 后台每 60s 拉 WCA Live GraphQL `recentRecords` (默认 10 天内 WR/CR/NR)
 *   2. 对每条新记录 spawn format_cli.py 拿 cn/en 文案 (走 wca_format 同款 Python 模板),
 *      按 record.id 缓存避免重复 spawn
 *   3. 端点直接吐快照 (含 formattedCn/En),不阻塞请求
 *   4. nginx proxy_cache 60s 兜底,上游负载 1 req/min
 */
import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runFormatCli } from './wca_format.js';
import { query } from '../db/connection.js';

export const wcaRecentRecordsRoutes = new Hono();

const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';
const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const SITE_BASE = 'https://www.cuberoot.me';

export interface RecentRecord {
  id: string;
  tag: 'WR' | 'CR' | 'NR' | string;
  type: 'single' | 'average' | string;
  attemptResult: number;
  eventId: string;
  eventName: string;
  personName: string;
  countryIso2: string;
  countryName: string;
  competitionId: string;
  /** 与 /v1/wca/format-record 同模板的 Bark 文案,Python 单一来源 */
  formattedCn: string;
  formattedEn: string;
}

interface Snapshot {
  fetchedAt: number;
  records: RecentRecord[];
}

let snapshot: Snapshot = { fetchedAt: 0, records: [] };
let inflight: Promise<void> | null = null;

// 按 record.id 缓存格式化文案 — WCA Live 同一条记录的 id 稳定
const formattedCache = new Map<string, { cn: string; en: string }>();
// 比赛元数据缓存 — comp.iso2 走 DB 查;nameZh 走静态 stats/comp_names_zh.json (CI 周更)
interface CompMeta { iso2: string; nameZh: string | null }
const compMetaCache = new Map<string, CompMeta>();

// stats/comp_names_zh.json — key = comp name (英文,含前导空格), value = 中文名。
// CI 周更,启动时一次加载到内存。dev 本地不存在就空 map 兜底。
let compNamesZhByEn: Map<string, string> | null = null;
async function loadCompNamesZh(): Promise<Map<string, string>> {
  if (compNamesZhByEn) return compNamesZhByEn;
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/routes/ → ../../../../stats 在生产; src/routes/ → ../../../../stats 同样.
  const candidates = [
    path.resolve(here, '../../../../stats/comp_names_zh.json'),
    path.resolve(here, '../../../../../stats/comp_names_zh.json'),
    '/www/wwwroot/toolkit/stats/comp_names_zh.json',
  ];
  for (const p of candidates) {
    try {
      const text = await readFile(p, 'utf-8');
      const obj = JSON.parse(text) as Record<string, string>;
      const m = new Map<string, string>();
      for (const [k, v] of Object.entries(obj)) m.set(k.trim(), v);
      compNamesZhByEn = m;
      console.log(`[recent-records] loaded ${m.size} comp_names_zh from ${p}`);
      return m;
    } catch { /* try next */ }
  }
  console.warn('[recent-records] comp_names_zh.json not found — zh comp names will fall back to en');
  compNamesZhByEn = new Map();
  return compNamesZhByEn;
}

const QUERY = `
  query RecentRecords {
    recentRecords {
      id
      tag
      type
      attemptResult
      result {
        person {
          name
          country { iso2 name }
        }
        round {
          competitionEvent {
            event { id name }
            competition { id wcaId name }
          }
        }
      }
    }
  }
`;

interface RawRecord {
  id: string;
  tag: string;
  type: string;
  attemptResult: number;
  result: {
    person: { name: string; country: { iso2: string; name: string } };
    round: {
      competitionEvent: {
        event: { id: string; name: string };
        competition: { id: string; wcaId: string; name: string };
      };
    };
  };
}

async function getCompMeta(compId: string, compNameEn: string, personIso2: string): Promise<CompMeta> {
  let meta = compMetaCache.get(compId);
  if (meta) return meta;
  let iso2 = personIso2;
  try {
    const rows = await query<{ iso2: string | null }>(
      `SELECT cc.iso2 AS iso2
       FROM wca_competitions comp
       LEFT JOIN wca_countries cc ON cc.id = comp.country_id
       WHERE comp.id = ?`,
      [compId],
    );
    if (rows[0]?.iso2) iso2 = rows[0].iso2;
  } catch { /* DB 错就 fallback 到 personIso2 */ }
  const zhMap = await loadCompNamesZh();
  const nameZh = zhMap.get(compNameEn.trim()) ?? null;
  meta = { iso2: iso2.toLowerCase(), nameZh };
  compMetaCache.set(compId, meta);
  return meta;
}

async function formatRecord(r: RawRecord): Promise<{ cn: string; en: string }> {
  const cached = formattedCache.get(r.id);
  if (cached) return cached;
  const compId = r.result.round.competitionEvent.competition.wcaId;
  const compNameEn = r.result.round.competitionEvent.competition.name;
  const personIso2 = (r.result.person.country.iso2 || '').toUpperCase();
  const meta = await getCompMeta(compId, compNameEn, personIso2);
  const event = {
    tag: r.tag,
    rec_type: r.type,
    attempt_result: r.attemptResult,
    event_id: r.result.round.competitionEvent.event.id,
    person_name: r.result.person.name,
    person_iso2: personIso2,
    comp_name: meta.nameZh || compNameEn,
    comp_name_en: compNameEn,
    comp_iso2: meta.iso2.toUpperCase(),
    url: `${SITE_BASE}/wca/comp/${compId}`,
    previous_pr: null,
    pr_rank: null,
  };
  let out: { cn: string; en: string };
  try {
    const r2 = await runFormatCli({ events: [event] });
    out = { cn: r2.cn, en: r2.en };
  } catch (e) {
    // format_cli 不可用 (dev 本地无 Python 模板) → 兜底纯文本
    console.warn('[recent-records] format_cli failed for', r.id, ':', (e as Error).message);
    out = { cn: '', en: '' };
  }
  formattedCache.set(r.id, out);
  return out;
}

async function fetchOnce(): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let raw: RawRecord[];
  try {
    const res = await fetch(WCA_LIVE_API, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: QUERY }),
    });
    if (!res.ok) throw new Error(`WCA Live HTTP ${res.status}`);
    const j = await res.json() as { data?: { recentRecords?: RawRecord[] }; errors?: { message: string }[] };
    if (j.errors?.length) throw new Error(`WCA Live: ${j.errors[0].message}`);
    raw = j.data?.recentRecords ?? [];
  } finally {
    clearTimeout(t);
  }

  // 串行 format — 单条 ~100ms,72 条 ~7s 首次冷启;后续 polls 全 cache 命中近 0 成本
  const records: RecentRecord[] = [];
  for (const r of raw) {
    const formatted = await formatRecord(r);
    records.push({
      id: r.id,
      tag: r.tag,
      type: r.type,
      attemptResult: r.attemptResult,
      eventId: r.result.round.competitionEvent.event.id,
      eventName: r.result.round.competitionEvent.event.name,
      personName: r.result.person.name,
      countryIso2: r.result.person.country.iso2,
      countryName: r.result.person.country.name,
      competitionId: r.result.round.competitionEvent.competition.wcaId,
      formattedCn: formatted.cn,
      formattedEn: formatted.en,
    });
  }
  snapshot = { fetchedAt: Date.now(), records };
}

function refresh(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetchOnce()
    .catch(err => {
      console.warn('[recent-records] poll failed:', (err as Error).message);
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export function startRecentRecordsPoller(): void {
  refresh();
  setInterval(refresh, POLL_INTERVAL_MS);
}

wcaRecentRecordsRoutes.get('/wca/recent-records', (c) => {
  if (snapshot.fetchedAt === 0) refresh();
  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=60');
  return c.json({
    fetchedAt: snapshot.fetchedAt,
    records: snapshot.records,
  });
});
