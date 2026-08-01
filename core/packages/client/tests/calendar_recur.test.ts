// 重复事件展开 + ICS 进出的回归(@cuberoot/shared 的 recur / calendar)。
//
// 期望值全部按 IANA tzdata 手算锁死:改展开算法就得主动改这里,当 review 信号。
// 最要紧的两条不变量:
//   1. 跨夏令时保持**墙上钟点**(每周三 9:00 换季后还是 9:00,绝对时刻差一小时);
//   2. COUNT 从首次开始数,与查询窗口无关(往后翻页不会凭空多出几次)。

import { describe, expect, it } from 'vitest';
import {
  expandOccurrences, formatRRule, parseRRule, seriesEnd,
} from '@cuberoot/shared/recur';
import {
  eventsToIcs, parseIcs, parseNumList, redactBusy, vtimezoneFor, type CalEvent,
} from '@cuberoot/shared/calendar';
import { wallToUtc, wallPartsIn } from '@cuberoot/shared/tz';

const NY = 'America/New_York';
const SH = 'Asia/Shanghai';

/** 某时区的墙上时间 → 绝对 ms,写用例用。 */
function at(tz: string, y: number, mo: number, d: number, h = 0, mi = 0): number {
  return wallToUtc(tz, { y, mo, d, h, mi, s: 0 }).getTime();
}

