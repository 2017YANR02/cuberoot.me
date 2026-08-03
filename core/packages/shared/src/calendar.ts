// /calendar 的跨端内核 —— 事件形状、ICS 进出、分享脱敏。前后端各自的边界代码都从这里取,
// 保证「客户端存进去的」「服务端发出去的」「ICS 里长的」是同一套语义。
//
// 时刻一律用绝对毫秒(epoch ms)传输,墙上时间靠 `tz` 字段还原 —— 事件自带时区是刚需:
// 同一场「北京时间周三 21:00 的会」在洛杉矶的人的日历上必须显示成周三 06:00,而且要能跟着
// 各自的夏令时走。全天事件的 start 是事件时区当日 0 点,end 是次日 0 点(半开区间,和 ICS 一致)。
//
// ICS 是对外的通用格式:导出的 .ics 能被 Google / Apple / Outlook 直接订阅或导入,所以这里
// 老老实实发 VTIMEZONE(只发 UTC 时刻会让重复事件在夏令时切换后整体错一小时)。

import {
  wallPartsIn, wallToUtc, zoneOffsetMinutes, nextTransition, isValidZone, zoneAbbrev,
  type WallParts,
} from './tz';
import { WEEKDAY_CODES, daysInMonth, weekdayOf } from './recur';

// ── 形状 ────────────────────────────────────────────────────────────────────

/** 日历(= Google 左栏「我的日历」里的一条),事件按颜色归组的容器。 */
export interface CalendarMeta {
  id: number;
  name: string;
  /** 调色板 key,见 CALENDAR_COLORS */
  color: string;
  /** 该日历的缺省时区 */
  tz: string;
  /** 主日历不可删 */
  isDefault: boolean;
  sortOrder: number;
}

export interface EventGuest {
  /** 归属键(真 wca_id 或 u<uid>) */
  key: string;
  name: string;
  avatar?: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface CalEvent {
  id: number;
  calendarId: number;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  /** 绝对时刻;全天 = 事件时区当日 0 点 */
  start: number;
  /** 绝对时刻,不含(exclusive) */
  end: number;
  tz: string;
  /** RRULE 正文,空串 = 不重复 */
  rrule: string;
  /** 已删除 / 已被单次覆盖的 occurrence 起点 */
  exdates: number[];
  /** 单次覆盖行:指向主事件 id;null = 主事件 */
  seriesId: number | null;
  /** 单次覆盖行替换的是哪一次 */
  occurrenceMs: number | null;
  /** 覆盖颜色,空串 = 跟随所在日历 */
  color: string;
  /** 提前多少分钟提醒,可多条;空数组 = 不提醒 */
  reminders: number[];
  guests: EventGuest[];
  /** 事件所有者的归属键(被邀请者看别人的事件时用来区分「我的 / 受邀的」) */
  ownerKey?: string;
  updatedAt: number;
}

/** 展开后的一次具体发生 —— 网格里画的是它,不是 CalEvent。 */
export interface EventOccurrence {
  /** `${event.id}:${start}`,拖拽 / 点击回查用 */
  key: string;
  event: CalEvent;
  start: number;
  end: number;
  /** 该事件是重复序列的一环 */
  recurring: boolean;
}

/** 编辑重复事件时的作用域(和 Google 的三选一一致)。 */
export type EditScope = 'this' | 'following' | 'all';

/** 分享页的信息量档位。busy 只留时间段,标题内容一律不出服务端。 */
export type ShareDetail = 'full' | 'busy';

export interface ShareSettings {
  enabled: boolean;
  token: string;
  detail: ShareDetail;
  title: string;
  /** 参与展示的日历 id;空数组 = 全部 */
  calendarIds: number[];
  tz: string;
}

/** 日历配色(Google 那套的近似;真正的色值在 client 的 calendar-colors.ts 里按主题 token 落地)。 */
export const CALENDAR_COLORS = [
  'peacock', 'blueberry', 'lavender', 'grape', 'flamingo',
  'tomato', 'tangerine', 'banana', 'sage', 'basil', 'graphite',
] as const;
export type CalendarColor = (typeof CALENDAR_COLORS)[number];

export function isCalendarColor(v: string): v is CalendarColor {
  return (CALENDAR_COLORS as readonly string[]).includes(v);
}

/** 提醒可选项(分钟),与 Google 的下拉一致。 */
export const REMINDER_CHOICES = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080] as const;

