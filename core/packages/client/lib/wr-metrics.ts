// wr_metric 的 13 个指标(并入 /wca/results 的「类型」下拉后的唯一客户端来源)。
// 与 stats/wr_metric.json 的 metricPanels 一致(顺序同)。逻辑分组(基本: single/average;
// 复合: bao5..wpa;分布: median..ratio)仅作参考,UI 不显示组标题。
// 单次 / 平均 → 排名视图(type 口径);其余 11 个派生指标 → 嵌入的 wr_metric 视图(mmetric=<id>)。
// 同时被 lib/site-search.ts 用来在全站搜索里登记这 13 个指标(指回 /wca/results),避免迁走 wr_metric 后丢搜索。
export interface WrMetric { id: string; zh: string; en: string; definition?: { zh: string; en: string } }

export const WR_METRICS: WrMetric[] = [
  { id: 'single', zh: '单次', en: 'Single' },
  { id: 'average', zh: '平均', en: 'Average' },
  { id: 'bao5', zh: 'BAo5', en: 'BAo5', definition: {
    zh: 'BAo5：一轮 5 次成绩中，最好 3 次的均值。',
    en: 'BAo5: the mean of the best 3 results out of 5 in a round.',
  } },
  { id: 'wao5', zh: 'WAo5', en: 'WAo5', definition: {
    zh: 'WAo5：一轮 5 次成绩中，最差 3 次的均值。',
    en: 'WAo5: the mean of the worst 3 results out of 5 in a round.',
  } },
  { id: 'mo5', zh: 'Mo5', en: 'Mo5', definition: {
    zh: 'Mo5：一轮全部 5 次成绩的均值，不去掉最好和最差。',
    en: 'Mo5: the mean of all 5 results in a round, without dropping the best or worst.',
  } },
  { id: 'bpa', zh: 'BPA', en: 'BPA', definition: {
    zh: 'BPA：前 4 次成绩中最好 3 次的均值，即完成前 4 次后的最佳可能平均。',
    en: 'BPA: the mean of the best 3 of the first 4 results—the best possible average after 4 attempts.',
  } },
  { id: 'wpa', zh: 'WPA', en: 'WPA', definition: {
    zh: 'WPA：前 4 次成绩中最差 3 次的均值，即完成前 4 次后的最差可能平均。',
    en: 'WPA: the mean of the worst 3 of the first 4 results—the worst possible average after 4 attempts.',
  } },
  { id: 'median', zh: '中位数', en: 'Median', definition: {
    zh: '中位数：一轮成绩从好到差排序后的中间值，支持 Mo3 与 Ao5。',
    en: 'Median: the middle result after sorting a round from best to worst; supports Mo3 and Ao5.',
  } },
  { id: 'bestc', zh: '最佳有效', en: 'Best Counting', definition: {
    zh: '最佳有效：Ao5 去掉最好和最差后，计入平均的 3 次成绩中的最好成绩。',
    en: 'Best Counting: the best of the 3 results counted in an Ao5 after dropping the best and worst.',
  } },
  { id: 'worstc', zh: '最差有效', en: 'Worst Counting', definition: {
    zh: '最差有效：Ao5 去掉最好和最差后，计入平均的 3 次成绩中的最差成绩。',
    en: 'Worst Counting: the worst of the 3 results counted in an Ao5 after dropping the best and worst.',
  } },
  { id: 'worst', zh: '最差', en: 'Worst', definition: {
    zh: '最差：一轮全部成绩有效时的最差成绩，支持 Mo3 与 Ao5。',
    en: 'Worst: the worst result in a round where all results are valid; supports Mo3 and Ao5.',
  } },
  { id: 'variance', zh: '方差', en: 'Variance', definition: {
    zh: '方差：一轮全部成绩的样本方差，越低越稳定；支持 Mo3 与 Ao5。',
    en: 'Variance: the sample variance of all results in a round; lower means more consistent. Supports Mo3 and Ao5.',
  } },
  { id: 'ratio', zh: '最佳/平均比值', en: 'Best/Avg', definition: {
    zh: '最佳/平均比值：一轮最佳单次除以平均成绩，越低说明最佳单次越突出。',
    en: 'Best/Avg: the best single divided by the average in a round; lower means a more outstanding best single.',
  } },
];

// 走排名视图的两个口径(其余 id 一律走 wr_metric 指标视图)
export const RANK_TYPE_IDS = new Set(['single', 'average']);
export const DEFAULT_METRIC_ID = 'bao5';

// 某个指标在 /wca/results 的目标 query；单次显式指定排名，避免落入默认纪录页。
export function resultsQueryForMetric(id: string): string | undefined {
  if (id === 'single') return 'tab=rank&type=single';
  if (id === 'average') return 'type=average';
  return `view=metric&mmetric=${id}`;
}
