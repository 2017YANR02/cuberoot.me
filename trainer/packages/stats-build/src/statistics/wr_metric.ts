// NOTE: WR Metric 聚合页面——将 13 个 RoundMetric 子类合并为一个 JSON
// 与 Ruby _stats_build/statistics/wr_metric.rb 1:1 对应
// 每个子统计的 toJson() 输出的 panels 被包装为一个 MetricPanel
import { Statistic } from '../core/statistic.js';
import type { StatJson, MetricPanel } from '../core/statistic.js';

// NOTE: 子统计类和 UI 元数据映射
// 顺序与 Ruby METRIC_CLASSES 一致
const METRIC_DEFS = [
  { module: () => import('./wr_single_history.js'),    label: 'Single',        id: 'single' },
  { module: () => import('./wr_average_history.js'),   label: 'Average',       id: 'average' },
  { module: () => import('./wr_bao5.js'),              label: 'BAo5',          id: 'bao5' },
  { module: () => import('./wr_wao5.js'),              label: 'WAo5',          id: 'wao5' },
  { module: () => import('./wr_mo5.js'),               label: 'Mo5',           id: 'mo5' },
  { module: () => import('./wr_bpa.js'),               label: 'BPA',           id: 'bpa' },
  { module: () => import('./wr_wpa.js'),               label: 'WPA',           id: 'wpa' },
  { module: () => import('./wr_median.js'),             label: 'Median',        id: 'median' },
  { module: () => import('./wr_best_counting.js'),     label: 'Best Counting', id: 'bestc' },
  { module: () => import('./wr_worst_counting.js'),    label: 'Worst Counting',id: 'worstc' },
  { module: () => import('./wr_worst.js'),             label: 'Worst',         id: 'worst' },
  { module: () => import('./wr_variance.js'),          label: 'Variance',      id: 'variance' },
  { module: () => import('./wr_best_average_ratio.js'),label: 'Best/Avg',      id: 'ratio' },
] as const;

// NOTE: 分组定义（前端渲染下拉菜单用）
const METRIC_GROUPS = [
  { label: 'Basic',        labelZh: '基本',  items: ['single', 'average'] },
  { label: 'Composite',    labelZh: '复合',  items: ['bao5', 'wao5', 'mo5', 'bpa', 'wpa'] },
  { label: 'Distribution', labelZh: '分布',  items: ['median', 'bestc', 'worstc', 'worst', 'variance', 'ratio'] },
];

export class WrMetric extends Statistic {
  constructor() {
    super();
    this.title = 'Metric';
    this.titleZh = '指标';
    this.note = "World record history and current rankings for various derived metrics computed from a round's 5 solves.";
    this.noteZh = '各种从一轮 5 次还原中计算的衍生指标的世界纪录历史和当前排名。';
  }

  query(): string { return ''; }

  async toJson(): Promise<StatJson> {
    const metricPanels: MetricPanel[] = [];

    for (const def of METRIC_DEFS) {
      const mod = await def.module();
      const StatClass = Object.values(mod).find(v => typeof v === 'function') as
        new () => Statistic;
      const inst = new StatClass();
      const sub = await inst.toJson();

      const t = performance.now();
      console.log(`  [WrMetric] ${def.label} done in ${((performance.now() - t) / 1000).toFixed(1)}s`);

      // NOTE: 每个子统计的 panels 直接提升为 MetricPanel 的 panels
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
      // NOTE: 分组元数据——前端用于渲染下拉菜单
      metricGroups: METRIC_GROUPS,
    } as StatJson & { metricGroups: typeof METRIC_GROUPS };
  }
}
