// NOTE: WR Average History——平均 WR 进展历史
// 与 Ruby _stats_build/statistics/wr_average_history.rb 1:1 对应
// compute_metric 直接返回 average 字段
// 333mbf/333mbo 无官方 average，暂不在 TS 版中处理（留待阶段 D）
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AVERAGE } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import type { RowDataPacket } from 'mysql2';

export class WrAverageHistory extends RoundMetric {
  constructor() {
    super();
    this.title = 'Average';
    this.titleZh = '平均';
    this.note = 'Shows how world record averages have progressed over time for each event.';
    this.noteZh = '展示各项目世界纪录平均成绩的历史变化。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
    // NOTE: 默认 wrRecordColumn/valueColumn/valueType 已是 average，无需覆写
  }

  // NOTE: batch_ranking = false——用高效两步 SQL
  batchRanking() { return false; }

  // NOTE: 目前只覆盖有官方 average 的项目（333mbf/333mbo 留待阶段 D 的 MbfAverage 处理）
  targetEvents() { return EVENTS_WITH_AVERAGE; }

  computeMetric(_values: number[], row: RowDataPacket): number | null {
    return Number(row['average']);
  }

  formatMetric(v: number, eid: string): string {
    return new SolveTime(eid, 'average', Math.round(v)).clockFormat();
  }
}
