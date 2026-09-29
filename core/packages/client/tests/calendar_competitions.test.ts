import { describe, expect, it } from 'vitest';
import { mergeCalendarCompetitions, competitionCalendarEvent, type CalendarCompetition } from '@/app/[lang]/calendar/_lib/competitions';
import { dayStart, defaultEventEnd } from '@/app/[lang]/calendar/_lib/format';
import type { Comp } from '@/lib/comp-search';

const comp = (id: string, start = '2026-09-28', end = start): Comp => ({ id, name: `${id} 2026`, start_date: start, end_date: end, city: 'Shanghai', country: 'CN' });

describe('WCA calendar sources', () => {
  it('keeps history outside the current window and gives attendance precedence over other sources', () => {
    const old = comp('Past', '2017-12-30', '2018-01-01');
    const rows = mergeCalendarCompetitions([old, comp('Registered'), comp('Followed'), comp('Future')], [{ ...old, city: 'Shanghai', country_iso2: 'CN' }], ['Registered'], ['Registered', 'Followed', 'Past'], '2026-09-28');
    expect(rows.map((c) => [c.id, c.source])).toEqual([['Past', 'attended'], ['Followed', 'followed'], ['Future', 'upcoming'], ['Registered', 'registered']]);
  });
  it('does not present unrelated past competitions or following as confirmed registration', () => {
    const rows = mergeCalendarCompetitions([comp('Old', '2020-01-01'), comp('Followed')], [], [], ['Followed'], '2026-09-28');
    expect(rows.map((c) => [c.id, c.source])).toEqual([['Followed', 'followed']]);
  });
  it.each([
    ['2026-09-28', '2026-09-28', '2026-09-29'],
    ['2026-09-28', '2026-09-30', '2026-10-01'],
    ['2026-12-30', '2027-01-02', '2027-01-03'],
  ])('renders the complete inclusive competition range %s to %s as a readonly event', (start, end, exclusiveEnd) => {
    const c: CalendarCompetition = { ...comp('Fixture', start, end), source: 'attended' };
    const event = competitionCalendarEvent(c, false);
    expect(event.start).toBe(start);
    expect(event.end).toBe(exclusiveEnd);
    expect(event.editable).toBe(false);
    expect(event.allDay).toBe(true);
    expect(event.id).toBe('wca:Fixture');
    expect(event.extendedProps.competitionId).toBe('Fixture');
  });
});

describe('new event duration', () => {
  it.each([15, 30, 60, 90, 120])('uses the %i-minute preference without changing the clicked start', (minutes) => {
    const start = Date.parse('2026-09-28T09:15:00Z');
    expect(defaultEventEnd(start, false, minutes, 'Asia/Shanghai') - start).toBe(minutes * 60_000);
  });
  it.each([['2026-03-08', 23], ['2026-11-01', 25]])('uses the next local midnight on DST day %s', (date, hours) => {
    const start = dayStart('America/Los_Angeles', String(date));
    expect(defaultEventEnd(start, true, 90, 'America/Los_Angeles') - start).toBe(Number(hours) * 3_600_000);
  });
});
