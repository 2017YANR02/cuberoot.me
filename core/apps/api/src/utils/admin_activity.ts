const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
export const ADMIN_ACTIVITY_MAX_DAYS = 366;

export class AdminActivityRangeError extends Error {}

function utcDateValue(value: string): number | null {
  if (!ISO_DATE_RE.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

function isoDateFromUtcTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export interface AdminActivityRange {
  from: string;
  to: string;
  days: number;
}

/** Resolve an inclusive UTC calendar-date range for administrator activity charts. */
export function resolveAdminActivityRange(
  rawFrom: string | undefined,
  rawTo: string | undefined,
  now = new Date(),
): AdminActivityRange {
  const today = now.toISOString().slice(0, 10);
  if (!rawFrom && !rawTo) {
    const toValue = Date.parse(`${today}T00:00:00.000Z`);
    return {
      from: isoDateFromUtcTimestamp(toValue - 29 * DAY_MS),
      to: today,
      days: 30,
    };
  }
  if (!rawFrom || !rawTo) {
    throw new AdminActivityRangeError('both from and to are required');
  }

  const fromValue = utcDateValue(rawFrom);
  const toValue = utcDateValue(rawTo);
  if (fromValue === null || toValue === null) {
    throw new AdminActivityRangeError('invalid activity date');
  }
  if (fromValue > toValue) {
    throw new AdminActivityRangeError('from must not be after to');
  }
  if (rawTo > today) {
    throw new AdminActivityRangeError('activity range cannot include future dates');
  }

  const days = Math.round((toValue - fromValue) / DAY_MS) + 1;
  if (days > ADMIN_ACTIVITY_MAX_DAYS) {
    throw new AdminActivityRangeError(`activity range cannot exceed ${ADMIN_ACTIVITY_MAX_DAYS} days`);
  }
  return { from: rawFrom, to: rawTo, days };
}
