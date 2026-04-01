// NOTE: WR Single History——单次 WR 进展历史
// 与 Ruby _stats_build/statistics/wr_single_history.rb 1:1 对应
// compute_metric 直接返回 best 字段，无需从 attempts 计算
import { RoundMetric } from '../core/round_metric.js';
import { OFFICIAL_EVENTS_RECORD } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

export class WrSingleHistory extends RoundMetric {
  constructor() {
    super();
    this.title = 'Single';
    this.titleZh = '单次';
    this.note = 'Shows how world record singles have progressed over time for each event.';
    this.noteZh = '展示各项目世界纪录单次成绩的历史变化。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
    // NOTE: 覆写钩子——使用 best 字段和 single 记录列
    this.wrRecordColumn = 'regional_single_record';
    this.valueColumn = 'best';
    this.valueType = 'single';
  }

  // NOTE: batch_ranking = false——用高效两步 SQL
  batchRanking() { return false; }

  targetEvents() { return OFFICIAL_EVENTS_RECORD; }

  computeMetric(_values: number[], row: RowDataPacket): number | null {
    return Number(row['best']);
  }

  formatMetric(v: number, eid: string): string {
    return new SolveTime(eid, 'single', Math.round(v)).clockFormat();
  }
}
