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
  /** WR / NR / AfR / AsR / ER / NAR / OcR / SAR — null if not a regional record. */
  regional_single_record?: string | null;
  regional_average_record?: string | null;
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
    regional_single_record: r.regional_single_record ?? null,
    regional_average_record: r.regional_average_record ?? null,
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

// ── Server endpoints (历史排名快照) ──────────────────────────────────────
// /v1/wca/person-best-ranks 与 /v1/wca/person-rank-history 由本仓库的
// core/packages/server/src/routes/wca_stats_extra.ts 提供,数据源是
// historical_ranks_snapshot 表(每天 GH Actions 灌一次,nginx 1d cache).
import { apiUrl } from '../../../utils/api_base';

export interface PersonBestRankCell {
  rank: number;
  year: number;
  value: number | null;
}

export interface PersonBestRanksResponse {
  wcaId: string;
  events: Record<string, {
    single?: { world?: PersonBestRankCell; country?: PersonBestRankCell };
    average?: { world?: PersonBestRankCell; country?: PersonBestRankCell };
  }>;
}

export async function fetchPersonBestRanks(wcaId: string): Promise<PersonBestRanksResponse> {
  const key = `wca:bestRanks:${wcaId}`;
  const cached = cacheGet<PersonBestRanksResponse>(key);
  if (cached) return cached;
  const res = await fetch(apiUrl(`/v1/wca/person-best-ranks?wcaId=${encodeURIComponent(wcaId)}`));
  if (!res.ok) throw new Error(`person-best-ranks ${res.status}`);
  const json = (await res.json()) as PersonBestRanksResponse;
  cacheSet(key, json);
  return json;
}

export interface PersonRankHistoryRow {
  year: number;
  single: number | null;
  average: number | null;
  singleWorldRank: number | null;
  singleCountryRank: number | null;
  avgWorldRank: number | null;
  avgCountryRank: number | null;
}

export interface PersonRankHistoryResponse {
  wcaId: string;
  eventId: string;
  rows: PersonRankHistoryRow[];
}

export async function fetchPersonRankHistory(wcaId: string, eventId: string): Promise<PersonRankHistoryResponse> {
  const key = `wca:rankHist:${wcaId}:${eventId}`;
  const cached = cacheGet<PersonRankHistoryResponse>(key);
  if (cached) return cached;
  const res = await fetch(apiUrl(`/v1/wca/person-rank-history?wcaId=${encodeURIComponent(wcaId)}&eventId=${encodeURIComponent(eventId)}`));
  if (!res.ok) throw new Error(`person-rank-history ${res.status}`);
  const json = (await res.json()) as PersonRankHistoryResponse;
  cacheSet(key, json);
  return json;
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
