// Ported from packages/client-vite/src/pages/calendar/use_calendar_data.ts.
import { useEffect, useState } from 'react';
import { statsUrl } from '@/lib/stats-base';

export interface PastComp {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude_degrees?: number;
  longitude_degrees?: number;
  start_date: string;
  end_date: string;
  events: string[];
}

export interface CompRecordsSummary {
  [compId: string]: 'NR' | 'CR' | 'WR' | string;
}

let pastCache: PastComp[] | null = null;
let pastPromise: Promise<PastComp[]> | null = null;
let recordsCache: CompRecordsSummary | null = null;
let recordsPromise: Promise<CompRecordsSummary> | null = null;

function fetchPastComps(): Promise<PastComp[]> {
  if (pastCache) return Promise.resolve(pastCache);
  if (pastPromise) return pastPromise;
  pastPromise = fetch(statsUrl('/stats/all_past_comps.json'))
    .then((r) => r.json())
    .then((data: PastComp[]) => { pastCache = data; return data; });
  return pastPromise;
}

function fetchRecordsSummary(): Promise<CompRecordsSummary> {
  if (recordsCache) return Promise.resolve(recordsCache);
  if (recordsPromise) return recordsPromise;
  recordsPromise = fetch(statsUrl('/stats/comp_records_summary.json'))
    .then((r) => r.json())
    .then((data: CompRecordsSummary) => { recordsCache = data; return data; });
  return recordsPromise;
}

export interface DayMatch {
  comp: PastComp;
  yearsAgo: number;
  recordTier: 'WR' | 'CR' | 'NR' | null;
}

function mmdd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

function withinWindow(target: string, startMmdd: string, endMmdd: string): boolean {
  if (startMmdd <= endMmdd) {
    return target >= startMmdd && target <= endMmdd;
  }
  return target >= startMmdd || target <= endMmdd;
}

export function useDayMatches(date: Date) {
  const [matches, setMatches] = useState<DayMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const target = mmdd(date);
  const targetYear = date.getFullYear();

  useEffect(() => {
    let cancelled = false;
    setMatches(null);
    setError(null);
    Promise.all([fetchPastComps(), fetchRecordsSummary().catch((): CompRecordsSummary => ({}))])
      .then(([past, records]) => {
        if (cancelled) return;
        const out: DayMatch[] = [];
        for (const c of past) {
          const startYear = Number(c.start_date.slice(0, 4));
          const startMmdd = c.start_date.slice(5, 10);
          const endMmdd = (c.end_date || c.start_date).slice(5, 10);
          if (!withinWindow(target, startMmdd, endMmdd)) continue;
          const tier = records[c.id] === 'WR' || records[c.id] === 'CR' || records[c.id] === 'NR'
            ? records[c.id] as 'WR' | 'CR' | 'NR'
            : null;
          out.push({
            comp: c,
            yearsAgo: targetYear - startYear,
            recordTier: tier,
          });
        }
        out.sort((a, b) => a.yearsAgo - b.yearsAgo || a.comp.id.localeCompare(b.comp.id));
        setMatches(out);
      })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, [target, targetYear]);

  return { matches, error };
}
