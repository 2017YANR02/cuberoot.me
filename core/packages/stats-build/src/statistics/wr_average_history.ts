// NOTE: WR Average History——平均 WR 进展历史
// 与 Ruby _stats_build/statistics/wr_average_history.rb 1:1 对应
// compute_metric 直接返回 average 字段
// 333mbf/333mbo 无官方 average，通过委托 MbfAverage 获取 Mo3 数据
import { RoundMetric } from '../core/round_metric.js';
import { EVENTS_WITH_AVERAGE_MBF } from '../core/events.js';
import { SolveTime } from '../core/solve_time.js';
import { MbfAverage } from './mbf_average.js';
import type { StatJson } from '../core/statistic.js';
import type { RowDataPacket } from 'mysql2';

// NOTE: 333mbf/333mbo 的项目 ID
const MBF_IDS = ['333mbf', '333mbo'];

export class WrAverageHistory extends RoundMetric {
  // NOTE: MbfAverage 单例——延迟初始化，避免重复实例化
  private _mbfInstance: MbfAverage | null = null;

  constructor() {
    super();
    this.title = 'Average';
    this.titleZh = '平均';
    this.note = 'Shows how world record averages have progressed over time for each event. ' +
      'For 333mbf and 333mbo, Mo3 (mean of 3) is used as an unofficial substitute.';
    this.noteZh = '展示各项目世界纪录平均成绩的历史变化。' +
      '对于 333mbf 和 333mbo，使用非官方的 Mo3（三次均值）代替。';
    this.tableHeader = {
      'Result': 'right', 'Improvement': 'right', 'Days': 'right',
      'Person': 'left', 'Date': 'left', 'Competition': 'left', 'Details': 'left',
    };
  }

  // NOTE: batch_ranking = false——用高效两步 SQL
  batchRanking() { return false; }

  // NOTE: 覆盖 targetEvents：加入 333mbf/333mbo（通过 Mo3 展示）
  targetEvents() { return EVENTS_WITH_AVERAGE_MBF; }

  computeMetric(_values: number[], row: RowDataPacket): number | null {
    return Number(row['average']);
  }

  formatMetric(v: number, eid: string): string {
    return new SolveTime(eid, 'average', Math.round(v)).clockFormat();
  }

  private get mbfInstance(): MbfAverage {
    if (!this._mbfInstance) this._mbfInstance = new MbfAverage();
    return this._mbfInstance;
  }

  // NOTE: 覆写 toJson——正常项目走基类逻辑，333mbf/333mbo 委托 MbfAverage
  async toJson(): Promise<StatJson> {
    // NOTE: 基类 toJson 调用 transform() 和 rankingData()
    // 但 targetEvents 现在包含 333mbf/333mbo，基类查询 WR record WHERE 条件
    // 会返回空（因为 333mbf 没有 regional_average_record = 'WR' 的行）
    // 所以 333mbf/333mbo 的 history 和 ranking 都是空的
    // 我们需要在基类结果上替换这两个项目的数据

    const baseJson = await super.toJson();

    // NOTE: 找到 panels 中的 ranking 和 history
    if (!baseJson.panels) return baseJson;

    const events = EVENTS_WITH_AVERAGE_MBF;

    for (const panel of baseJson.panels) {
      for (const section of panel.sections) {
        // NOTE: 通过 title 反查 eventId
        const eventId = Object.entries(events).find(([, name]) => name === section.title)?.[0];
        if (!eventId || !MBF_IDS.includes(eventId)) continue;

        // NOTE: 委托 MbfAverage 获取数据
        if (panel.id === 'ranking') {
          section.rows = await this.mbfInstance.rankingFor(section.title);
        } else if (panel.id === 'history') {
          section.rows = await this.mbfInstance.historyFor(section.title);
        }
      }
    }

    return baseJson;
  }
}
