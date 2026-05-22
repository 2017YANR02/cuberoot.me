/**
 * WCA 公开 results API（无 auth、无 CORS）
 * GET https://www.worldcubeassociation.org/api/v0/competitions/:compId/results/:eventId
 *
 * 响应:
 *   { id: <event_id>, rounds: [{ id, roundTypeId, results: [{ wca_id, attempts: [int...], ... }] }] }
 *   attempts 元素是 centisecond 整数；-1 = DNF, -2 = DNS, 0 = 该把不存在
 *   未导入的比赛 rounds 都有但 results: []
 */

import { toWcaEventId } from './wca_events';
import { apiUrl } from './api_base';

/** Recon round (`1`/`2`/`3`/`f`) → WCA round_type_id 候选(包含 combined/cutoff 变体) */
const ROUND_VARIANTS: Record<string, string[]> = {
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

// NOTE: 优先打 cuberoot server 的缓存代理(write-through 到 wca_results_cache 表),失败再直拉 WCA。
// 让"同轮次还原"在第二位用户/设备秒加载;server 挂了也能 graceful 降级。
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

/** 取某选手某轮 5 把成绩（秒；DNF=-1 / DNS=-2 / 不存在=null）。round 直接用 recon 的字段值（'1'/'2'/'3'/'f'）。 */
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

/**
 * 取某选手某轮整 row(含 record marker / 整轮 best 下标),用于纪录字段自动填。
 * - singleRecord: 整轮"最佳单次"对应的 WCA 大洲缩写(WR/AsR/.../SAR/NR),null = 无纪录
 * - averageRecord: 整轮 average 的纪录类型,语义同上
 * - bestIndex: 0-based,整轮 best 那把 attempt 的下标(全 DNF/DNS 时 -1)
 */
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

/** WCA ID slug → cubing.com URL slug：PascalCase 变 dash-case。 `DeqingSmallSpecial2026` → `Deqing-Small-Special-2026` */
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

// NOTE: 同 fetchWcaResults —— server proxy 优先 + 直拉 fallback
export function fetchWcaScrambles(compId: string): Promise<WcaScrambleRow[] | null> {
  const hit = scrambleCache.get(compId);
  if (hit) return hit;
  const proxyUrl = apiUrl(`/v1/recon/wca-scrambles?compId=${encodeURIComponent(compId)}`);
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

/** 取整轮的 5 把官方打乱（按 solveNum 索引）。group 默认 'A'，找不到时取第一个。失败返回 null。 */
export async function fetchScrambles(
  compId: string,
  reconEvent: string,
  round: string,
  groupId?: string,
): Promise<(string | null)[] | null> {
  const wcaEventId = toWcaEventId(reconEvent);
  const all = await fetchWcaScrambles(compId);
  if (!all) return null;
  // NOTE: 先按 event + round + 非 extra 过滤
  const inRound = all.filter(s =>
    s.event_id === wcaEventId &&
    matchRoundType(round, s.round_type_id) &&
    !s.is_extra
  );
  if (inRound.length === 0) return null;
  // NOTE: groupId 优先匹配；不匹配 / 没传则用出现的第一个 group
  const desiredGroup = groupId || inRound[0].group_id;
  const inGroup = inRound.filter(s => s.group_id === desiredGroup);
  if (inGroup.length === 0) return null;
  // NOTE: 按 scramble_num 索引，最大 5
  const result: (string | null)[] = Array(5).fill(null);
  for (const s of inGroup) {
    if (s.scramble_num >= 1 && s.scramble_num <= 5) {
      result[s.scramble_num - 1] = s.scramble;
    }
  }
  return result;
}

/** 走 cuberoot 服务端代理拉 cubing.com 实时成绩。失败返回 null（含未导入 / 比赛不存在）。 */
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
