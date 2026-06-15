import { describe, it, expect } from 'vitest';
import { formatDateRangeIso, toIsoDate } from '@/lib/wca-date';

describe('formatDateRangeIso', () => {
  it('same day → bare ISO', () => {
    expect(formatDateRangeIso('2026-06-06')).toBe('2026-06-06');
    expect(formatDateRangeIso('2026-06-06', '2026-06-06')).toBe('2026-06-06');
    expect(formatDateRangeIso('2026-06-06', null)).toBe('2026-06-06');
  });
  it('same year + month → suffix DD only', () => {
    expect(formatDateRangeIso('2026-06-06', '2026-06-07')).toBe('2026-06-06~07');
    expect(formatDateRangeIso('2026-06-01', '2026-06-30')).toBe('2026-06-01~30');
  });
  it('same year, cross-month → suffix MM-DD', () => {
    expect(formatDateRangeIso('2026-06-28', '2026-07-02')).toBe('2026-06-28~07-02');
  });
  it('cross-year → full ISO suffix', () => {
    expect(formatDateRangeIso('2025-12-30', '2026-01-02')).toBe('2025-12-30~2026-01-02');
  });
});

describe('toIsoDate', () => {
  it('formats local date with leading zeros', () => {
    // Construct via local-time components to avoid timezone drift in test env
    const d = new Date(2026, 0, 5); // 2026-01-05 local
    expect(toIsoDate(d)).toBe('2026-01-05');
  });
  it('end of year', () => {
    const d = new Date(2026, 11, 31);
    expect(toIsoDate(d)).toBe('2026-12-31');
  });
});
