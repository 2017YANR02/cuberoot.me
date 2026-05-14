// NOTE: 最多共同登台次数
import { GroupedStatistic } from '../core/grouped_statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 组合数学——从 arr 中选 k 个元素的所有组合
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinations(arr.slice(i + 1), k - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}

export class MostPodiumsTogether extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Most podiums together';
    this.titleZh = '最多共同登台次数';
    this.tableHeader = {
      'Podiums': 'right',
      'People': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        GROUP_CONCAT(
          CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')')
          ORDER BY person.name
        ) people
      FROM results
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN round_types round_type ON round_type.id = round_type_id
      WHERE 1
        AND round_type.final = 1
        AND pos <= 3
        AND best > 0
      GROUP BY event_id, competition_id
    `;
  }

  // NOTE: 对每组领奖台选手取组合，统计共同登台频率
  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    const podiums = rows.map(r => (r['people'] as string).split(','));

    const groups: Record<number, string> = { 2: 'Pairs', 3: 'Triples' };

    return Object.entries(groups).map(([countStr, header]) => {
      const peopleCount = Number(countStr);
      const freq = new Map<string, number>();

      for (const people of podiums) {
        const combos = combinations(people, peopleCount);
        for (const combo of combos) {
          const key = combo.join(' & ');
          freq.set(key, (freq.get(key) ?? 0) + 1);
        }
      }

      const results = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100)
        .map(([people, count]) => [count, people]);

      return [header, results] as [string, unknown[][]];
    });
  }
}
