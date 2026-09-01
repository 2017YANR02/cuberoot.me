import {
  averageOfN,
  bestAverageOfN,
  bestMeanOfN,
  meanOfN,
} from './stats';
import type { EventId, Solve } from './types';

export type RollingStatKey = 'mo3' | `ao${number}`;

export const MIN_AO_WINDOW = 3;
export const MAX_AO_WINDOW = 100_000;
export const MAX_ROLLING_STAT_COLUMNS = 2;
export const DEFAULT_ROLLING_STAT_COLUMNS: RollingStatKey[] = ['ao5', 'ao12'];
export const ROLLING_STAT_PRESETS: RollingStatKey[] = [
  'mo3',
  'ao5',
  'ao12',
  'ao25',
  'ao50',
  'ao100',
  'ao200',
  'ao1000',
  'ao10000',
];

export interface RollingStatDefinition {
  key: RollingStatKey;
  kind: 'mean' | 'average';
  size: number;
}

export interface RollingStatPoint {
  isPb: boolean;
  value: number | null;
}

export type RollingStatProjection = ReadonlyMap<RollingStatKey, readonly RollingStatPoint[]>;

export function parseRollingStatKey(raw: unknown): RollingStatDefinition | null {
  if (raw === 'mo3') return { key: 'mo3', kind: 'mean', size: 3 };
  if (typeof raw !== 'string') return null;
  const match = /^ao(\d+)$/.exec(raw);
  if (!match) return null;
  const size = Number(match[1]);
  if (!Number.isSafeInteger(size) || size < MIN_AO_WINDOW || size > MAX_AO_WINDOW) return null;
  return { key: `ao${size}`, kind: 'average', size };
}

export function sanitizeRollingStatColumns(
  raw: unknown,
  max = MAX_ROLLING_STAT_COLUMNS,
): RollingStatKey[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Map<RollingStatKey, RollingStatDefinition>();
  for (const value of raw) {
    const definition = parseRollingStatKey(value);
    if (definition) unique.set(definition.key, definition);
  }
  return [...unique.values()]
    .sort((a, b) => a.size - b.size || (a.kind === b.kind ? 0 : a.kind === 'mean' ? -1 : 1))
    .slice(0, max)
    .map((definition) => definition.key);
}

/** Keep both statistic slots populated, including old saved 0/1-column states. */
export function normalizeRollingStatColumns(raw: unknown): RollingStatKey[] {
  const columns = sanitizeRollingStatColumns(raw);
  for (const fallback of DEFAULT_ROLLING_STAT_COLUMNS) {
    if (columns.length >= MAX_ROLLING_STAT_COLUMNS) break;
    if (!columns.includes(fallback)) columns.push(fallback);
  }
  return sanitizeRollingStatColumns(columns);
}

export function rollingStatReplacementOptions(
  columns: readonly RollingStatKey[],
): RollingStatKey[] {
  const selected = new Set(sanitizeRollingStatColumns(columns));
  return ROLLING_STAT_PRESETS.filter((key) => !selected.has(key));
}

export function replaceRollingStatColumn(
  columns: readonly RollingStatKey[],
  current: RollingStatKey,
  replacement: RollingStatKey,
): RollingStatKey[] {
  const selected = sanitizeRollingStatColumns(columns);
  if (!selected.includes(current) || selected.includes(replacement)) return selected;
  return sanitizeRollingStatColumns(selected.map((key) => (
    key === current ? replacement : key
  )));
}

export function rollingStatColumnsFromLegacy(raw: unknown): RollingStatKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ROLLING_STAT_COLUMNS];
  const keys = raw.map((value) => `ao${Math.floor(Number(value))}`);
  return sanitizeRollingStatColumns(keys);
}

export function rollingStatCurrent(solves: Solve[], key: RollingStatKey): number | null {
  const definition = parseRollingStatKey(key);
  if (!definition) return null;
  return definition.kind === 'mean'
    ? meanOfN(solves, definition.size)
    : averageOfN(solves, definition.size);
}

/** Per-solve rolling values and strict running PBs for chronological history. */
export function rollingStatSeries(
  solves: readonly Solve[],
  key: RollingStatKey,
): RollingStatPoint[] {
  const definition = parseRollingStatKey(key);
  const points: RollingStatPoint[] = solves.map(() => ({ isPb: false, value: null }));
  if (!definition) return points;

  let best = Infinity;
  for (let index = definition.size - 1; index < solves.length; index += 1) {
    const window = solves.slice(index - definition.size + 1, index + 1);
    const value = rollingStatCurrent(window, key);
    const isPb = value !== null && Number.isFinite(value) && value < best;
    points[index] = { isPb, value };
    if (isPb) best = value;
  }
  return points;
}

/** MBLD ranks by points, so duration rolling columns are intentionally absent. */
export function rollingStatColumnsForEvent(
  event: EventId | null | undefined,
  columns: readonly RollingStatKey[],
): RollingStatKey[] {
  return event === '333mbld' ? [] : sanitizeRollingStatColumns(columns);
}

export function projectRollingStats(
  solves: readonly Solve[],
  columns: readonly RollingStatKey[],
): RollingStatProjection {
  return new Map(columns.map(key => [key, rollingStatSeries(solves, key)]));
}

export function rollingStatBest(solves: Solve[], key: RollingStatKey): number | null {
  const definition = parseRollingStatKey(key);
  if (!definition) return null;
  return definition.kind === 'mean'
    ? bestMeanOfN(solves, definition.size)
    : bestAverageOfN(solves, definition.size);
}
