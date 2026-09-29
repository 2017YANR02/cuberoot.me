import { EVENTS, type EventId } from './types';
import { DEFAULT_ROUND_CONFIG, type RoundConfig } from './round';

/** Shared training preferences; hosts own persistence and the current event. */
export interface TimerTrainingSettings {
  targetMsByEvent: Partial<Record<EventId, number>>;
  dailySolveGoal: number | null;
  round: RoundConfig;
}

export function normalizeTimerTrainingSettings(value: Record<string, unknown> = {}): TimerTrainingSettings {
  const targetMsByEvent: Partial<Record<EventId, number>> = {};
  const targets = value.targetMsByEvent;
  if (targets && typeof targets === 'object' && !Array.isArray(targets)) {
    for (const event of EVENTS) {
      const target = (targets as Record<string, unknown>)[event.id];
      if (typeof target === 'number' && Number.isSafeInteger(target) && target > 0) targetMsByEvent[event.id] = target;
    }
  }
  const raw = value.round && typeof value.round === 'object' && !Array.isArray(value.round)
    ? value.round as Record<string, unknown> : {};
  const positiveTime = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
  return {
    targetMsByEvent,
    dailySolveGoal: typeof value.dailySolveGoal === 'number' && Number.isFinite(value.dailySolveGoal) && value.dailySolveGoal >= 1
      ? Math.floor(value.dailySolveGoal) : null,
    round: {
      ...DEFAULT_ROUND_CONFIG,
      on: raw.on === true,
      format: typeof raw.format === 'string' && ['ao5', 'mo3', 'bo3', 'bo1', 'bo2', 'bo5'].includes(raw.format) ? raw.format as RoundConfig['format'] : DEFAULT_ROUND_CONFIG.format,
      cutoffMs: positiveTime(raw.cutoffMs),
      limitMs: positiveTime(raw.limitMs),
      cutoffAttempts: typeof raw.cutoffAttempts === 'number' && Number.isFinite(raw.cutoffAttempts) && raw.cutoffAttempts >= 1
        ? Math.floor(raw.cutoffAttempts) : DEFAULT_ROUND_CONFIG.cutoffAttempts,
      cumulative: raw.cumulative === true,
    },
  };
}
/**
 * Parse a daily-solve-goal string. Empty / 0 / negative / non-finite → null
 * (treated as "disabled" by the progress pill).
 */
export function parseDailySolveGoal(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/**
 * Parse a time-attack target time string (`m:ss.ms` style, e.g. `0:10.50`,
 * `1:23.4`, or plain seconds like `10.5`) into milliseconds.
 *
 * Returns null for empty / invalid / non-positive / non-finite input — callers
 * should treat null as "disable the target".
 */
export function parseTargetTime(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Accept: "m:ss.ms", "m:ss", "s.ms", or plain integer seconds.
  // Use a permissive parse — a single colon splits minutes:seconds.
  let mins = 0;
  let secStr = trimmed;
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx >= 0) {
    const mPart = trimmed.slice(0, colonIdx);
    secStr = trimmed.slice(colonIdx + 1);
    const m = Number(mPart);
    if (!Number.isFinite(m) || m < 0) return null;
    mins = Math.floor(m);
  }
  const sec = Number(secStr);
  if (!Number.isFinite(sec) || sec < 0) return null;
  const totalMs = Math.round(mins * 60_000 + sec * 1000);
  if (!Number.isSafeInteger(totalMs) || totalMs <= 0) return null;
  return totalMs;
}

/**
 * Format a target-time ms value back into `m:ss.ms` for display in the
 * settings input. 0 / null / non-finite → empty string.
 */
export function formatTargetTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '';
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${min}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

