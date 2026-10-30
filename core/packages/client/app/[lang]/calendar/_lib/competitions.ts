import type { Comp } from '@/lib/comp-search';
import type { WcaCompetition } from '@/lib/wca-person-api';
export type CompetitionSource = 'attended' | 'registered' | 'followed' | 'upcoming';
export interface CalendarCompetition extends Comp { source: CompetitionSource }
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
