/**
 * WCA public competition results / scrambles API — ported from packages/client/src/utils/wca_results_api.ts.
 * Module-level promise cache; proxy via cuberoot server with direct WCA fallback.
 */

import { toWcaEventId } from './wca-events';
import { apiUrl } from './api-base';

/** Recon round (`1`/`2`/`3`/`f`) → WCA round_type_id variants (incl. combined / cutoff). */
export const ROUND_VARIANTS: Record<string, string[]> = {
  '1': ['1', 'b', 'd'],
  '2': ['2', 'e'],
  '3': ['3', 'g'],
  'f': ['f', 'c', 'h'],
};

export function matchRoundType(reconRound: string, wcaRoundTypeId: string): boolean {
  const variants = ROUND_VARIANTS[reconRound];
  return variants ? variants.includes(wcaRoundTypeId) : wcaRoundTypeId === reconRound;
}

interface WcaResultRow {
  wca_id: string;
  attempts: number[];
  round_type_id: string;
  regional_single_record?: string | null;
  regional_average_record?: string | null;
}

interface WcaRound {
  id: number;
  roundTypeId: string;
  results: WcaResultRow[];
}

interface WcaResultsResponse {
  id: string;
  rounds: WcaRound[];
}

const cache = new Map<string, Promise<WcaResultsResponse | null>>();

