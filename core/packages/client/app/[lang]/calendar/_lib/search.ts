import type { CalEvent, EventOccurrence } from '@cuberoot/shared/calendar';
import { expandRange } from '@/lib/calendar-store';
import { addDaysToKey, dayStart } from './format';

export interface SearchFilters {
  calendar: string;
  participant: string;
  location: string;
  exclude: string;
  from: string;
  to: string;
}

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  calendar: 'enabled', participant: '', location: '', exclude: '', from: '', to: '',
};

export function searchWindow(filters: SearchFilters, today: string, tz: string) {
  const fromKey = filters.from || addDaysToKey(today, -365);
  const toKey = filters.to || addDaysToKey(today, 365);
  const from = dayStart(tz, fromKey);
  const to = dayStart(tz, addDaysToKey(toKey, 1));
  return { from, to, fromKey, toKey, valid: Number.isFinite(from) && Number.isFinite(to) && to > from && to - from <= 750 * 86_400_000 };
}

/** Filter master events before expanding; keep recurrence identity and event timezones. */
export function searchOccurrences(events: CalEvent[], query: string, filters: SearchFilters, hidden: number[], from: number, to: number): EventOccurrence[] {
  const normalize = (s: string) => s.trim().toLocaleLowerCase();
  const q = normalize(query);
  const participant = normalize(filters.participant);
  const location = normalize(filters.location);
  const exclude = normalize(filters.exclude);
  const matches = events.filter(event => {
    if (filters.calendar !== 'enabled' && filters.calendar !== 'all' && String(event.calendarId) !== filters.calendar) return false;
    const text = normalize(`${event.title} ${event.description} ${event.location}`);
    if (q && !text.includes(q)) return false;
    if (exclude && text.includes(exclude)) return false;
    if (location && !normalize(event.location).includes(location)) return false;
    if (participant && !event.guests.some(g => normalize(`${g.name} ${g.key}`).includes(participant))) return false;
    return true;
  });
  // Daily recurrence must not inherit the grid's 400-item cap for a 750-day search.
  return expandRange({ events: matches, hidden: filters.calendar === 'enabled' ? hidden : [], from, to, showDeclined: true, occurrenceLimit: 10000 });
}
