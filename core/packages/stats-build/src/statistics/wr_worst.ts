// NOTE: Worst Solve in Round——一轮中的最差成绩
// 与 Ruby _stats_build/statistics/wr_worst.rb 1:1 对应
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';

export class WrWorst extends RoundMetric {
  constructor() {
    super();
    this.title = 'Worst solve in round';
    this.titleZh = '轮次最差成绩';
    this.note = 'Worst solve: the worst (highest) single in a round where all 5 solves are valid.';
    this.noteZh = '轮次最差成绩：一轮中全部 5 次有效时的最大值。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: Worst = 5 次中最大值，需要全部有效
  computeMetric(values: number[]): number | null {
    if (!values.every(v => v > 0)) return null;
    return Math.max(...values);
  }
}
