import type { PastCompRecord, UpcomingCompRecord } from './api/comps_json';
import { assertUniqueCompetitionIndex } from './competition_index';
import { countryToIso2 } from './country_flag';
export interface CalendarMonth { past: PastCompRecord[]; upcoming: UpcomingCompRecord[]; contentHash: string }
export interface CalendarSummary {
  countryOptions: string[];
  maxRounds: Record<string, number>;
  maxDays: number;
  firstCountry: Record<string, string>;
  firstEvent: Record<string, string>;
  yearMonths: Record<string, number[]>;
}
export interface CalendarManifest extends CalendarSummary { version: 1; months: Record<string, string> }
/** Match the Monday-first calendar, including adjacent-month grid days. */
export function calendarWindow(month: string): [string, string] {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
  const last = new Date(Date.UTC(year, number, 0));
  last.setUTCDate(last.getUTCDate() + (7 - last.getUTCDay()) % 7);
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}
export function buildCalendarData(past: PastCompRecord[], upcoming: UpcomingCompRecord[]) {
  assertUniqueCompetitionIndex(past, 'all_past_comps');
  assertUniqueCompetitionIndex(upcoming, 'all_upcoming_comps');
  const upcomingIds = new Set(upcoming.map(c => c.id));
  const historical = past.filter(c => !upcomingIds.has(c.id));
  // Same order and country normalization as the public calendar adapters.
  const all = [...upcoming, ...historical.map(c => ({ ...c, country: countryToIso2(c.country).toUpperCase() || c.country }))];
  const counts: Record<string, number> = {}, maxRounds: Record<string, number> = {};
  const yearMonths: Record<string, number[]> = {};
  const firstCountry = new Map<string, typeof all[number]>(), firstEvent = new Map<string, typeof all[number]>();
  let maxDays = 1;
  const remember = (map: typeof firstCountry, key: string, c: typeof all[number]) => {
    const previous = map.get(key);
    if (!previous || c.start_date < previous.start_date || (c.start_date === previous.start_date && c.id < previous.id)) map.set(key, c);
  };
  for (const c of all) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.start_date) || !Number.isFinite(Date.parse(c.start_date))) throw new Error(`Invalid competition date: ${c.id}`);
    counts[c.country] = (counts[c.country] ?? 0) + 1;
    for (const [event, n] of Object.entries(c.rounds ?? {})) maxRounds[event] = Math.max(maxRounds[event] ?? 0, n);
    maxDays = Math.max(maxDays, Math.round((Date.parse(c.end_date || c.start_date) - Date.parse(c.start_date)) / 86400000) + 1);
    const year = c.start_date.slice(0, 4), month = Number(c.start_date.slice(5, 7));
    const months = yearMonths[year] ??= [];
    if (!months.includes(month)) months.push(month);
    remember(firstCountry, c.country.toUpperCase(), c);
    for (const event of c.events) remember(firstEvent, event, c);
  }
  const summary: CalendarSummary = {
    countryOptions: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([country]) => country),
    maxRounds, maxDays: Math.min(6, maxDays), yearMonths,
    firstCountry: Object.fromEntries([...firstCountry].map(([key, c]) => [key, c.id])),
    firstEvent: Object.fromEntries([...firstEvent].map(([key, c]) => [key, c.id])),
  };
  const months: Record<string, Omit<CalendarMonth, 'contentHash'>> = {};
  const dates = all.flatMap(c => [c.start_date, c.end_date || c.start_date]).sort();
  if (!dates.length) throw new Error('Refusing an empty calendar snapshot');
  // Include adjacent months too: their calendar grids can contain competitions.
  const first = new Date(dates[0] + 'T00:00:00Z'), last = new Date(dates.at(-1)! + 'T00:00:00Z');
  first.setUTCDate(1); first.setUTCMonth(first.getUTCMonth() - 1);
  last.setUTCDate(1); last.setUTCMonth(last.getUTCMonth() + 1);
  for (const date = first; date <= last; date.setUTCMonth(date.getUTCMonth() + 1)) {
    const month = date.toISOString().slice(0, 7), [start, end] = calendarWindow(month);
    const intersects = (c: typeof all[number]) => c.start_date <= end && (c.end_date || c.start_date) >= start;
    const slice = { past: historical.filter(intersects), upcoming: upcoming.filter(intersects) };
    if (slice.past.length || slice.upcoming.length) months[month] = slice;
  }
  return { summary, months };
}
