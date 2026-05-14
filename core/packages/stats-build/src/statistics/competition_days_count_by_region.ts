// NOTE: 按区域统计比赛天数
import { GroupedStatistic } from '../core/grouped_statistic.js';
import type { RowDataPacket } from 'mysql2';

export class CompetitionDaysCountByRegion extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Competition days count by region';
    this.titleZh = '按区域统计比赛天数';
    this.tableHeader = {
      'Days': 'right',
      'Region': 'left',
      'Competitions': 'right',
    };
  }

  query(): string {
    return `
      SELECT
        (DATEDIFF(end_date, start_date) + 1) days,
        country.name country,
        continent.name continent
      FROM competitions
      JOIN countries country ON country.id = country_id
      JOIN continents continent ON continent.id = continent_id
      WHERE country_id
        NOT IN ('XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW')
        AND continent_id != "_Multiple Continents"
    `;
  }

  // NOTE: 按 World/Continents/Countries 三个维度分组
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    const groupings: Record<string, (r: RowDataPacket) => string> = {
      'World': () => 'World',
      'Continents': (r) => r['continent'] as string,
      'Countries': (r) => r['country'] as string,
    };

    return Object.entries(groupings).map(([header, groupFn]) => {
      // NOTE: 按分组键聚合
      const groups = new Map<string, { totalDays: number; count: number }>();
      for (const row of rows) {
        const key = groupFn(row);
        const days = Number(row['days']);
        if (!groups.has(key)) groups.set(key, { totalDays: 0, count: 0 });
        const g = groups.get(key)!;
        g.totalDays += days;
        g.count += 1;
      }

      const results = [...groups.entries()]
        .map(([region, { totalDays, count }]) => ({
          mean: totalDays / count,
          region,
          count,
        }))
        .sort((a, b) => b.mean - a.mean || a.region.localeCompare(b.region))
        .map(({ mean, region, count }) => [mean.toFixed(2), region, count]);

      return [header, results] as [string, unknown[][]];
    });
  }
}
