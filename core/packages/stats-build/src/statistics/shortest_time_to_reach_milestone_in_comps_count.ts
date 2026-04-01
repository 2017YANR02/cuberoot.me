// NOTE: 最短时间达到比赛数里程碑
// 与 Ruby _stats_build/statistics/shortest_time_to_reach_milestone_in_comps_count.rb 1:1 对应
import { GroupedStatistic } from '../core/grouped_statistic.js';
import type { RowDataPacket } from 'mysql2';

export class ShortestTimeToReachMilestoneInCompsCount extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Shortest amount of time to reach a milestone in competitions count';
    this.titleZh = '最短时间达到比赛数里程碑';
    this.tableHeader = {
      'Days': 'right',
      'Person': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        start_date
      FROM (
        SELECT DISTINCT
          person_id,
          competition_id,
          start_date
        FROM results
        JOIN competitions competition ON competition.id = competition_id
      ) AS competition_dates_with_people
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      ORDER BY start_date
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应——对每个里程碑数值计算达成天数
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    const milestones = [300, 250, 200, 150, 100, 50, 25, 10, 5];

    // NOTE: 按选手分组
    const byPerson = new Map<string, Date[]>();
    for (const row of rows) {
      const key = row['person_link'] as string;
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(row['start_date'] as Date);
    }

    return milestones.map(count => {
      const results: [number, string][] = [];

      for (const [personLink, dates] of byPerson) {
        if (dates.length < count) continue;
        const firstDate = dates[0];
        const milestoneDate = dates[count - 1];
        // NOTE: +1 与 Ruby 的 (milestone_date - first_date).to_i + 1 对应
        const days = Math.floor((milestoneDate.getTime() - firstDate.getTime()) / (24 * 3600 * 1000)) + 1;
        results.push([days, personLink]);
      }

      const sorted = results.sort((a, b) => a[0] - b[0]).slice(0, 20);
      return [`${count} Competitions`, sorted] as [string, unknown[][]];
    });
  }
}
