// NOTE: 姓名词数统计
// 与 Ruby _stats_build/statistics/name_parts_count.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

export class NamePartsCount extends Statistic {
  constructor() {
    super();
    this.title = 'Name parts count';
    this.titleZh = '姓名词数统计';
    this.note = 'Local names within parentheses are ignored.';
    this.noteZh = '括号内的本地名称被忽略。';
    this.tableHeader = {
      'Parts': 'center',
      'People': 'right',
      'Countries of origin': 'left',
    };
  }

  // NOTE: SQL 与 Ruby 版完全一致
  query(): string {
    return `
      SELECT
        person.name name,
        country.name country_name
      FROM persons person
      JOIN countries country ON country.id = country_id
      WHERE sub_id = 1
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应
  // 1. 去掉括号内本地名称 → 按空格分词计数
  // 2. 按词数分组 → 统计人数
  // 3. 每个分组取 top 5 国家，计算该国占比
  transform(rows: RowDataPacket[]): unknown[][] {
    // NOTE: 按姓名词数分组
    const groups = new Map<number, Array<{ name: string; countryName: string }>>();
    for (const row of rows) {
      const name = (row['name'] as string).replace(/ \(.*\)/, '');
      const partsCount = name.split(' ').length;
      if (!groups.has(partsCount)) groups.set(partsCount, []);
      groups.get(partsCount)!.push({
        name: row['name'] as string,
        countryName: row['country_name'] as string,
      });
    }

    // NOTE: 对每个分组计算 top 5 国家
    const result: unknown[][] = [];
    for (const [partsCount, people] of groups) {
      // NOTE: 按国家聚合人数
      const countryCount = new Map<string, number>();
      for (const p of people) {
        countryCount.set(p.countryName, (countryCount.get(p.countryName) ?? 0) + 1);
      }

      // NOTE: 按人数降序 → 取 top 5 → 格式化为 "Country *(xx.xx %)*"
      const countriesStr = [...countryCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([country, count]) => {
          const percent = ((count / people.length) * 100).toFixed(2);
          return `${country} *(${percent} %)*`;
        })
        .join(', ');

      result.push([partsCount, people.length, countriesStr]);
    }

    // NOTE: 按词数升序排列（与 Ruby .sort_by!(&:first) 对应）
    return result.sort((a, b) => (a[0] as number) - (b[0] as number));
  }
}
