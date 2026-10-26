import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCompetitionToCalendar, competitionCalendarRange } from '@/lib/competition-calendar-event';
import { createEvent, fetchBootstrap, fetchEvents } from '@/lib/calendar-api';
vi.mock('@/lib/calendar-api', () => ({ createEvent: vi.fn(), fetchBootstrap: vi.fn(), fetchEvents: vi.fn() }));

const input = { id: 'LishuiOpen2026', title: '丽水公开赛2026', startDate: '2026-12-06', endDate: '2026-12-06', location: '丽水' };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchBootstrap).mockResolvedValue({ calendars: [{ id: 7, isDefault: true, tz: 'Asia/Shanghai' }] } as Awaited<ReturnType<typeof fetchBootstrap>>);
  vi.mocked(fetchEvents).mockResolvedValue({ events: [], invitedIds: [] });
});
describe('competition calendar', () => {
  it('uses local calendar midnights with an exclusive end, including DST and multi-day competitions', () => {
    expect(competitionCalendarRange('2026-12-06', '', 'Asia/Shanghai')).toEqual({ start: Date.parse('2026-12-05T16:00:00Z'), end: Date.parse('2026-12-06T16:00:00Z') });
    expect(competitionCalendarRange('2026-03-07', '2026-03-08', 'America/Los_Angeles')).toEqual({ start: Date.parse('2026-03-07T08:00:00Z'), end: Date.parse('2026-03-09T07:00:00Z') });
    expect(() => competitionCalendarRange('2026-02-30', '', 'UTC')).toThrow();
    expect(() => competitionCalendarRange('2026-12-06', '2026-12-05', 'UTC')).toThrow();
  });
  it('serializes concurrent clicks and preserves event details', async () => {
    await Promise.all([addCompetitionToCalendar('test', input), addCompetitionToCalendar('test', input)]);
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(createEvent).toHaveBeenCalledWith({ calendarId: 7, title: input.title, description: 'https://www.worldcubeassociation.org/competitions/LishuiOpen2026', location: '丽水', allDay: true, tz: 'Asia/Shanghai', start: Date.parse('2026-12-05T16:00:00Z'), end: Date.parse('2026-12-06T16:00:00Z') });
  });
  it('does not recreate a persisted competition, independent of translated title', async () => {
    vi.mocked(fetchEvents).mockResolvedValue({ events: [{ id: 9, calendarId: 7, description: 'https://www.worldcubeassociation.org/competitions/LishuiOpen2026' }], invitedIds: [] } as unknown as Awaited<ReturnType<typeof fetchEvents>>);
    await addCompetitionToCalendar('test', input);
    expect(createEvent).not.toHaveBeenCalled();
  });
  it('allows retry after a failed request and never creates when reading existing events fails', async () => {
    vi.mocked(fetchEvents).mockRejectedValueOnce(new Error('offline'));
    await expect(addCompetitionToCalendar('test', input)).rejects.toThrow('offline');
    expect(createEvent).not.toHaveBeenCalled();
    await addCompetitionToCalendar('test', input);
    expect(createEvent).toHaveBeenCalledTimes(1);
  });
});
