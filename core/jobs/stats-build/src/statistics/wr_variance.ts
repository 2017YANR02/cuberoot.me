// NOTE: Variance——一轮中全部成绩的样本方差
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AVERAGE } from '../core/events.js';

export class WrVariance extends RoundMetric {
  constructor() {
    super();
    this.title = 'Variance';
    this.titleZh = '方差';
    this.note = 'Variance: sample variance of all solves in a round (lower = more consistent).';
    this.noteZh = '方差：一轮中全部成绩的样本方差（越低越稳定）。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AVERAGE; }

  // NOTE: Variance = 样本方差 (n-1)，需要 Mo3/Ao5 全部成绩有效
  computeMetric(values: number[]): number | null {
    if (values.length < 2 || !values.every(v => v > 0)) return null;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sumSq = values.reduce((s, v) => s + (v - mean) ** 2, 0);
    return sumSq / (values.length - 1);
  }

  // NOTE: 方差值显示为秒方差（厘秒² / 10000）
  formatMetric(metricValue: number): string {
    const varianceSeconds = metricValue / 10000.0;
    return varianceSeconds.toFixed(3);
  }
}
