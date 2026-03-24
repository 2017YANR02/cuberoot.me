// NOTE: 移动平均（指数加权平均 EMA）
// 与 Ruby _stats_build/statistics/moving_average.rb 1:1 对应
import { GroupedStatistic } from '../core/grouped_statistic.js';
import { EVENTS, EVENTS_ENTRIES } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 指数加权平均（EMA）+ 偏差校正
// α = 0.8 → 最近约 5 个结果权重占主导
function movingAverage(numbers: number[]): number {
  const alpha = 0.8;
  let avg = 0;
  for (const num of numbers) {
    avg = avg * alpha + (1 - alpha) * num;
  }
  // NOTE: 偏差校正（与 Ruby bias correction 一致）
  const corrected = avg / (1 - alpha ** numbers.length);
  return Math.round(corrected);
}

export class MovingAverage extends GroupedStatistic {
  constructor() {
    super();
    this.title = 'Moving average';
    this.titleZh = '移动平均';
    this.note = 'You may think of it as &quot;how well the given person has been doing recently&quot;. '
      + 'This computes exponentially moving average (EMA) of competitor averages. '
      + 'EMA is a weighted average, with weights decreasing exponentially, '
      + 'meaning that more recent values contribute more to the computed average. '
      + 'Here we use α = 0.8, meaning that the average emphasizes last ~5 results '
      + '(weight of results older than 5 is around 1/3 in total and decreases quickly for particular results). '
      + 'People with less than 5 averages are ignored (as there\'s not much data to base on).';
    this.noteZh = '可理解为"该选手近期表现"。使用指数移动平均(EMA)计算，α=0.8，即最近约 5 个成绩权重最高。不足 5 个平均的选手被排除。';
    this.tableHeader = {
      'Moving average': 'right',
      'Person': 'left',
    };
  }

  query(): string {
    return `
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        event_id,
        average
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      WHERE average > 0 AND event_id NOT IN ('333bf', '333mbf', '333mbo', '444bf', '555bf')
      ORDER BY competition.start_date, round_type.rank
    `;
  }

  transform(rows: RowDataPacket[]): [string, unknown[][]][] {
    return EVENTS_ENTRIES.map(([eventId, eventName]) => {
      const eventRows = rows.filter(r => r['event_id'] === eventId);

      // NOTE: 按选手分组
      const byPerson = new Map<string, number[]>();
      for (const r of eventRows) {
        const key = r['person_link'] as string;
        if (!byPerson.has(key)) byPerson.set(key, []);
        byPerson.get(key)!.push(Number(r['average']));
      }

      const results = [...byPerson.entries()]
        .filter(([, avgs]) => avgs.length >= 5)
        .map(([personLink, avgs]) => {
          const ema = movingAverage(avgs);
          return { ema, personLink };
        })
        .sort((a, b) => a.ema - b.ema)
        .slice(0, 50)
        .map(({ ema, personLink }) => [
          new SolveTime(eventId, 'average', ema).clockFormat(),
          personLink,
        ]);

      return [eventName, results] as [string, unknown[][]];
    });
  }
}
