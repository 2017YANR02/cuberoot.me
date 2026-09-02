import { describe, expect, it } from 'vitest';
import {
  ADMIN_ACTIVITY_MAX_DAYS,
  AdminActivityRangeError,
  resolveAdminActivityRange,
} from '../src/utils/admin_activity.js';

const NOW = new Date('2026-09-02T18:00:00.000Z');

describe('administrator activity date range', () => {
  it('defaults to 30 inclusive UTC calendar days', () => {
    expect(resolveAdminActivityRange(undefined, undefined, NOW)).toEqual({
      from: '2026-08-04',
      to: '2026-09-02',
      days: 30,
    });
  });

  it('accepts a valid inclusive leap-day range', () => {
    expect(resolveAdminActivityRange('2024-02-28', '2024-03-01', NOW)).toEqual({
      from: '2024-02-28',
      to: '2024-03-01',
      days: 3,
    });
  });

  it.each([
    [undefined, '2026-09-02', 'both from and to are required'],
    ['2026-09-01', undefined, 'both from and to are required'],
    ['2026-02-30', '2026-09-02', 'invalid activity date'],
    ['2026-09-02', '2026-09-01', 'from must not be after to'],
    ['2026-09-01', '2026-09-03', 'activity range cannot include future dates'],
  ])('rejects invalid boundaries', (from, to, message) => {
    expect(() => resolveAdminActivityRange(from, to, NOW)).toThrow(message);
  });

  it('rejects a range longer than the chart contract', () => {
    expect(() => resolveAdminActivityRange('2025-09-01', '2026-09-02', NOW))
      .toThrow(new AdminActivityRangeError(`activity range cannot exceed ${ADMIN_ACTIVITY_MAX_DAYS} days`));
  });
});
