// NOTE: 单场比赛最多纪录
import { GroupedStatistic } from '../core/grouped_statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 取 top N，含并列
function takeTopNWithTies(xs: unknown[][], n: number, valueIndex: number): unknown[][] {
  if (xs.length <= n) return xs;
  const boundaryValue = xs[n - 1][valueIndex];
  const top = xs.slice(0, n);
  const ties = xs.slice(n).filter(x => x[valueIndex] === boundaryValue);
  return [...top, ...ties];
}

export class MostRecordsAtSingleCompetition extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Most records at a single competition';
    this.titleZh = '单场比赛最多纪录';
    this.tableHeader = {
      'Records': 'right',
      'Person': 'left',
      'Results': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        regional_single_record,
        regional_average_record,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/by_person#', person.wca_id, ')') results_link
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE (regional_single_record IS NOT NULL AND regional_single_record != '')
         OR (regional_average_record IS NOT NULL AND regional_average_record != '')
    `;
  }

  // NOTE: 按 World/Continental/National 三级纪录统计
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    const levels: Record<string, string[]> = {
      'World': ['WR'],
      'Continental': ['AfR', 'AsR', 'NAR', 'SAR', 'ER', 'OcR', 'WR'],
      'National': ['NR', 'AfR', 'AsR', 'NAR', 'SAR', 'ER', 'OcR', 'WR'],
    };

    return Object.entries(levels).map(([header, recordIds]) => {
      // NOTE: 按 (person, competition) 分组统计纪录数
      const groups = new Map<string, { person: string; results: string; count: number }>();
      for (const row of rows) {
        const key = `${row['person_link']}|||${row['results_link']}`;
        if (!groups.has(key)) {
          groups.set(key, { person: row['person_link'] as string, results: row['results_link'] as string, count: 0 });
        }
        const g = groups.get(key)!;
        if (recordIds.includes(row['regional_single_record'] as string)) g.count += 1;
        if (recordIds.includes(row['regional_average_record'] as string)) g.count += 1;
      }

      const sorted = [...groups.values()]
        .map(({ count, person, results }) => [count, person, results] as unknown[])
        .sort((a, b) => (b[0] as number) - (a[0] as number));

      return [header, takeTopNWithTies(sorted, 20, 0)] as [string, unknown[][]];
    });
  }
}
