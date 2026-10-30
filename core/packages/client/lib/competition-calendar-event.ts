import { localZone } from '@cuberoot/shared/tz';
import { fetchBootstrap, fetchEvents, syncCalendarCompetitions } from './calendar-api';

import { competitionCalendarRange, type CompetitionCalendarInput } from '@cuberoot/shared/calendar';
export { competitionCalendarRange, type CompetitionCalendarInput } from '@cuberoot/shared/calendar';

async function competitionCalendarContext(input: CompetitionCalendarInput) {
  const bootstrap = await fetchBootstrap(localZone());
  const calendar = bootstrap.calendars.find(item => item.isDefault);
  if (!calendar) throw new Error('Default calendar unavailable');
  const range = competitionCalendarRange(input.startDate, input.endDate, calendar.tz);
  const link = `https://www.worldcubeassociation.org/competitions/${encodeURIComponent(input.id)}`;
  const { events, invitedIds } = await fetchEvents(range.start, range.end);
  const ownCalendars = new Set(bootstrap.calendars.map(item => item.id));
  const exists = events.some(event => ownCalendars.has(event.calendarId) && !invitedIds.includes(event.id)
    && event.description.split(/\r?\n/).includes(link));
  return { calendar, range, link, exists };
}

export async function isCompetitionInCalendar(input: CompetitionCalendarInput): Promise<boolean> {
  return (await competitionCalendarContext(input)).exists;
}

const pending = new Map<string, Promise<void>>();

/** Coalesce local clicks; the server atomically deduplicates across sources and devices. */
export function addCompetitionToCalendar(owner: string, input: CompetitionCalendarInput): Promise<void> {
  const key = `competition-calendar:${owner}:${input.id}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const add = async () => {
    await syncCalendarCompetitions([input], true, owner);
  };
  const result = (typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(key, add) : add()).finally(() => pending.delete(key));
  pending.set(key, result);
  return result;
}
