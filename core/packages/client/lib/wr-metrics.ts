// wr_metric 的 13 个指标(并入 /wca/results 的「类型」下拉后的唯一客户端来源)。
// 与 stats/wr_metric.json 的 metricPanels 一致(顺序同)。逻辑分组(基本: single/average;
// 复合: bao5..wpa;分布: median..ratio)仅作参考,UI 不显示组标题。
// 单次 / 平均 → 排名视图(type 口径);其余 11 个派生指标 → 嵌入的 wr_metric 视图(mmetric=<id>)。
// 同时被 lib/site-search.ts 用来在全站搜索里登记这 13 个指标(指回 /wca/results),避免迁走 wr_metric 后丢搜索。
export interface WrMetric { id: string; zh: string; en: string }

export const WR_METRICS: WrMetric[] = [
  { id: 'single', zh: '单次', en: 'Single' },
  { id: 'average', zh: '平均', en: 'Average' },
  { id: 'bao5', zh: 'BAo5', en: 'BAo5' },
  { id: 'wao5', zh: 'WAo5', en: 'WAo5' },
  { id: 'mo5', zh: 'Mo5', en: 'Mo5' },
  { id: 'bpa', zh: 'BPA', en: 'BPA' },
  { id: 'wpa', zh: 'WPA', en: 'WPA' },
  { id: 'median', zh: '中位数', en: 'Median' },
  { id: 'bestc', zh: '最佳有效', en: 'Best Counting' },
  { id: 'worstc', zh: '最差有效', en: 'Worst Counting' },
  { id: 'worst', zh: '轮次最差成绩', en: 'Worst' },
  { id: 'variance', zh: '方差', en: 'Variance' },
  { id: 'ratio', zh: '最佳/平均比值', en: 'Best/Avg' },
];

// 走排名视图的两个口径(其余 id 一律走 wr_metric 指标视图)
export const RANK_TYPE_IDS = new Set(['single', 'average']);
export const DEFAULT_METRIC_ID = 'bao5';

// 某个指标在 /wca/results 的目标 query(单次→无 / 平均→type=average / 派生→view=metric&mmetric=id)
export function resultsQueryForMetric(id: string): string | undefined {
  if (id === 'single') return undefined;
  if (id === 'average') return 'type=average';
  return `view=metric&mmetric=${id}`;
}
