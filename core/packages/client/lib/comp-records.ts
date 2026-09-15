// 比赛纪录数据加载
// 数据源: stats/comp_records_summary.json + stats/comp_records_detail.json
// Ported from packages/client-vite/src/utils/comp_records.ts.
import { statsUrl } from './stats-base';

export type RecordTop = 'WR' | 'CR' | 'NR';

/** Count each round's single/average once, using its highest displayed record level. */
export function summarizeCompRecords(results: readonly {
  e: string; b: number; a: number; sr?: string; ar?: string | number;
  pS?: number | null; pA?: number | null;
}[]) {
  const counts = { WR: 0, FWR: 0, CR: 0, NR: 0, PR: 0 };
  for (const result of results) {
    const add = (value: number, tag: string, rank: number | null | undefined) => {
      if (!Number.isFinite(value) || value <= 0) return;
      if (tag === 'WR' || tag === 'FWR' || tag === 'NR') counts[tag]++;
      else if (/^(CR|AfR|AsR|ER|NAR|OcR|SAR)$/.test(tag)) counts.CR++;
      else if (rank === 1 || tag === 'PR') counts.PR++;
    };
    add(result.b, result.sr ?? '', result.pS);
    if (!['333mbf', '333mbo'].includes(result.e)) add(result.a, String(result.ar ?? ''), result.pA);
  }
  return counts;
}

export interface RecordEntry {
  t: string;    // level 原值 (WR / AfR / AsR / ER / NAR / OcR / SAR / NR)
  k: 's' | 'a'; // single / average
  e: string;    // WCA event_id
  p: string;    // WCA person ID
  n: string;    // persons.name (含括号中文)
  v: number;    // centiseconds
  a: number[] | null; // 该轮按 attempt_number 排序的成绩
}

let _summary: Record<string, RecordTop> | null = null;
let _detail: Record<string, RecordEntry[]> | null = null;
let _summaryPromise: Promise<void> | null = null;
let _detailPromise: Promise<void> | null = null;
let _version = 0;

export function loadCompRecordsSummary(): Promise<number> {
  if (_summary) return Promise.resolve(_version);
  if (!_summaryPromise) {
    _summaryPromise = fetch(statsUrl('/stats/comp_records_summary.json'))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((d: Record<string, RecordTop>) => {
        _summary = d;
        _version++;
      });
  }
  return _summaryPromise.then(() => _version);
}

export function getCompRecordTop(compId: string): RecordTop | null {
  return _summary?.[compId] ?? null;
}

export function loadCompRecordsDetail(): Promise<number> {
  if (_detail) return Promise.resolve(_version);
  if (!_detailPromise) {
    _detailPromise = fetch(statsUrl('/stats/comp_records_detail.json'))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((d: Record<string, RecordEntry[]>) => {
        _detail = d;
        _version++;
      });
  }
  return _detailPromise.then(() => _version);
}

export function getCompRecordEntries(compId: string): RecordEntry[] {
  return _detail?.[compId] ?? [];
}

export function compRecordsVersion(): number {
  return _version;
}
