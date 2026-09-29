import type { Comp } from '@/lib/comp-search';
import type { WcaCompetition } from '@/lib/wca-person-api';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { colorHex, readableInk } from '@/lib/calendar-colors';
import { addDaysToKey, type FcEvent } from './format';

export type CompetitionSource = 'attended' | 'registered' | 'followed' | 'upcoming';
export interface CalendarCompetition extends Comp { source: CompetitionSource }
export const COMPETITION_SOURCE_LABELS = {
  attended: { zh: '已参赛', en: 'Attended' },
  registered: { zh: '已报名', en: 'Registered' },
  followed: { zh: '已关注 · 未确认报名', en: 'Following · registration unconfirmed' },
  upcoming: { zh: '未来比赛 · 未确认报名', en: 'Upcoming · registration unconfirmed' },
};

/** 每场比赛只出现一次；个人参赛/报名关系优先于关注和全量目录。 */
export function mergeCalendarCompetitions(index: Comp[], history: WcaCompetition[], registered: string[], followed: string[], today: string): CalendarCompetition[] {
  const indexed = new Map(index.map((c) => [c.id, c]));
  const entries = new Map<string, CalendarCompetition>();
  const followedIds = new Set(followed);
  const registeredIds = new Set(registered);
  for (const c of index) {
    if (c.end_date < today) continue;
    entries.set(c.id, { ...c, source: registeredIds.has(c.id) ? 'registered' : followedIds.has(c.id) ? 'followed' : 'upcoming' });
  }
  for (const c of history) {
    entries.set(c.id, { ...indexed.get(c.id), ...c, country: c.country_iso2, source: 'attended' });
  }
  return [...entries.values()].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));
}

/** WCA 日期是场地当地日历日；全天条使用日期串，避免显示时区把比赛挪到前一天。 */
export function competitionCalendarEvent(c: CalendarCompetition, isZh: boolean, theme: 'light' | 'dark' = 'light'): FcEvent {
  const color = colorHex(c.source === 'attended' || c.source === 'registered' ? 'basil' : c.source === 'followed' ? 'tangerine' : 'graphite', theme);
  return {
    id: `wca:${c.id}`, title: localizeCompName(c.id, c.name, isZh, { date: c.start_date }),
    start: c.start_date, end: addDaysToKey(c.end_date || c.start_date, 1), allDay: true,
    backgroundColor: color, borderColor: color, textColor: readableInk(color), editable: false,
    extendedProps: { eventId: 0, occurrence: 0, recurring: false, calendarId: 0, location: localizeCity(c.city ?? '', isZh), invited: false, rsvp: '', busy: false, competitionId: c.id },
  };
}
