// NOTE: Worst Solve in Round——一轮中的最差成绩
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AVERAGE } from '../core/events.js';

export class WrWorst extends RoundMetric {
  constructor() {
    super();
    this.title = 'Worst';
    this.titleZh = '最差';
    this.note = 'Worst: the highest single in a round where every solve is valid.';
    this.noteZh = '最差：一轮中全部成绩有效时的最大值。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AVERAGE; }

  // NOTE: Worst = Mo3/Ao5 全部成绩中的最大值，需要全部有效
  computeMetric(values: number[]): number | null {
    if (values.length < 3 || !values.every(v => v > 0)) return null;
    return Math.max(...values);
  }
}
