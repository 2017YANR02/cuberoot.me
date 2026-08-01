// /timezone 的时区数学回归。全部数值都是从 IANA tzdata 得出的确定值,用 toBe() 锁死 ——
// 改算法就得主动改这里的期望值,当 review 信号。
//
// 前提:运行环境带完整 ICU(Node 18+ 默认如此),否则 Intl 只认 UTC,这些用例会直接红。

import { describe, expect, it } from 'vitest';
import {
  comfortWindows, dateKey, dayDelta, dstInfo, formatOffset, hourBand, hourGrid,
  inWindow, isValidZone, nextTransition, parseDateTime, timeKey, wallPartsIn,
  wallToUtc, zoneOffsetMinutes,
} from '@/app/[lang]/timezone/_lib/tz';
import { isPopularZone, POPULAR_ZONES, zoneLabel, zoneSearchTerms } from '@/app/[lang]/timezone/_lib/zones';

const JUL = new Date('2026-07-15T12:00:00Z');
const JAN = new Date('2026-01-15T12:00:00Z');

describe('zoneOffsetMinutes', () => {
  it('中国全年 +8,不设夏令时', () => {
    expect(zoneOffsetMinutes('Asia/Shanghai', JAN)).toBe(480);
    expect(zoneOffsetMinutes('Asia/Shanghai', JUL)).toBe(480);
  });

  it('美东冬夏差一小时', () => {
    expect(zoneOffsetMinutes('America/New_York', JAN)).toBe(-300);
    expect(zoneOffsetMinutes('America/New_York', JUL)).toBe(-240);
  });

  it('南半球的夏令时反过来', () => {
    expect(zoneOffsetMinutes('Australia/Sydney', JAN)).toBe(660);
    expect(zoneOffsetMinutes('Australia/Sydney', JUL)).toBe(600);
  });

  it('半小时 / 三刻钟偏移', () => {
    expect(zoneOffsetMinutes('Asia/Kolkata', JUL)).toBe(330);
    expect(zoneOffsetMinutes('Asia/Kathmandu', JUL)).toBe(345);
    expect(zoneOffsetMinutes('America/St_Johns', JUL)).toBe(-150);
  });

  it('UTC 是 0', () => {
    expect(zoneOffsetMinutes('UTC', JUL)).toBe(0);
  });
});

describe('formatOffset', () => {
  it('整点 / 非整点 / 零', () => {
    expect(formatOffset(480)).toBe('UTC+8');
    expect(formatOffset(345)).toBe('UTC+5:45');
    expect(formatOffset(-150)).toBe('UTC-2:30');
    expect(formatOffset(-300)).toBe('UTC-5');
    expect(formatOffset(0)).toBe('UTC');
  });
});

