// Ported from packages/client-vite/src/utils/date_range.ts.

export function formatDateRangeIso(startISO: string, endISO?: string | null): string {
  const end = endISO || startISO;
  if (startISO === end) return startISO;
  const [sy, sm] = startISO.split('-');
  const [ey, em, ed] = end.split('-');
  if (sy === ey && sm === em) return `${startISO}~${ed}`;
  if (sy === ey) return `${startISO}~${em}-${ed}`;
  return `${startISO}~${end}`;
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
