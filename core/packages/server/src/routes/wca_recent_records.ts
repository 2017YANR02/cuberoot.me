/**
 * /v1/wca/recent-records — WCA Live "recent records" 镜像 + Bark 推送文案
 *
 * 数据流:
 *   1. 后台每 60s 拉 WCA Live GraphQL `recentRecords` (默认 10 天内 WR/CR/NR)
 *   2. 对每条新记录本地渲染 cn/en 文案 (wca_format.formatRecords,无 spawn/无联网),
 *      按 record.id 缓存避免重复计算
 *   3. 端点直接吐快照 (含 formattedCn/En),不阻塞请求
 *   4. nginx proxy_cache 60s 兜底,上游负载 1 req/min
 */
import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { formatRecords } from './wca_format.js';
import type { RecordEvent } from '../utils/record_format.js';
import { extractInferredRecords, type InferredRecord } from './cubing_live.js';
import { query } from '../db/connection.js';
import { WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';

// WCA Live 展示顺序(scoretaking.ex list_recent_records):
//   ① tag 优先级 WR > CR(含洲际) > NR  ② WCA 官方项目顺序  ③ 成绩值升序
const TAG_RANK: Record<string, number> = { WR: 0, CR: 1, NR: 2 };
function recordTagRank(tag: string): number {
  const r = TAG_RANK[tag];
  if (r !== undefined) return r;
  // 洲际记录(AsR/ER/NAR/SAR/AfR/OcR)与 CR 同级
  return tag.endsWith('R') ? 1 : 3;
}
function recordEventRank(eventId: string): number {
  const i = (WCA_EVENT_ORDER as readonly string[]).indexOf(eventId);
  return i < 0 ? 999 : i;
}

export const wcaRecentRecordsRoutes = new Hono();

const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';
const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const SITE_BASE = 'https://www.cuberoot.me';
const INFERRED_CAP = 40;  // 首页一次最多并入多少条中国比赛推断纪录

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
  /** 与 /v1/wca/format-record 同模板的纪录快讯文案(本地渲染) */
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

/** 本地渲染 cn/en(无 spawn / 无联网,见 wca_format.formatRecords),带 id 缓存 + 仅缓存非空结果。
 *  无熔断:本地查 PG + 内存二分,不会卡;偶发异常返空,client 已能降级渲染,下轮重试。 */
async function renderCached(id: string, event: RecordEvent): Promise<{ cn: string; en: string }> {
  const cached = formattedCache.get(id);
  if (cached) return cached;
  try {
    const r2 = await formatRecords([event]);
    const out = { cn: r2.cn, en: r2.en };
    if (out.cn || out.en) formattedCache.set(id, out);  // 仅缓存有效文案,失败下轮重试
    return out;
  } catch (e) {
    console.warn('[recent-records] format failed for', id, ':', (e as Error).message);
    return { cn: '', en: '' };
  }
}

async function formatRecord(r: RawRecord): Promise<{ cn: string; en: string }> {
  const compId = r.result.round.competitionEvent.competition.wcaId;
  const compNameEn = r.result.round.competitionEvent.competition.name;
  const personIso2 = (r.result.person.country.iso2 || '').toUpperCase();
  const meta = await getCompMeta(compId, compNameEn, personIso2);
  return renderCached(r.id, {
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
  });
}

/** 中国比赛(cubing.com)推断纪录的格式化 — 走与 WCA Live 同款 format_cli 模板 + getCompMeta.
 *  缓存键 = rec.id(含成绩值/tag),成绩更新自动重算. */
async function formatInferred(rec: InferredRecord): Promise<{ cn: string; en: string }> {
  const personIso2 = rec.personIso2.toUpperCase();
  const meta = await getCompMeta(rec.compId, rec.compNameEn, personIso2);
  return renderCached(rec.id, {
    tag: rec.tag,
    rec_type: rec.type,
    attempt_result: rec.attemptResult,
    event_id: rec.eventId,
    person_name: rec.personName,
    person_iso2: personIso2,
    comp_name: meta.nameZh || rec.compNameEn,
    comp_name_en: rec.compNameEn,
    comp_iso2: meta.iso2.toUpperCase(),
    url: `${SITE_BASE}/wca/comp/${rec.compId}`,
    previous_pr: null,
    pr_rank: null,
  });
}

/** 取 cubing.com 中国比赛缓存里的推断纪录,排序 + 截断 + 格式化成 RecentRecord. */
async function buildInferredRecords(): Promise<RecentRecord[]> {
  const raw = await extractInferredRecords();
  const tagRank = (t: string) => (t === 'WR' ? 0 : t === 'CR' ? 1 : 2);
  raw.sort((a, b) =>
    tagRank(a.tag) - tagRank(b.tag) ||
    (b.startDate ?? '').localeCompare(a.startDate ?? '') ||
    a.attemptResult - b.attemptResult,
  );
  const out: RecentRecord[] = [];
  for (const rec of raw.slice(0, INFERRED_CAP)) {
    const f = await formatInferred(rec);
    out.push({
      id: rec.id,
      tag: rec.tag,
      type: rec.type,
      attemptResult: rec.attemptResult,
      eventId: rec.eventId,
      eventName: rec.eventId,
      personName: rec.personName,
      countryIso2: rec.personIso2,
      countryName: '',
      competitionId: rec.compId,
      formattedCn: f.cn,
      formattedEn: f.en,
    });
  }
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

  // 并入 cubing.com 中国比赛的推断纪录(WCA 公示前不在 WCA Live feed 里).放前面 —— 是进行中的最新赛事.
  // 失败不影响 WCA Live 主列表.dedup: 同一纪录极少同时出现在两源(cubing CN 比赛不在 WCA Live).
  let inferred: RecentRecord[] = [];
  try {
    inferred = await buildInferredRecords();
  } catch (e) {
    console.warn('[recent-records] inferred build failed:', (e as Error).message);
  }
  const seen = new Set<string>();
  const merged: RecentRecord[] = [];
  for (const r of [...inferred, ...records]) {
    // competitionId 小写归一:WCA Live feed 与本地 dump 偶尔大小写不同(StartOfSummer… vs
    // Startof…),同一条纪录两源都出时需当成重复去掉。
    // 含 personName:同场同项同成绩可有多人并列破纪录(如 FM 9 人并列 17 步 AsR),
    // 不带选手会把他们误并成一条,首页只剩 1 个。
    const k = `${r.competitionId.toLowerCase()}|${r.eventId}|${r.type}|${r.attemptResult}|${r.personName.trim().toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(r);
  }
  // 跟 WCA Live 一致:tag(WR>CR>NR)→ 项目官方序 → 成绩升序.
  merged.sort((a, b) =>
    recordTagRank(a.tag) - recordTagRank(b.tag) ||
    recordEventRank(a.eventId) - recordEventRank(b.eventId) ||
    a.attemptResult - b.attemptResult,
  );
  snapshot = { fetchedAt: Date.now(), records: merged };
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
