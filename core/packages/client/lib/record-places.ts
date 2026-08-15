import {
  isRecordPlacesData,
  type RecordCounts,
  type RecordMetric,
  type RecordPlacesData,
} from '@cuberoot/shared/record-places';
import { statsUrl } from './stats-base';

let inflight: Promise<RecordPlacesData> | null = null;

export async function loadRecordPlaces(): Promise<RecordPlacesData> {
  if (!inflight) {
    inflight = fetch(statsUrl('/stats/record_places.json')).then(async (response) => {
      if (!response.ok) throw new Error(`record places unavailable (${response.status})`);
      const value: unknown = await response.json();
      if (!isRecordPlacesData(value)) throw new Error('invalid record places data');
      return value;
    }).catch((error) => {
      inflight = null;
      throw error;
    });
  }
  return inflight;
}

export interface RankedRecordRow<T> {
  row: T;
  rank: number;
}

export function rankRecordRows<T extends RecordCounts>(
  rows: readonly T[],
  metric: RecordMetric,
  keyOf: (row: T) => string,
): RankedRecordRow<T>[] {
  const sorted = [...rows].sort((a, b) => {
    const selected = b[metric] - a[metric];
    if (selected) return selected;
    const total = (b.wr + b.cr + b.nr) - (a.wr + a.cr + a.nr);
    if (total) return total;
    const wr = b.wr - a.wr;
    if (wr) return wr;
    const cr = b.cr - a.cr;
    if (cr) return cr;
    const nr = b.nr - a.nr;
    return nr || keyOf(a).localeCompare(keyOf(b), 'en');
  });

  let rank = 0;
  let lastCount: number | null = null;
  return sorted.map((row, index) => {
    if (row[metric] !== lastCount) rank = index + 1;
    lastCount = row[metric];
    return { row, rank };
  });
}
