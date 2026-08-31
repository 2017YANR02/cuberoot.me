const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const probe = new Date(0);
  probe.setUTCHours(0, 0, 0, 0);
  probe.setUTCFullYear(year, month - 1, day);
  return probe.getUTCFullYear() === year
    && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day;
}

/**
 * Format a date using the device's local calendar fields. Date-only values must
 * not travel through UTC because doing so can silently move them by one day.
 */
export function toLocalIsoDate(date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeIsoDate(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  const leadingDate = trimmed.slice(0, 10);
  if (isValidIsoDate(leadingDate)) return leadingDate;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? '' : toLocalIsoDate(parsed);
}

/** Compact ISO-only competition range: 2026-06-06~07 / ~07-02 / ~2027-01-02. */
export function formatDateRangeIso(startISO: string, endISO?: string | null): string {
  const end = endISO || startISO;
  if (startISO === end) return startISO;
  const [startYear, startMonth] = startISO.split('-');
  const [endYear, endMonth, endDay] = end.split('-');
  if (startYear === endYear && startMonth === endMonth) return `${startISO}~${endDay}`;
  if (startYear === endYear) return `${startISO}~${endMonth}-${endDay}`;
  return `${startISO}~${end}`;
}
