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
    this.note = 'Averages computed across all rounds a competitor participated in during a single competition.';
    this.noteZh = '选手在单场比赛中参加的所有轮次的平均成绩。';
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
