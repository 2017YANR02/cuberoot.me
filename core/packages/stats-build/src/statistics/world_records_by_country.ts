// NOTE: 各国世界纪录数量（含按年累计时间轴）
// 扩展：除了原 rows（国家总数降序），额外输出 years[] + cumulative{countryName: number[]}
// 用于 /globe 的 WR 模式（choropleth + 年份 slider + play/pause）
// 和 /wca/world_records_by_country 的年份 slider
import { Statistic } from '../core/statistic.js';
import type { StatJson } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

interface WrByYearRow extends RowDataPacket {
  country: string;
  year: number;
  wrs: number | string;
}

export class WorldRecordsByCountry extends Statistic {
  constructor() {
    super();
    this.title = 'World records count by country';
    this.titleZh = '各国世界纪录数量';
    this.tableHeader = {
      'WRs': 'right',
      'Country': 'left',
    };
  }

  // NOTE: 按国家+年份分组统计 WR 数（single + average 各计 1 条）
  query(): string {
    return `
      SELECT
        country.name AS country,
        YEAR(comp.start_date) AS year,
        SUM(IF(regional_single_record = 'WR', 1, 0)
          + IF(regional_average_record = 'WR', 1, 0)) AS wrs
      FROM results
      JOIN competitions comp ON comp.id = results.competition_id
      JOIN countries country ON country.id = results.country_id
      WHERE regional_single_record = 'WR' OR regional_average_record = 'WR'
      GROUP BY country.id, year
      ORDER BY year, country.name
    `;
  }

  async toJson(): Promise<StatJson> {
    const rawRows = await this.queryResults() as WrByYearRow[];
    if (global.gc) global.gc();

    if (rawRows.length === 0) {
      return {
        id: this.id,
        title: this.title,
        titleZh: this.titleZh,
        header: [
          { key: 'wrs',     label: 'WRs',     labelZh: '世界纪录数', align: 'right' },
          { key: 'country', label: 'Country', labelZh: '国家',       align: 'left' },
        ],
        rows: [],
        years: [],
        cumulative: {},
      };
    }

    // NOTE: years = [minYear .. currentYear]，保证时间轴连续（中间没 WR 的年也占位）
    const minYear = rawRows.reduce((m, r) => Math.min(m, Number(r.year)), 9999);
    const maxYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);

    // NOTE: 按国家 → { year: count } 稀疏表
    const perYearByCountry = new Map<string, Map<number, number>>();
    for (const row of rawRows) {
      const name = String(row.country);
      const y = Number(row.year);
      const n = Number(row.wrs);
      let byYear = perYearByCountry.get(name);
      if (!byYear) {
        byYear = new Map();
        perYearByCountry.set(name, byYear);
      }
      byYear.set(y, n);
    }

    // NOTE: 转成累计稠密数组
    const cumulative: Record<string, number[]> = {};
    for (const [name, byYear] of perYearByCountry) {
      const arr: number[] = [];
      let cum = 0;
      for (const y of years) {
        cum += byYear.get(y) ?? 0;
        arr.push(cum);
      }
      cumulative[name] = arr;
    }

    // NOTE: 主 rows = 截至最后一年的累计，按 WR 数降序 + 国名字母序
    const rows: unknown[][] = Object.entries(cumulative)
      .map(([name, arr]) => [String(arr[arr.length - 1]), name])
      .filter(r => Number(r[0]) > 0)
      .sort((a, b) => {
        const diff = Number(b[0]) - Number(a[0]);
        return diff !== 0 ? diff : String(a[1]).localeCompare(String(b[1]));
      });

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh,
      header: [
        { key: 'wrs',     label: 'WRs',     labelZh: '世界纪录数', align: 'right' },
        { key: 'country', label: 'Country', labelZh: '国家',       align: 'left' },
      ],
      rows,
      years,
      cumulative,
    };
  }
}
