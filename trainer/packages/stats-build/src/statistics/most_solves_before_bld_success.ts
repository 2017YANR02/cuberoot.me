// NOTE: 盲拧成功前最多尝试次数
// 与 Ruby _stats_build/statistics/most_solves_before_bld_success.rb 1:1 对应
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { BLD_EVENTS } from '../core/events.js';
import { ATTEMPTS_SUBQUERY } from '../core/database.js';
import type { RowDataPacket } from 'mysql2';

export class MostSolvesBeforeBldSuccess extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Most solves before getting a successful BLD attempt';
    this.titleZh = '盲拧成功前最多尝试次数';
    this.tableHeader = {
      'Attempts': 'right',
      'Person': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        event_id,
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        ${ATTEMPTS_SUBQUERY} AS attempts
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      JOIN events event ON event.id = event_id
      WHERE event_id IN ('333bf', '444bf', '555bf', '333mbf')
      ORDER BY competition.start_date, round_type.rank
    `;
  }

  // NOTE: 与 Ruby transform 1:1 对应
  // 按选手追踪所有 attempt → 找到首次成功（值 > 0）的索引
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return Object.entries(BLD_EVENTS).map(([eventId, eventName]) => {
      const eventRows = rows.filter(r => r['event_id'] === eventId);

      // NOTE: 按选手分组
      const byPerson = new Map<string, RowDataPacket[]>();
      for (const r of eventRows) {
        const key = r['person_link'] as string;
        if (!byPerson.has(key)) byPerson.set(key, []);
        byPerson.get(key)!.push(r);
      }

      const results: [number, string][] = [];

      for (const [personLink, personRows] of byPerson) {
        // NOTE: 展开所有 attempt 值
        const allAttempts: number[] = [];
        for (const r of personRows) {
          const vals = ((r['attempts'] as string) || '').split(',').map(Number);
          // NOTE: 只保留 DNF(-1) 和有效成绩(>0)，排除跳过(0)和 DNS(-2)
          for (const v of vals) {
            if (v === -1 || v > 0) allAttempts.push(v);
          }
        }

        // NOTE: 找首次成功的索引
        const firstSuccess = allAttempts.findIndex(v => v > 0);
        if (firstSuccess >= 0) {
          results.push([firstSuccess, personLink]);
        }
      }

      const sorted = results
        .sort((a, b) => b[0] - a[0])
        .slice(0, 20);

      return [eventName, sorted] as [string, unknown[][]];
    });
  }
}
