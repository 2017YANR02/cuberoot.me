import { describe, expect, it } from 'vitest';
import { isValidIsoDate, normalizeIsoDate, toLocalIsoDate } from '@/lib/iso-date';

describe('ISO date-only helpers', () => {
  it('validates real Gregorian calendar days', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('08/27/2026')).toBe(false);
  });

  it('formats the local calendar day without UTC conversion', () => {
    expect(toLocalIsoDate(new Date(2026, 7, 27, 23, 59))).toBe('2026-08-27');
  });

  it('normalizes API date values and rejects invalid input', () => {
    expect(normalizeIsoDate(' 2026-08-27 ')).toBe('2026-08-27');
    expect(normalizeIsoDate('2026-08-27T23:30:00-07:00')).toBe('2026-08-27');
    expect(normalizeIsoDate('not-a-date')).toBe('');
    expect(normalizeIsoDate(null)).toBe('');
  });
});
