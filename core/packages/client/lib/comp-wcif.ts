// Fetch public WCIF for a WCA comp + competition metadata. 24h localStorage cache.
// Ported from packages/client-vite/src/utils/comp_wcif.ts.

import { apiUrl } from './api-base';

const WCIF_URL = (id: string) =>
  `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}/wcif/public`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// v3: cache now stores full CompWcif (rounds + round-1 meta + competitorLimit), not just rounds.
const CACHE_PREFIX = 'wcif-meta-v3-';

import type { RoundMeta } from '@cuberoot/shared';

export type RoundFormat = '1' | '2' | '3' | '5' | 'a' | 'm' | 'h';

const VALID_FORMATS: ReadonlySet<string> = new Set(['1', '2', '3', '5', 'a', 'm', 'h']);

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

export interface CompWcif {
  rounds: Record<string, RoundFormat[]>;  // WCA eventId → 各轮 format
  meta: Record<string, RoundMeta>;         // WCA eventId → round-1 紧凑 meta（与静态 JSON 同形状）
  competitorLimit: number | null;          // 比赛级人数上限（通常非空）
}

const EMPTY_WCIF: CompWcif = { rounds: {}, meta: {}, competitorLimit: null };

interface CacheEntry { t: number; v: CompWcif; }

function cacheGet(id: string): CompWcif | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as CacheEntry;
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}

function cacheSet(id: string, v: CompWcif): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ t: Date.now(), v })); }
  catch { /* quota / private mode */ }
}

const inflight = new Map<string, Promise<CompWcif>>();

const INFO_URL = (id: string) =>
  `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}`;
// v5: + competitor_limit
const INFO_CACHE_PREFIX = 'wca-comp-info-v5-';
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
  /** WCA 权威取消时间戳(ISO);未取消为 ''。 */
  cancelled_at: string;
  /** 比赛人数上限;无上限或未知为 null。 */
  competitor_limit: number | null;
}

export async function fetchCompInfo(compId: string): Promise<CompInfo | null> {
  if (!compId) return null;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(INFO_CACHE_PREFIX + compId);
      if (raw) {
        const { t, v } = JSON.parse(raw) as { t: number; v: CompInfo };
        if (Date.now() - t <= CACHE_TTL_MS) return v;
      }
    } catch { /* ignore */ }
  }
  const existing = infoInflight.get(compId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(INFO_URL(compId));
      if (!res.ok) return null;
      const d = await res.json() as Partial<Record<keyof CompInfo, unknown>>;
      const str = (k: keyof CompInfo) => typeof d[k] === 'string' ? d[k] as string : '';
      const limit = typeof d.competitor_limit === 'number' && d.competitor_limit > 0 ? d.competitor_limit : null;
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
        cancelled_at: str('cancelled_at'),
        competitor_limit: limit,
      };
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(INFO_CACHE_PREFIX + compId, JSON.stringify({ t: Date.now(), v: info })); }
        catch { /* quota / private mode */ }
      }
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

export async function fetchCompName(compId: string): Promise<string | null> {
  const info = await fetchCompInfo(compId);
  return info?.name ?? null;
}

// ── cubing.com Chinese metadata for CN comps ───────────────────────

export interface CubingZhMeta {
  location: string | null;
  withdrawDeadline: string | null;
  reopenAt: string | null;
  nameZh: string | null; // cubing.com 原始中文全名(含 WCA/魔方),localizeCompName 会 stripWcaPrefix
}
const EMPTY_ZH: CubingZhMeta = { location: null, withdrawDeadline: null, reopenAt: null, nameZh: null };
const ZH_CACHE_PREFIX = 'wca-comp-cubing-zh-v3-';
const ZH_EMPTY_TTL_MS = 60 * 60 * 1000;
const ZH_FULL_TTL_MS = 7 * CACHE_TTL_MS;
const zhInflight = new Map<string, Promise<CubingZhMeta>>();

function isEmptyZh(m: CubingZhMeta): boolean {
  return !m.location && !m.withdrawDeadline && !m.reopenAt && !m.nameZh;
}

export async function fetchCubingZh(wcaId: string): Promise<CubingZhMeta> {
  if (!wcaId) return EMPTY_ZH;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(ZH_CACHE_PREFIX + wcaId);
      if (raw) {
        const { t, v } = JSON.parse(raw) as { t: number; v: CubingZhMeta };
        const ttl = isEmptyZh(v) ? ZH_EMPTY_TTL_MS : ZH_FULL_TTL_MS;
        if (Date.now() - t <= ttl) return v;
      }
    } catch { /* ignore */ }
  }
  const existing = zhInflight.get(wcaId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(apiUrl(`/v1/cubing-zh/${encodeURIComponent(wcaId)}`));
      if (!res.ok) return EMPTY_ZH;
      const data = await res.json() as Partial<CubingZhMeta>;
      const meta: CubingZhMeta = {
        location: typeof data.location === 'string' && data.location ? data.location : null,
        withdrawDeadline: typeof data.withdrawDeadline === 'string' && data.withdrawDeadline ? data.withdrawDeadline : null,
        reopenAt: typeof data.reopenAt === 'string' && data.reopenAt ? data.reopenAt : null,
        nameZh: typeof data.nameZh === 'string' && data.nameZh ? data.nameZh : null,
      };
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(ZH_CACHE_PREFIX + wcaId, JSON.stringify({ t: Date.now(), v: meta })); }
        catch { /* ignore */ }
      }
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

interface WcifRoundRaw {
  format?: string;
  timeLimit?: { centiseconds?: number; cumulativeRoundIds?: string[] } | null;
  cutoff?: { numberOfAttempts?: number; attemptResult?: number } | null;
  advancementCondition?: { type?: string; level?: number } | null;
}
interface WcifQualRaw { type?: string; resultType?: string; level?: number }

/** 拉单场 WCIF public：轮次 format + 每个项目 round-1 配置 + qualification + 比赛人数上限。24h localStorage 缓存。 */
export async function fetchCompWcif(compId: string): Promise<CompWcif> {
  if (!compId) return EMPTY_WCIF;
  const cached = cacheGet(compId);
  if (cached) return cached;
  const existing = inflight.get(compId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(WCIF_URL(compId));
      if (!res.ok) return EMPTY_WCIF;
      const data = await res.json() as {
        competitorLimit?: number | null;
        events?: { id: string; qualification?: WcifQualRaw | null; rounds?: WcifRoundRaw[] }[];
      };
      const rounds: Record<string, RoundFormat[]> = {};
      const meta: Record<string, RoundMeta> = {};
      for (const e of data.events ?? []) {
        const rs = e.rounds ?? [];
        rounds[e.id] = rs.map(r => {
          const f = r.format;
          return (f && VALID_FORMATS.has(f)) ? (f as RoundFormat) : '1';
        });
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
        const q = encodeQual(e.qualification);
        if (q) m.q = q;
        if (Object.keys(m).length > 0) meta[e.id] = m;
      }
      const out: CompWcif = { rounds, meta, competitorLimit: data.competitorLimit ?? null };
      cacheSet(compId, out);
      return out;
    } catch {
      return EMPTY_WCIF;
    } finally {
      inflight.delete(compId);
    }
  })();
  inflight.set(compId, p);
  return p;
}

export async function fetchCompRounds(compId: string): Promise<Record<string, RoundFormat[]>> {
  return (await fetchCompWcif(compId)).rounds;
}
