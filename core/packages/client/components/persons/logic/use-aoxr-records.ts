'use client';

import { useEffect, useState } from 'react';
import { statsUrl } from '@/lib/stats-base';
import { parseAoxrWorldRecords } from '@/lib/aoxr-records';

let cache: { records: ReadonlySet<string>; expires: number } | null = null;
let inflight: Promise<ReadonlySet<string>> | null = null;

function loadAoxrWorldRecords(): Promise<ReadonlySet<string>> {
  if (cache && cache.expires > Date.now()) return Promise.resolve(cache.records);
  if (!inflight) {
    inflight = fetch(statsUrl('/stats/wr_aoxr.json'))
      .then(response => {
        if (!response.ok) throw new Error(`AoXR records: HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        const records = parseAoxrWorldRecords(data);
        cache = { records, expires: Date.now() + 300_000 };
        return records;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useAoxrWorldRecords(enabled: boolean): ReadonlySet<string> | null {
  const [records, setRecords] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadAoxrWorldRecords().then(data => { if (alive) setRecords(data); }).catch(() => {
      // Keep PR ranks available; a later mount can retry a failed request.
    });
    return () => { alive = false; };
  }, [enabled]);
  return records;
}
