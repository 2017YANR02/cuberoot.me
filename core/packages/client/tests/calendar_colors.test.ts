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

  it('深色主题逐项对应 Google 现代配色菜单的实际色值', () => {
    const expected = ['#4b99d2', '#6e72c3', '#828bc2', '#a75aba', '#d6837a', '#da5234', '#e3683e', '#e7ba51', '#55b080', '#489160', '#7c7c7c'];
    expect(CALENDAR_COLOR_DEFS.map((c) => colorHex(c.key, 'dark'))).toEqual(expected);
  });

  it('保留新版 24 色标签的深浅模式，同时不改写用户的普通 hex', () => {
    expect(Object.keys(GOOGLE_LABEL_COLORS)).toHaveLength(24);
    for (const [light, dark] of Object.entries(GOOGLE_LABEL_COLORS)) {
      expect(isCalendarColor(`google:${light}`)).toBe(true);
      expect(colorHex(`google:${light}`, 'light')).toBe(light);
      expect(colorHex(`google:${light}`, 'dark')).toBe(dark);
      expect(colorHex(light, 'dark')).toBe(light);
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
