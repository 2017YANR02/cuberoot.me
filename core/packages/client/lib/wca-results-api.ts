/**
 * WCA public competition results / scrambles API — ported from packages/client-vite/src/utils/wca_results_api.ts.
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

export interface WcaScrambleRow {
  event_id: string;
  round_type_id: string;
  group_id: string;
  is_extra: boolean;
  scramble_num: number;
  scramble: string;
  optimal_scramble?: string | null; // God's-number 最短等态打乱(同态项目 333/oh/ft/fm 才有,见 wca_scramble_optimal)
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

// Distinct scramble groups (A / B / C …) for one comp / event / round. Used by
// the recon form to drive the group dropdown — multi-group rounds force a pick,
// single-group rounds auto-fill. Returns null when there's no scramble data.
export async function fetchScrambleGroups(
  compId: string,
  reconEvent: string,
  round: string,
): Promise<string[] | null> {
  const wcaEventId = toWcaEventId(reconEvent);
  const all = await fetchWcaScrambles(compId);
  if (!all) return null;
  const inRound = all.filter(s =>
    s.event_id === wcaEventId &&
    matchRoundType(round, s.round_type_id) &&
    !s.is_extra
  );
  if (inRound.length === 0) return null;
  const groups = Array.from(new Set(inRound.map(s => s.group_id).filter(Boolean)));
  groups.sort((a, b) => a.localeCompare(b));
  return groups;
}

/** 取某 comp/event/round/group 的逐 scramble_num(1..5)字段值。`pick` 选原始打乱还是最优打乱。 */
async function fetchScramblesField(
  compId: string,
  reconEvent: string,
  round: string,
  groupId: string | undefined,
  pick: (s: WcaScrambleRow) => string | null | undefined,
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
      result[s.scramble_num - 1] = pick(s) ?? null;
    }
  }
  return result;
}

export function fetchScrambles(
  compId: string,
  reconEvent: string,
  round: string,
  groupId?: string,
): Promise<(string | null)[] | null> {
  return fetchScramblesField(compId, reconEvent, round, groupId, s => s.scramble);
}

/**
 * 同 fetchScrambles,但取每条真题的「最优等价打乱」(= invert(整解最优解),本地 333opt/puzzles
 * 管道预计算后入 PG `wca_scramble_optimal`,见 /v1/wca/scrambles 的 LEFT JOIN)。只有同态项目
 * (333/oh/ft/fm + 222/pyram/skewb)且该比赛已被求解管道覆盖的真题才有,其余槽位为 null。
 */
export function fetchOptimalScrambles(
  compId: string,
  reconEvent: string,
  round: string,
  groupId?: string,
): Promise<(string | null)[] | null> {
  return fetchScramblesField(compId, reconEvent, round, groupId, s => s.optimal_scramble);
}

export async function fetchCubingAttempts(
  compWcaId: string,
  reconEvent: string,
  round: string,
  personId: string,
): Promise<(number | null)[] | null> {
  const wcaEventId = toWcaEventId(reconEvent);
  // 传 compId(无横杠 WCA ID),cubing.com slug 由服务端按真实比赛名推导 —— 客户端从 ID 反推
  // 会把内部大写词误拆(GuangzhouGraDUAL3x3I2026 → Guangzhou-Gra-DUAL-…)导致 404。见 /recon/cubing-attempts。
  const url = apiUrl(`/v1/recon/cubing-attempts?compId=${encodeURIComponent(compWcaId)}&event=${encodeURIComponent(wcaEventId)}&round=${encodeURIComponent(round)}&personId=${encodeURIComponent(personId)}`);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json() as { attempts: (number | null)[] | null };
    return j.attempts;
  } catch {
    return null;
  }
}

interface CubingLiveUser { wcaid?: string; countryId?: string; continentId?: string }
interface CubingLiveResult { n: number; b?: number; a?: number; pS?: number; pA?: number }
interface CubingRecordsSnapshot { wr?: Record<string, number>; cr?: Record<string, number>; nr?: Record<string, number> }
interface CubingLiveData {
  users?: Record<string, CubingLiveUser>;
  resultsByRound?: Record<string, CubingLiveResult[]>;
  currentRecords?: CubingRecordsSnapshot;
}
const cubingLiveCache = new Map<string, Promise<CubingLiveData | null>>();

function loadCubingLive(compWcaId: string): Promise<CubingLiveData | null> {
  let p = cubingLiveCache.get(compWcaId);
  if (!p) {
    p = fetch(apiUrl(`/v1/cubing-live/${encodeURIComponent(compWcaId)}`))
      .then(r => r.ok ? r.json() as Promise<CubingLiveData> : null)
      .catch(() => null);
    cubingLiveCache.set(compWcaId, p);
  }
  return p;
}

