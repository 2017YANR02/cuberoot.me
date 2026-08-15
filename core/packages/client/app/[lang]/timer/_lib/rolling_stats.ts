import type { Solve } from './types';
import { averageOfN, bestAverageOfN, bestMeanOfN, meanOfN } from './stats';

export type RollingStatKey = 'mo3' | `ao${number}`;

export const MIN_AO_WINDOW = 3;
export const MAX_AO_WINDOW = 100_000;
export const MAX_ROLLING_STAT_COLUMNS = 2;
export const DEFAULT_ROLLING_STAT_COLUMNS: RollingStatKey[] = ['ao5', 'ao12'];
export const ROLLING_STAT_PRESETS: RollingStatKey[] = [
  'mo3', 'ao5', 'ao12', 'ao25', 'ao50', 'ao100', 'ao200', 'ao1000', 'ao10000',
];

export interface RollingStatDefinition {
  key: RollingStatKey;
  kind: 'mean' | 'average';
  size: number;
}

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
    .map(definition => definition.key);
}

export function rollingStatColumnsFromLegacy(raw: unknown): RollingStatKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ROLLING_STAT_COLUMNS];
  const keys = raw.map(value => `ao${Math.floor(Number(value))}`);
  return sanitizeRollingStatColumns(keys);
}

export function rollingStatCurrent(solves: Solve[], key: RollingStatKey): number | null {
  const definition = parseRollingStatKey(key);
  if (!definition) return null;
  return definition.kind === 'mean'
    ? meanOfN(solves, definition.size)
    : averageOfN(solves, definition.size);
}

export function rollingStatBest(solves: Solve[], key: RollingStatKey): number | null {
  const definition = parseRollingStatKey(key);
  if (!definition) return null;
  return definition.kind === 'mean'
    ? bestMeanOfN(solves, definition.size)
    : bestAverageOfN(solves, definition.size);
}
