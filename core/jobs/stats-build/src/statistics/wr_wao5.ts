// NOTE: WAo5 (Worst Average of 5)——5 次中取最差的 3 次求均值
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';

export class WrWao5 extends RoundMetric {
  constructor() {
    super();
    this.title = 'WAo5';
    this.titleZh = 'WAo5';
    this.note = 'Worst Average of 5: average of the worst 3 out of all 5 solves in a round.';
    this.noteZh = '最差 5 中 3 均值：一轮 5 次还原中取最差 3 次的平均。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: WAo5 = 5 次中取最差 3 次均值，需要全部 5 次有效
  computeMetric(values: number[]): number | null {
    if (!values.every(v => v > 0)) return null;
    const worst3 = values.sort((a, b) => b - a).slice(0, 3);
    return worst3.reduce((s, v) => s + v, 0) / 3;
  }
}