/** 展开结果 → 该时区的 'MM-DD HH:mm' 列表,肉眼可读地断言。 */
function local(tz: string, list: number[]): string[] {
  return list.map((ms) => {
    const w = wallPartsIn(tz, new Date(ms));
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${p(w.mo)}-${p(w.d)} ${p(w.h)}:${p(w.mi)}`;
  });
}

const YEAR = { from: at(SH, 2026, 1, 1), to: at(SH, 2027, 1, 1) };

describe('parseRRule / formatRRule', () => {
  it('往返不丢字段', () => {
    const r = parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10');
    expect(r).toEqual({ freq: 'WEEKLY', interval: 2, byDay: [
      { weekday: 1, nth: 0 }, { weekday: 3, nth: 0 }, { weekday: 5, nth: 0 },
    ], byMonthDay: [], count: 10, until: 0 });
    expect(formatRRule(r!)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10');
  });

  it('认 RRULE: 前缀、序号 BYDAY 与 UNTIL', () => {
    const r = parseRRule('RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20261231T155959Z')!;
    expect(r.byDay).toEqual([{ weekday: 5, nth: -1 }]);
    expect(r.until).toBe(Date.UTC(2026, 11, 31, 15, 59, 59));
  });

  it('FREQ 缺失 / 认不出 → null(调用方当单次)', () => {
    expect(parseRRule('')).toBeNull();
    expect(parseRRule('INTERVAL=2')).toBeNull();
    expect(parseRRule('FREQ=SECONDLY')).toBeNull();
  });
});

describe('expandOccurrences —— 基本频率', () => {
  it('无规则 = 只有首次', () => {
    const start = at(SH, 2026, 8, 1, 9);
    expect(expandOccurrences({ rrule: '', start, tz: SH, ...YEAR })).toEqual([start]);
  });

  it('每天 + COUNT', () => {
    const out = expandOccurrences({ rrule: 'FREQ=DAILY;COUNT=3', start: at(SH, 2026, 8, 1, 9), tz: SH, ...YEAR });
    expect(local(SH, out)).toEqual(['08-01 09:00', '08-02 09:00', '08-03 09:00']);
  });

  it('隔两天', () => {
    const out = expandOccurrences({ rrule: 'FREQ=DAILY;INTERVAL=2;COUNT=4', start: at(SH, 2026, 8, 1, 9), tz: SH, ...YEAR });
    expect(local(SH, out)).toEqual(['08-01 09:00', '08-03 09:00', '08-05 09:00', '08-07 09:00']);
  });

  it('每周一三五(首次是周六,同周更早的周一三五不倒着发)', () => {
    // 2026-08-01 是周六。
    const out = expandOccurrences({
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=4', start: at(SH, 2026, 8, 1, 9), tz: SH, ...YEAR,
    });
    expect(local(SH, out)).toEqual(['08-03 09:00', '08-05 09:00', '08-07 09:00', '08-10 09:00']);
  });

  it('隔周同一天,相位跟着首次那一周走', () => {
    const out = expandOccurrences({
      rrule: 'FREQ=WEEKLY;INTERVAL=2;COUNT=3', start: at(SH, 2026, 8, 5, 20), tz: SH, ...YEAR,
    });
    expect(local(SH, out)).toEqual(['08-05 20:00', '08-19 20:00', '09-02 20:00']);
  });

  it('每月同一号;小月没这天就跳过整月', () => {
    const out = expandOccurrences({
      rrule: 'FREQ=MONTHLY;COUNT=4', start: at(SH, 2026, 1, 31, 10), tz: SH,
      from: at(SH, 2026, 1, 1), to: at(SH, 2027, 6, 1),
    });
    // 2 月无 31 日、4 月无 31 日 → 跳过;1/3/5/7 月发。
    expect(local(SH, out)).toEqual(['01-31 10:00', '03-31 10:00', '05-31 10:00', '07-31 10:00']);
  });

  it('每月第二个周二 / 每月最后一个周五', () => {
    const second = expandOccurrences({
      rrule: 'FREQ=MONTHLY;BYDAY=2TU;COUNT=3', start: at(SH, 2026, 8, 11, 19), tz: SH,
      from: at(SH, 2026, 8, 1), to: at(SH, 2027, 1, 1),
    });
    expect(local(SH, second)).toEqual(['08-11 19:00', '09-08 19:00', '10-13 19:00']);

    const last = expandOccurrences({
      rrule: 'FREQ=MONTHLY;BYDAY=-1FR;COUNT=3', start: at(SH, 2026, 8, 28, 19), tz: SH,
      from: at(SH, 2026, 8, 1), to: at(SH, 2027, 1, 1),
    });
    expect(local(SH, last)).toEqual(['08-28 19:00', '09-25 19:00', '10-30 19:00']);
  });

  it('每年;2 月 29 日只在闰年发', () => {
    const out = expandOccurrences({
      rrule: 'FREQ=YEARLY;COUNT=2', start: at(SH, 2028, 2, 29, 12), tz: SH,
      from: at(SH, 2028, 1, 1), to: at(SH, 2040, 1, 1),
    });
    expect(out.map((ms) => wallPartsIn(SH, new Date(ms)).y)).toEqual([2028, 2032]);
  });
});

describe('expandOccurrences —— 边界', () => {
  it('UNTIL 是闭区间上界', () => {
    const start = at(SH, 2026, 8, 1, 9);
    const until = at(SH, 2026, 8, 3, 9);
    const out = expandOccurrences({
      rrule: `FREQ=DAILY;UNTIL=${new Date(until).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      start, tz: SH, ...YEAR,
    });
    expect(local(SH, out)).toEqual(['08-01 09:00', '08-02 09:00', '08-03 09:00']);
  });

  it('COUNT 从首次数起,不受查询窗口影响', () => {
    const start = at(SH, 2026, 8, 1, 9);
    // 窗口只覆盖第 3 天往后:仍然只剩 COUNT=3 里的最后一次。
    const out = expandOccurrences({
      rrule: 'FREQ=DAILY;COUNT=3', start, tz: SH,
      from: at(SH, 2026, 8, 3), to: at(SH, 2026, 9, 1),
    });
    expect(local(SH, out)).toEqual(['08-03 09:00']);
  });

  it('EXDATE 精确剔除某一次', () => {
    const start = at(SH, 2026, 8, 1, 9);
    const out = expandOccurrences({
      rrule: 'FREQ=DAILY;COUNT=3', start, tz: SH, exdates: [at(SH, 2026, 8, 2, 9)], ...YEAR,
    });
    expect(local(SH, out)).toEqual(['08-01 09:00', '08-03 09:00']);
  });

  it('跨过窗口左沿的长事件仍然命中', () => {
    const start = at(SH, 2026, 8, 1, 22);
    const out = expandOccurrences({
      rrule: '', start, tz: SH, durationMs: 5 * 3600_000,
      from: at(SH, 2026, 8, 2, 0), to: at(SH, 2026, 8, 3, 0),
    });
    expect(out).toEqual([start]);
  });

  it('多年前起步的每日事件,跳到窗口也只吐窗口内的(且不超时)', () => {
    const out = expandOccurrences({
      rrule: 'FREQ=DAILY', start: at(SH, 2015, 1, 1, 8), tz: SH,
      from: at(SH, 2026, 8, 1), to: at(SH, 2026, 8, 5),
    });
    expect(local(SH, out)).toEqual(['08-01 08:00', '08-02 08:00', '08-03 08:00', '08-04 08:00']);
  });

  it('seriesEnd:无界返回 0,有界返回末次结束', () => {
    const start = at(SH, 2026, 8, 1, 9);
    expect(seriesEnd('FREQ=DAILY', start, SH, 3600_000)).toBe(0);
    expect(seriesEnd('FREQ=DAILY;COUNT=3', start, SH, 3600_000)).toBe(at(SH, 2026, 8, 3, 9) + 3600_000);
  });
});

