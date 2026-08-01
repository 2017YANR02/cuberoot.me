// 重复事件 —— RFC 5545 RRULE 的子集,前后端共用(客户端渲染网格、服务端扫提醒 / 出 ICS)。
//
// 只实现 Google 日历「自定义重复」界面能表达的那些:FREQ / INTERVAL / BYDAY / BYMONTHDAY /
// COUNT / UNTIL。剩下的(BYSETPOS 组合、BYYEARDAY、BYWEEKNO…)界面里根本给不出,解析时忽略,
// 免得写一堆没人能触发的分支。不引 rrule.js:那包连带 luxon 一百多 KB,而这里真正难的不是
// 语法而是「跨夏令时要不要保持墙上时间」,那部分谁家的库都替不了我们决定。
//
// 关键约定:重复按**墙上时间**推进,不是按毫秒加 86400000。每周三 9:00 的会,夏令时切换之后
// 仍然是本地 9:00(Google / Apple / Outlook 全都这样);所以先在日历日上走步,再逐个用
// wallToUtc 折算成绝对时刻。DST 那天不存在的墙上时间由 wallToUtc 兜底(顺延到切换后的等价点)。
//
// 回归测试见 client/tests/calendar_recur.test.ts。

import { wallToUtc, wallPartsIn, type WallParts } from './tz';

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** RFC 5545 的星期码,索引即 JS getUTCDay()(周日 = 0)。 */
export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

/** BYDAY 的一项:`WE` = 每个周三;`2WE` = 每月第 2 个周三;`-1FR` = 每月最后一个周五。 */
export interface ByDay {
  /** 0=周日 … 6=周六 */
  weekday: number;
  /** 第几个(1..5 / -1..-5);0 = 不限第几个 */
  nth: number;
}

export interface RRule {
  freq: Freq;
  /** ≥ 1 */
  interval: number;
  byDay: ByDay[];
  /** 1..31,或负数(-1 = 当月最后一天) */
  byMonthDay: number[];
  /** 总共发生几次(含首次);0 = 不限 */
  count: number;
  /** 最后一次的绝对时刻上界(含);0 = 不限 */
  until: number;
}

const DAY_MS = 86_400_000;

/** 展开时的兜底闸:任何一次调用最多吐这么多次occurrence,防坏规则打死浏览器。 */
const MAX_OCCURRENCES = 2000;
/** 连续这么多个候选周期都落空就收工(如「每月 31 号」连撞小月)。 */
const MAX_EMPTY_STREAK = 400;

// ── 纯日历日算术(与时区无关,一律走 UTC 字段)──────────────────────────────

/** 年月日 → 距 1970-01-01 的天数。 */
export function toDayNumber(y: number, mo: number, d: number): number {
  return Math.round(Date.UTC(y, mo - 1, d) / DAY_MS);
}

