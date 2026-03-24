// NOTE: Best Counting Solve——Ao5 中计入平均的 3 次中的最好一次
// 与 Ruby _stats_build/statistics/wr_best_counting.rb 1:1 对应
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';

export class WrBestCounting extends RoundMetric {
  constructor() {
    super();
    this.title = 'Best counting solve';
    this.titleZh = '最佳计入成绩';
    this.note = 'Best counting solve: the best single that counts into the Ao5 (excluding the dropped best and worst).';
    this.noteZh = '最佳计入成绩：Ao5 去掉最好和最差后，剩余 3 次中的最小值。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: Best Counting = 排序后第 2 个值（0-indexed: [1]）
  computeMetric(values: number[]): number | null {
    const valid = values.filter(v => v > 0).sort((a, b) => a - b);
    const invalidCount = values.filter(v => v <= 0).length;
    if (invalidCount >= 2) return null;  // 2+ DNF → Ao5 本身 DNF
    return valid[1] ?? null;
  }
}