describe('expandOccurrences —— 夏令时', () => {
  it('纽约每周三 09:00,跨 11/1 回拨仍是本地 09:00(绝对时刻多一小时)', () => {
    const start = at(NY, 2026, 10, 28, 9);   // 夏令时期间的周三
    const out = expandOccurrences({
      rrule: 'FREQ=WEEKLY;COUNT=3', start, tz: NY,
      from: at(NY, 2026, 10, 1), to: at(NY, 2026, 12, 1),
    });
    expect(local(NY, out)).toEqual(['10-28 09:00', '11-04 09:00', '11-11 09:00']);
    // 11/1 回拨后 UTC 偏移由 -4 变 -5:相邻两次的绝对间隔是 7 天 + 1 小时。
    expect(out[2] - out[1]).toBe(7 * 86_400_000);
    expect(out[1] - out[0]).toBe(7 * 86_400_000 + 3600_000);
  });

  it('春季前拨跳掉的钟点,顺延到切换后的等价时刻', () => {
    // 2026-03-08 02:30 在纽约不存在(02:00 直接跳到 03:00)。
    const start = at(NY, 2026, 3, 1, 2, 30);
    const out = expandOccurrences({
      rrule: 'FREQ=WEEKLY;COUNT=2', start, tz: NY,
      from: at(NY, 2026, 3, 1), to: at(NY, 2026, 4, 1),
    });
    expect(local(NY, out)).toEqual(['03-01 02:30', '03-08 03:30']);
  });
});

// ── ICS ─────────────────────────────────────────────────────────────────────

function ev(over: Partial<CalEvent> = {}): CalEvent {
  return {
    id: 1, calendarId: 1, title: '周会', description: '', location: '', allDay: false,
    start: at(SH, 2026, 8, 5, 21), end: at(SH, 2026, 8, 5, 22), tz: SH,
    rrule: '', exdates: [], seriesId: null, occurrenceMs: null, color: '',
    reminders: [], guests: [], updatedAt: Date.UTC(2026, 7, 1),
    ...over,
  };
}

