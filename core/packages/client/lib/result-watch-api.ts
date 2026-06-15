// 选手「成绩变更」客户端 — 读 + 管理员写 /v1/wca/result-watch/*。
// 自动数据由 server monitors/wca_past_results.ts diff 写入(source='auto');
// 管理员可手动录入/编辑变更链(source='manual')。

import { apiUrl } from './api-base';
import { authHeaders } from './admin-api';
import { formatWcaResult } from './wca-format-result';
import { computeWcaBestAverage, canRecompute } from './wca-compute';

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
  note: string | null;
  effectiveAt: string | null;
  source: 'auto' | 'manual';
  createdBy: string | null;
  editedAt: string | null;
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
  noStore = false,
): Promise<ResultChange[]> {
  const qs = new URLSearchParams();
  if (wcaId) qs.set('wcaId', wcaId);
  qs.set('limit', String(limit));
  if (noStore) qs.set('_t', String(Date.now()));
  const res = await fetch(apiUrl(`/v1/wca/result-watch/changes?${qs.toString()}`), {
    signal,
    ...(noStore ? { cache: 'no-store' as RequestCache } : {}),
  });
  if (!res.ok) throw new Error(`result-watch/changes ${res.status}`);
  const j = (await res.json()) as { changes?: ResultChange[] };
  return j.changes ?? [];
}

/** 按比赛拉全场变更(comp 直播页用,一次取一个比赛所有选手)。 */
export async function fetchResultChangesByComp(
  compId: string,
  limit = 500,
  signal?: AbortSignal,
  noStore = false,
): Promise<ResultChange[]> {
  const qs = new URLSearchParams({ compId, limit: String(limit) });
  if (noStore) qs.set('_t', String(Date.now()));
  const res = await fetch(apiUrl(`/v1/wca/result-watch/changes?${qs.toString()}`), {
    signal,
    ...(noStore ? { cache: 'no-store' as RequestCache } : {}),
  });
  if (!res.ok) throw new Error(`result-watch/changes ${res.status}`);
  const j = (await res.json()) as { changes?: ResultChange[] };
  return j.changes ?? [];
}

// ── 管理员写(手动录入/编辑变更链) ─────────────────────────────────────────────

export interface ResultChangeInput {
  wcaId: string;
  resultId?: number | null;
  competitionId: string;
  eventId: string;
  roundTypeId: string;
  changeType?: 'modified' | 'removed';
  fields?: ResultChangeField[];
  note?: string | null;
  effectiveAt?: string | null;
}

async function writeChange(method: 'POST' | 'PUT', path: string, input: ResultChangeInput): Promise<unknown> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `${method} ${path} ${res.status}`);
  }
  return res.json();
}

export async function createResultChange(input: ResultChangeInput): Promise<number> {
  const j = (await writeChange('POST', '/v1/wca/result-watch/changes', input)) as { id?: number };
  return Number(j.id ?? 0);
}

export async function updateResultChange(id: number, input: ResultChangeInput): Promise<void> {
  await writeChange('PUT', `/v1/wca/result-watch/changes/${id}`, input);
}

export async function deleteResultChange(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/v1/wca/result-watch/changes/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`delete change ${res.status}`);
}

/**
 * 人类输入 → 厘秒(WCA 内部编码)。支持 DNF/DNS、[mm:]ss[.cc]、333fm 步数。
 * MBLD 等特殊编码不在此精确处理(回退按数值*100,录入时罕见)。
 */
