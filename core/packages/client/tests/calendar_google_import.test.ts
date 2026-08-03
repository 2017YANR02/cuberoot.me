// 从 Google 日历导出的 .ics 导进来 —— 那份文件的形状和我们自己导出的不一样,以前有三处
// 会读错,这里逐条锁死:
//
//   1. RECURRENCE-ID 覆盖行:Google 改了重复日程的某一次时另起一条 VEVENT,主事件那边**不写**
//      EXDATE。照单全收 → 那一次出现两遍(原时段 + 新时段)。
//   2. STATUS:CANCELLED:导出里混着一堆已取消的墓碑。当普通事件收进来 → 满屏本该消失的日程。
//      但带 RECURRENCE-ID 的取消是「删掉这一次」,得反过来变成主事件的 EXDATE,丢掉的话
//      那一次会照常冒出来。
//   3. X-WR-CALNAME:文件名是日历 id(xxx@group.calendar.google.com.ics),真名字在这里。
//
// 展开逻辑本身在 calendar_recur.test.ts,不重复。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseIcs, icsCalendarName, ICS_IMPORT_BATCH, type CalendarMeta } from '@cuberoot/shared/calendar';
import { readIcsSources, importCalendarFile } from '@/app/[lang]/calendar/_lib/import';
import { createCalendar, importEvents, startImport } from '@/lib/calendar-api';

// 编排那一层(建日历 / 切批 / 限流重试 / 挂批次)只能打桩验:真跑要本地 API + PG。
vi.mock('@/lib/calendar-api', () => ({
  createCalendar: vi.fn(),
  importEvents: vi.fn(),
  startImport: vi.fn(),
}));
import { expandOccurrences } from '@cuberoot/shared/recur';
import { wallToUtc } from '@cuberoot/shared/tz';

const SH = 'Asia/Shanghai';

function at(tz: string, y: number, mo: number, d: number, h = 0, mi = 0): number {
  return wallToUtc(tz, { y, mo, d, h, mi, s: 0 }).getTime();
}

