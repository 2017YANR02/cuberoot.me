// 拉取 WCA 比赛公开 WCIF 抽出每个项目每轮的 format。
// 仅用于 CompModal / Recon 录入等"点开比赛"场景；CORS 公开，localStorage 缓存 24h。

const WCIF_URL = (id: string) =>
  `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}/wcif/public`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// NOTE: v2 — 返回结构从 Record<eid, count> 升级到 Record<eid, RoundFormat[]>，bump 让旧缓存自然失效
const CACHE_PREFIX = 'wcif-rounds-v2-';

/** WCIF round.format 取值 — 见 https://github.com/thewca/worldcubeassociation.org/blob/main/lib/static_data/formats.json */
export type RoundFormat = '1' | '2' | '3' | '5' | 'a' | 'm' | 'h';

const VALID_FORMATS: ReadonlySet<string> = new Set(['1', '2', '3', '5', 'a', 'm', 'h']);

interface CacheEntry { t: number; v: Record<string, RoundFormat[]>; }

function cacheGet(id: string): Record<string, RoundFormat[]> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as CacheEntry;
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}

function cacheSet(id: string, v: Record<string, RoundFormat[]>): void {
  try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ t: Date.now(), v })); }
  catch { /* quota / private mode */ }
}

const inflight = new Map<string, Promise<Record<string, RoundFormat[]>>>();

const INFO_URL = (id: string) =>
  `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}`;
const INFO_CACHE_PREFIX = 'wca-comp-info-v3-';
const infoInflight = new Map<string, Promise<CompInfo | null>>();

export interface CompInfo {
  name: string;
  city: string;
  country_iso2: string;
  start_date: string;
  end_date: string;
  venue_address: string;
  venue_details: string;
  website: string;
  registration_open: string;
  registration_close: string;
  event_change_deadline_date: string;
  waiting_list_deadline_date: string;
}

/** 拿比赛元数据(名/城市/日期/地址/详情/官网)。失败返回 null。24h localStorage 缓存。 */
export async function fetchCompInfo(compId: string): Promise<CompInfo | null> {
  if (!compId) return null;
  try {
    const raw = localStorage.getItem(INFO_CACHE_PREFIX + compId);
    if (raw) {
      const { t, v } = JSON.parse(raw) as { t: number; v: CompInfo };
      if (Date.now() - t <= CACHE_TTL_MS) return v;
    }
  } catch { /* ignore */ }
  const existing = infoInflight.get(compId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(INFO_URL(compId));
      if (!res.ok) return null;
      const d = await res.json() as Partial<Record<keyof CompInfo, unknown>>;
      const str = (k: keyof CompInfo) => typeof d[k] === 'string' ? d[k] as string : '';
      if (!str('name')) return null;
      const info: CompInfo = {
        name: str('name'),
        city: str('city'),
        country_iso2: str('country_iso2'),
        start_date: str('start_date'),
        end_date: str('end_date'),
        venue_address: str('venue_address'),
        venue_details: str('venue_details'),
        website: str('website'),
        registration_open: str('registration_open'),
        registration_close: str('registration_close'),
        event_change_deadline_date: str('event_change_deadline_date'),
        waiting_list_deadline_date: str('waiting_list_deadline_date'),
      };
      try { localStorage.setItem(INFO_CACHE_PREFIX + compId, JSON.stringify({ t: Date.now(), v: info })); }
      catch { /* quota / private mode */ }
      return info;
    } catch {
      return null;
    } finally {
      infoInflight.delete(compId);
    }
  })();
  infoInflight.set(compId, p);
  return p;
}

/** 兼容旧调用:拿比赛名。失败返回 null。 */
export async function fetchCompName(compId: string): Promise<string | null> {
  const info = await fetchCompInfo(compId);
  return info?.name ?? null;
}

// ─── 中国大陆比赛 cubing.com 中文元数据 ─────────────────────────────────
// server 抓 cubing.com:venue 合并的中文地点 + 退赛/重开报名时间.非国内 comp 全 null.
export interface CubingZhMeta {
  location: string | null;
  withdrawDeadline: string | null;
  reopenAt: string | null;
}
const EMPTY_ZH: CubingZhMeta = { location: null, withdrawDeadline: null, reopenAt: null };
const ZH_CACHE_PREFIX = 'wca-comp-cubing-zh-v1-';
const zhInflight = new Map<string, Promise<CubingZhMeta>>();

export async function fetchCubingZh(wcaId: string): Promise<CubingZhMeta> {
  if (!wcaId) return EMPTY_ZH;
  try {
    const raw = localStorage.getItem(ZH_CACHE_PREFIX + wcaId);
    if (raw) {
      const { t, v } = JSON.parse(raw) as { t: number; v: CubingZhMeta };
      if (Date.now() - t <= 7 * CACHE_TTL_MS) return v;
    }
  } catch { /* ignore */ }
  const existing = zhInflight.get(wcaId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const { apiUrl } = await import('./api_base');
      const res = await fetch(apiUrl(`/v1/cubing-zh/${encodeURIComponent(wcaId)}`));
      if (!res.ok) return EMPTY_ZH;
      const data = await res.json() as Partial<CubingZhMeta>;
      const meta: CubingZhMeta = {
        location: typeof data.location === 'string' && data.location ? data.location : null,
        withdrawDeadline: typeof data.withdrawDeadline === 'string' && data.withdrawDeadline ? data.withdrawDeadline : null,
        reopenAt: typeof data.reopenAt === 'string' && data.reopenAt ? data.reopenAt : null,
      };
      try { localStorage.setItem(ZH_CACHE_PREFIX + wcaId, JSON.stringify({ t: Date.now(), v: meta })); }
      catch { /* ignore */ }
      return meta;
    } catch {
      return EMPTY_ZH;
    } finally {
      zhInflight.delete(wcaId);
    }
  })();
  zhInflight.set(wcaId, p);
  return p;
}

/** eventId（WCA 标准短码 333/222/...）→ 每轮的 format 数组（数组长度 = rounds 数）。失败返回 {}。 */
export async function fetchCompRounds(compId: string): Promise<Record<string, RoundFormat[]>> {
  if (!compId) return {};
  const cached = cacheGet(compId);
  if (cached) return cached;
  const existing = inflight.get(compId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(WCIF_URL(compId));
      if (!res.ok) return {};
      const data = await res.json() as { events?: { id: string; rounds?: { format?: string }[] }[] };
      const out: Record<string, RoundFormat[]> = {};
      for (const e of data.events ?? []) {
        out[e.id] = (e.rounds ?? []).map(r => {
          const f = r.format;
          return (f && VALID_FORMATS.has(f)) ? (f as RoundFormat) : '1';
        });
      }
      cacheSet(compId, out);
      return out;
    } catch {
      return {};
    } finally {
      inflight.delete(compId);
    }
  })();
  inflight.set(compId, p);
  return p;
}
