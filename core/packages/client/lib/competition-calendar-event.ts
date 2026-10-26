import { localZone, wallToUtc } from '@cuberoot/shared/tz';
import { createEvent, fetchBootstrap, fetchEvents } from './calendar-api';

export interface CompetitionCalendarInput {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
}

/** Competition dates are calendar days, not UTC timestamps. Use the personal
 * calendar's timezone so an all-day competition stays on its named dates. */
export function competitionCalendarRange(startDate: string, endDate: string, tz: string) {
  const parse = (value: string) => {
    const key = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Invalid competition date');
    const date = new Date(`${key}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) throw new Error('Invalid competition date');
    return date;
  };
  const startDay = parse(startDate);
  const lastDay = parse(endDate || startDate);
  if (lastDay < startDay) throw new Error('Invalid competition date range');
  lastDay.setUTCDate(lastDay.getUTCDate() + 1);
  const midnight = (date: Date) => wallToUtc(tz, {
    y: date.getUTCFullYear(), mo: date.getUTCMonth() + 1, d: date.getUTCDate(), h: 0, mi: 0, s: 0,
  }).getTime();
  return { start: midnight(startDay), end: midnight(lastDay) };
}

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

/** Serialize clicks/remounts, and tabs where Web Locks is available. Recheck
 * persisted events before creating so revisiting the page does not add a copy. */
export function addCompetitionToCalendar(owner: string, input: CompetitionCalendarInput): Promise<void> {
  const key = `competition-calendar:${owner}:${input.id}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const add = async () => {
    const { calendar, range, link, exists } = await competitionCalendarContext(input);
    if (exists) return;
    await createEvent({ calendarId: calendar.id, title: input.title, description: link,
      location: input.location, allDay: true, tz: calendar.tz, ...range });
  };
  const result = (typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(key, add) : add()).finally(() => pending.delete(key));
  pending.set(key, result);
  return result;
}
