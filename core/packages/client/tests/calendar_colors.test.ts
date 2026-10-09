import { describe, expect, it } from 'vitest';
import { eventsToIcs, parseIcs, icsCalendarColor, isCalendarColor, type CalEvent } from '@cuberoot/shared/calendar';
import { colorHex, colorName, CALENDAR_COLOR_DEFS, GOOGLE_LABEL_COLORS } from '@/lib/calendar-colors';

describe('日历来源颜色无损保留', () => {
  it('允许精确 hex 和原调色板 key，拒绝任意 CSS 或无效色值', () => {
    for (const color of ['#123456', '#aBCDef', 'peacock', 'basil']) expect(isCalendarColor(color)).toBe(true);
    for (const color of ['', '#fff', '#12345678', '#xyzxyz', 'url(https://example.com)', 'var(--accent)', 'red;display:none']) expect(isCalendarColor(color)).toBe(false);
  });

  it('不把未知的原始 hex 近似为孔雀蓝', () => {
    expect(colorHex('#4B99D2')).toBe('#4B99D2');
    expect(colorName('#6E72C3', true)).toBe('#6E72C3');
    expect(colorHex('peacock')).toBe('#039be5');
    expect(colorHex('#123456', 'dark')).toBe('#123456');
  });

  it('深色主题逐项对应维护者截图里的完整 24 色菜单', () => {
    const expected = ['#b84d7b', '#d9497e', '#e2867c', '#db4546', '#f16f45', '#ea842f', '#eaa130', '#ecc24a', '#dbc359', '#bcc44a', '#83b053', '#3d8f66', '#48b482', '#2c9b92', '#30a8e4', '#5f96f2', '#7f8aca', '#6370bc', '#ae99d4', '#9f6eaf', '#9f52b4', '#896b61', '#737373', '#a4988a'];
    expect(CALENDAR_COLOR_DEFS.map((c) => colorHex(c.key, 'dark'))).toEqual(expected);
    expect(CALENDAR_COLOR_DEFS.map((c) => colorName(c.key, true))).toEqual([
      '菊苣红', '樱花粉红', '红鹤色', '番茄红', '橘红', '南瓜色', '芒果黄', '香蕉黄',
      '香橼黄', '牛油果色', '开心果绿', '罗勒绿', '鼠尾草绿', '桉树绿', '孔雀蓝', '钴蓝',
      '薰衣草色', '蓝莓色', '紫藤色', '水晶紫', '葡萄紫', '可可棕', '石墨黑', '桦木灰',
    ]);
  });

  it('保留新版 24 色标签的深浅模式，同时不改写用户的普通 hex', () => {
    expect(Object.keys(GOOGLE_LABEL_COLORS)).toHaveLength(24);
    for (const [light, dark] of Object.entries(GOOGLE_LABEL_COLORS)) {
      expect(isCalendarColor(`google:${light}`)).toBe(true);
      expect(colorHex(`google:${light}`, 'light')).toBe(light);
      expect(colorHex(`google:${light}`, 'dark')).toBe(dark);
      expect(colorHex(light, 'dark')).toBe(light);
      expect(colorName(`google:${light}`, true)).toBe(CALENDAR_COLOR_DEFS.find((c) => c.hex === light)!.zh);
    }
    expect(isCalendarColor('google:#fff')).toBe(false);
  });

  it('只从日历头读取日历颜色；没有颜色的文件保持未知', () => {
    expect(icsCalendarColor('BEGIN:VCALENDAR\r\nX-APPLE-CALENDAR-COLOR:#123456\r\nBEGIN:VEVENT\r\nCOLOR:#abcdef')).toBe('#123456');
    expect(icsCalendarColor('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nCOLOR:#abcdef')).toBe('');
    expect(icsCalendarColor('BEGIN:VCALENDAR\r\nX-WR-CALNAME:test\r\nEND:VCALENDAR')).toBe('');
  });

  it.each(['#123456', 'basil'])('本站 ICS 再导入保留活动覆盖色 %s', (color) => {
    const event: CalEvent = {
      id: 1, calendarId: 1, title: 'fixture', description: '', location: '', allDay: false,
      start: Date.UTC(2026, 8, 28, 2), end: Date.UTC(2026, 8, 28, 3), tz: 'UTC',
      rrule: '', exdates: [], seriesId: null, occurrenceMs: null, color, reminders: [], guests: [], updatedAt: 1,
    };
    const text = eventsToIcs({ name: 'fixture', tz: 'UTC', events: [event] });
    expect(parseIcs(text, 'UTC')[0].color).toBe(color);
  });
});
