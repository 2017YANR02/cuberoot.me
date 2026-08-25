// NOTE: 在最多项目中打破纪录
import { GroupedStatistic } from '../core/grouped_statistic.js';
import type { RowDataPacket } from 'mysql2';

export class RecordsInMostEvents extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Records in the highest number of events';
    this.titleZh = '在最多项目中打破纪录';
    this.note = 'All historical records are taken into account (i.e. not only the current ones).';
    this.noteZh = '统计所有历史纪录（不仅是当前纪录）。';
    this.tableHeader = {
      'Events': 'right',
      'Person': 'left',
      'List': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        regional_single_record,
        regional_average_record,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        event.name event_name
      FROM results
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN events event ON event.id = event_id
      WHERE (regional_single_record IS NOT NULL AND regional_single_record != '')
         OR (regional_average_record IS NOT NULL AND regional_average_record != '')
      ORDER BY event.rank
    `;
  }

  // NOTE: 按 World/Continental/National 三级纪录分组
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    const levels: Record<string, string[]> = {
      'World': ['WR'],
      'Continental': ['AfR', 'AsR', 'NAR', 'SAR', 'ER', 'OcR', 'WR'],
      'National': ['NR', 'AfR', 'AsR', 'NAR', 'SAR', 'ER', 'OcR', 'WR'],
    };

    return Object.entries(levels).map(([header, recordIds]) => {
      // NOTE: 按选手分组 → 统计不重复的项目数
      const byPerson = new Map<string, Set<string>>();
      for (const row of rows) {
        const person = row['person_link'] as string;
        const hasRecord = recordIds.includes(row['regional_single_record'] as string)
          || recordIds.includes(row['regional_average_record'] as string);
        if (hasRecord) {
          if (!byPerson.has(person)) byPerson.set(person, new Set());
          byPerson.get(person)!.add(row['event_name'] as string);
        }
      }

      const results = [...byPerson.entries()]
        .map(([person, events]) => [events.size, person, [...events].join(', ')] as unknown[])
        .sort((a, b) => (b[0] as number) - (a[0] as number))
        .slice(0, 20);

      return [header, results] as [string, unknown[][]];
    });
  }
}
