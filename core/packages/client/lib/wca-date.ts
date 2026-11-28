// Web adapter over the runtime-neutral ISO date/range helpers shared with Mobile.
import { formatDateRangeIso, toLocalIsoDate } from '@cuberoot/shared/iso-date';

import { dateKey, timeKey, wallPartsIn } from '@cuberoot/shared/tz';

export { formatDateRangeIso };

export function toIsoDate(d: Date): string {
  return toLocalIsoDate(d);
}

// 比赛日期(start_date/end_date)存的是「比赛当地时区」的日历日。若用用户浏览器本地 today
// 分桶,领先时区正在进行的比赛会被误判:中国比赛在美洲看像「明天才开始」而落进「未来」。
// 已知中国大陆赛事使用北京时间，其余赛事按经度估算 UTC 偏移(≈ 经度/15 小时)。
// 经度缺失时回退用户本地日期(同旧行为)。
const chinaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', dateStyle: 'short' });

export function compLocalDate(nowMs: number, lon: number | null | undefined, country?: string): string {
  if (country?.toUpperCase() === 'CN') return chinaDate.format(nowMs);
  if (lon == null || !Number.isFinite(lon)) return toIsoDate(new Date(nowMs));
  const d = new Date(nowMs + Math.round((lon / 15) * 60) * 60_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Keep official date-only values as calendar dates. Convert timestamped fields at their own instant. */
export function formatCompDateTime(iso: string, zone: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const wall = wallPartsIn(zone, date);
  return `${dateKey(wall)} ${timeKey(wall)}`;
}

/** cubing.com publishes these deadlines as Beijing wall time without a UTC offset. */
export function formatCubingDeadline(raw: string, zone: string): string {
  return formatCompDateTime(raw.replace(' ', 'T') + '+08:00', zone);
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
