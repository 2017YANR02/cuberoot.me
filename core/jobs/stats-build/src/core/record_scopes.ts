import type { RowDataPacket } from 'mysql2';
import type { RecordScope } from './statistic.js';

// Record tiers are inclusive: a WR also counts as a continental and national record.
export const RECORD_LEVELS = {
  WR: ['WR'],
  CR: ['WR', 'AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR'],
  NR: ['WR', 'AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR', 'NR'],
} satisfies Record<RecordScope['level'], string[]>;

export function recordRegions(rows: RowDataPacket[]): string[] {
  return ['World', ...[...new Set(rows.map(row => String(row.continent)))].filter(
    name => name && name !== 'undefined' && name !== 'Multiple Continents',
  ).sort()];
}

export function recordRowsForScope(rows: RowDataPacket[], region: string, level: RecordScope['level']): RowDataPacket[] {
  const markers: readonly string[] = RECORD_LEVELS[level];
  return rows.filter(row => (region === 'World' || row.continent === region)
    && (markers.includes(row.regional_single_record) || markers.includes(row.regional_average_record)));
}

// NOTE: 取 top N，含并列
export function takeTopNWithTies(xs: unknown[][], n: number, valueIndex: number): unknown[][] {
  if (xs.length <= n) return xs;
  const boundaryValue = xs[n - 1][valueIndex];
  const top = xs.slice(0, n);
  const ties = xs.slice(n).filter(x => x[valueIndex] === boundaryValue);
  return [...top, ...ties];
}
