// 比赛纪录数据加载
// 数据源: stats/comp_records_summary.json + stats/comp_records_detail.json
// 由 stats-build 的 gen_comp_records.ts 周更生成

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
    _summaryPromise = fetch('/stats/comp_records_summary.json')
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
    _detailPromise = fetch('/stats/comp_records_detail.json')
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

// 格式化纪录值
//   333fm single: v = moves (int)
//   333fm average: v = moves*100 → mean.xx
//   333mbf: 10 位编码 DDTTTTTMM（D=99-(solved-missed), T=seconds, M=missed）
//   其他: v = centiseconds → s.ss 或 m:ss.ss
export function formatRecordValue(v: number, eventId: string, kind: 's' | 'a'): string {
  if (v < 0) return 'DNF';
  if (eventId === '333fm') {
    return kind === 's' ? String(v) : (v / 100).toFixed(2);
  }
  if (eventId === '333mbf') {
    const ss = String(v).padStart(10, '0');
    const diff = parseInt(ss.slice(1, 3), 10);
    const seconds = parseInt(ss.slice(3, 8), 10);
    const missed = parseInt(ss.slice(8, 10), 10);
    const solvedMinusMissed = 99 - diff;
    const solved = solvedMinusMissed + missed;
    const attempted = solved + missed;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${solved}/${attempted} ${min}:${String(sec).padStart(2, '0')}`;
  }
  // NOTE: 老多盲编码 (333mbo, ≥10 位): DDDTTTTTAA
  //   D = 99 - solved, T = seconds (5 位), A = attempted
  if (eventId === '333mbo') {
    let mb = v;
    const seconds = mb % 100000;
    mb = Math.floor(mb / 100000);
    const attempted = mb % 100;
    mb = Math.floor(mb / 100);
    const solved = 99 - (mb % 100);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${solved}/${attempted} ${min}:${String(sec).padStart(2, '0')}`;
  }
  const sec = v / 100;
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2);
    return `${m}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
  }
  return sec.toFixed(2);
}