/**
 * 逗号分隔的数字串 → 数字数组(exdates / reminders / calendar_ids 三列共用这一种编码)。
 *
 * 必须**先滤空段再转数字**:`''.split(',')` 给的是 `['']`,而 `Number('')` 是 0 且
 * Number.isFinite(0) 为真 —— 少这一步,空 reminders 会变成「事件开始时提醒」把通知发给
 * 所有人,空 calendar_ids 会把「空 = 全部日历」读成「只有 id 0」让分享页整片空白。
 */
export function parseNumList(s: string | null | undefined): number[] {
  return (s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

// ── 分享脱敏 ────────────────────────────────────────────────────────────────

/** busy 档:只保留时间段与所属日历,标题换成占位、正文/地点/嘉宾全清。在**服务端**调用。 */
export function redactBusy(e: CalEvent): CalEvent {
  return {
    ...e,
    title: '',
    description: '',
    location: '',
    color: '',
    reminders: [],
    guests: [],
  };
}

// ── ICS 输出 ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** UTF-8 字节数(CJK 一字 3 字节);折行按字节算,不能按字符数。 */
function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** RFC 5545 的 75 octet 折行(续行以单空格开头)。 */
function fold(line: string): string {
  if (byteLen(line) <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const n = byteLen(ch);
    // 续行前缀占 1 字节,所以后续行的容量是 74。
    const cap = out.length === 0 ? 75 : 74;
    if (curBytes + n > cap) {
      out.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += n;
  }
  if (cur) out.push(cur);
  return out.map((s, i) => (i === 0 ? s : ` ${s}`)).join('\r\n');
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

/** 绝对时刻 → `20260801T013000Z` */
export function icsUtc(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** 墙上时间 → `20260801T093000`(带 TZID 时用) */
function icsLocal(p: WallParts): string {
  return `${pad(p.y, 4)}${pad(p.mo)}${pad(p.d)}T${pad(p.h)}${pad(p.mi)}${pad(p.s)}`;
}

/** 墙上日期 → `20260801`(全天用) */
function icsDate(p: WallParts): string {
  return `${pad(p.y, 4)}${pad(p.mo)}${pad(p.d)}`;
}

/** 绝对时刻 + 偏移(分钟)→ 该偏移下的墙上时间(秒归零)。VTIMEZONE 的 DTSTART 用。 */
function shiftedUtcParts(at: Date, offsetMin: number): WallParts {
  const d = new Date(at.getTime() + offsetMin * 60_000);
  return {
    y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), s: 0,
  };
}

function offsetToIcs(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

/**
 * 从 IANA tzdata 反推一个够用的 VTIMEZONE。
 *
 * 拿未来一年里的两次偏移切换(有夏令时的地方正好是入夏 / 出夏),把每次切换的墙上日期
 * 归纳成「几月第几个周几」再写成 RRULE=FREQ=YEARLY。这不是完整历史(历史规则改过好几轮),
 * 但订阅端只拿它解释未来的日程,足够;没有夏令时的地方只发一个 STANDARD 定偏移。
 */
export function vtimezoneFor(tz: string, ref: Date = new Date()): string[] {
  const lines = ['BEGIN:VTIMEZONE', `TZID:${tz}`];
  const t1 = nextTransition(tz, ref, 400);
  if (!t1) {
    const off = zoneOffsetMinutes(tz, ref);
    lines.push(
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      `TZOFFSETFROM:${offsetToIcs(off)}`,
      `TZOFFSETTO:${offsetToIcs(off)}`,
      'TZNAME:STD',
      'END:STANDARD',
      'END:VTIMEZONE',
    );
    return lines;
  }
  const t2 = nextTransition(tz, new Date(t1.at.getTime() + 86_400_000), 400);
  const parts: { at: Date; before: number; after: number }[] = t2 ? [t1, t2] : [t1];
  for (const t of parts) {
    // DTSTART 是切换那一瞬间**按切换前偏移**读出的墙上钟点(美东秋天回拨 = 02:00,
    // 不是 01:59)。别用 wallPartsIn(at − 1s):那读的是切换前最后一秒,整整差一分钟,
    // 落在 01:59–02:00 的日程会被订阅端解释错。
    const w = shiftedUtcParts(t.at, t.before);
    const daylight = t.after > t.before;
    const tag = daylight ? 'DAYLIGHT' : 'STANDARD';
    // 真缩写(EDT/EST)比 DST/STD 好看;没有真缩写的时区(Intl 回 "GMT+8")退回通用名。
    const abbrev = zoneAbbrev(tz, new Date(t.at.getTime() + 86_400_000));
    lines.push(
      `BEGIN:${tag}`,
      `DTSTART:${icsLocal(w)}`,
      `RRULE:${yearlyRuleFor(w)}`,
      `TZOFFSETFROM:${offsetToIcs(t.before)}`,
      `TZOFFSETTO:${offsetToIcs(t.after)}`,
      `TZNAME:${abbrev || (daylight ? 'DST' : 'STD')}`,
      `END:${tag}`,
    );
  }
  lines.push('END:VTIMEZONE');
  return lines;
}

/** 某个墙上日期 → 「几月第几个周几」的年重复规则(月末那周写成 -1)。 */
function yearlyRuleFor(w: WallParts): string {
  const wd = weekdayOf(w.y, w.mo, w.d);
  const nth = Math.floor((w.d - 1) / 7) + 1;
  const isLast = w.d + 7 > daysInMonth(w.y, w.mo);
  const code = WEEKDAY_CODES[wd];
  return `FREQ=YEARLY;BYMONTH=${w.mo};BYDAY=${isLast ? -1 : nth}${code}`;
}

export interface IcsExportOptions {
  /** 日历名(X-WR-CALNAME,订阅端拿它当标题) */
  name: string;
  /** 缺省时区(X-WR-TIMEZONE) */
  tz: string;
  events: CalEvent[];
  /** 事件所在日历名,用来写 CATEGORIES;缺了就不写 */
  calendarName?: (e: CalEvent) => string | undefined;
  /** busy 档:标题写「忙碌」,内容全清(调用方应已 redactBusy 过) */
  busyLabel?: string;
  /** 订阅刷新间隔提示 */
  refreshMinutes?: number;
}

/** 事件数组 → 完整 .ics 文本(CRLF 结尾,含 VTIMEZONE)。 */
export function eventsToIcs(opts: IcsExportOptions): string {
  const now = Date.now();
  const zones = new Set<string>();
  for (const e of opts.events) if (!e.allDay && isValidZone(e.tz)) zones.add(e.tz);
  if (isValidZone(opts.tz)) zones.add(opts.tz);

  const out: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CubeRoot//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(opts.name)}`,
    `X-WR-TIMEZONE:${opts.tz}`,
  ];
  if (opts.refreshMinutes) {
    out.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${opts.refreshMinutes}M`, `X-PUBLISHED-TTL:PT${opts.refreshMinutes}M`);
  }
  for (const tz of zones) out.push(...vtimezoneFor(tz));

  for (const e of opts.events) {
    const tz = isValidZone(e.tz) ? e.tz : opts.tz;
    const s = wallPartsIn(tz, new Date(e.start));
    const en = wallPartsIn(tz, new Date(e.end));
    out.push('BEGIN:VEVENT');
    out.push(`UID:cal-${e.id}@cuberoot.me`);
    out.push(`DTSTAMP:${icsUtc(e.updatedAt || now)}`);
    if (e.allDay) {
      out.push(`DTSTART;VALUE=DATE:${icsDate(s)}`);
      out.push(`DTEND;VALUE=DATE:${icsDate(en)}`);
    } else {
      out.push(`DTSTART;TZID=${tz}:${icsLocal(s)}`);
      out.push(`DTEND;TZID=${tz}:${icsLocal(en)}`);
    }
    out.push(`SUMMARY:${esc(e.title || opts.busyLabel || '')}`);
    if (e.description) out.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) out.push(`LOCATION:${esc(e.location)}`);
    if (opts.busyLabel && !e.title) out.push('X-MICROSOFT-CDO-BUSYSTATUS:BUSY', 'CLASS:PRIVATE');
    const cat = opts.calendarName?.(e);
    if (cat) out.push(`CATEGORIES:${esc(cat)}`);
    if (e.rrule) out.push(`RRULE:${e.rrule}`);
    if (e.exdates.length) {
      const list = e.exdates.map((ms) => (e.allDay
        ? icsDate(wallPartsIn(tz, new Date(ms)))
        : icsLocal(wallPartsIn(tz, new Date(ms)))));
      out.push(e.allDay ? `EXDATE;VALUE=DATE:${list.join(',')}` : `EXDATE;TZID=${tz}:${list.join(',')}`);
    }
    if (e.seriesId && e.occurrenceMs != null) {
      const r = wallPartsIn(tz, new Date(e.occurrenceMs));
      out.push(e.allDay
        ? `RECURRENCE-ID;VALUE=DATE:${icsDate(r)}`
        : `RECURRENCE-ID;TZID=${tz}:${icsLocal(r)}`);
    }
    for (const m of e.reminders) {
      out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title || opts.busyLabel || '')}`,
        `TRIGGER:-PT${m}M`, 'END:VALARM');
    }
    out.push('END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.map(fold).join('\r\n') + '\r\n';
}

// ── ICS 输入 ────────────────────────────────────────────────────────────────

export interface ParsedIcsEvent {
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: number;
  end: number;
  tz: string;
  rrule: string;
  exdates: number[];
  reminders: number[];
  /** 原文件里的 UID,用来把覆盖行认领回它的主事件。我们自己不存。 */
  uid: string;
}

/** 一次导入请求最多带多少条。客户端按它切批,服务端按它拒收 —— 同一个数,免得静默截断。 */
export const ICS_IMPORT_BATCH = 500;

function unescapeIcs(s: string): string {
  return s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** 展开折行:续行以空格 / TAB 开头,拼回上一行。 */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

interface IcsProp {
  name: string;
  params: Map<string, string>;
  value: string;
}

function parseProp(line: string): IcsProp | null {
  const colon = findValueColon(line);
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs = head.split(';');
  const params = new Map<string, string>();
  for (const seg of segs.slice(1)) {
    const eq = seg.indexOf('=');
    if (eq > 0) params.set(seg.slice(0, eq).toUpperCase(), seg.slice(eq + 1).replace(/^"|"$/g, ''));
  }
  return { name: segs[0].toUpperCase(), params, value };
}

/** 冒号可能出现在带引号的参数里(TZID="A:B"),取第一个不在引号内的。 */
function findValueColon(line: string): number {
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === ':' && !q) return i;
  }
  return -1;
}

/** `20260801T093000` / `...Z` / `20260801` → 绝对 ms + 是否整日。fallbackTz 用于无 TZID 的浮动时间。 */
function icsTimeToMs(value: string, params: Map<string, string>, fallbackTz: string): { ms: number; date: boolean } | null {
  const v = value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
  if (!m) return null;
  const p: WallParts = {
    y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]),
    h: m[4] ? Number(m[4]) : 0, mi: m[5] ? Number(m[5]) : 0, s: m[6] ? Number(m[6]) : 0,
  };
  const isDate = params.get('VALUE') === 'DATE' || !m[4];
  if (m[7]) return { ms: Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s), date: isDate };
  const tzid = params.get('TZID') || '';
  const tz = tzid && isValidZone(tzid) ? tzid : fallbackTz;
  return { ms: wallToUtc(tz, p).getTime(), date: isDate };
}