export function fetchWcaResults(compId: string, wcaEventId: string): Promise<WcaResultsResponse | null> {
  const key = `${compId}|${wcaEventId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const proxyUrl = apiUrl(`/v1/recon/wca-results?compId=${encodeURIComponent(compId)}&wcaEvent=${encodeURIComponent(wcaEventId)}`);
  const directUrl = `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/results/${encodeURIComponent(wcaEventId)}`;
  const parse = (j: unknown): WcaResultsResponse | null =>
    (j && typeof j === 'object' && Array.isArray((j as WcaResultsResponse).rounds)) ? j as WcaResultsResponse : null;
  const p = fetch(proxyUrl)
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`proxy ${r.status}`)))
    .then(parse)
    .catch(() =>
      fetch(directUrl).then(r => r.ok ? r.json() : null).then(parse).catch(() => null),
    );
  cache.set(key, p);
  return p;
}

export async function fetchAttempts(
  compId: string,
  reconEvent: string,
  round: string,
  personId: string,
): Promise<(number | null)[] | null> {
  const wcaEventId = toWcaEventId(reconEvent);
  const data = await fetchWcaResults(compId, wcaEventId);
  if (!data) return null;
  const targetRound = data.rounds.find(r => matchRoundType(round, r.roundTypeId));
  if (!targetRound || targetRound.results.length === 0) return null;
  const row = targetRound.results.find(r => r.wca_id === personId);
  if (!row) return null;
  return row.attempts.map(v => {
    if (v === 0) return null;
    if (v < 0) return v;
    return v / 100;
  });
}

export async function fetchResultRow(
  compId: string,
  reconEvent: string,
  round: string,
  personId: string,
): Promise<{
  attempts: (number | null)[];
  singleRecord: string | null;
  averageRecord: string | null;
  bestIndex: number;
} | null> {
  const wcaEventId = toWcaEventId(reconEvent);
  const data = await fetchWcaResults(compId, wcaEventId);
  if (!data) return null;
  const targetRound = data.rounds.find(r => matchRoundType(round, r.roundTypeId));
  if (!targetRound || targetRound.results.length === 0) return null;
  const row = targetRound.results.find(r => r.wca_id === personId);
  if (!row) return null;
  const attempts = row.attempts.map(v => {
    if (v === 0) return null;
    if (v < 0) return v;
    return v / 100;
  });
  let bestIndex = -1;
  let bestVal = Infinity;
  for (let i = 0; i < row.attempts.length; i++) {
    const v = row.attempts[i];
    if (v > 0 && v < bestVal) { bestVal = v; bestIndex = i; }
  }
  return {
    attempts,
    singleRecord: row.regional_single_record || null,
    averageRecord: row.regional_average_record || null,
    bestIndex,
  };
}

export function wcaIdToCubingSlug(wcaId: string): string {
  return wcaId
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2');
}

export interface WcaScrambleRow {
  event_id: string;
  round_type_id: string;
  group_id: string;
  is_extra: boolean;
  scramble_num: number;
  scramble: string;
}

const scrambleCache = new Map<string, Promise<WcaScrambleRow[] | null>>();

export function fetchWcaScrambles(compId: string): Promise<WcaScrambleRow[] | null> {
  const hit = scrambleCache.get(compId);
  if (hit) return hit;
  const proxyUrl = apiUrl(`/v1/wca/scrambles?compId=${encodeURIComponent(compId)}`);
  const directUrl = `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/scrambles`;
  const parse = (j: unknown): WcaScrambleRow[] | null => Array.isArray(j) ? j as WcaScrambleRow[] : null;
  const p = fetch(proxyUrl)
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`proxy ${r.status}`)))
    .then(parse)
    .catch(() =>
      fetch(directUrl).then(r => r.ok ? r.json() : null).then(parse).catch(() => null),
    );
  scrambleCache.set(compId, p);
  return p;
}

export async function fetchScrambles(
  compId: string,
  reconEvent: string,
  round: string,
  groupId?: string,
): Promise<(string | null)[] | null> {
  const wcaEventId = toWcaEventId(reconEvent);
  const all = await fetchWcaScrambles(compId);
  if (!all) return null;
  const inRound = all.filter(s =>
    s.event_id === wcaEventId &&
    matchRoundType(round, s.round_type_id) &&
    !s.is_extra
  );
  if (inRound.length === 0) return null;
  const desiredGroup = groupId || inRound[0].group_id;
  const inGroup = inRound.filter(s => s.group_id === desiredGroup);
  if (inGroup.length === 0) return null;
  const result: (string | null)[] = Array(5).fill(null);
  for (const s of inGroup) {
    if (s.scramble_num >= 1 && s.scramble_num <= 5) {
      result[s.scramble_num - 1] = s.scramble;
    }
  }
  return result;
}

export async function fetchCubingAttempts(
  compWcaId: string,
  reconEvent: string,
  round: string,
  personId: string,
): Promise<(number | null)[] | null> {
  const slug = wcaIdToCubingSlug(compWcaId);
  const wcaEventId = toWcaEventId(reconEvent);
  const url = apiUrl(`/v1/recon/cubing-attempts?slug=${encodeURIComponent(slug)}&event=${encodeURIComponent(wcaEventId)}&round=${encodeURIComponent(round)}&personId=${encodeURIComponent(personId)}`);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json() as { attempts: (number | null)[] | null };
    return j.attempts;
  } catch {
    return null;
  }
}

interface CubingLiveResult { n: number; b?: number; a?: number; pS?: number; pA?: number }
interface CubingLiveData {
  users?: Record<string, { wcaid?: string }>;
  resultsByRound?: Record<string, CubingLiveResult[]>;
}
const cubingLiveCache = new Map<string, Promise<CubingLiveData | null>>();

/**
 * Personal-record RANK (single + average) from cubing.com live data — the same
 * `pS`/`pA` the /comp page uses. WCA's regional_record field only carries
 * WR/CR/NR; the PR rank (PR / PR2 / PR3 …) lives only here. Round code is
 * matched via ROUND_VARIANTS (recon `f` → cubing `f`/`c`/`h`, etc.); best-single
 * / average value is a fallback link when the round code doesn't line up.
 */
export async function fetchCubingPrRanks(
  compWcaId: string,
  reconEvent: string,
  round: string,
  personId: string,
  bestCs: number | null,
  avgCs: number | null,
): Promise<{ pS: number | null; pA: number | null } | null> {
  const wcaEventId = toWcaEventId(reconEvent);
  let p = cubingLiveCache.get(compWcaId);
  if (!p) {
    p = fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(compWcaId)}`))
      .then(r => r.ok ? r.json() as Promise<CubingLiveData> : null)
      .catch(() => null);
    cubingLiveCache.set(compWcaId, p);
  }
  const data = await p;
  if (!data) return null;
  const users = data.users ?? {};
  let num: string | null = null;
  for (const [k, u] of Object.entries(users)) {
    if (u?.wcaid === personId) { num = String(k); break; }
  }
  if (num == null) return null;
  const byRound = data.resultsByRound ?? {};
  const pick = (r: CubingLiveResult) => ({
    pS: typeof r.pS === 'number' ? r.pS : null,
    pA: typeof r.pA === 'number' ? r.pA : null,
  });
  const variants = ROUND_VARIANTS[round] ?? [round];
  for (const code of variants) {
    const hit = byRound[`${wcaEventId}:${code}`]?.find(r => String(r.n) === num);
    if (hit) return pick(hit);
  }
  // Round code mismatch — link by the round's best-single / average value.
  for (const key of Object.keys(byRound)) {
    if (!key.startsWith(`${wcaEventId}:`)) continue;
    const hit = byRound[key].find(r => String(r.n) === num
      && ((bestCs != null && r.b === bestCs) || (avgCs != null && r.a === avgCs)));
    if (hit) return pick(hit);
  }
  return null;
}
