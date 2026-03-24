// NOTE: 最小的单次与平均差距
// 与 Ruby _stats_build/statistics/smallest_diff_between_single_and_average.rb 1:1 对应
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

export class SmallestDiffBetweenSingleAndAverage extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Smallest difference between a single and an average';
    this.titleZh = '最小的单次与平均差距';
    this.note = "FMC is ignored because values are integers, thus it's likely to get the same single and average.";
    this.noteZh = 'FMC 因整数值容易相同而被排除。';
    this.tableHeader = {
      'Diff': 'right',
      'Person': 'left',
      'Single': 'right',
      'Average': 'right',
      'Results': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        event_id,
        best single,
        average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/by_person#', person.wca_id, ')') results_link
      FROM results
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE event_id != '333fm' AND average > 0
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return Object.entries(EVENTS).map(([eventId, eventName]) => {
      const withDiff = rows
        .filter(r => r['event_id'] === eventId)
        .map(r => ({ row: r, diff: Number(r['average']) - Number(r['single']) }));

      const results = withDiff
        .sort((a, b) => a.diff - b.diff || Number(a.row['average']) - Number(b.row['average']) || Number(a.row['single']) - Number(b.row['single']))
        .slice(0, 10)
        .map(({ row, diff }) => {
          const diffStr = (diff / 100.0).toFixed(2);
          const singleStr = new SolveTime(eventId, 'single', Number(row['single'])).clockFormat();
          const avgStr = new SolveTime(eventId, 'average', Number(row['average'])).clockFormat();
          return [diffStr, row['person_link'], singleStr, avgStr, row['results_link']];
        });

      return [eventName, results] as [string, unknown[][]];
    });
  }
}

