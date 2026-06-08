// 比赛纪录数据加载
// 数据源: stats/comp_records_summary.json + stats/comp_records_detail.json
// Ported from packages/client/src/utils/comp_records.ts.
import { statsUrl } from './stats-base';

export type RecordTop = 'WR' | 'CR' | 'NR';

export interface RecordEntry {
  t: string;    // level 原值 (WR / AfR / AsR / ER / NAR / OcR / SAR / NR)
  k: 's' | 'a'; // single / average
  e: string;    // WCA event_id
  p: string;    // WCA person ID
  n: string;    // persons.name (含括号中文)
  v: number;    // centiseconds
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
