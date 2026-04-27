/**
 * Shared timer types — keep this file dependency-free (no React, no DOM).
 */

export type EventId =
  | '222'
  | '333'
  | '444'
  | '555'
  | '666'
  | '777'
  | 'pyra'
  | 'skewb'
  | 'sq1'
  | 'mega'
  | 'clock'
  | '333oh'
  | '333bld'
  | '333fm';

export type Penalty = 'ok' | '+2' | 'DNF';

export interface Solve {
  /** ULID-ish: timestamp + random suffix; sorted by ts not id */
  id: string;
  /** Raw recorded time in milliseconds, BEFORE penalty */
  timeMs: number;
  penalty: Penalty;
  scramble: string;
  event: EventId;
  /** Unix ms */
  ts: number;
  comment?: string;
}

export interface Session {
  id: string;
  name: string;
  event: EventId;
  /** Unix ms */
  createdAt: number;
  solves: Solve[];
}

/** Effective time after penalty (Infinity for DNF). */
export function effectiveMs(s: Solve): number {
  if (s.penalty === 'DNF') return Infinity;
  if (s.penalty === '+2') return s.timeMs + 2000;
  return s.timeMs;
}

export const EVENTS: { id: EventId; nameEn: string; nameZh: string }[] = [
  { id: '333', nameEn: '3x3', nameZh: '三阶' },
  { id: '222', nameEn: '2x2', nameZh: '二阶' },
  { id: '444', nameEn: '4x4', nameZh: '四阶' },
  { id: '555', nameEn: '5x5', nameZh: '五阶' },
  { id: '666', nameEn: '6x6', nameZh: '六阶' },
  { id: '777', nameEn: '7x7', nameZh: '七阶' },
  { id: 'pyra', nameEn: 'Pyraminx', nameZh: '金字塔' },
  { id: 'skewb', nameEn: 'Skewb', nameZh: '斜转' },
  { id: 'sq1', nameEn: 'Square-1', nameZh: 'SQ-1' },
  { id: 'mega', nameEn: 'Megaminx', nameZh: '五魔' },
  { id: 'clock', nameEn: 'Clock', nameZh: '魔表' },
  { id: '333oh', nameEn: '3x3 OH', nameZh: '三阶单手' },
  { id: '333bld', nameEn: '3x3 BLD', nameZh: '三盲' },
  { id: '333fm', nameEn: 'FMC', nameZh: '最少步' },
];
