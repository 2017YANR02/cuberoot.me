// NOTE: WR AoXR 聚合页面——将 4 个 AoRounds 子类合并为一个 JSON
import { Statistic } from '../core/statistic.js';
import type { StatJson, MetricPanel } from '../core/statistic.js';

// NOTE: 4 个 AoRounds 子类定义
const AOXR_DEFS = [
  { module: () => import('./wr_ao1r.js'), label: 'Ao1R', id: 'ao1r' },
  { module: () => import('./wr_ao2r.js'), label: 'Ao2R', id: 'ao2r' },
  { module: () => import('./wr_ao3r.js'), label: 'Ao3R', id: 'ao3r' },
  { module: () => import('./wr_ao4r.js'), label: 'Ao4R', id: 'ao4r' },
] as const;

export class WrAoxr extends Statistic {
  constructor() {
    super();
    this.title = 'AoXR';
    this.titleZh = 'AoXR';
    this.note = 'Mean of a competitor\'s round averages at a single competition. It counts only when they competed in every round of that event (i.e. made the final) and every round produced a valid average — one DNF average voids the whole competition. X = the number of rounds.';
    this.noteZh = '选手在单场比赛某项目各轮平均的均值。两个前提:①打满该项目全部轮次(即打进决赛);②每轮都有有效平均,任意一轮平均 DNF 则整场不计。X = 该场轮数。';
  }

  query(): string { return ''; }

  async toJson(): Promise<StatJson> {
    const metricPanels: MetricPanel[] = [];

    for (const def of AOXR_DEFS) {
      const mod = await def.module();
      const StatClass = Object.values(mod).find(v => typeof v === 'function') as
        new () => Statistic;
      let inst: InstanceType<typeof StatClass> | null = new StatClass();
      const sub = await inst.toJson();
      // NOTE: 子统计完成后释放实例
      inst = null;
      if (global.gc) global.gc();

      metricPanels.push({
        id: def.id,
        labelEn: def.label,
        labelZh: def.label,
        panels: sub.panels || [],
      });
    }

    return {
      id: this.id,
      title: this.title,
      titleZh: this.titleZh || this.title,
      ...(this.note ? { note: this.note } : {}),
      ...(this.noteZh ? { noteZh: this.noteZh } : {}),
      header: [],
      metricPanels,
    };
  }
}