// Locate one person's result row within a comp's live data for an event/round.
// Primary match by round code (ROUND_VARIANTS: recon `f` → cubing `f`/`c`/`h`, etc.);
// falls back to the round's best-single / average value when the code doesn't line up.
async function findCubingLiveHit(
  compWcaId: string, reconEvent: string, round: string, personId: string,
  bestCs: number | null, avgCs: number | null,
): Promise<{ data: CubingLiveData; num: string; hit: CubingLiveResult } | null> {
  const wcaEventId = toWcaEventId(reconEvent);
  const data = await loadCubingLive(compWcaId);
  if (!data) return null;
  const users = data.users ?? {};
  let num: string | null = null;
  for (const [k, u] of Object.entries(users)) {
    if (u?.wcaid === personId) { num = String(k); break; }
  }
  if (num == null) return null;
  const byRound = data.resultsByRound ?? {};
  const variants = ROUND_VARIANTS[round] ?? [round];
  for (const code of variants) {
    const hit = byRound[`${wcaEventId}:${code}`]?.find(r => String(r.n) === num);
    if (hit) return { data, num, hit };
  }
  for (const key of Object.keys(byRound)) {
    if (!key.startsWith(`${wcaEventId}:`)) continue;
    const hit = byRound[key].find(r => String(r.n) === num
      && ((bestCs != null && r.b === bestCs) || (avgCs != null && r.a === avgCs)));
    if (hit) return { data, num, hit };
  }
  return null;
}

/**
 * Personal-record RANK (single + average) from cubing.com live data — the same
 * `pS`/`pA` the /comp page uses (PR / PR2 / PR3 …, which WCA's regional_record
 * field doesn't carry).
 */
export async function fetchCubingPrRanks(
  compWcaId: string, reconEvent: string, round: string, personId: string,
  bestCs: number | null, avgCs: number | null,
): Promise<{ pS: number | null; pA: number | null } | null> {
  const found = await findCubingLiveHit(compWcaId, reconEvent, round, personId, bestCs, avgCs);
  if (!found) return null;
  return {
    pS: typeof found.hit.pS === 'number' ? found.hit.pS : null,
    pA: typeof found.hit.pA === 'number' ? found.hit.pA : null,
  };
}

// Infer a regional record tag (WR/CR/NR) for one live value — mirrors
// CompDetailPage's inferLiveRecordTag, comparing against the comp's currentRecords
// snapshot (keyed `${event}|${isAvg?1:0}` + continent/country suffix).
function inferLiveTag(
  value: number, wcaEventId: string, isAvg: boolean,
  user: CubingLiveUser | undefined, snap: CubingRecordsSnapshot | undefined,
): 'WR' | 'CR' | 'NR' | '' {
  if (!snap || !value || value <= 0) return '';
  const k = `${wcaEventId}|${isAvg ? '1' : '0'}`;
  const wrMin = snap.wr?.[k];
  if (wrMin !== undefined && value <= wrMin) return 'WR';
  if (!user) return '';
  if (user.continentId) {
    const crMin = snap.cr?.[`${k}|${user.continentId}`];
    if (crMin !== undefined && value <= crMin) return 'CR';
  }
  if (user.countryId) {
    const nrMin = snap.nr?.[`${k}|${user.countryId}`];
    if (nrMin !== undefined && value <= nrMin) return 'NR';
  }
  return '';
}

export interface CubingLiveResultInfo {
  pS: number | null; pA: number | null;
  singleTag: 'WR' | 'CR' | 'NR' | '';
  averageTag: 'WR' | 'CR' | 'NR' | '';
}

/**
 * Per-result live info for one person: PR rank (pS/pA) + inferred regional record
 * tag (WR/CR/NR) for single & average — the same data /wca/comp's result table
 * shows. Lets the person page badge unofficial (live) rows identically.
 */
export async function fetchCubingLiveResultInfo(
  compWcaId: string, reconEvent: string, round: string, personId: string,
  bestCs: number | null, avgCs: number | null,
): Promise<CubingLiveResultInfo | null> {
  const found = await findCubingLiveHit(compWcaId, reconEvent, round, personId, bestCs, avgCs);
  if (!found) return null;
  const { data, num, hit } = found;
  const wcaEventId = toWcaEventId(reconEvent);
  const user = data.users?.[num];
  const snap = data.currentRecords;
  const bestVal = typeof hit.b === 'number' ? hit.b : (bestCs ?? 0);
  const avgVal = typeof hit.a === 'number' ? hit.a : (avgCs ?? 0);
  return {
    pS: typeof hit.pS === 'number' ? hit.pS : null,
    pA: typeof hit.pA === 'number' ? hit.pA : null,
    singleTag: inferLiveTag(bestVal, wcaEventId, false, user, snap),
    averageTag: inferLiveTag(avgVal, wcaEventId, true, user, snap),
  };
}
