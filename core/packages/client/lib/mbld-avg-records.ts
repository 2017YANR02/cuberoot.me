'use client';
// 非官方多盲平均(333mbf / 333mbo Mo3)的区域纪录(WR / 大洲码 / NR)查表。
// 数据由 stats-build 的 mbld_avg_records_build.ts 产(stats/records/mbld_avg_records.json),
// 随「update stats」CI 重算。WCA 不追踪多盲平均,故这是站内自算的纪录标签,选手页平均列用它上
// RecordBadge(优先级高于 PR 名次)。文件很小(几 KB),仅在有多盲行的页面按需拉一次、模块级缓存。

import { useEffect, useState } from 'react';
import { statsUrl } from '@/lib/stats-base';

export function mbldAvgRecordKey(wcaId: string, compId: string, eventId: string, roundTypeId: string): string {
  return `${wcaId}|${compId}|${eventId}|${roundTypeId}`;
}

let _cache: Map<string, string> | null = null;
let _inflight: Promise<Map<string, string>> | null = null;

export function loadMbldAvgRecords(): Promise<Map<string, string>> {
  if (_cache) return Promise.resolve(_cache);
  if (!_inflight) {
    _inflight = fetch(statsUrl('/stats/records/mbld_avg_records.json'))
      .then((r) => (r.ok ? r.json() : { tags: {} }))
      .then((j: { tags?: Record<string, string> }) => {
        _cache = new Map(Object.entries(j.tags ?? {}));
        return _cache;
      })
      .catch(() => {
        _cache = new Map();
        return _cache;
      });
  }
  return _inflight;
}

// enabled=false(无多盲行)时不发请求;命中缓存即同步返回,避免无谓 fetch。
export function useMbldAvgRecords(enabled: boolean): Map<string, string> | null {
  const [map, setMap] = useState<Map<string, string> | null>(_cache);
  useEffect(() => {
    if (!enabled || _cache) { if (_cache) setMap(_cache); return; }
    let alive = true;
    loadMbldAvgRecords().then((m) => { if (alive) setMap(m); });
    return () => { alive = false; };
  }, [enabled]);
  return map;
}
