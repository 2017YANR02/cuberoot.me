// NOTE: Median——一轮中的中位数
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';

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

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: Median = 排序后第 3 个值（0-indexed: [2]）
  // DNF 时中位数往后移，3 个及以上无效则 null
  computeMetric(values: number[]): number | null {
    const valid = values.filter(v => v > 0).sort((a, b) => a - b);
    const invalidCount = values.filter(v => v <= 0).length;
    if (invalidCount >= 3) return null;
    return valid[2] ?? null;
  }
}
