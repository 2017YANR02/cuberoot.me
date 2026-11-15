/** Weekly planned availability, separate from private events and reported working hours. */
import { wallPartsIn, wallToUtc } from './tz';

export interface WorkSlot { weekday: number; startHour: number; endHour: number }
export interface WorkPeriod { id: string; userId: number; from: string; until: string | null; tz: string; slots: WorkSlot[] }
export interface WorkException { periodId: string; date: string; slots: WorkSlot[] }
export interface WorkCalendarMember { userId: number; name: string; version: number }
export interface WorkCalendarData { me: number; members: WorkCalendarMember[]; periods: WorkPeriod[]; exceptions: WorkException[] }
export interface WorkOccurrence { id: string; userId: number; periodId: string; date: string; startHour: number; endHour: number; start: number; end: number; adjusted: boolean }
export const WORK_CALENDAR_DEFAULT_ZONE = 'Asia/Shanghai';
export const WORK_CALENDAR_COLORS = ['peacock', 'tomato', 'basil', 'grape', 'tangerine', 'blueberry', 'banana', 'sage', 'flamingo', 'graphite', 'lavender'] as const;
export function workCalendarColor(userId: number): string { return WORK_CALENDAR_COLORS[(userId - 1) % WORK_CALENDAR_COLORS.length]; }
export function workDate(tz: string, ms: number): string {
  const w = wallPartsIn(tz, new Date(ms));
  return `${w.y}-${String(w.mo).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}
export function shiftWorkDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function workInstant(tz: string, date: string, hour: number): number {
  const key = hour === 24 ? shiftWorkDate(date, 1) : date;
  const [y, mo, d] = key.split('-').map(Number);
  return wallToUtc(tz, { y, mo, d, h: hour % 24, mi: 0, s: 0 }).getTime();
}
export function workSlotsValid(slots: readonly WorkSlot[]): boolean {
  return slots.every((a, i) => Number.isInteger(a.weekday) && a.weekday >= 0 && a.weekday <= 6
    && Number.isInteger(a.startHour) && Number.isInteger(a.endHour) && a.startHour >= 0 && a.endHour <= 24 && a.startHour < a.endHour
    && slots.every((b, j) => i === j || a.weekday !== b.weekday || a.endHour <= b.startHour || b.endHour <= a.startHour));
}
export function activeWorkPeriod(periods: readonly WorkPeriod[], userId: number, date: string): WorkPeriod | undefined {
  return periods.find(p => p.userId === userId && p.from <= date && (!p.until || date < p.until));
}
/** Expand only the visible window; both endpoints use wall time, including DST and midnight. */
export function expandWorkCalendar(data: Pick<WorkCalendarData, 'periods' | 'exceptions'>, from: number, to: number): WorkOccurrence[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 64 * 86400000) return [];
  const exceptions = new Map(data.exceptions.map(e => [`${e.periodId}:${e.date}`, e]));
  const out: WorkOccurrence[] = [];
  for (const p of data.periods) {
    let date = workDate(p.tz, from - 86400000);
    const last = workDate(p.tz, to);
    for (; date <= last; date = shiftWorkDate(date, 1)) {
      if (date < p.from || p.until && date >= p.until) continue;
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const exception = exceptions.get(`${p.id}:${date}`);
      const slots = exception ? exception.slots : p.slots.filter(s => s.weekday === weekday);
      slots.forEach((slot, index) => {
        const start = workInstant(p.tz, date, slot.startHour), end = workInstant(p.tz, date, slot.endHour);
        if (end > from && start < to && end > start) out.push({ id: `${p.id}:${date}:${index}`, userId: p.userId, periodId: p.id, date, startHour: slot.startHour, endHour: slot.endHour, start, end, adjusted: !!exception });
      });
    }
  }
  return out.sort((a, b) => a.start - b.start || a.userId - b.userId);
}
