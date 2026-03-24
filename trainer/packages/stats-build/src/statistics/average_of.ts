// NOTE: Average Of X 聚合页面——将 7 个 AverageOfX 子类合并为一个 JSON
// 与 Ruby _stats_build/statistics/average_of.rb 1:1 对应
import { Statistic } from '../core/statistic.js';
import type { StatJson, MetricPanel } from '../core/statistic.js';

// NOTE: 7 个 AverageOfX 子类定义
const AOX_DEFS = [
  { module: () => import('./average_of_3.js'),    label: 'Ao3',    id: 'ao3' },
  { module: () => import('./average_of_5.js'),    label: 'Ao5',    id: 'ao5' },
  { module: () => import('./average_of_12.js'),   label: 'Ao12',   id: 'ao12' },
  { module: () => import('./average_of_25.js'),   label: 'Ao25',   id: 'ao25' },
  { module: () => import('./average_of_50.js'),   label: 'Ao50',   id: 'ao50' },
  { module: () => import('./average_of_100.js'),  label: 'Ao100',  id: 'ao100' },
  { module: () => import('./average_of_1000.js'), label: 'Ao1000', id: 'ao1000' },
] as const;

export class AverageOf extends Statistic {
  constructor() {
    super();
    this.title = 'Average of X';
    this.titleZh = 'X 次均值';
    this.note = 'Trimmed mean averages computed over X consecutive official attempts.';
    this.noteZh = '从连续 X 次官方还原中计算的裁剪均值。';
  }

  query(): string { return ''; }

  async toJson(): Promise<StatJson> {
    const metricPanels: MetricPanel[] = [];

    for (const def of AOX_DEFS) {
      const mod = await def.module();
      const StatClass = Object.values(mod).find(v => typeof v === 'function') as
        new () => Statistic;
      const inst = new StatClass();
      const sub = await inst.toJson();

      metricPanels.push({
        id: def.id,
        labelEn: def.label,
        labelZh: sub.titleZh || def.label,
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