describe('wallPartsIn / wallToUtc', () => {
  it('北京时间 20:30 = 洛杉矶前一天 05:30(夏令时期间)', () => {
    const at = wallToUtc('Asia/Shanghai', { y: 2026, mo: 7, d: 15, h: 20, mi: 30, s: 0 });
    expect(at.toISOString()).toBe('2026-07-15T12:30:00.000Z');
    const la = wallPartsIn('America/Los_Angeles', at);
    expect(dateKey(la)).toBe('2026-07-15');
    expect(timeKey(la)).toBe('05:30');
  });

  it('跨日:北京 08:00 时纽约还在前一天', () => {
    const at = wallToUtc('Asia/Shanghai', { y: 2026, mo: 7, d: 15, h: 8, mi: 0, s: 0 });
    const ny = wallPartsIn('America/New_York', at);
    expect(dateKey(ny)).toBe('2026-07-14');
    expect(timeKey(ny)).toBe('20:00');
    expect(dayDelta({ y: 2026, mo: 7, d: 15 }, ny)).toBe(-1);
  });

  it('往返一致(随便挑几个时区和时刻)', () => {
    for (const tz of ['Asia/Shanghai', 'America/New_York', 'Europe/London', 'Asia/Kathmandu', 'Pacific/Auckland']) {
      for (const iso of ['2026-01-05T03:17:00Z', '2026-07-22T18:44:00Z', '2026-11-30T23:59:00Z']) {
        const at = new Date(iso);
        const w = wallPartsIn(tz, at);
        expect(wallToUtc(tz, w).toISOString()).toBe(at.toISOString());
      }
    }
  });

  it('春季前拨那被跳掉的一小时落到切换后的等价时刻', () => {
    // 美东 2026-03-08 02:30 不存在(02:00 直接跳到 03:00)。
    const at = wallToUtc('America/New_York', { y: 2026, mo: 3, d: 8, h: 2, mi: 30, s: 0 });
    expect(timeKey(wallPartsIn('America/New_York', at))).toBe('03:30');
  });

  it('秋季回拨重复的那一小时取靠前那次(仍是夏令时)', () => {
    // 美东 2026-11-01 01:30 出现两次;取 EDT(UTC-4)那次 = 05:30Z。
    const at = wallToUtc('America/New_York', { y: 2026, mo: 11, d: 1, h: 1, mi: 30, s: 0 });
    expect(at.toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });

  it('回拨当天靠后的时刻按新偏移算(第一次估偏移会估错,必须回代验证)', () => {
    // 美东 2026-11-01 05:00 已是 EST(UTC-5)= 10:00Z。
    const at = wallToUtc('America/New_York', { y: 2026, mo: 11, d: 1, h: 5, mi: 0, s: 0 });
    expect(at.toISOString()).toBe('2026-11-01T10:00:00.000Z');
    expect(timeKey(wallPartsIn('America/New_York', at))).toBe('05:00');
  });
});

describe('dstInfo', () => {
  it('认出观察夏令时的时区及其当下状态', () => {
    expect(dstInfo('America/New_York', JUL)).toEqual({ observes: true, active: true });
    expect(dstInfo('America/New_York', JAN)).toEqual({ observes: true, active: false });
    expect(dstInfo('Australia/Sydney', JAN)).toEqual({ observes: true, active: true });
  });

  it('不观察夏令时的时区两季都 false', () => {
    expect(dstInfo('Asia/Shanghai', JUL)).toEqual({ observes: false, active: false });
    expect(dstInfo('America/Phoenix', JUL)).toEqual({ observes: false, active: false });
  });
});

describe('nextTransition', () => {
  it('美东 2026 年的两次换时', () => {
    const spring = nextTransition('America/New_York', new Date('2026-01-10T00:00:00Z'));
    expect(spring).not.toBeNull();
    expect(spring!.at.toISOString()).toBe('2026-03-08T07:00:00.000Z');
    expect(spring!.before).toBe(-300);
    expect(spring!.after).toBe(-240);

    const fall = nextTransition('America/New_York', new Date('2026-07-01T00:00:00Z'));
    expect(fall!.at.toISOString()).toBe('2026-11-01T06:00:00.000Z');
    expect(fall!.after).toBe(-300);
  });

  it('不换时的时区返回 null', () => {
    expect(nextTransition('Asia/Shanghai', JAN)).toBeNull();
    expect(nextTransition('UTC', JAN)).toBeNull();
  });
});

describe('parseDateTime', () => {
  it('接受合法输入', () => {
    expect(parseDateTime('2026-08-02', '20:30')).toEqual({ y: 2026, mo: 8, d: 2, h: 20, mi: 30, s: 0 });
  });

  it('拒绝空 / 越界 / 乱写(URL 是用户能手改的)', () => {
    expect(parseDateTime('', '20:30')).toBeNull();
    expect(parseDateTime('2026-08-02', '')).toBeNull();
    expect(parseDateTime('2026-13-02', '20:30')).toBeNull();
    expect(parseDateTime('2026-08-02', '25:00')).toBeNull();
    expect(parseDateTime('nope', 'nope')).toBeNull();
  });
});

describe('hourBand', () => {
  it('四档边界', () => {
    expect(hourBand(0)).toBe('night');
    expect(hourBand(6)).toBe('night');
    expect(hourBand(7)).toBe('early');
    expect(hourBand(9)).toBe('day');
    expect(hourBand(17)).toBe('day');
    expect(hourBand(18)).toBe('evening');
    expect(hourBand(22)).toBe('evening');
    expect(hourBand(23)).toBe('night');
  });
});

describe('inWindow', () => {
  it('普通区间与跨夜区间', () => {
    expect(inWindow(9, 9, 22)).toBe(true);
    expect(inWindow(22, 9, 22)).toBe(false);
    expect(inWindow(8, 9, 22)).toBe(false);
    expect(inWindow(23, 22, 6)).toBe(true);
    expect(inWindow(3, 22, 6)).toBe(true);
    expect(inWindow(12, 22, 6)).toBe(false);
    expect(inWindow(5, 0, 24)).toBe(true);
  });
});

describe('hourGrid / comfortWindows', () => {
  const day = { y: 2026, mo: 7, d: 15 };
  const zones = ['Asia/Shanghai', 'America/Los_Angeles'];
  const grid = hourGrid('Asia/Shanghai', day, zones);

  it('24 列,基准时区自己永远不跨日', () => {
    expect(grid).toHaveLength(24);
    expect(grid.map((c) => c.cells[0].hour)).toEqual(Array.from({ length: 24 }, (_, h) => h));
    expect(grid.every((c) => c.cells[0].dayDelta === 0)).toBe(true);
  });

  it('洛杉矶比上海晚 15 小时,凌晨那几列还停在前一天', () => {
    expect(grid[0].cells[1].hour).toBe(9);      // 上海 00:00 = 洛杉矶 09:00
    expect(grid[0].cells[1].dayDelta).toBe(-1);
    expect(grid[15].cells[1].hour).toBe(0);     // 上海 15:00 = 洛杉矶 00:00 同日
    expect(grid[15].cells[1].dayDelta).toBe(0);
  });

  it('9–22 的窗口里两地都醒着的只有上海上午那段', () => {
    const w = comfortWindows(grid, 9, 22);
    expect(w).toHaveLength(1);
    // 上海 09:00–13:00 ↔ 洛杉矶(前一天)18:00–22:00
    expect(w[0].startHour).toBe(9);
    expect(w[0].endHour).toBe(13);
    expect(timeKey(wallPartsIn('America/Los_Angeles', w[0].start))).toBe('18:00');
    expect(timeKey(wallPartsIn('America/Los_Angeles', w[0].end))).toBe('22:00');
  });

  it('窗口收得太紧就没有结果', () => {
    expect(comfortWindows(grid, 14, 16)).toHaveLength(0);
  });

  it('同一时区的两个人整个窗口都合适', () => {
    const same = hourGrid('Asia/Shanghai', day, ['Asia/Shanghai', 'Asia/Shanghai']);
    const w = comfortWindows(same, 9, 22);
    expect(w).toHaveLength(1);
    expect(w[0].startHour).toBe(9);
    expect(w[0].endHour).toBe(22);
  });
});

describe('时区目录', () => {
  it('常用表里的 id 平台全都认识', () => {
    for (const z of POPULAR_ZONES) expect(isValidZone(z.tz)).toBe(true);
  });

  it('没有重复的 id', () => {
    const ids = POPULAR_ZONES.map((z) => z.tz);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('双语名都非空,可搜文本含 id 与两种语言', () => {
    for (const z of POPULAR_ZONES) {
      expect(z.zh.length).toBeGreaterThan(0);
      expect(z.en.length).toBeGreaterThan(0);
      const terms = zoneSearchTerms(z);
      expect(terms).toContain(z.tz);
      expect(terms).toContain(z.zh);
      expect(terms).toContain(z.en);
    }
  });

  it('不在常用表里的时区退回 IANA 原文拼名', () => {
    expect(isPopularZone('Asia/Shanghai')).toBe(true);
    expect(isPopularZone('Europe/Vilnius')).toBe(false);
    expect(zoneLabel('Europe/Vilnius', false)).toBe('Vilnius');
    expect(zoneLabel('Europe/Vilnius', true)).toBe('欧洲 Vilnius');
    expect(zoneLabel('Asia/Shanghai', true)).toBe('上海');
    expect(zoneLabel('Asia/Shanghai', false)).toBe('Shanghai');
  });

  it('搜索别名能把常见说法引到正确时区', () => {
    const byTz = new Map(POPULAR_ZONES.map((z) => [z.tz, zoneSearchTerms(z)]));
    expect(byTz.get('Asia/Shanghai')).toContain('北京');
    expect(byTz.get('America/Los_Angeles')).toContain('旧金山');
    expect(byTz.get('Asia/Kolkata')).toContain('新德里');
    expect(byTz.get('Australia/Sydney')).toContain('墨尔本');
  });
});
