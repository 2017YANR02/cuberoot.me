// Thin client over /v1/nemesizer/* — replaces the in-browser dataset loader
// + algorithm. All heavy work happens server-side; the client only renders
// the responses.
import { apiUrl } from '../../../utils/api_base';

export type RelationView =
  | 'myNem'
  | 'iNem'
  | 'nearlyMe'
  | 'iNearly'
  | 'onlyJustMe'
  | 'iOnlyJust';

export type Scope = 'world' | 'continent' | 'country';

export interface NemPersonRow {
  wcaId: string;
  name: string;
  iso2: string;
  sharedEkCount: number;
  nemesisCount: number;
  nemesizedCount: number;
}

export interface RefPerson {
  wcaId: string;
  name: string;
  iso2: string;
  continent: string;
}
export interface NemesesResponse {
  ref: RefPerson;
  view: RelationView;
  scope: Scope;
  totalCount: number;
  truncated: boolean;
  persons: NemPersonRow[];
  countryTally: Record<string, number>;
}

export interface PersonRankEntry { event: string; kind: number; rank: number; best: number; }
export interface PersonDetailResponse {
  wcaId: string;
  name: string;
  iso2: string;
  continent: string;
  nemesisCount: number;
  nemesizedCount: number;
  ranks: PersonRankEntry[];
}

export interface H2HRow { event: string; kind: number; r1?: number; b1?: number; r2?: number; b2?: number; }
export interface H2HResponse {
  p1: { wcaId: string; name: string; iso2: string };
  p2: { wcaId: string; name: string; iso2: string };
  rows: H2HRow[];
}

export interface WhatIfResponse {
  ref: {
    wcaId: string;
    name: string;
    iso2: string;
    ranks: PersonRankEntry[];
  };
  view: RelationView;
  origCount: number;
  newCount: number;
  truncated: boolean;
  persons: { wcaId: string; name: string; iso2: string; sharedEkCount: number }[];
}

export interface StatsPerson {
  wcaId: string;
  name: string;
  iso2: string;
  nemesisCount?: number;
  nemesizedCount?: number;
}
export interface StatsCountryRow { iso2: string; peopleCount: number; sumNemesis: number; sumNemesized: number; }
export interface StatsResponse {
  tab: string;
  persons?: StatsPerson[];
  rows?: StatsCountryRow[];
  truncated?: boolean;
  totalCount?: number;
}

export interface MetaResponse {
  ready: boolean;
  exportDate?: string;
  generatedAt?: string;
  personCount?: number;
  rankCount?: number;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const resp = await fetch(apiUrl(path), { signal });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${path}: ${body || resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

export function fetchMeta(): Promise<MetaResponse> {
  return getJson('/v1/nemesizer/meta');
}

export function fetchPerson(wcaId: string, signal?: AbortSignal): Promise<PersonDetailResponse> {
  return getJson(`/v1/nemesizer/person?wcaId=${encodeURIComponent(wcaId)}`, signal);
}

export function fetchNemeses(wcaId: string, view: RelationView, scope: Scope, signal?: AbortSignal): Promise<NemesesResponse> {
  const qs = new URLSearchParams({ wcaId, view, scope }).toString();
  return getJson(`/v1/nemesizer/nemeses?${qs}`, signal);
}

export function fetchH2H(p1: string, p2: string, signal?: AbortSignal): Promise<H2HResponse> {
  const qs = new URLSearchParams({ p1, p2 }).toString();
  return getJson(`/v1/nemesizer/h2h?${qs}`, signal);
}

export function fetchWhatIf(wcaId: string, view: RelationView, overrides: Map<number, number>, signal?: AbortSignal): Promise<WhatIfResponse> {
  const parts: string[] = [];
  for (const [ek, rank] of overrides) parts.push(`${ek}:${rank}`);
  const qs = new URLSearchParams({ wcaId, view, overrides: parts.join(',') }).toString();
  return getJson(`/v1/nemesizer/whatif?${qs}`, signal);
}

export function fetchStats(tab: 'most' | 'few' | 'biggest' | 'people' | 'countries', signal?: AbortSignal): Promise<StatsResponse> {
  return getJson(`/v1/nemesizer/stats?tab=${tab}`, signal);
}
