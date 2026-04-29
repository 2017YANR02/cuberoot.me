// NOTE: Mo5 (Mean of 5)——5 次全部求均值，无裁剪
// 与 Ruby _stats_build/statistics/wr_mo5.rb 1:1 对应
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';

export class WrMo5 extends RoundMetric {
  constructor() {
    super();
    this.title = 'Mo5';
    this.titleZh = 'Mo5';
    this.note = 'Mean of 5: average of all 5 solves in a round (no trimming).';
    this.noteZh = '5 次均值：一轮 5 次还原的简单平均。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: Mo5 = 5 次全部均值，需要全部有效
  computeMetric(values: number[]): number | null {
    if (!values.every(v => v > 0)) return null;
    return values.reduce((s, v) => s + v, 0) / 5;
  }
}
