// NOTE: BPA (Best Possible Average)——前 4 次中取最好 3 次均值
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';

export class WrBpa extends RoundMetric {
  constructor() {
    super();
    this.title = 'BPA';
    this.titleZh = 'BPA';
    this.note = 'Best Possible Average: average of the best 3 out of the first 4 solves in a round.';
    this.noteZh = '最佳可能平均：前 4 次中取最好 3 次的平均。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: BPA = 前 4 次中取最好 3 次均值
  computeMetric(values: number[]): number | null {
    const first4 = values.slice(0, 4);
    const valid = first4.filter(v => v > 0);
    if (valid.length < 3) return null;
    const best3 = valid.sort((a, b) => a - b).slice(0, 3);
    return best3.reduce((s, v) => s + v, 0) / 3;
  }
}
