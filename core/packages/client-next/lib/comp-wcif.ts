// Fetch public WCIF for a WCA comp + competition metadata. 24h localStorage cache.
// Ported from packages/client/src/utils/comp_wcif.ts.

import { apiUrl } from './api-base';

const WCIF_URL = (id: string) =>
  `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(id)}/wcif/public`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'wcif-rounds-v2-';

export type RoundFormat = '1' | '2' | '3' | '5' | 'a' | 'm' | 'h';

const VALID_FORMATS: ReadonlySet<string> = new Set(['1', '2', '3', '5', 'a', 'm', 'h']);

interface CacheEntry { t: number; v: Record<string, RoundFormat[]>; }

function cacheGet(id: string): Record<string, RoundFormat[]> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as CacheEntry;
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}

function cacheSet(id: string, v: Record<string, RoundFormat[]>): void {
  if (typeof window === 'undefined') return;
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
}
const EMPTY_ZH: CubingZhMeta = { location: null, withdrawDeadline: null, reopenAt: null };
const ZH_CACHE_PREFIX = 'wca-comp-cubing-zh-v2-';
const ZH_EMPTY_TTL_MS = 60 * 60 * 1000;
const ZH_FULL_TTL_MS = 7 * CACHE_TTL_MS;
const zhInflight = new Map<string, Promise<CubingZhMeta>>();

function isEmptyZh(m: CubingZhMeta): boolean {
  return !m.location && !m.withdrawDeadline && !m.reopenAt;
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
