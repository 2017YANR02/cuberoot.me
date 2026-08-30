// NOTE: Median——一轮中的中位数
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AVERAGE } from '../core/events.js';

export class WrMedian extends RoundMetric {
  constructor() {
    super();
    this.title = 'Median';
    this.titleZh = '中位数';
    this.note = 'Median: the middle value of all solves in a round. With DNFs, the median shifts to a higher-ranked valid solve.';
    this.noteZh = '中位数：一轮中所有成绩的中间值。有 DNF 时中位数向有效成绩偏移。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AVERAGE; }

  // NOTE: Mo3/Ao5 都是奇数次。DNF 视为比任意有效成绩更差，再取正中间一项。
  computeMetric(values: number[]): number | null {
    if (values.length < 3 || values.length % 2 === 0) return null;
    const sorted = values
      .map(v => v > 0 ? v : Number.POSITIVE_INFINITY)
      .sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return Number.isFinite(median) ? median : null;
  }
}
