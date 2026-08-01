// /calendar 的呈现层小工具:视图定义、标题文案、时间格式化、事件 ↔ FullCalendar 的换算。
// 纯函数,不碰 store,方便页面与分享页共用。

import { wallPartsIn, wallToUtc } from '@cuberoot/shared/tz';
import type { CalEvent, EventOccurrence } from '@cuberoot/shared/calendar';

export const VIEW_KEYS = ['timeGridDay', 'fourDay', 'timeGridWeek', 'dayGridMonth', 'multiMonthYear', 'listMonth'] as const;
export type ViewKey = (typeof VIEW_KEYS)[number];

export function isViewKey(v: string): v is ViewKey {
  return (VIEW_KEYS as readonly string[]).includes(v);
}

export const VIEW_LABELS: Record<ViewKey, { zh: string; en: string; hint: string }> = {
  timeGridDay: { zh: '日', en: 'Day', hint: 'D' },
  fourDay: { zh: '4 天', en: '4 days', hint: 'X' },
  timeGridWeek: { zh: '周', en: 'Week', hint: 'W' },
  dayGridMonth: { zh: '月', en: 'Month', hint: 'M' },
  multiMonthYear: { zh: '年', en: 'Year', hint: 'Y' },
  listMonth: { zh: '日程', en: 'Schedule', hint: 'A' },
};

const DAY = 86_400_000;

/** `YYYY-MM-DD`(按给定时区取那一刻所在的日历日)。 */
export function dayKeyIn(tz: string, ms: number): string {
  const w = wallPartsIn(tz, new Date(ms));
  return `${w.y}-${String(w.mo).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` + 时区 → 那天 0 点的绝对时刻。 */
export function dayStart(tz: string, key: string): number {
  const [y, mo, d] = key.split('-').map(Number);
  return wallToUtc(tz, { y, mo, d, h: 0, mi: 0, s: 0 }).getTime();
}

/** 日期串加减天数(纯日历日运算,与时区无关)。 */
export function addDaysToKey(key: string, days: number): string {
  const [y, mo, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d) + days * DAY);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** `HH:mm` / `h:mm AM`,按用户的 24 小时制偏好。 */
export function formatClock(ms: number, tz: string, hour24: boolean, isZh: boolean): string {
  return new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
    timeZone: tz, hour: hour24 ? '2-digit' : 'numeric', minute: '2-digit', hourCycle: hour24 ? 'h23' : 'h12',
  }).format(new Date(ms));
}

/** 「8月2日 周日」/「Sunday, August 2」 */
export function formatLongDate(ms: number, tz: string, isZh: boolean): string {
  return new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
    timeZone: tz, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }).format(new Date(ms));
}

/** 顶部标题:随视图变(月视图给「2026年8月」,周视图给起止范围)。 */
export function rangeTitle(view: ViewKey, anchor: number, tz: string, isZh: boolean, rangeStart: number, rangeEnd: number): string {
  const fmt = (opts: Intl.DateTimeFormatOptions, at: number): string =>
    new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', { timeZone: tz, ...opts }).format(new Date(at));

  if (view === 'multiMonthYear') return fmt({ year: 'numeric' }, anchor);
  if (view === 'dayGridMonth' || view === 'listMonth') return fmt({ year: 'numeric', month: 'long' }, anchor);
  if (view === 'timeGridDay') return fmt({ year: 'numeric', month: 'long', day: 'numeric' }, anchor);

  // 周 / 4 天:同月只写一次月份,跨月 / 跨年才两头都写。
  const a = wallPartsIn(tz, new Date(rangeStart));
  const b = wallPartsIn(tz, new Date(rangeEnd - 1));
  if (a.y === b.y && a.mo === b.mo) {
    return isZh
      ? `${a.y}年${a.mo}月${a.d}–${b.d}日`
      : `${fmt({ month: 'long', day: 'numeric' }, rangeStart)} – ${b.d}, ${a.y}`;
  }
  if (a.y === b.y) {
    return isZh
      ? `${a.y}年${a.mo}月${a.d}日 – ${b.mo}月${b.d}日`
      : `${fmt({ month: 'short', day: 'numeric' }, rangeStart)} – ${fmt({ month: 'short', day: 'numeric' }, rangeEnd - 1)}, ${a.y}`;
  }
  return `${fmt({ year: 'numeric', month: 'short', day: 'numeric' }, rangeStart)} – ${fmt({ year: 'numeric', month: 'short', day: 'numeric' }, rangeEnd - 1)}`;
}

export interface FcEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  editable: boolean;
  extendedProps: {
    eventId: number;
    occurrence: number;
    recurring: boolean;
    calendarId: number;
    location: string;
    invited: boolean;
    rsvp: string;
    busy: boolean;
  };
}

export interface ToFcOptions {
  /** 展开后的块 */
  occurrences: EventOccurrence[];
  /** 日历 id → 颜色 hex */
  calendarColor: (id: number) => string;
  colorHex: (key: string) => string;
  readableInk: (hex: string) => string;
  /** 我的归属键(用于标出「别人邀请我的」) */
  meKey: string;
  /** 只读模式(分享页) */
  readOnly?: boolean;
  /** busy 档:标题被服务端抹掉了,这里给一个占位文案 */
  busyLabel?: string;
}

/** 展开块 → FullCalendar 事件对象。全天事件用日期串,定时事件用带偏移的 ISO。 */
export function toFcEvents(opts: ToFcOptions): FcEvent[] {
  return opts.occurrences.map((o) => {
    const e = o.event;
    const hex = e.color ? opts.colorHex(e.color) : opts.calendarColor(e.calendarId);
    const mine = e.guests.find((g) => g.key === opts.meKey);
    const invited = !!e.ownerKey && !!opts.meKey && e.ownerKey !== opts.meKey;
    const busy = !e.title && !!opts.busyLabel;
    return {
      id: o.key,
      title: e.title || opts.busyLabel || '',
      // 全天块要交日期串:交时刻的话 FullCalendar 会按显示时区再折一次,东八区的
      // 「8 月 5 日全天」在 UTC 视图下会滑到 4 号。
      start: e.allDay ? dayKeyIn(e.tz, o.start) : new Date(o.start).toISOString(),
      end: e.allDay ? dayKeyIn(e.tz, o.end) : new Date(o.end).toISOString(),
      allDay: e.allDay,
      backgroundColor: hex,
      borderColor: hex,
      textColor: opts.readableInk(hex),
      editable: !opts.readOnly && !invited,
      extendedProps: {
        eventId: e.id,
        occurrence: o.start,
        recurring: o.recurring,
        calendarId: e.calendarId,
        location: e.location,
        invited,
        rsvp: mine?.status ?? '',
        busy,
      },
    };
  });
}

/** 事件时长(ms);全天事件按整日算。 */
export function durationOf(e: CalEvent): number {
  return Math.max(0, e.end - e.start);
}

/** 「1 小时」「30 分钟」「全天」 */
export function formatDuration(msLen: number, allDay: boolean, isZh: boolean): string {
  if (allDay) {
    const days = Math.max(1, Math.round(msLen / DAY));
    return isZh ? (days === 1 ? '全天' : `${days} 天`) : (days === 1 ? 'All day' : `${days} days`);
  }
  const mins = Math.round(msLen / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return isZh ? `${h} 小时 ${m} 分` : `${h}h ${m}m`;
  if (h) return isZh ? `${h} 小时` : `${h}h`;
  return isZh ? `${m} 分钟` : `${m} min`;
}