/** 一份按 Google 导出格式手写的样本(折行、VTIMEZONE、覆盖行、墓碑都照它的样子来)。 */
const GOOGLE_ICS = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'VERSION:2.0',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-WR-CALNAME:工作',
  'X-WR-TIMEZONE:Asia/Shanghai',
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Shanghai',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0800',
  'TZOFFSETTO:+0800',
  'TZNAME:CST',
  'DTSTART:19700101T000000',
  'END:STANDARD',
  'END:VTIMEZONE',
  // ① 每周一 10:00 的例会
  'BEGIN:VEVENT',
  'DTSTART;TZID=Asia/Shanghai:20260803T100000',
  'DTEND;TZID=Asia/Shanghai:20260803T110000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4',
  'UID:weekly-standup@google.com',
  'SUMMARY:周会',
  'DESCRIPTION:每周同步一下\\n第二行',
  'LOCATION:会议室 A',
  'STATUS:CONFIRMED',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'TRIGGER:-PT10M',
  'END:VALARM',
  'END:VEVENT',
  // ② 8/10 那次改到了 14:00(覆盖行,主事件不带 EXDATE)
  'BEGIN:VEVENT',
  'DTSTART;TZID=Asia/Shanghai:20260810T140000',
  'DTEND;TZID=Asia/Shanghai:20260810T150000',
  'RECURRENCE-ID;TZID=Asia/Shanghai:20260810T100000',
  'UID:weekly-standup@google.com',
  'SUMMARY:周会(改到下午)',
  'STATUS:CONFIRMED',
  'END:VEVENT',
  // ③ 8/17 那次被删了(取消的覆盖行)
  'BEGIN:VEVENT',
  'DTSTART;TZID=Asia/Shanghai:20260817T100000',
  'DTEND;TZID=Asia/Shanghai:20260817T110000',
  'RECURRENCE-ID;TZID=Asia/Shanghai:20260817T100000',
  'UID:weekly-standup@google.com',
  'SUMMARY:周会',
  'STATUS:CANCELLED',
  'END:VEVENT',
  // ④ 整份取消的独立事件(墓碑)
  'BEGIN:VEVENT',
  'DTSTART;TZID=Asia/Shanghai:20260805T090000',
  'DTEND;TZID=Asia/Shanghai:20260805T093000',
  'UID:dead-meeting@google.com',
  'SUMMARY:已取消的面谈',
  'STATUS:CANCELLED',
  'END:VEVENT',
  // ⑤ 全天事件,顺带验折行(续行以空格开头)
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260901',
  'DTEND;VALUE=DATE:20260902',
  'UID:holiday@google.com',
  'SUMMARY:很长的标题被折成两行的那种情',
  ' 况',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('Google 日历导出的 .ics', () => {
  const parsed = parseIcs(GOOGLE_ICS, SH);

  it('日历名取自 X-WR-CALNAME,不是文件名', () => {
    expect(icsCalendarName(GOOGLE_ICS)).toBe('工作');
  });

  it('取消的独立事件不进来', () => {
    expect(parsed.map((e) => e.title)).not.toContain('已取消的面谈');
  });

  it('读出 3 条:主事件 + 改期的那一次 + 全天', () => {
    expect(parsed).toHaveLength(3);
  });

  it('折行拼得回去', () => {
    const holiday = parsed.find((e) => e.uid === 'holiday@google.com');
    expect(holiday?.title).toBe('很长的标题被折成两行的那种情况');
    expect(holiday?.allDay).toBe(true);
  });

  it('提醒读成「提前 10 分钟」', () => {
    const master = parsed.find((e) => e.rrule !== '');
    expect(master?.reminders).toEqual([10]);
    expect(master?.description).toBe('每周同步一下\n第二行');
    expect(master?.location).toBe('会议室 A');
    expect(master?.tz).toBe(SH);
  });

  it('改期与删除的那两次都从主事件上 EXDATE 掉了', () => {
    const master = parsed.find((e) => e.rrule !== '');
    expect(master?.exdates).toEqual([
      at(SH, 2026, 8, 10, 10),
      at(SH, 2026, 8, 17, 10),
    ]);
  });

  it('改期的那一次留成独立日程,自己不再带重复规则', () => {
    const moved = parsed.find((e) => e.title === '周会(改到下午)');
    expect(moved?.rrule).toBe('');
    expect(moved?.start).toBe(at(SH, 2026, 8, 10, 14));
  });

  it('展开后 8/10 只在 14:00 出现一次,8/17 整个消失', () => {
    const master = parsed.find((e) => e.rrule !== '')!;
    const from = at(SH, 2026, 8, 1);
    const to = at(SH, 2026, 9, 1);
    const times = expandOccurrences({
      rrule: master.rrule,
      start: master.start,
      tz: SH,
      exdates: master.exdates,
      durationMs: master.end - master.start,
      from,
      to,
    });

    // COUNT=4 → 8/3、8/10、8/17、8/24;中间两次被排除,只剩首尾。
    expect(times).toEqual([at(SH, 2026, 8, 3, 10), at(SH, 2026, 8, 24, 10)]);

    const moved = parsed.find((e) => e.title === '周会(改到下午)')!;
    const allOn0810 = [...times, moved.start].filter((t) => t >= at(SH, 2026, 8, 10) && t < at(SH, 2026, 8, 11));
    expect(allOn0810).toEqual([at(SH, 2026, 8, 10, 14)]);
  });
});

describe('导入切批', () => {
  it('批大小是前后端共用的那一个常量', () => {
    // 前端按它切、后端按它拒收。两边各写一个数的话,超出的部分会被后端静默 slice 掉,
    // 界面还报「导入成功」。
    expect(ICS_IMPORT_BATCH).toBe(500);
  });
});

