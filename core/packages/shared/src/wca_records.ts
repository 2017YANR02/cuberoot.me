import { WCA_EVENT_ORDER } from './wca_events.js';

/** Published record-history row; the records page and assistant share this contract. */
export interface WcaRecordRow {
  e: string; t: 's' | 'a'; v: number; l: string;
  p: string; pn: string; pc?: string;
  c: string; cn: string; d: string; de?: string; a: number[] | null;
}

/** Select all tied best valid records, preserving the records page's display order. */
export function selectCurrentRecords<T extends WcaRecordRow>(rows: readonly T[]): T[] {
  const best = new Map<string, { value: number; rows: T[] }>();
  for (const row of rows) {
    if (row.v <= 0) continue;
    const key = `${row.e}-${row.t}`, current = best.get(key);
    if (!current || row.v < current.value) best.set(key, { value: row.v, rows: [row] });
    else if (row.v === current.value) current.rows.push(row);
  }
  return WCA_EVENT_ORDER.flatMap(event => (['s', 'a'] as const).flatMap(type =>
    [...(best.get(`${event}-${type}`)?.rows ?? [])].sort((a, b) => a.d.localeCompare(b.d))));
}

export interface PersonalRecordFlag { bestIsPb: boolean; averageIsPb: boolean }
/** Input must be chronological. Only strict improvements count; DNF/DNS/0 never do. */
export function personalRecordFlags<T extends {event_id:string;best:number;average:number}>(rows:readonly T[]): Map<T,PersonalRecordFlag> {
  const best=new Map<string,{single:number;average:number}>();
  const flags=new Map<T,PersonalRecordFlag>();
  for (const row of rows) {
    const previous=best.get(row.event_id) ?? {single:Infinity,average:Infinity};
    const bestIsPb=row.best>0 && row.best<previous.single;
    const averageIsPb=row.average>0 && row.average<previous.average;
    if(bestIsPb)previous.single=row.best;
    if(averageIsPb)previous.average=row.average;
    best.set(row.event_id,previous);flags.set(row,{bestIsPb,averageIsPb});
  }
  return flags;
}
