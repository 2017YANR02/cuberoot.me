// NOTE: Worst Counting Solve——Ao5 中计入平均的 3 次中的最差一次
// 与 Ruby _stats_build/statistics/wr_worst_counting.rb 1:1 对应
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';

export class WrWorstCounting extends RoundMetric {
  constructor() {
    super();
    this.title = 'Worst counting solve';
    this.titleZh = '最差有效';
    this.note = 'Worst counting solve: the worst single that counts into the Ao5 (excluding the dropped best and worst).';
    this.noteZh = '最差有效：Ao5 去掉最好和最差后，剩余 3 次中的最大值。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: Worst Counting = 去掉最好和最差后的最大值
  computeMetric(values: number[]): number | null {
    const valid = values.filter(v => v > 0).sort((a, b) => a - b);
    const invalidCount = values.filter(v => v <= 0).length;
    switch (invalidCount) {
      case 0: return valid[3] ?? null;  // 5 全有效，第 4 小 = counting 最差
      case 1: return valid[2] ?? null;  // 1 DNF，4 有效中第 3 个
      default: return null;
    }
  }
}
