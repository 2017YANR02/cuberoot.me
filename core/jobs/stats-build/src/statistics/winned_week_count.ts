// NOTE: 获胜周数
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS, EVENTS_ENTRIES } from '../core/events.js';
import type { RowDataPacket } from 'mysql2';

export class WinnedWeekCount extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Winned week count';
    this.titleZh = '获胜周数';
    this.note = "In other words it's the number of weeks when the given person got the fastest single in the given event.";
    this.noteZh = '即该选手在给定项目中获得该周最快单次的周数。';
    this.tableHeader = {
      'Person': 'left',
      'Winned weeks': 'right',
    };
  }

  query(): string {
    return `
      SELECT
        event_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        winned_weeks
      FROM (
        SELECT
          333_best_by_week.event_id,
          person_id,
          COUNT(DISTINCT 333_best_by_week.event_id, best, week_start_date) winned_weeks
        FROM (
          SELECT
            event_id,
            MIN(best) week_best,
            DATE_ADD(start_date, INTERVAL(-WEEKDAY(start_date)) DAY) week_start_date,
            DATE_ADD(start_date, INTERVAL(6 - WEEKDAY(start_date)) DAY) week_end_date
          FROM results
          JOIN competitions competition ON competition.id = competition_id
          WHERE best > 0
          GROUP BY event_id, week_start_date, week_end_date
        ) AS 333_best_by_week
        JOIN results result ON result.event_id = 333_best_by_week.event_id AND best = week_best
        JOIN competitions competition ON competition.id = competition_id
        WHERE start_date BETWEEN week_start_date AND week_end_date
        GROUP BY 333_best_by_week.event_id, person_id
      ) AS winned_weeks_by_person
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1;
    `;
  }

  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return EVENTS_ENTRIES.map(([eventId, eventName]) => {
      const results = rows
        .filter(r => r['event_id'] === eventId)
        .sort((a, b) => Number(b['winned_weeks']) - Number(a['winned_weeks']))
        .slice(0, 20)
        .map(r => [r['person_link'], r['winned_weeks']]);

      return [eventName, results] as [string, unknown[][]];
    });
  }
}
