import type { Penalty } from './types';

export interface ParsedTimerEntry {
  /** Raw time before a +2 penalty, in milliseconds. */
  ms: number;
  penalty: Penalty;
}

/**
 * Parse the canonical timer manual-entry syntax.
 *
 * Accepts DNF / DNS, seconds, mm:ss, hh:mm:ss, and either a `+2 ` prefix or
 * `+2` suffix. The legacy prefix is a displayed total (so two seconds are
 * removed before storing); the competition-style suffix marks a raw time that
 * still needs the penalty. Colon-delimited minute/second fields stay below 60.
 */
export function parseTimerEntry(input: string): ParsedTimerEntry | null {
  let value = input.trim();
  if (!value) return null;
  if (/^dnf$/i.test(value)) return { ms: 0, penalty: 'DNF' };
  if (/^dns$/i.test(value)) return { ms: 0, penalty: 'DNS' };

  let penalty: Penalty = 'ok';
  let plusTwoIsDisplayedTotal = false;
  if (/^\+2\s+/i.test(value)) {
    penalty = '+2';
    plusTwoIsDisplayedTotal = true;
    value = value.replace(/^\+2\s+/i, '').trim();
  } else if (/\s*\+2$/i.test(value)) {
    penalty = '+2';
    value = value.replace(/\s*\+2$/i, '').trim();
  }

  if (!/^(?:\d+(?::\d{1,2}){0,2})?(?:\.\d+)?$/.test(value)) return null;
  if (!value || value === '.') return null;
  const parts = value.split(':');
  if (parts.length > 3) return null;
  const numbers = parts.map(Number);
  if (numbers.some((part) => !Number.isFinite(part) || part < 0)) return null;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (parts.length === 3) {
    [hours, minutes, seconds] = numbers;
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes >= 60 || seconds >= 60) return null;
  } else if (parts.length === 2) {
    [minutes, seconds] = numbers;
    if (!Number.isInteger(minutes) || seconds >= 60) return null;
  } else {
    [seconds] = numbers;
  }

  const displayedMs = hours * 3_600_000 + minutes * 60_000 + Math.round(seconds * 1000);
  if (!Number.isSafeInteger(displayedMs) || displayedMs <= 0) return null;
  if (plusTwoIsDisplayedTotal) {
    if (displayedMs < 2000) return null;
    return { ms: displayedMs - 2000, penalty };
  }
  return { ms: displayedMs, penalty };
}