// Google 的「导出」给的是 zip,不是 ics —— 里面账号下每个日历一份。
describe('Google 导出的 .zip', () => {
  /** 一份最小 .ics,只放一条事件。 */
  const oneEvent = (calName: string, title: string): string => [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `X-WR-CALNAME:${calName}`,
    'BEGIN:VEVENT',
    'DTSTART;TZID=Asia/Shanghai:20260803T100000',
    'DTEND;TZID=Asia/Shanghai:20260803T110000',
    `UID:${title}@google.com`, `SUMMARY:${title}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');

  function zipFile(entries: Record<string, string>, name = 'google-calendar.zip'): File {
    const bytes = zipSync(Object.fromEntries(
      Object.entries(entries).map(([k, v]) => [k, strToU8(v)]),
    ));
    // 走 .slice() 拿一个确定是 ArrayBuffer(而非 SharedArrayBuffer)的底,免得 File 的类型对不上。
    return new File([bytes.slice().buffer as ArrayBuffer], name, { type: 'application/zip' });
  }

  it('拆出每个 .ics,名字取 X-WR-CALNAME 而不是文件名', async () => {
    const f = zipFile({
      'me@gmail.com.ics': oneEvent('个人', '看牙'),
      'abc123@group.calendar.google.com.ics': oneEvent('工作', '周会'),
    });
    const sources = await readIcsSources(f, SH);
    expect(sources.map((s) => s.name).sort()).toEqual(['个人', '工作']);
    expect(sources.every((s) => s.events.length === 1)).toBe(true);
  });

  it('跳过 zip 里的非 .ics(Takeout 会塞 Tasks 的 json)', async () => {
    const f = zipFile({
      'Takeout/Calendar/me@gmail.com.ics': oneEvent('个人', '看牙'),
      'Takeout/Tasks/Tasks.json': '{"items":[]}',
      'Takeout/archive_browser.html': '<html></html>',
    });
    const sources = await readIcsSources(f, SH);
    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe('个人');
  });

  it('没有 X-WR-CALNAME 时退回文件名(去掉目录和后缀)', async () => {
    const ics = oneEvent('', '看牙').replace('X-WR-CALNAME:\r\n', '');
    const f = zipFile({ 'Takeout/Calendar/我的日历.ics': ics });
    const sources = await readIcsSources(f, SH);
    expect(sources[0].name).toBe('我的日历');
  });

  it('单份 .ics 照旧能读(不是 zip 就直接当文本)', async () => {
    const f = new File([oneEvent('工作', '周会')], 'work.ics', { type: 'text/calendar' });
    const sources = await readIcsSources(f, SH);
    expect(sources).toEqual([expect.objectContaining({ name: '工作' })]);
    expect(sources[0].events[0].title).toBe('周会');
  });

  // ── 编排:建日历 / 切批 / 限流退避 ────────────────────────────────────────
  //
  // 真跑要本地 API + PG,这里把 API 层打桩,验的是「送出去的形状对不对」:
  // 几个日历、每批多少条、撞限流会不会把剩下的丢掉。
  describe('落库编排', () => {
    const created = vi.mocked(createCalendar);
    const sent = vi.mocked(importEvents);
    const opened = vi.mocked(startImport);
    const BATCH_ID = 77;

    const cal = (id: number, name: string): CalendarMeta => ({
      id, name, color: 'peacock', tz: SH, isDefault: id === 1, sortOrder: id,
    });

    beforeEach(() => {
      vi.clearAllMocks();
      let nextId = 100;
      opened.mockResolvedValue(BATCH_ID);
      created.mockImplementation(async (input) => cal(nextId++, input.name));
      sent.mockImplementation(async (_id, events) => ({ added: events.length, failed: 0 }));
    });

    it('先开批次,建的日历和塞的事件都挂在它下面', async () => {
      const f = zipFile({ 'a.ics': oneEvent('工作', '周会') });
      const r = await importCalendarFile({
        file: f, tz: SH, defaultCalendarId: 1, calendars: [cal(1, '我的日历')],
      });
      expect(opened).toHaveBeenCalledWith('google-calendar.zip');
      // 少挂一处,撤销就漏一处:新建的日历会变成删不掉的空壳,事件会留在库里。
      expect(created.mock.calls[0][0].importId).toBe(BATCH_ID);
      expect(sent.mock.calls[0][2]).toBe(BATCH_ID);
      expect(r.importId).toBe(BATCH_ID);
    });

    it('一条都没读出来就不开批次(不留空记录)', async () => {
      const f = new File(['BEGIN:VCALENDAR\r\nEND:VCALENDAR'], 'empty.ics', { type: 'text/calendar' });
      const r = await importCalendarFile({
        file: f, tz: SH, defaultCalendarId: 1, calendars: [cal(1, '我的日历')],
      });
      expect(opened).not.toHaveBeenCalled();
      expect(r).toEqual({ added: 0, failed: 0, calendars: [], importId: null });
    });

    /** 造一份含 n 条事件的 .ics。 */
    const manyEvents = (calName: string, n: number): string => [
      'BEGIN:VCALENDAR', 'VERSION:2.0', `X-WR-CALNAME:${calName}`,
      ...Array.from({ length: n }, (_, i) => [
        'BEGIN:VEVENT',
        `DTSTART;TZID=Asia/Shanghai:20260803T${String(10 + (i % 12)).padStart(2, '0')}0000`,
        `UID:e${i}@google.com`, `SUMMARY:事件${i}`,
        'END:VEVENT',
      ].join('\r\n')),
      'END:VCALENDAR',
    ].join('\r\n');

    it('zip 里每个日历各建一个,同名的并进已有的那个', async () => {
      const f = zipFile({
        'a.ics': oneEvent('工作', '周会'),
        'b.ics': oneEvent('个人', '看牙'),
      });
      const r = await importCalendarFile({
        file: f, tz: SH, defaultCalendarId: 1,
        calendars: [cal(1, '我的日历'), cal(2, '工作')],
      });
      // 「工作」已经有了 → 只新建「个人」
      expect(created).toHaveBeenCalledTimes(1);
      expect(created.mock.calls[0][0].name).toBe('个人');
      expect(sent.mock.calls.map((c) => c[0]).sort((a, b) => a - b)).toEqual([2, 100]);
      expect(r.added).toBe(2);
      expect(r.calendars.sort()).toEqual(['个人', '工作']);
    });

    it('超过一批就切开送,不让后端静默截断', async () => {
      const n = ICS_IMPORT_BATCH * 2 + 7;
      const f = new File([manyEvents('大日历', n)], 'big.ics', { type: 'text/calendar' });
      const progress: number[] = [];
      const r = await importCalendarFile({
        file: f, tz: SH, defaultCalendarId: 1, calendars: [cal(1, '我的日历')],
        onProgress: (p) => progress.push(p.done),
      });
      expect(sent).toHaveBeenCalledTimes(3);
      expect(sent.mock.calls.map((c) => c[1].length)).toEqual([ICS_IMPORT_BATCH, ICS_IMPORT_BATCH, 7]);
      expect(r.added).toBe(n);
      // 进度从 0 起、逐批涨、最后等于总数
      expect(progress).toEqual([0, ICS_IMPORT_BATCH, ICS_IMPORT_BATCH * 2, n]);
    });

    it('撞限流会退避重试,不丢那一批', async () => {
      vi.useFakeTimers();
      try {
        let hit = 0;
        sent.mockImplementation(async (_id, events) => {
          if (++hit === 1) throw new Error('Rate limit exceeded');
          return { added: events.length, failed: 0 };
        });
        const f = new File([manyEvents('大日历', 3)], 'big.ics', { type: 'text/calendar' });
        const p = importCalendarFile({
          file: f, tz: SH, defaultCalendarId: 1, calendars: [cal(1, '我的日历')],
        });
        await vi.runAllTimersAsync();
        expect((await p).added).toBe(3);
        expect(sent).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('建不出日历(到上限了)就退回主日历,不整批失败', async () => {
      created.mockRejectedValue(new Error('too many calendars'));
      const f = new File([oneEvent('工作', '周会')], 'work.ics', { type: 'text/calendar' });
      const r = await importCalendarFile({
        file: f, tz: SH, defaultCalendarId: 1, calendars: [cal(1, '我的日历')],
      });
      expect(sent.mock.calls[0][0]).toBe(1);
      expect(r.added).toBe(1);
    });
  });
});
