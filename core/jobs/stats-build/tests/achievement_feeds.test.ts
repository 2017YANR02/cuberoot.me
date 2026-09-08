import { describe, expect, it, vi } from 'vitest';
import type { RowDataPacket } from 'mysql2';
import { MostPodiumsTogether } from '../src/statistics/most_podiums_together';
import { WinnedWeekCount } from '../src/statistics/winned_week_count';
import { WorldChampionshipRecords } from '../src/statistics/world_championship_records';

const person = (id: string) => `[Person ${id}](https://www.worldcubeassociation.org/persons/${id})`;
const raw = (rows: object[]) => rows as RowDataPacket[];

describe('complete badge evidence without widening visible leaderboards', () => {
  it('includes eligible pairs below the visible top 100 and keeps names', async () => {
    const stat = new MostPodiumsTogether();
    const rows = Array.from({ length: 101 }, (_, i) => Array.from({ length: 10 }, () => ({ people: `${person(`P${i}`)},${person(`Q${i}`)}` }))).flat();
    rows.push({ people: `${person('SHORT')},${person('PAIR')}` });
    vi.spyOn(stat, 'queryResults').mockResolvedValue(raw(rows));
    const result = await stat.toJson();
    expect(result.sections?.[0].rows.length).toBe(100);
    expect(result.achievementRows.length).toBe(101);
    expect(result.achievementRows[100]).toEqual(['P100', 'Q100', 10, 'Person P100', 'Person Q100']);
  });

  it('includes weekly winners below the top 20 and excludes sub-threshold counts', async () => {
    const stat = new WinnedWeekCount();
    vi.spyOn(stat, 'queryResults').mockResolvedValue(raw(Array.from({ length: 22 }, (_, i) => ({ person_link: person(`P${i}`), event_id: '333', winned_weeks: i === 21 ? 9 : 10 }))));
    const result = await stat.toJson();
    expect(result.sections?.[0].rows.length).toBe(20);
    expect(result.achievementRows.length).toBe(21);
    expect(result.achievementRows[20]).toEqual(['P20', '333', 10]);
  });

  it('keeps tied world championship bests and actual event-specific edition chronology', async () => {
    const stat = new WorldChampionshipRecords();
    const row = (personId: string, compId: string, date: string, event = '333', single = 500) => ({ person_id: personId, competition_id: compId, competition_date: date, event_id: event, single, average: 0, person_link: person(personId), competition_link: compId, country_name: 'Country' });
    vi.spyOn(stat, 'queryResults').mockResolvedValue(raw([
      row('P1', 'WorldLater', '2023-08-01'), row('P2', 'WorldLater', '2023-08-01'),
      row('P1', 'WorldEarly', '2019-07-01', '333', 600), row('P3', 'WorldEarly', '2019-07-01', '222', 200),
    ]));
    const result = await stat.toJson();
    expect(result.achievementRows).toEqual([
      ['P1', '333', 'single', 500, 'WorldLater'], ['P2', '333', 'single', 500, 'WorldLater'],
      ['P3', '222', 'single', 200, 'WorldEarly'],
    ]);
    expect(result.worldEditions).toEqual([
      { compId: 'WorldEarly', date: '2019-07-01', events: ['222', '333'] },
      { compId: 'WorldLater', date: '2023-08-01', events: ['333'] },
    ]);
  });
});
