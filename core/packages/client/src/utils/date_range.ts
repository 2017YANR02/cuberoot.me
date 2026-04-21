// WCA 比赛日期的紧凑展示。全项目统一 yyyy-mm-dd ISO，不按语言切英文/中文月名。
// 跨天比赛避免重复年月：
//   同一天    → 2026-06-06
//   同年同月  → 2026-06-06~07
//   同年跨月  → 2026-06-28~07-02
//   跨年      → 2025-12-30~2026-01-02

export function formatDateRangeIso(startISO: string, endISO?: string | null): string {
  const end = endISO || startISO;
  if (startISO === end) return startISO;
  const [sy, sm] = startISO.split('-');
  const [ey, em, ed] = end.split('-');
  if (sy === ey && sm === em) return `${startISO}~${ed}`;
  if (sy === ey) return `${startISO}~${em}-${ed}`;
  return `${startISO}~${end}`;
}

/** Date → 'YYYY-MM-DD'（本地时区，非 UTC，避免跨时区日期偏移） */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
