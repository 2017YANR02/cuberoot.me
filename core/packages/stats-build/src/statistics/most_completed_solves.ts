// NOTE: 最多完成还原数——按 6 维度分组
// 与 Ruby _stats_build/statistics/most_completed_solves.rb 1:1 对应
import { GroupedStatistic } from '../core/grouped_statistic.js';
import type { RowDataPacket } from 'mysql2';

export class MostCompletedSolves extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Most completed solves';
    this.titleZh = '最多完成还原数';
    this.tableHeader = {
      '': 'left',
      'Solves': 'right',
      'Attempts': 'right',
    };
  }

  // NOTE: SQL 与 Ruby 版完全一致——通过 result_attempts 子查询统计完成数和 DNF 数
  query(): string {
    return `
      SELECT
        (SELECT COUNT(*) FROM result_attempts ra WHERE ra.result_id = result.id AND ra.value > 0) completed_count,
        (SELECT COUNT(*) FROM result_attempts ra WHERE ra.result_id = result.id AND ra.value = -1) dnfs_count,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        country.name country,
        continent.name continent,
        YEAR(competition.start_date) year,
        event.name event
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN countries country ON country.id = competition.country_id
      JOIN continents continent ON continent.id = continent_id
      JOIN events event ON event.id = event_id
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应
  // 按 6 个维度分组（Competition/Person/Country/Continent/Year/Event）
  // 每个维度返回一个 section —— [sectionTitle, rows]
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    // NOTE: 6 个维度定义：section 标题 → 数据字段名
    const dimensions: [string, string][] = [
      ['Competition', 'competition_link'],
      ['Person', 'person_link'],
      ['Country', 'country'],
      ['Continent', 'continent'],
      ['Year', 'year'],
      ['Event', 'event'],
    ];

    return dimensions.map(([groupName, groupField]) => {
      // NOTE: 按字段值聚合 completed_count 和 dnfs_count
      const grouped = new Map<string, { completed: number; dnfs: number }>();
      for (const row of rows) {
        const key = String(row[groupField]);
        const entry = grouped.get(key) ?? { completed: 0, dnfs: 0 };
        entry.completed += Number(row['completed_count']);
        entry.dnfs += Number(row['dnfs_count']);
        grouped.set(key, entry);
      }

      // NOTE: 按完成数降序 → 再按尝试数升序 → 再按名称升序排列
      // 取 top 20，completed_count 加粗（与 Ruby 一致）
      const sorted = [...grouped.entries()]
        .map(([key, val]) => ({
          key,
          completed: val.completed,
          attempts: val.completed + val.dnfs,
        }))
        .sort((a, b) =>
          b.completed - a.completed
          || a.attempts - b.attempts
          || a.key.localeCompare(b.key)
        )
        .slice(0, 20)
        .map(r => [r.key, `**${r.completed}**`, r.attempts]);

      return [groupName, sorted] as [string, unknown[][]];
    });
  }
}
