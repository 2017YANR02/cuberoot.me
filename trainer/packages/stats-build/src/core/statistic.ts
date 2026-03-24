// NOTE: 统计基类——与 Ruby _stats_build/core/statistic.rb 对应
// 子类实现 query() 返回 SQL 字符串，基类负责执行查询、转换数据、输出 JSON
import { query as dbQuery } from './database.js';
import { headerZh } from './events.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 分组统计的 section 定义（GroupedStatistic 使用）
export interface StatSection {
  title: string;
  titleZh: string;
  rows: unknown[][];
}

// NOTE: 双视图面板（Ranking + History）——RoundMetric/AverageOfX/AoRounds 使用
// 与 Ruby StatPanel#tabbed_grouped_markdown 对应
export interface StatPanel {
  id: string;       // 'ranking' | 'history'
  labelEn: string;  // Tab 按钮英文标签
  labelZh: string;  // Tab 按钮中文标签
  header: Array<{
    key: string;
    label: string;
    labelZh: string;
    align: Alignment;
  }>;
  sections: StatSection[];
}

// NOTE: 表头对齐方向
export type Alignment = 'left' | 'right' | 'center';

// NOTE: 表头定义：{列名: 对齐方向}
export type TableHeader = Record<string, Alignment>;

// NOTE: JSON 输出格式——React 前端消费
// 普通统计使用 rows，分组统计使用 sections，双视图使用 panels
export interface StatJson {
  id: string;
  title: string;
  titleZh: string;
  note?: string;
  noteZh?: string;
  header: Array<{
    key: string;
    label: string;
    labelZh: string;
    align: Alignment;
  }>;
  rows?: unknown[][];       // NOTE: 普通统计（Statistic）
  sections?: StatSection[]; // NOTE: 分组统计（GroupedStatistic）
  panels?: StatPanel[];     // NOTE: 双视图统计（RoundMetric/AverageOfX/AoRounds）
}

export abstract class Statistic {
  // NOTE: 子类在 constructor 中设置这些属性
  protected title = '';
  protected titleZh = '';
  protected note = '';
  protected noteZh = '';
  protected tableHeader: TableHeader = {};

  // NOTE: 子类实现——返回 SQL 查询字符串
  abstract query(): string;

  // NOTE: 执行查询返回原始行数据
  async queryResults(): Promise<RowDataPacket[]> {
    return dbQuery(this.query());
  }

  // NOTE: 默认 transform——从 RowDataPacket 提取值数组（顺序与 SQL SELECT 一致）
  // 与 Ruby 的 query_results.map(&:values) 对应
  transform(rows: RowDataPacket[]): unknown[][] {
    return rows.map(row => Object.values(row));
  }

  // NOTE: 从类名推导统计 ID（CamelCase → snake_case）
  // 与 Ruby top() 方法中的 basename 推导逻辑一致
  get id(): string {
    return this.constructor.name
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/([a-z])(\d)/g, '$1_$2')
      .toLowerCase();
  }

  // NOTE: 生成 JSON 结构——React 前端消费
  async toJson(): Promise<StatJson> {
    const rawRows = await this.queryResults();
    const data = this.transform(rawRows);

    const headerEntries = Object.entries(this.tableHeader);

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh || this.title,
      ...(this.note ? { note: this.note } : {}),
      ...(this.noteZh ? { noteZh: this.noteZh } : {}),
      header: headerEntries.map(([label, align]) => ({
        key: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        labelZh: headerZh(label),
        align,
      })),
      rows: data,
    };
  }
}
