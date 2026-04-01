// NOTE: Best/Average Ratio——best / average 比值
// 与 Ruby _stats_build/statistics/wr_best_average_ratio.rb 1:1 对应
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AO5 } from '../core/events.js';
import type { RowDataPacket } from 'mysql2';

export class WrBestAverageRatio extends RoundMetric {
  constructor() {
    super();
    this.title = 'Best/average ratio';
    this.titleZh = '最佳/平均比值';
    this.note = 'Best/Average Ratio: ratio of the best single to the average in a round (lower = more dominant best solve).';
    this.noteZh = '最佳/平均比值：一轮中最佳单次与平均的比值（越低说明最好成绩越突出）。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  targetEvents() { return EVENTS_WITH_AO5; }

  // NOTE: ratio = best / average，需要全部有效且 average > 0
  computeMetric(values: number[], row: RowDataPacket): number | null {
    if (!values.every(v => v > 0)) return null;
    const avg = Number(row['average']);
    if (avg <= 0) return null;
    return Number(row['best']) / avg;
  }

  formatMetric(metricValue: number): string {
    return metricValue.toFixed(2);
  }
}