export function parseHumanResult(input: string, eventId: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (up === 'DNF') return -1;
  if (up === 'DNS') return -2;
  if (eventId === '333fm') {
    if (/^\d+$/.test(s)) return parseInt(s, 10);             // single = 步数
    const fm = Number(s);
    return Number.isFinite(fm) ? Math.round(fm * 100) : null; // average = 步数*100
  }
  const m = s.match(/^(?:(\d+):)?(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  const min = m[1] ? parseInt(m[1], 10) : 0;
  const sec = parseInt(m[2], 10);
  const cs = m[3] ? parseInt(m[3].padEnd(2, '0'), 10) : 0;
  return (min * 60 + sec) * 100 + cs;
}

/** 单行成绩 → 变更记录的匹配键(comp | event | 归一轮次)。选手页按人拉取,故无需带人。 */
export function rowChangeKey(competitionId: string, eventId: string, roundTypeId: string | null): string {
  return `${competitionId}|${eventId}|${canonicalRound(roundTypeId) ?? roundTypeId ?? ''}`;
}

/** comp 直播页匹配键(wcaId | event | 归一轮次):一个轮次多名选手,必须带人区分。 */
export function personRoundChangeKey(wcaId: string, eventId: string, roundTypeId: string | null): string {
  return `${wcaId}|${eventId}|${canonicalRound(roundTypeId) ?? roundTypeId ?? ''}`;
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

/** 变更链排序键:真实发生时间优先(effectiveAt),缺失退化 detectedAt。 */
function changeOrderTs(c: ResultChange): number {
  const t = Date.parse(c.effectiveAt ?? c.detectedAt);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 把变更列表按行键索引为「变更链」:同一行(comp|event|轮次)的多条变更,
 * 按发生时间升序排成数组(支持同一成绩多次更改)。
 */
export function buildRowChangeListMap(changes: ResultChange[]): Map<string, ResultChange[]> {
  const m = new Map<string, ResultChange[]>();
  for (const c of changes) {
    if (!c.competitionId || !c.eventId) continue;
    const k = rowChangeKey(c.competitionId, c.eventId, c.roundTypeId);
    const arr = m.get(k);
    if (arr) arr.push(c);
    else m.set(k, [c]);
  }
  for (const arr of m.values()) arr.sort((a, b) => changeOrderTs(a) - changeOrderTs(b));
  return m;
}

/** comp 直播页用:按 (wcaId | event | 轮次) 索引变更链(区分同轮多名选手)。 */
export function buildPersonRoundChangeListMap(changes: ResultChange[]): Map<string, ResultChange[]> {
  const m = new Map<string, ResultChange[]>();
  for (const c of changes) {
    if (!c.eventId) continue;
    const k = personRoundChangeKey(c.wcaId, c.eventId, c.roundTypeId);
    const arr = m.get(k);
    if (arr) arr.push(c);
    else m.set(k, [c]);
  }
  for (const arr of m.values()) arr.sort((a, b) => changeOrderTs(a) - changeOrderTs(b));
  return m;
}

/**
 * 一条变更链里某数值字段被历次更正前的旧值序列(oldest→newest),
 * 用于行内依次划线:[78, 283] → ~~0.78~~ ~~2.83~~,当前值加粗在后。
 */
export function changeChainOldValues(
  changes: ResultChange[] | undefined,
  field: 'best' | 'average',
): number[] {
  if (!changes) return [];
  const out: number[] = [];
  for (const c of changes) {
    if (c.changeType !== 'modified') continue;
    const f = (c.fields ?? []).find((x) => x.field === field);
    if (f && f.old != null) out.push(Number(f.old));
  }
  return out;
}

// ── 行内改成绩:当前有效值(WCA 值叠加变更链最新值)+ 自动重算录入 ───────────────

/** 数值字段的当前有效值 = 变更链最新一条的 new(若有),否则 WCA 原值。 */
export function effectiveFieldValue(
  changes: ResultChange[] | undefined,
  field: 'best' | 'average',
  fallback: number,
): number {
  if (changes) {
    for (let i = changes.length - 1; i >= 0; i--) {
      const f = (changes[i].fields ?? []).find((x) => x.field === field);
      if (f && f.new != null && !Array.isArray(f.new)) return Number(f.new);
    }
  }
  return fallback;
}

/** 各次成绩的当前有效数组 = 变更链最新 attempts 的 new(若有),否则 WCA 原数组。 */
export function effectiveAttempts(
  changes: ResultChange[] | undefined,
  fallback: number[],
): number[] {
  if (changes) {
    for (let i = changes.length - 1; i >= 0; i--) {
      const f = (changes[i].fields ?? []).find((x) => x.field === 'attempts');
      if (f && Array.isArray(f.new)) return (f.new as unknown[]).map(Number);
    }
  }
  return fallback;
}

/** 某一次成绩(index)历次被改前的旧值序列,用于该次行内划线。 */
export function attemptOldValues(changes: ResultChange[] | undefined, index: number): number[] {
  const out: number[] = [];
  if (changes) {
    for (const c of changes) {
      const f = (c.fields ?? []).find((x) => x.field === 'attempts');
      if (f && Array.isArray(f.old) && Array.isArray(f.new)) {
        const o = Number((f.old as unknown[])[index]);
        const n = Number((f.new as unknown[])[index]);
        if (Number.isFinite(o) && o !== n) out.push(o);
      }
    }
  }
  return out;
}

export interface AttemptEditTarget {
  wcaId: string;
  competitionId: string;
  eventId: string;
  roundTypeId: string;
  resultId?: number | null;
}

/**
 * 行内改某一次成绩 → 自动按 WCA 规则重算单次/平均 → 录入一条变更
 * (fields 含 attempts,以及实际变动的 best/average)。MBLD 等不重算,只记 attempts。
 */
export async function recordAttemptEdit(p: {
  target: AttemptEditTarget;
  currentAttempts: number[];
  currentBest: number;
  currentAverage: number;
  index: number;
  newValue: number;
  note?: string | null;
}): Promise<void> {
  const { target, currentAttempts, currentBest, currentAverage, index, newValue, note } = p;
  if (currentAttempts[index] === newValue) return;
  const newAttempts = currentAttempts.slice();
  newAttempts[index] = newValue;

  const fields: ResultChangeField[] = [{ field: 'attempts', old: currentAttempts, new: newAttempts }];
  if (canRecompute(target.eventId)) {
    const { best, average } = computeWcaBestAverage(newAttempts, target.eventId);
    if (best !== currentBest) fields.push({ field: 'best', old: currentBest, new: best });
    if (average != null && average !== currentAverage) {
      fields.push({ field: 'average', old: currentAverage, new: average });
    }
  }
  await createResultChange({
    wcaId: target.wcaId,
    competitionId: target.competitionId,
    eventId: target.eventId,
    roundTypeId: target.roundTypeId,
    resultId: target.resultId ?? null,
    changeType: 'modified',
    fields,
    note: note ?? null,
  });
}

/**
 * 组装「补录原始值」变更的 fields(纯函数,便于测试)。
 * baseOld = 已有 backfill 记录累积的 old 数组(逐次补录会更新同一条记录);无则从当前数组起。
 * 旧 = 当前数组里把第 index 位换成原始值;新 = 当前 live 数组(当前值不变)。
 * 原始单次/平均按 WCA 规则从拼好的旧数组重算,新单次/平均取权威 live。
 */
export function buildOriginalBackfillFields(p: {
  currentAttempts: number[];
  currentBest: number;
  currentAverage: number;
  eventId: string;
  index: number;
  originalValue: number;
  baseOld?: number[];
}): ResultChangeField[] {
  const { currentAttempts, currentBest, currentAverage, eventId, index, originalValue } = p;
  const oldArr = (p.baseOld ?? currentAttempts).slice();
  oldArr[index] = originalValue;
  const fields: ResultChangeField[] = [{ field: 'attempts', old: oldArr, new: currentAttempts.slice() }];
  if (canRecompute(eventId)) {
    const o = computeWcaBestAverage(oldArr, eventId);
    if (o.best !== currentBest) fields.push({ field: 'best', old: o.best, new: currentBest });
    if (o.average != null && o.average !== currentAverage) {
      fields.push({ field: 'average', old: o.average, new: currentAverage });
    }
  }
  return fields;
}

/**
 * 行内补录某一次成绩的「更正前原始值」→ 当前值不变,旧值划线留在前面。
 * 逐次补录折进同一条 backfill 变更(以 attempts.new===当前数组 识别),保持单条事件 + 单次/平均一致。
 */
export async function recordAttemptOriginal(p: {
  target: AttemptEditTarget;
  currentAttempts: number[];
  currentBest: number;
  currentAverage: number;
  index: number;
  originalValue: number;
  existingChain?: ResultChange[];
  note?: string | null;
}): Promise<void> {
  const { target, currentAttempts, index, originalValue, existingChain, note } = p;
  if (currentAttempts[index] === originalValue) return;
  const eq = (a: unknown, b: number[]) =>
    Array.isArray(a) && a.length === b.length && a.every((v, k) => Number(v) === b[k]);
  const existing = (existingChain ?? []).find(
    (c) => c.changeType === 'modified' && (c.fields ?? []).some((f) => f.field === 'attempts' && eq(f.new, currentAttempts)),
  );
  const baseOld = existing
    ? ((existing.fields ?? []).find((f) => f.field === 'attempts')?.old as unknown[] | undefined)?.map(Number)
    : undefined;
  const fields = buildOriginalBackfillFields({
    currentAttempts: p.currentAttempts,
    currentBest: p.currentBest,
    currentAverage: p.currentAverage,
    eventId: target.eventId,
    index,
    originalValue,
    baseOld,
  });
  // 补录时若给了原因就更新;逐次折进同一条记录,空原因不抹掉已有的。
  const input: ResultChangeInput = {
    wcaId: target.wcaId,
    competitionId: target.competitionId,
    eventId: target.eventId,
    roundTypeId: target.roundTypeId,
    resultId: target.resultId ?? null,
    changeType: 'modified',
    fields,
    note: note ?? (existing?.note ?? null),
  };
  if (existing) await updateResultChange(existing.id, input);
  else await createResultChange(input);
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
