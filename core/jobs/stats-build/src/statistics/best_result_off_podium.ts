// NOTE: 最佳非领奖台成绩
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS, EVENTS_ENTRIES } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

export class BestResultOffPodium extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Best result not providing a podium';
    this.titleZh = '最佳非领奖台成绩';
    this.note = 'Only finals are taken into account.';
    this.noteZh = '仅统计决赛。';
    this.tableHeader = {
      'Person': 'left',
      'Single': 'right',
      'Average': 'right',
      'Competition': 'left',
      'Place': 'center',
    };
  }

  query(): string {
    return `
      SELECT
        format.sort_by,
        format.sort_by_second,
        results.event_id,
        best single,
        average,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, '/results/all#e', results.event_id, '_', round_type_id, ')') podium_link,
        pos place
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN preferred_formats preferred_format ON preferred_format.event_id = results.event_id AND ranking = 1
      JOIN formats format ON format.id = preferred_format.format_id
      WHERE round_type_id IN ('c', 'f') AND pos > 3
    `;
  }

  // NOTE: 按项目分组、用 sort_by 指定的字段排序
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return EVENTS_ENTRIES.map(([eventId, eventName]) => {
      // NOTE: 为每行创建 SolveTime 并保留原始 row 引用
      const enriched = rows
        .filter(r => r['event_id'] === eventId)
        .map(r => ({
          row: r,
          single: new SolveTime(eventId, 'single', Number(r['single'])),
          average: new SolveTime(eventId, 'average', Number(r['average'])),
        }));

      const sortBy = enriched[0]?.row['sort_by'] as string | undefined;
      const sortBy2 = enriched[0]?.row['sort_by_second'] as string | undefined;

      enriched.sort((a, b) => {
        const primary = sortBy === 'average' ? 'average' : 'single';
        const secondary = sortBy2 === 'average' ? 'average' : 'single';
        const cmp1 = a[primary].compareTo(b[primary]);
        if (cmp1 !== 0) return cmp1;
        return a[secondary].compareTo(b[secondary]);
      });

      const results = enriched.slice(0, 10).map(({ row, single, average }) => {
        const primary = sortBy === 'average' ? 'average' : 'single';
        const secondary = sortBy2 === 'average' ? 'average' : 'single';
        const singleSt = primary === 'single' ? single : average;
        const averageSt = primary === 'single' ? average : single;
        // NOTE: 主排序字段加粗
        const primaryStr = primary === 'single'
          ? `**${singleSt.clockFormat()}**` : singleSt.clockFormat();
        const secondaryStr = primary === 'average'
          ? `**${averageSt.clockFormat()}**` : averageSt.clockFormat();

        return [
          row['person_link'],
          primary === 'single' ? primaryStr : secondaryStr,
          primary === 'single' ? secondaryStr : primaryStr,
          row['podium_link'],
          row['place'],
        ];
      });

      return [eventName, results] as [string, unknown[][]];
    });
  }
}

