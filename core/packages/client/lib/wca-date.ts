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

/** ISO 时间戳 → 本地时区 'YYYY-MM-DD HH:MM'(报名起止等需要时分的场合,不带秒);非法输入返回 ''。 */
export function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${toIsoDate(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** ISO 日期(区间)的星期标签:单日 '周日'/'Sun',跨日 '周六~日'/'Sat~Sun'。非法输入返回 ''。 */
export function weekdayRangeLabel(startISO: string, endISO: string | null | undefined, isZh: boolean): string {
  const parse = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
  const s = parse(startISO);
  if (Number.isNaN(s.getTime())) return '';
  const sd = s.getDay();
  const single = isZh ? `周${WEEKDAY_ZH[sd]}` : WEEKDAY_EN[sd]!;
  if (!endISO || endISO.slice(0, 10) === startISO.slice(0, 10)) return single;
  const e = parse(endISO);
  if (Number.isNaN(e.getTime())) return single;
  const ed = e.getDay();
  return isZh ? `周${WEEKDAY_ZH[sd]}~${WEEKDAY_ZH[ed]}` : `${WEEKDAY_EN[sd]}~${WEEKDAY_EN[ed]}`;
}