/** 天数 → 年月日。 */
export function fromDayNumber(n: number): { y: number; mo: number; d: number } {
  const dt = new Date(n * DAY_MS);
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** 该日历日是周几(0=周日)。 */
export function weekdayOf(y: number, mo: number, d: number): number {
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/** 该月有多少天。 */
export function daysInMonth(y: number, mo: number): number {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

// ── 解析 / 序列化 ───────────────────────────────────────────────────────────

function parseByDay(v: string): ByDay[] {
  const out: ByDay[] = [];
  for (const raw of v.split(',')) {
    const m = /^([+-]?\d)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(raw.trim().toUpperCase());
    if (!m) continue;
    out.push({ weekday: WEEKDAY_CODES.indexOf(m[2] as WeekdayCode), nth: m[1] ? Number(m[1]) : 0 });
  }
  return out;
}

function formatByDay(items: ByDay[]): string {
  return items.map((b) => `${b.nth ? b.nth : ''}${WEEKDAY_CODES[b.weekday]}`).join(',');
}

/** `20260815T013000Z` / `20260815`(全天 UNTIL)→ epoch ms;认不出返回 0。 */
function parseUntil(v: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(v.trim());
  if (!m) return 0;
  const n = (s: string | undefined): number => (s ? Number(s) : 0);
  return Date.UTC(n(m[1]), n(m[2]) - 1, n(m[3]), n(m[4]), n(m[5]), n(m[6]));
}

/** epoch ms → `20260815T013000Z`。 */
export function formatUntil(ms: number): string {
  const d = new Date(ms);
  const p = (x: number, w = 2): string => String(x).padStart(w, '0');
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`
    + `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/**
 * 解析 RRULE 正文(不带 `RRULE:` 前缀也认)。FREQ 缺失 / 不认识 → null,调用方按「不重复」处理。
 * COUNT 与 UNTIL 同时出现时以 COUNT 为准(RFC 说二者互斥,遇到脏数据取更保守的那个)。
 */
export function parseRRule(input: string): RRule | null {
  const text = (input || '').trim().replace(/^RRULE:/i, '');
  if (!text) return null;
  const parts = new Map<string, string>();
  for (const seg of text.split(';')) {
    const i = seg.indexOf('=');
    if (i > 0) parts.set(seg.slice(0, i).trim().toUpperCase(), seg.slice(i + 1).trim());
  }
  const freq = (parts.get('FREQ') || '').toUpperCase();
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;

  const interval = Math.max(1, Math.min(999, Number(parts.get('INTERVAL') || 1) || 1));
  const byDay = parseByDay(parts.get('BYDAY') || '');
  const byMonthDay = (parts.get('BYMONTHDAY') || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n !== 0 && n >= -31 && n <= 31);
  const count = Math.max(0, Math.min(MAX_OCCURRENCES, Number(parts.get('COUNT') || 0) || 0));
  const until = count > 0 ? 0 : parseUntil(parts.get('UNTIL') || '');
  return { freq, interval, byDay, byMonthDay, count, until };
}

export function formatRRule(r: RRule): string {
  const out = [`FREQ=${r.freq}`];
  if (r.interval > 1) out.push(`INTERVAL=${r.interval}`);
  if (r.byDay.length) out.push(`BYDAY=${formatByDay(r.byDay)}`);
  if (r.byMonthDay.length) out.push(`BYMONTHDAY=${r.byMonthDay.join(',')}`);
  if (r.count > 0) out.push(`COUNT=${r.count}`);
  else if (r.until > 0) out.push(`UNTIL=${formatUntil(r.until)}`);
  return out.join(';');
}

// ── 展开 ────────────────────────────────────────────────────────────────────

export interface ExpandOptions {
  /** 规则正文;空串 / 认不出 = 单次事件 */
  rrule: string;
  /** 首次发生的绝对时刻 */
  start: number;
  /** 墙上时间锚定的时区 */
  tz: string;
  /** 被单独删掉 / 被单次覆盖的 occurrence 起点(绝对 ms),精确匹配 */
  exdates?: number[];
  /** 只要与 [from, to) 有交集的 occurrence;传 0 表示不设下界 */
  from: number;
  to: number;
  /** 事件时长 ms,用来判断「跨过 from 的长事件」也算命中 */
  durationMs?: number;
  /** 上限,默认 MAX_OCCURRENCES */
  limit?: number;
}

/**
 * 展开出落在窗口内的 occurrence 起点(绝对 ms,升序)。
 *
 * COUNT 按「从首次开始数」计,窗口过滤不影响计数 —— 否则往后翻页会凭空多出几次。
 * 每个候选墙上日期都用事件自己的时区折算,所以跨 DST 依然保持本地钟点。
 */
export function expandOccurrences(opts: ExpandOptions): number[] {
  const { start, tz, from, to } = opts;
  const limit = Math.max(1, Math.min(MAX_OCCURRENCES, opts.limit ?? MAX_OCCURRENCES));
  const dur = Math.max(0, opts.durationMs ?? 0);
  const ex = new Set(opts.exdates ?? []);
  const hits: number[] = [];

  const push = (ms: number): void => {
    if (ex.has(ms)) return;
    if (ms + dur > from && ms < to) hits.push(ms);
  };

  const rule = parseRRule(opts.rrule);
  if (!rule) {
    push(start);
    return hits;
  }

  // 首次的墙上时间就是整条序列的钟点锚:后续所有 occurrence 都用它的 h/mi/s。
  const anchor: WallParts = wallPartsIn(tz, new Date(start));
  const timeOf = (y: number, mo: number, d: number): number =>
    wallToUtc(tz, { y, mo, d, h: anchor.h, mi: anchor.mi, s: anchor.s }).getTime();

  const dayTime = (day: number): number => {
    const { y, mo, d } = fromDayNumber(day);
    return timeOf(y, mo, d);
  };

  // 只要没有 COUNT,就可以直接跳到窗口附近开工:否则「2015 年起每天」翻到今天要空转三千轮
  // Intl 折算。有 COUNT 时必须从首次一个个数,不能跳。留一个事件时长的余量,免得漏掉跨过
  // 窗口左沿的长事件。
  const canSkip = rule.count === 0 && from > start;
  const fromWall = wallPartsIn(tz, new Date(Math.max(0, from - dur)));
  const fromDay = toDayNumber(fromWall.y, fromWall.mo, fromWall.d);

  const stopAt = rule.until > 0 ? rule.until : Infinity;
  let emitted = 0;
  let empty = 0;

  /** 一个候选日历日 → 收进结果;返回 false 表示整条序列到头了。 */
  const consider = (y: number, mo: number, d: number): boolean => {
    const ms = timeOf(y, mo, d);
    if (ms < start) return true;           // 周期内早于首次的那些天(如首周里 BYDAY 更早的一天)
    if (ms > stopAt) return false;
    emitted++;
    push(ms);
    if (rule.count > 0 && emitted >= rule.count) return false;
    return hits.length < limit && ms < to;
  };

  if (rule.freq === 'DAILY') {
    const anchorDay = toDayNumber(anchor.y, anchor.mo, anchor.d);
    let day = anchorDay;
    if (canSkip && fromDay > anchorDay) {
      day += Math.floor((fromDay - anchorDay) / rule.interval) * rule.interval;
    }
    for (;;) {
      const { y, mo, d } = fromDayNumber(day);
      if (!consider(y, mo, d)) break;
      day += rule.interval;
      if (dayTime(day) >= to) break;
    }
    return hits;
  }

  if (rule.freq === 'WEEKLY') {
    // 没写 BYDAY 就按首次那天的星期;写了就一周内按星期升序发。
    const days = (rule.byDay.length ? rule.byDay.map((b) => b.weekday) : [weekdayOf(anchor.y, anchor.mo, anchor.d)])
      .filter((w, i, a) => a.indexOf(w) === i)
      .sort((a, b) => a - b);
    // 以首次所在周的周日为基准往后跳,保证 INTERVAL>1 时的「隔周」相位稳定。
    const startDay = toDayNumber(anchor.y, anchor.mo, anchor.d);
    let weekStart = startDay - weekdayOf(anchor.y, anchor.mo, anchor.d);
    if (canSkip && fromDay > weekStart) {
      weekStart += Math.floor((fromDay - weekStart) / (7 * rule.interval)) * 7 * rule.interval;
    }
    for (;;) {
      let any = false;
      for (const w of days) {
        const { y, mo, d } = fromDayNumber(weekStart + w);
        const before = hits.length;
        if (!consider(y, mo, d)) return hits;
        if (hits.length > before) any = true;
      }
      empty = any ? 0 : empty + 1;
      if (empty > MAX_EMPTY_STREAK) break;
      weekStart += 7 * rule.interval;
      if (dayTime(weekStart) >= to) break;
    }
    return hits;
  }

  // MONTHLY / YEARLY 共用「按月推进 + 在月内挑日子」,YEARLY 只是步长 12 个月。
  const monthStep = rule.freq === 'YEARLY' ? 12 * rule.interval : rule.interval;
  let ym = anchor.y * 12 + (anchor.mo - 1);
  if (canSkip) {
    const fromYm = fromWall.y * 12 + (fromWall.mo - 1);
    if (fromYm > ym) ym += Math.floor((fromYm - ym) / monthStep) * monthStep;
  }
  for (;;) {
    const y = Math.floor(ym / 12);
    const mo = (ym % 12) + 1;
    const dim = daysInMonth(y, mo);
    const picks: number[] = [];

    if (rule.byDay.some((b) => b.nth !== 0)) {
      // 「每月第 N 个周几」——第 5 个 / 倒数第 1 个都在这条路径里。
      for (const b of rule.byDay) {
        const first = weekdayOf(y, mo, 1);
        if (b.nth > 0) {
          const d = 1 + ((b.weekday - first + 7) % 7) + (b.nth - 1) * 7;
          if (d <= dim) picks.push(d);
        } else {
          const lastWd = weekdayOf(y, mo, dim);
          const d = dim - ((lastWd - b.weekday + 7) % 7) + (b.nth + 1) * 7;
          if (d >= 1) picks.push(d);
        }
      }
    } else if (rule.byMonthDay.length) {
      for (const md of rule.byMonthDay) {
        const d = md > 0 ? md : dim + md + 1;
        if (d >= 1 && d <= dim) picks.push(d);
      }
    } else if (rule.byDay.length) {
      // MONTHLY + 无序号 BYDAY(如「每月的每个周一」),RFC 认,界面给不出,照实展开。
      for (let d = 1; d <= dim; d++) if (rule.byDay.some((b) => b.weekday === weekdayOf(y, mo, d))) picks.push(d);
    } else {
      // 缺省:与首次同一号数。小月没这天就跳过整月(和 Google「每月 31 号」一致)。
      if (anchor.d <= dim) picks.push(anchor.d);
    }

    picks.sort((a, b) => a - b);
    let any = false;
    for (const d of picks) {
      const before = hits.length;
      if (!consider(y, mo, d)) return hits;
      if (hits.length > before) any = true;
    }
    empty = any ? 0 : empty + 1;
    if (empty > MAX_EMPTY_STREAK) break;
    ym += monthStep;
    if (timeOf(Math.floor(ym / 12), (ym % 12) + 1, 1) >= to) break;
  }
  return hits;
}

/**
 * 序列的最后一次(没有上界则返回 0)—— 分享页与提醒扫描要知道「这条还活着吗」。
 */
export function seriesEnd(rrule: string, start: number, tz: string, durationMs: number): number {
  const rule = parseRRule(rrule);
  if (!rule) return start + durationMs;
  if (rule.count <= 0 && rule.until <= 0) return 0;
  const all = expandOccurrences({
    rrule, start, tz, from: 0, to: Number.MAX_SAFE_INTEGER, durationMs, limit: MAX_OCCURRENCES,
  });
  return all.length ? all[all.length - 1] + durationMs : start + durationMs;
}
