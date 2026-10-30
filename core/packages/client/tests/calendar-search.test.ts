import { describe, expect, it } from 'vitest';
import type { CalEvent } from '@cuberoot/shared/calendar';
import { EMPTY_SEARCH_FILTERS, searchOccurrences, searchWindow } from '@/app/[lang]/calendar/_lib/search';
import { dayStart } from '@/app/[lang]/calendar/_lib/format';

const tz = 'Asia/Shanghai';
const start = dayStart(tz, '2026-10-30');
const event: CalEvent = {
  id: 1, calendarId: 10, title: '魔方训练', description: '复习 PLL', location: '上海会议室',
  start, end: start + 3600000, tz, allDay: false, rrule: '', exdates: [], seriesId: null,
  occurrenceMs: null, color: '', reminders: [], updatedAt: 0,
  guests: [{ key: '2017YANR02', name: '颜瑞民', status: 'accepted' }],
};

describe('calendar search', () => {
  it('combines keyword, participant, location and exclusion filters', () => {
    const filters = { ...EMPTY_SEARCH_FILTERS, participant: '2017yanr02', location: '上海', exclude: '取消' };
    const cancelled = { ...event, id: 2, title: '魔方训练 取消' };
    const wrongPlace = { ...event, id: 3, location: '北京' };
    expect(searchOccurrences([event, cancelled, wrongPlace], 'pll', filters, [], start, start + 86400000).map(o => o.event.id)).toEqual([1]);
    expect(searchOccurrences([event], '', { ...filters, participant: '颜瑞民' }, [], start, start + 86400000)).toHaveLength(1);
    expect(searchOccurrences([event], '', { ...filters, participant: '不存在' }, [], start, start + 86400000)).toHaveLength(0);
  });

  it('distinguishes enabled, all and explicitly selected hidden calendars', () => {
    const other = { ...event, id: 2, calendarId: 20 };
    const run = (calendar: string) => searchOccurrences([event, other], '', { ...EMPTY_SEARCH_FILTERS, calendar }, [20], start, start + 86400000).map(o => o.event.id);
    expect(run('enabled')).toEqual([1]);
    expect(run('all')).toEqual([1, 2]);
    expect(run('20')).toEqual([2]);
  });

  it('includes the full end date and handles DST in the selected timezone', () => {
    const range = searchWindow({ ...EMPTY_SEARCH_FILTERS, from: '2026-11-01', to: '2026-11-01' }, '2026-10-30', 'America/Los_Angeles');
    expect(range.to - range.from).toBe(25 * 3600000);
    expect(range.valid).toBe(true);
    const window = searchWindow({ ...EMPTY_SEARCH_FILTERS, from: '2026-10-30', to: '2026-10-30' }, '2026-10-30', tz);
    const late = { ...event, start: window.to - 1800000, end: window.to + 1800000 };
    const nextDay = { ...event, id: 2, start: window.to, end: window.to + 3600000 };
    expect(searchOccurrences([late, nextDay], '', EMPTY_SEARCH_FILTERS, [], window.from, window.to).map(o => o.event.id)).toEqual([1]);
    expect(searchWindow({ ...EMPTY_SEARCH_FILTERS, from: '2025-01-01', to: '2028-01-01' }, '2026-10-30', tz).valid).toBe(false);
  });

  it('returns daily recurrences beyond the grid cap and keeps overridden occurrences unique', () => {
    const first = dayStart(tz, '2025-01-01');
    const excluded = dayStart(tz, '2026-10-30');
    const series = { ...event, start: first, end: first + 3600000, rrule: 'FREQ=DAILY', exdates: [excluded] };
    const override = { ...event, id: 2, seriesId: 1, occurrenceMs: excluded };
    const occurrences = searchOccurrences([series, override], '', EMPTY_SEARCH_FILTERS, [], first, dayStart(tz, '2027-01-01'));
    expect(occurrences).toHaveLength(730);
    expect(occurrences.filter(o => o.start === excluded).map(o => o.event.id)).toEqual([2]);
    expect(occurrences.at(-1)?.start).toBe(dayStart(tz, '2026-12-31'));
  });
});
