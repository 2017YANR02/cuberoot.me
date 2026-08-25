// NOTE: GroupedStatistic 基类——按项目（或其他维度）分组的统计
// 子类的 transform() 返回 [sectionTitle, rows][] 格式
import { Statistic, type StatJson } from './statistic.js';
import { headerZh, eventZh } from './events.js';
import type { RowDataPacket } from 'mysql2';

export abstract class GroupedStatistic extends Statistic {
  // NOTE: 子类必须覆写——返回 [sectionTitle, rows][] 格式
  // sectionTitle 通常是 WCA 项目英文名（如 "Rubik's Cube"）
  abstract override transform(rows: RowDataPacket[]): [string, unknown[][]][];

  // NOTE: 覆写 toJson()——输出 sections 而非 rows
  // markdown 方法：
  //   按 event 分组，每组一个 section，空 section 被跳过
  async toJson(): Promise<StatJson> {
    let rawRows: RowDataPacket[] | null = await this.queryResults();
    const grouped = this.transform(rawRows);
    // NOTE: 内存管理——transform 完成后释放原始查询结果
    rawRows = null;
    if (global.gc) global.gc();

    const headerEntries = Object.entries(this.tableHeader);

    // NOTE: 过滤掉空 section
    const sections = grouped
      .filter(([, rows]) => rows.length > 0)
      .map(([title, rows]) => ({
        title,
        titleZh: eventZh(title),
        rows,
      }));

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
      sections,
    };
  }
}
