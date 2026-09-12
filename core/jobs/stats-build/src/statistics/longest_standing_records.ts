// NOTE: 最长保持纪录
import { GroupedStatistic, type GroupedSection } from '../core/grouped_statistic.js';
import { EVENTS, OFFICIAL_EVENTS } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';
import { RECORD_LEVELS, recordRegions, recordRowsForScope } from '../core/record_scopes.js';

export class LongestStandingRecords extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Longest standing records';
    this.titleZh = '最长保持纪录';
    this.note = 'Historical world and continental records, ranked after filtering. Ties do not end a record; retired events stop at their last competition. Region follows the competitor’s country at the time of the result.';
    this.noteZh = '历史世界及洲际纪录，按筛选条件分别排名。追平不结束保持期；停办项目只计至最后一场比赛。地区按选手取得成绩时的所属国家划分。';
    this.tableHeader = {
      'Event': 'left',
      'Type': 'left',
      'Days': 'right',
      'Result': 'right',
      'Person': 'left',
      'Competition': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        regional_single_record,
        regional_average_record,
        best single,
        average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/by_person#', person.wca_id, ')') results_link,
        competition.start_date competition_date,
        result.event_id,
        continent.name continent,
        retired.last_date last_event_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = result.country_id
      JOIN continents continent ON continent.id = country.continent_id
      LEFT JOIN (
        SELECT r.event_id, MAX(c.end_date) last_date
        FROM results r
        JOIN competitions c ON c.id = r.competition_id
        WHERE r.event_id IN ('333ft', 'magic', 'mmagic', '333mbo')
        GROUP BY r.event_id
      ) retired ON retired.event_id = result.event_id
      WHERE regional_single_record IN ('AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR', 'WR')
         OR regional_average_record IN ('AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR', 'WR')
      ORDER BY competition_date
    `;
  }

  // Calculate each record's duration before taking a top ten for each filter combination.
  transform(rows: RowDataPacket[], today = new Date()): GroupedSection[] {
    const sections: GroupedSection[] = [];
    for (const region of recordRegions(rows)) {
      const level = region === 'World' ? 'WR' : 'CR';
      const regionRows = recordRowsForScope(rows, region, level);
      const records: { event: string; type: 'single' | 'average'; days: number; row: unknown[] }[] = [];
      for (const type of ['single', 'average'] as const) {
        const markers: readonly string[] = RECORD_LEVELS[level];
        const byEvent = new Map<string, RowDataPacket[]>();
        for (const row of regionRows) {
          const event = String(row.event_id);
          if (!OFFICIAL_EVENTS.includes(event) || !markers.includes(row[`regional_${type}_record`]) || Number(row[type]) <= 0) continue;
          const list = byEvent.get(event) ?? [];
          list.push(row);
          byEvent.set(event, list);
        }
        for (const [event, eventRows] of byEvent) {
          eventRows.sort((a, b) => new Date(a.competition_date).getTime() - new Date(b.competition_date).getTime());
          for (const row of eventRows) {
            const start = new Date(row.competition_date).getTime();
            const better = eventRows.find(next => Number(next[type]) < Number(row[type]) && new Date(next.competition_date).getTime() >= start);
            const end = better ? new Date(better.competition_date) : row.last_event_date ? new Date(row.last_event_date) : today;
            const days = Math.max(0, Math.floor((end.getTime() - start) / 86400000));
            records.push({ event, type, days, row: [
              EVENTS[event], type === 'single' ? 'Single' : 'Average', `**${days}**`,
              new SolveTime(event, type, Number(row[type])).clockFormat(), row.person_link, row.results_link,
            ] });
          }
        }
      }
      records.sort((a, b) => b.days - a.days || a.event.localeCompare(b.event));
      for (const event of ['', ...OFFICIAL_EVENTS]) {
        const eventRecords = records.filter(record => !event || record.event === event);
        const types = new Set(eventRecords.map(record => record.type));
        for (const type of ['all', 'single', 'average'] as const) {
          if (type === 'all' && types.size < 2) continue;
          const top = eventRecords.filter(record => type === 'all' || record.type === type).slice(0, 10);
          if (top.length) sections.push([
            `${region} - ${event || 'All events'} - ${type}`, top.map(record => record.row),
            { region, level, event, type },
          ]);
        }
      }
    }
    return sections;
  }
}
