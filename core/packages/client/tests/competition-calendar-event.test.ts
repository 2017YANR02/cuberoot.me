import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCompetitionToCalendar, competitionCalendarRange, isCompetitionInCalendar } from '@/lib/competition-calendar-event';
import { syncCalendarCompetitions, fetchBootstrap, fetchEvents } from '@/lib/calendar-api';
vi.mock('@/lib/calendar-api', () => ({ syncCalendarCompetitions: vi.fn(), fetchBootstrap: vi.fn(), fetchEvents: vi.fn() }));

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
    expect(syncCalendarCompetitions).toHaveBeenCalledTimes(1);
    expect(syncCalendarCompetitions).toHaveBeenCalledWith([input], true, 'test');
  });
  it('does not recreate a persisted competition, independent of translated title', async () => {
    vi.mocked(fetchEvents).mockResolvedValue({ events: [{ id: 9, calendarId: 7, description: 'https://www.worldcubeassociation.org/competitions/LishuiOpen2026' }], invitedIds: [] } as unknown as Awaited<ReturnType<typeof fetchEvents>>);
    expect(await isCompetitionInCalendar(input)).toBe(true);
    expect(syncCalendarCompetitions).not.toHaveBeenCalled();
  });
  it('allows retry after the atomic import fails', async () => {
    vi.mocked(syncCalendarCompetitions).mockRejectedValueOnce(new Error('offline'));
    await expect(addCompetitionToCalendar('test', input)).rejects.toThrow('offline');
    await addCompetitionToCalendar('test', input);
    expect(syncCalendarCompetitions).toHaveBeenCalledTimes(2);
  });
});
