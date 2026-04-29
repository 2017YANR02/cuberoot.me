// NOTE: WPA (Worst Possible Average)——前 4 次中取最差 3 次均值
// 与 Ruby _stats_build/statistics/wr_wpa.rb 1:1 对应
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';

export class WrWpa extends RoundMetric {
  constructor() {
    super();
    this.title = 'WPA';
    this.titleZh = 'WPA';
    this.note = 'Worst Possible Average: average of the worst 3 out of the first 4 solves in a round.';
    this.noteZh = '最差可能平均：前 4 次中取最差 3 次的平均。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: WPA = 前 4 次中取最差 3 次均值，需要全部 4 次有效
  computeMetric(values: number[]): number | null {
    const first4 = values.slice(0, 4);
    if (!first4.every(v => v > 0)) return null;
    const worst3 = first4.sort((a, b) => b - a).slice(0, 3);
    return worst3.reduce((s, v) => s + v, 0) / 3;
  }
}