describe('ICS 输出', () => {
  it('定时事件带 TZID 与 VTIMEZONE,行尾是 CRLF', () => {
    const ics = eventsToIcs({ name: '我的日历', tz: SH, events: [ev()] });
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:Asia/Shanghai');
    expect(ics).toContain('DTSTART;TZID=Asia/Shanghai:20260805T210000');
    expect(ics).toContain('DTEND;TZID=Asia/Shanghai:20260805T220000');
    expect(ics).toContain('SUMMARY:周会');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('全天事件用 VALUE=DATE,DTEND 是次日(半开区间)', () => {
    const ics = eventsToIcs({
      name: 'x', tz: SH,
      events: [ev({ allDay: true, start: at(SH, 2026, 8, 5), end: at(SH, 2026, 8, 6) })],
    });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260805');
    expect(ics).toContain('DTEND;VALUE=DATE:20260806');
  });

  it('特殊字符转义 + 提醒写成 VALARM', () => {
    const ics = eventsToIcs({
      name: 'x', tz: SH,
      events: [ev({ title: 'a;b,c\\d', description: '第一行\n第二行', reminders: [30] })],
    });
    expect(ics).toContain('SUMMARY:a\\;b\\,c\\\\d');
    expect(ics).toContain('DESCRIPTION:第一行\\n第二行');
    expect(ics).toContain('TRIGGER:-PT30M');
  });

  it('超长行按 75 字节折行,续行以空格开头', () => {
    const ics = eventsToIcs({ name: 'x', tz: SH, events: [ev({ title: '很长的标题'.repeat(20) })] });
    const line = ics.split('\r\n').find((l) => l.startsWith('SUMMARY:'))!;
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const idx = ics.split('\r\n').indexOf(line);
    expect(ics.split('\r\n')[idx + 1].startsWith(' ')).toBe(true);
  });

  it('有夏令时的时区发 STANDARD + DAYLIGHT,没有的只发一个 STANDARD', () => {
    const ny = vtimezoneFor(NY, new Date('2026-08-01T00:00:00Z')).join('\n');
    expect(ny).toContain('BEGIN:DAYLIGHT');
    expect(ny).toContain('BEGIN:STANDARD');
    expect(ny).toContain('TZOFFSETTO:-0500');
    expect(ny).toContain('TZOFFSETTO:-0400');
    const sh = vtimezoneFor(SH, new Date('2026-08-01T00:00:00Z')).join('\n');
    expect(sh).not.toContain('BEGIN:DAYLIGHT');
    expect(sh).toContain('TZOFFSETTO:+0800');
  });

  // DTSTART 写的是切换瞬间**按切换前偏移**读出的钟点 —— 美东回拨是 02:00。
  // 早前用「切换前 1 秒」的墙上时间,得到 01:59,整整差一分钟:订阅端把落在
  // 01:59–02:00 的日程算到错误的一侧。tzdata 官方规则同样写 2:00。
  it('VTIMEZONE 的 DTSTART 落在整点切换时刻,不是它前一分钟', () => {
    const lines = vtimezoneFor(NY, new Date('2026-08-01T00:00:00Z'));
    const std = lines.indexOf('BEGIN:STANDARD');
    const dst = lines.indexOf('BEGIN:DAYLIGHT');
    expect(lines[std + 1]).toBe('DTSTART:20261101T020000');   // 2026-11-01 02:00 EDT → 01:00 EST
    expect(lines[std + 2]).toBe('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU');
    expect(lines[dst + 1]).toBe('DTSTART:20270314T020000');   // 2027-03-14 02:00 EST → 03:00 EDT
    expect(lines[dst + 2]).toBe('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU');
  });

  it('TZNAME 用真缩写(EST/EDT),没有真缩写的时区退回 STD', () => {
    const ny = vtimezoneFor(NY, new Date('2026-08-01T00:00:00Z')).join('\n');
    expect(ny).toContain('TZNAME:EST');
    expect(ny).toContain('TZNAME:EDT');
    // Asia/Shanghai 的 Intl 短名是 "GMT+8",与偏移列重复,zoneAbbrev 返回空串。
    expect(vtimezoneFor(SH, new Date('2026-08-01T00:00:00Z')).join('\n')).toContain('TZNAME:STD');
  });
});

describe('ICS 输入', () => {
  it('往返:导出再解析回来,时刻与规则不变', () => {
    const src = ev({ title: '周会', rrule: 'FREQ=WEEKLY;BYDAY=WE;COUNT=5', reminders: [10], location: '线上' });
    const back = parseIcs(eventsToIcs({ name: 'x', tz: SH, events: [src] }), SH);
    expect(back).toHaveLength(1);
    expect(back[0].start).toBe(src.start);
    expect(back[0].end).toBe(src.end);
    expect(back[0].tz).toBe(SH);
    expect(back[0].rrule).toBe('FREQ=WEEKLY;BYDAY=WE;COUNT=5');
    expect(back[0].reminders).toEqual([10]);
    expect(back[0].location).toBe('线上');
    expect(back[0].allDay).toBe(false);
  });

  it('全天事件往返保持整日', () => {
    const src = ev({ allDay: true, start: at(SH, 2026, 8, 5), end: at(SH, 2026, 8, 7) });
    const back = parseIcs(eventsToIcs({ name: 'x', tz: SH, events: [src] }), SH)[0];
    expect(back.allDay).toBe(true);
    expect(back.start).toBe(src.start);
    expect(back.end).toBe(src.end);
  });

  it('认 UTC 时刻、折行、以及 DTEND 缺失时补一小时', () => {
    const text = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'BEGIN:VEVENT', 'UID:x', 'DTSTART:20260805T130000Z',
      'SUMMARY:折行标', ' 题',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const [e] = parseIcs(text, SH);
    expect(e.start).toBe(Date.UTC(2026, 7, 5, 13));
    expect(e.end - e.start).toBe(3600_000);
    expect(e.title).toBe('折行标题');
  });

  it('跳过不认识的组件,不整份报错', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'BEGIN:VTODO', 'SUMMARY:待办不要', 'END:VTODO',
      'BEGIN:VEVENT', 'DTSTART:20260805T130000Z', 'SUMMARY:要这个', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const list = parseIcs(text, SH);
    expect(list.map((x) => x.title)).toEqual(['要这个']);
  });
});

describe('分享脱敏', () => {
  it('busy 档只剩时间段,标题/正文/地点/嘉宾全清', () => {
    const src = ev({
      title: '面试', description: '密', location: '公司', reminders: [10],
      guests: [{ key: '2017YANR02', name: 'X', status: 'accepted' }],
    });
    const out = redactBusy(src);
    expect(out.title).toBe('');
    expect(out.description).toBe('');
    expect(out.location).toBe('');
    expect(out.guests).toEqual([]);
    expect(out.reminders).toEqual([]);
    // 时间段照留 —— 这才是 busy 档要展示的东西。
    expect(out.start).toBe(src.start);
    expect(out.end).toBe(src.end);
  });
});

describe('parseNumList', () => {
  // 空串是最常见的一档(没设提醒 / 没排除次数 / 分享全部日历),它必须给空数组。
  // Number('') === 0 且 isFinite(0) 为真,所以「先转数字再过滤」的写法会静默产出 [0]:
  // 空 reminders 变成「开始时提醒」轰炸所有人,空 calendar_ids 变成「只有 id 0」让分享页空白。
  it('空串给空数组,不给 [0]', () => {
    expect(parseNumList('')).toEqual([]);
    expect(parseNumList(null)).toEqual([]);
    expect(parseNumList(undefined)).toEqual([]);
    expect(parseNumList(' ')).toEqual([]);
    expect(parseNumList(',,')).toEqual([]);
  });

  it('正常串照解,容忍空格与尾逗号,真的 0 保留', () => {
    expect(parseNumList('5,10,30')).toEqual([5, 10, 30]);
    expect(parseNumList(' 5 , 10 ,')).toEqual([5, 10]);
    expect(parseNumList('0,15')).toEqual([0, 15]);       // 0 = 「开始时提醒」,是合法选项
    expect(parseNumList('1785600000000')).toEqual([1785600000000]);
  });

  it('非数字段丢掉,不变成 NaN', () => {
    expect(parseNumList('5,abc,10')).toEqual([5, 10]);
  });
});
