// NOTE: Rankings 抽象基类——按项目 × {Single, Average} 分组排名
// 子类通过 constructor 传入 WHERE 条件来过滤数据
import { GroupedStatistic } from './grouped_statistic.js';
import { EVENTS, EVENTS_ENTRIES } from './events.js';
import { SolveTime } from './solve_time.js';
import { ATTEMPTS_SUBQUERY } from './database.js';
import type { RowDataPacket } from 'mysql2';

export abstract class Rankings extends GroupedStatistic {
  protected condition: string;

  constructor(title: string, titleZh: string, note: string, noteZh: string, condition: string) {
    super();
    this.condition = condition;
    this.title = title;
    this.titleZh = titleZh;
    this.note = note;
    this.noteZh = noteZh;
    this.tableHeader = {
      'Person': 'left', 'Result': 'right', 'Country': 'left',
      'Competition': 'left', 'Details': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        event_id,
        best single,
        average,
        ${ATTEMPTS_SUBQUERY} AS attempts,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        country.name country
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN countries country ON country.id = person.country_id
      JOIN competitions competition ON competition.id = competition_id
      ${this.condition}
    `;
  }

  // 对每个 event × {single, average}，筛选、排序、去重、top 10
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return EVENTS_ENTRIES.flatMap(([eventId, eventName]) => {
      return (['single', 'average'] as const).map(type => {
        // NOTE: 筛选该项目且该类型值 > 0 的行，同步计算 SolveTime
        // 避免 spread RowDataPacket（会丢失 index signature）
        const filtered = rows
          .filter(r => r['event_id'] === eventId && Number(r[type]) > 0)
          .map(r => ({ row: r, st: new SolveTime(eventId, type, Number(r[type])) }));

        // NOTE: 按 SolveTime 排序
        filtered.sort((a, b) => a.st.compareTo(b.st));

        // NOTE: 每人只保留最佳（去重）
        const seen = new Set<string>();
        const unique = filtered.filter(({ row }) => {
          const key = String(row['person_link']);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // NOTE: 取 top 10 并格式化输出
        const results = unique.slice(0, 10).map(({ row, st }) => {
          const details = String(row['attempts'] || '').split(',')
            .map(v => new SolveTime(eventId, 'single', Number(v)).clockFormat())
            .filter(s => s.length > 0)
            .join(' ');
          return [
            row['person_link'],
            `**${st.clockFormat()}**`,
            row['country'],
            row['competition_link'],
            details,
          ];
        });

        const sectionTitle = `${eventName} - ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        return [sectionTitle, results] as [string, unknown[][]];
      });
    });
  }
}
