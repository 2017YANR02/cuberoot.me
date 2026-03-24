// NOTE: 领奖台最差成绩——按项目分组
// 与 Ruby _stats_build/statistics/worst_result_on_podium.rb 1:1 对应
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS, EVENTS_ENTRIES } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

export class WorstResultOnPodium extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Worst result providing a podium';
    this.titleZh = '领奖台最差成绩';
    this.note = 'Only finals are taken into account. Results where the main statistic is DNF are ignored.';
    this.noteZh = '仅统计决赛。主成绩为 DNF 的结果被排除。';
    this.tableHeader = {
      'Person': 'left',
      'Single': 'right',
      'Average': 'right',
      'Competition': 'left',
      'Place': 'center',
    };
  }

  // NOTE: SQL 与 Ruby 版完全一致
  query(): string {
    return `
      SELECT
        format.sort_by,
        format.sort_by_second,
        results.event_id,
        best single,
        average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/podiums#e', results.event_id, ')') podium_link,
        pos place
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN preferred_formats preferred_format ON preferred_format.event_id = results.event_id AND ranking = 1
      JOIN formats format ON format.id = preferred_format.format_id
      WHERE round_type_id IN ('c', 'f') AND pos <= 3
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应
  // 按项目遍历 → 用 SolveTime 解析 → 过滤 DNF → 按主成绩正序排列 → 反转取最差 top 10
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return EVENTS_ENTRIES.map(([eventId, eventName]) => {
      // NOTE: 筛选当前项目的结果
      const eventRows = rows.filter(r => r['event_id'] === eventId);

      // NOTE: 解析成绩 → 过滤 → 排序
      const processed = eventRows
        .map(row => {
          const sortBy = row['sort_by'] as string;     // "single" 或 "average"
          const sortBySecond = row['sort_by_second'] as string;
          const single = new SolveTime(eventId, 'single', Number(row['single']));
          const average = new SolveTime(eventId, 'average', Number(row['average']));

          return {
            sortBy,
            sortBySecond,
            single,
            average,
            personLink: row['person_link'] as string,
            podiumLink: row['podium_link'] as string,
            place: row['place'],
          };
        })
        // NOTE: 过滤掉主成绩不完整的（DNF/DNS/跳过）
        .filter(r => {
          const primary = r.sortBy === 'single' ? r.single : r.average;
          return primary.isComplete();
        })
        // NOTE: 按主成绩 → 次成绩正序排列
        .sort((a, b) => {
          const aPrimary = a.sortBy === 'single' ? a.single : a.average;
          const bPrimary = b.sortBy === 'single' ? b.single : b.average;
          const cmp = aPrimary.compareTo(bPrimary);
          if (cmp !== 0) return cmp;
          const aSecondary = a.sortBySecond === 'single' ? a.single : a.average;
          const bSecondary = b.sortBySecond === 'single' ? b.single : b.average;
          return aSecondary.compareTo(bSecondary);
        })
        // NOTE: 反转后取 top 10（即最差的 10 个）
        .reverse()
        .slice(0, 10)
        .map(r => {
          // NOTE: 主成绩加粗，次成绩普通格式
          const primaryFormatted = r.sortBy === 'single'
            ? `**${r.single.clockFormat()}**`
            : r.single.clockFormat();
          const secondaryFormatted = r.sortBy === 'average'
            ? `**${r.average.clockFormat()}**`
            : r.average.clockFormat();

          return [r.personLink, primaryFormatted, secondaryFormatted, r.podiumLink, r.place];
        });

      return [eventName, processed] as [string, unknown[][]];
    });
  }
}
