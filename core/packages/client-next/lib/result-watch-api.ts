// 关注选手「往期成绩变更」监控 — 只读 /v1/wca/result-watch/* 客户端。
// 数据由 server monitors/wca_past_results.ts 后台 diff WCA 全生涯成绩写入。

import { apiUrl } from './api-base';
import { formatWcaResult } from './wca-format-result';

export interface ResultWatchPerson {
  wcaId: string;
  name: string | null;
  countryIso2: string | null;
  resultCount: number | null;
  checkedAt: string | null;
  changeCount: number;
}

export interface ResultWatchStatus {
  enabled: boolean;
  totalChanges: number;
  lastCheckedAt: string | null;
  persons: ResultWatchPerson[];
}

/** 单条成绩的可变字段指纹(server fingerprint,短键)。 */
export interface ResultFingerprint {
  c: string;          // competition_id
  e: string;          // event_id
  r: string;          // round_type_id
  f: string;          // format_id
  b: number;          // best
  a: number;          // average
  p: number;          // pos
  at: number[];       // attempts
  rs: string | null;  // regional_single_record
  ra: string | null;  // regional_average_record
}

export interface ResultChangeField {
  field: string;
  old: unknown;
  new: unknown;
}

export interface ResultChange {
  id: number;
  wcaId: string;
  personName: string | null;
  personIso2: string | null;
  resultId: number | null;
  competitionId: string | null;
  compName: string | null;
  compStartDate: string | null;
  compIso2: string | null;
  eventId: string | null;
  roundTypeId: string | null;
  changeType: 'removed' | 'modified';
  fields: ResultChangeField[] | null;
  before: ResultFingerprint | null;
  after: ResultFingerprint | null;
  detectedAt: string;
}

export async function fetchResultWatchStatus(signal?: AbortSignal): Promise<ResultWatchStatus> {
  const res = await fetch(apiUrl('/v1/wca/result-watch/status'), { signal });
  if (!res.ok) throw new Error(`result-watch/status ${res.status}`);
  return (await res.json()) as ResultWatchStatus;
}

export async function fetchResultChanges(
  wcaId: string | null,
  limit = 300,
  signal?: AbortSignal,
): Promise<ResultChange[]> {
  const qs = new URLSearchParams();
  if (wcaId) qs.set('wcaId', wcaId);
  qs.set('limit', String(limit));
  const res = await fetch(apiUrl(`/v1/wca/result-watch/changes?${qs.toString()}`), { signal });
  if (!res.ok) throw new Error(`result-watch/changes ${res.status}`);
  const j = (await res.json()) as { changes?: ResultChange[] };
  return j.changes ?? [];
}

/** 单行成绩 → 变更记录的匹配键(comp | event | 归一轮次)。用于把变更内联到全部成绩表。 */
export function rowChangeKey(competitionId: string, eventId: string, roundTypeId: string | null): string {
  return `${competitionId}|${eventId}|${canonicalRound(roundTypeId) ?? roundTypeId ?? ''}`;
}

/** 把变更列表按行键索引,供成绩表逐行查命中。 */
export function buildRowChangeMap(changes: ResultChange[]): Map<string, ResultChange> {
  const m = new Map<string, ResultChange>();
  for (const c of changes) {
    if (!c.competitionId || !c.eventId) continue;
    // 同一行可能有多条历史变更:保留最新一条(端点已按 detected_at 倒序返回 → 首条即最新)。
    const k = rowChangeKey(c.competitionId, c.eventId, c.roundTypeId);
    if (!m.has(k)) m.set(k, c);
  }
  return m;
}

/** 取某变更里指定字段的旧值(用于表格内划掉旧成绩);无该字段返回 null。 */
export function changeOldValue(change: ResultChange, field: 'best' | 'average'): number | null {
  const f = (change.fields ?? []).find((x) => x.field === field);
  return f ? Number(f.old) : null;
}

/** WCA round_type_id 归一到 4 个轮次桶('1'/'2'/'3'/'f'),含 combined / cutoff 变体。 */
export function canonicalRound(id: string | null | undefined): '1' | '2' | '3' | 'f' | null {
  switch (id) {
    case '1': case 'b': case 'd': return '1';
    case '2': case 'e': return '2';
    case '3': case 'g': return '3';
    case 'f': case 'c': case 'h': return 'f';
    default: return null;
  }
}

/** 变更字段值 → 展示字符串。result-watch 页与选手页变更面板共用。 */
export function formatChangeFieldValue(field: string, value: unknown, eventId: string): string {
  if (field === 'best') return formatWcaResult(Number(value), eventId, 'single');
  if (field === 'average') return formatWcaResult(Number(value), eventId, 'average');
  if (field === 'attempts') {
    const arr = Array.isArray(value) ? (value as number[]) : [];
    if (arr.length === 0) return '—';
    return arr.map((v) => formatWcaResult(Number(v), eventId, 'single')).join('  ');
  }
  if (field === 'pos') {
    const n = Number(value);
    return n > 0 ? `#${n}` : '—';
  }
  // 纪录标记:WR / CR / NR / … 或无
  if (field === 'regional_single_record' || field === 'regional_average_record') {
    return value ? String(value) : '—';
  }
  return String(value ?? '—');
}
