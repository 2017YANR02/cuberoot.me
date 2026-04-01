// NOTE: 最长保持纪录
// 与 Ruby _stats_build/statistics/longest_standing_records.rb 1:1 对应
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS, OFFICIAL_EVENTS } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

export class LongestStandingRecords extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Longest standing records';
    this.titleZh = '最长保持纪录';
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
        event_id,
        continent.name continent
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = result.country_id
      JOIN continents continent ON continent.id = country.continent_id
      WHERE regional_single_record IN ('AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR', 'WR')
         OR regional_average_record IN ('AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR', 'WR')
      ORDER BY competition_date
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应——按区域×类型统计最长保持天数
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    const regionRecords: Record<string, string[]> = {
      'World': ['WR'],
      'Africa': ['AfR', 'WR'],
      'Asia': ['AsR', 'WR'],
      'Europe': ['ER', 'WR'],
      'North America': ['NAR', 'WR'],
      'Oceania': ['OcR', 'WR'],
      'South America': ['SAR', 'WR'],
    };

    const today = new Date();

    return Object.entries(regionRecords).map(([region, recordIds]) => {
      const results: unknown[][] = [];

      for (const type of ['single', 'average'] as const) {
        const recordField = type === 'single' ? 'regional_single_record' : 'regional_average_record';

        // NOTE: 筛选符合区域和纪录类型的记录
        const filtered = rows.filter(r =>
          recordIds.includes(r[recordField] as string) &&
          (region === 'World' || region === r['continent']) &&
          OFFICIAL_EVENTS.includes(r['event_id'] as string)
        );

        // NOTE: 按项目分组
        const byEvent = new Map<string, RowDataPacket[]>();
        for (const r of filtered) {
          const eid = r['event_id'] as string;
          if (!byEvent.has(eid)) byEvent.set(eid, []);
          byEvent.get(eid)!.push(r);
        }

        for (const [, eventRows] of byEvent) {
          for (const r of eventRows) {
            // NOTE: 找到更好的纪录（值更小），计算保持天数
            const betterResult = eventRows.find(r2 => Number(r2[type]) < Number(r[type]));
            const betterDate = betterResult ? new Date(betterResult['competition_date'] as Date) : today;
            const rDate = new Date(r['competition_date'] as Date);
            const days = Math.floor((betterDate.getTime() - rDate.getTime()) / (24 * 3600 * 1000));
            const eventName = EVENTS[r['event_id'] as string] ?? (r['event_id'] as string);
            const st = new SolveTime(r['event_id'] as string, type, Number(r[type]));
            results.push([
              eventName,
              type.charAt(0).toUpperCase() + type.slice(1),
              days,
              st.clockFormat(),
              r['person_link'],
              r['results_link'],
            ]);
          }
        }
      }

      // NOTE: 按天数降序 → 取 top 10 → 加粗天数
      const sorted = results
        .sort((a, b) => (b[2] as number) - (a[2] as number))
        .slice(0, 10)
        .map(row => {
          row[2] = `**${row[2]}**`;
          return row;
        });

      return [region, sorted] as [string, unknown[][]];
    });
  }
}
