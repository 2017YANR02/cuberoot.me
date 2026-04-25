// Thin client for the WCA public API (https://documenter.getpostman.com/view/4584491/SVfWN6KS).
// CORS-enabled; cached in localStorage 24h to keep repeat visits instant.

const BASE = 'https://www.worldcubeassociation.org/api/v0';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> { t: number; v: T; }

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}

function cacheSet<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })); }
  catch { /* quota / private mode */ }
}

export interface WcaPersonRecord {
  best: number;                  // centiseconds (or moves * 100 for fmc avg, or move count for fmc single, or MBLD code)
  world_rank: number | null;
  continent_rank: number | null;
  country_rank: number | null;
  event_id: string;
}

export interface WcaPersonProfile {
  person: {
    id: string;
    wca_id: string;
    name: string;
    country_iso2: string;
    gender: string | null;
    url: string;
    avatar?: { url?: string; thumb_url?: string };
  };
  competition_count: number;
  personal_records: Record<string, { single?: WcaPersonRecord; average?: WcaPersonRecord }>;
  medals: { gold: number; silver: number; bronze: number; total: number };
  records: { world: number; continental: number; national: number; total: number };
}

export async function fetchWcaPerson(wcaId: string): Promise<WcaPersonProfile> {
  const key = `wca:person:${wcaId}`;
  const cached = cacheGet<WcaPersonProfile>(key);
  if (cached) return cached;
  const res = await fetch(`${BASE}/persons/${encodeURIComponent(wcaId)}`);
  if (!res.ok) throw new Error(`WCA API ${res.status}`);
  const json = (await res.json()) as WcaPersonProfile;
  cacheSet(key, json);
  return json;
}

export interface WcaResultRow {
  id: number;
  competition_id: string;
  event_id: string;
  round_type_id: string;
  format_id: string;
  best: number;
  average: number;
  pos: number;
  attempts: number[];
  date?: string;            // not in raw API; we backfill from comp lookup if needed
}

export async function fetchWcaPersonResults(wcaId: string): Promise<WcaResultRow[]> {
  const key = `wca:results:${wcaId}`;
  const cached = cacheGet<WcaResultRow[]>(key);
  if (cached) return cached;
  const res = await fetch(`${BASE}/persons/${encodeURIComponent(wcaId)}/results`);
  if (!res.ok) throw new Error(`WCA API ${res.status}`);
  const arr = (await res.json()) as any[];
  const out: WcaResultRow[] = arr.map((r) => ({
    id: r.id,
    competition_id: r.competition_id,
    event_id: r.event_id,
    round_type_id: r.round_type_id,
    format_id: r.format_id,
    best: r.best,
    average: r.average,
    pos: r.pos,
    attempts: Array.isArray(r.attempts) ? r.attempts : [],
  }));
  cacheSet(key, out);
  return out;
}

export interface WcaCompetition {
  id: string;
  name: string;
  city: string;
  country_iso2: string;
  start_date: string;
  end_date: string;
}

export async function fetchWcaPersonCompetitions(wcaId: string): Promise<WcaCompetition[]> {
  const key = `wca:comps:${wcaId}`;
  const cached = cacheGet<WcaCompetition[]>(key);
  if (cached) return cached;
  const res = await fetch(`${BASE}/persons/${encodeURIComponent(wcaId)}/competitions`);
  if (!res.ok) throw new Error(`WCA API ${res.status}`);
  const arr = (await res.json()) as any[];
  const out: WcaCompetition[] = arr.map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city,
    country_iso2: c.country_iso2,
    start_date: c.start_date,
    end_date: c.end_date,
  }));
  cacheSet(key, out);
  return out;
}