/** `-PT30M` / `-PT1H` / `-P1D` / `PT0S` → 提前分钟数;正向(事件之后)的忽略,返回 null。 */
function triggerToMinutes(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim().toUpperCase());
  if (!m) return null;
  const num = (s: string | undefined): number => (s ? Number(s) : 0);
  const mins = num(m[2]) * 10080 + num(m[3]) * 1440 + num(m[4]) * 60 + num(m[5]) + Math.round(num(m[6]) / 60);
  if (m[1] === '-') return mins;
  return mins === 0 ? 0 : null;
}

/**
 * 解析 .ics 文本里的 VEVENT。只取我们存得下的字段,认不出的整块跳过而不是整份报错 ——
 * 用户从别家导出的日历里带一堆 X- 扩展与 VTODO 是常态。
 */
export function parseIcs(text: string, fallbackTz: string): ParsedIcsEvent[] {
  const lines = unfold(text);
  const out: ParsedIcsEvent[] = [];
  /** 覆盖行(带 RECURRENCE-ID 的那种)先攒着,等整份读完再认领主事件。event 为 null = 那次被删了。 */
  const overrides: { at: number; uid: string; event: ParsedIcsEvent | null }[] = [];
  let cur: (Partial<ParsedIcsEvent> & {
    exdates: number[]; reminders: number[]; cancelled?: boolean; recurrenceId?: number;
  }) | null = null;
  let inAlarm = false;
  let depth = 0;

  for (const line of lines) {
    const prop = parseProp(line);
    if (!prop) continue;
    if (prop.name === 'BEGIN') {
      const kind = prop.value.trim().toUpperCase();
      if (kind === 'VEVENT') {
        cur = { exdates: [], reminders: [], allDay: false, tz: fallbackTz, rrule: '', title: '', description: '', location: '' };
        depth = 0;
      } else if (cur && kind === 'VALARM') inAlarm = true;
      else if (cur) depth++;
      continue;
    }
    if (prop.name === 'END') {
      const kind = prop.value.trim().toUpperCase();
      if (kind === 'VALARM') { inAlarm = false; continue; }
      if (kind === 'VEVENT') {
        // STATUS:CANCELLED 是「这条已经取消」的墓碑,Google 导出里混着一堆。收进来就成了
        // 一堆本该消失的日程。带 RECURRENCE-ID 的取消例外 —— 那是「删掉这一次」,
        // 它得变成主事件上的 EXDATE,直接扔掉的话那一次会照常冒出来。
        if (cur && cur.start != null && cur.cancelled && cur.recurrenceId != null) {
          overrides.push({ at: cur.recurrenceId, uid: cur.uid || '', event: null });
        } else if (cur && cur.start != null && !cur.cancelled) {
          const start = cur.start;
          const end = cur.end != null && cur.end > start
            ? cur.end
            : start + (cur.allDay ? 86_400_000 : 3_600_000);
          const ev: ParsedIcsEvent = {
            title: cur.title || '',
            description: cur.description || '',
            location: cur.location || '',
            allDay: !!cur.allDay,
            start,
            end,
            tz: cur.tz || fallbackTz,
            rrule: cur.rrule || '',
            exdates: cur.exdates,
            reminders: [...new Set(cur.reminders)].sort((a, b) => a - b).slice(0, 5),
            uid: cur.uid || '',
          };
          if (cur.recurrenceId != null) overrides.push({ at: cur.recurrenceId, uid: ev.uid, event: ev });
          else out.push(ev);
        }
        cur = null;
        continue;
      }
      if (depth > 0) depth--;
      continue;
    }
    if (!cur) continue;
    if (inAlarm) {
      if (prop.name === 'TRIGGER') {
        const m = triggerToMinutes(prop.value);
        if (m != null) cur.reminders.push(m);
      }
      continue;
    }
    if (depth > 0) continue;

    switch (prop.name) {
      case 'UID': cur.uid = prop.value.trim(); break;
      case 'STATUS': cur.cancelled = prop.value.trim().toUpperCase() === 'CANCELLED'; break;
      // RANGE=THISANDFUTURE(「这一次及以后」)按单次覆盖处理:那一次改对了,后面几次保持原样。
      // Google 改「以后所有」时是拆成新 UID 另起一条序列,不走这个参数,所以对导入 Google
      // 的场景没影响;Apple / Outlook 的文件会在这里少改几次。
      case 'RECURRENCE-ID': {
        const t = icsTimeToMs(prop.value, prop.params, cur.tz || fallbackTz);
        if (t) cur.recurrenceId = t.ms;
        break;
      }
      case 'SUMMARY': cur.title = unescapeIcs(prop.value).slice(0, 300); break;
      case 'DESCRIPTION': cur.description = unescapeIcs(prop.value).slice(0, 5000); break;
      case 'LOCATION': cur.location = unescapeIcs(prop.value).slice(0, 300); break;
      case 'RRULE': cur.rrule = prop.value.trim().toUpperCase(); break;
      case 'DTSTART': {
        const t = icsTimeToMs(prop.value, prop.params, fallbackTz);
        if (t) {
          cur.start = t.ms;
          cur.allDay = t.date;
          const tzid = prop.params.get('TZID');
          if (tzid && isValidZone(tzid)) cur.tz = tzid;
        }
        break;
      }
      case 'DTEND': {
        const t = icsTimeToMs(prop.value, prop.params, cur.tz || fallbackTz);
        if (t) cur.end = t.ms;
        break;
      }
      case 'DURATION': {
        const mins = triggerToMinutes(prop.value.replace(/^-/, ''));
        if (mins != null && cur.start != null) cur.end = cur.start + mins * 60_000;
        break;
      }
      case 'EXDATE': {
        for (const v of prop.value.split(',')) {
          const t = icsTimeToMs(v, prop.params, cur.tz || fallbackTz);
          if (t) cur.exdates.push(t.ms);
        }
        break;
      }
      default: break;
    }
  }

  // 覆盖行归位。ICS 里「改了/删了重复日程的某一次」是另起一条 VEVENT + RECURRENCE-ID 指认
  // 是哪一次,主事件那边并不写 EXDATE。照单全收的话那一次会出现两遍(主事件按 RRULE 排一次,
  // 覆盖行自己再排一次),所以这里替主事件把它 EXDATE 掉,改动过的那条留成独立日程。
  const masters = new Map<string, ParsedIcsEvent>();
  for (const e of out) if (e.uid && e.rrule) masters.set(e.uid, e);
  for (const o of overrides) {
    const master = masters.get(o.uid);
    if (master) master.exdates.push(o.at);
    // 认不出主事件(只导出了片段)时,删除标记无处安放,只能丢掉;改动过的那条照收。
    if (o.event) out.push({ ...o.event, rrule: '' });
  }
  for (const e of out) if (e.exdates.length) e.exdates = [...new Set(e.exdates)].sort((a, b) => a - b);

  return out;
}

/** 取 X-WR-CALNAME —— 导出方给这份日历起的名字,导入时拿它当目标日历名。 */
export function icsCalendarName(text: string): string {
  for (const line of unfold(text)) {
    const prop = parseProp(line);
    if (prop?.name === 'X-WR-CALNAME') return unescapeIcs(prop.value).trim().slice(0, 60);
    // 名字在头部;真进了 VEVENT 就别再往下翻整份文件了。
    if (prop?.name === 'BEGIN' && prop.value.trim().toUpperCase() === 'VEVENT') break;
  }
  return '';
}
