// NOTE: 在最多项目中打破纪录
import { GroupedStatistic, type GroupedSection } from '../core/grouped_statistic.js';
import type { RowDataPacket } from 'mysql2';
import { RECORD_LEVELS, recordRegions, recordRowsForScope, takeTopNWithTies } from '../core/record_scopes.js';
import type { RecordScope } from '../core/statistic.js';

export class RecordsInMostEvents extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Records in the highest number of events';
    this.titleZh = '在最多项目中打破纪录';
    this.note = 'All historical records; region follows the competitor’s country at the time of the result. Higher record levels count toward lower levels.';
    this.noteZh = '统计所有历史纪录；地区按选手取得成绩时的所属国家划分。高级别纪录同时计入较低级别。';
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
        continent.name continent,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        event.name event_name
      FROM results
      JOIN countries country ON country.id = results.country_id
      JOIN continents continent ON continent.id = country.continent_id
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN events event ON event.id = event_id
      WHERE (regional_single_record IS NOT NULL AND regional_single_record != '')
         OR (regional_average_record IS NOT NULL AND regional_average_record != '')
      ORDER BY event.rank
    `;
  }

  // NOTE: 按 World/Continental/National 三级纪录分组
  transform(rows: RowDataPacket[]): GroupedSection[] {
    return recordRegions(rows).flatMap(region => Object.entries(RECORD_LEVELS).map(([level, recordIds]) => {
      const scopedRows = recordRowsForScope(rows, region, level as RecordScope['level']);
      // NOTE: 按选手分组 → 统计不重复的项目数
      const byPerson = new Map<string, Set<string>>();
      for (const row of scopedRows) {
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
        .sort((a, b) => (b[0] as number) - (a[0] as number));

      return [`${region} - ${level}`, takeTopNWithTies(results, 20, 0), { region, level: level as RecordScope['level'], event: '', type: 'all' }] as GroupedSection;
    }));
  }
}
