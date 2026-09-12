// NOTE: 单场比赛最多纪录
import { GroupedStatistic, type GroupedSection } from '../core/grouped_statistic.js';
import type { RowDataPacket } from 'mysql2';
import { RECORD_LEVELS, recordRegions, recordRowsForScope, takeTopNWithTies } from '../core/record_scopes.js';
import type { RecordScope } from '../core/statistic.js';

export class MostRecordsAtSingleCompetition extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Most records at a single competition';
    this.titleZh = '单场比赛最多纪录';
    this.note = 'All historical records; region follows the competitor’s country at the time of the result. Higher record levels count toward lower levels.';
    this.noteZh = '统计所有历史纪录；地区按选手取得成绩时的所属国家划分。高级别纪录同时计入较低级别。';
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
        continent.name continent,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/by_person#', person.wca_id, ')') results_link
      FROM results
      JOIN countries country ON country.id = results.country_id
      JOIN continents continent ON continent.id = country.continent_id
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      WHERE (regional_single_record IS NOT NULL AND regional_single_record != '')
         OR (regional_average_record IS NOT NULL AND regional_average_record != '')
    `;
  }

  // NOTE: 按 World/Continental/National 三级纪录统计
  transform(rows: RowDataPacket[]): GroupedSection[] {
    return recordRegions(rows).flatMap(region => Object.entries(RECORD_LEVELS).map(([level, recordIds]) => {
      const scopedRows = recordRowsForScope(rows, region, level as RecordScope['level']);
      // NOTE: 按 (person, competition) 分组统计纪录数
      const groups = new Map<string, { person: string; results: string; count: number }>();
      for (const row of scopedRows) {
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

      return [`${region} - ${level}`, takeTopNWithTies(sorted, 20, 0), { region, level: level as RecordScope['level'], event: '', type: 'all' }] as GroupedSection;
    }));
  }
}
