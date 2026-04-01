// NOTE: BAo5 (Best Average of 5)——5 次中取最好的 3 次求均值
// 与 Ruby _stats_build/statistics/wr_bao5.rb 1:1 对应
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';

export class WrBao5 extends RoundMetric {
  constructor() {
    super();
    this.title = 'BAo5 (Best Average of 5)';
    this.titleZh = 'BAo5（最佳 5 次中取 3 均值）';
    this.note = 'Best Average of 5: average of the best 3 out of all 5 solves in a round.';
    this.noteZh = '最佳 5 中 3 均值：一轮 5 次还原中取最好 3 次的平均。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: BAo5 = 5 次中取最好的 3 次求均值，至少 3 次有效
  computeMetric(values: number[]): number | null {
    const valid = values.filter(v => v > 0);
    if (valid.length < 3) return null;
    const best3 = valid.sort((a, b) => a - b).slice(0, 3);
    return best3.reduce((s, v) => s + v, 0) / 3;
  }
}
