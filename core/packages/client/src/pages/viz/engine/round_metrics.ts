// NOTE: 轮次衍生指标计算模块
// 从 viz/round_metrics.js 1:1 翻译为 TypeScript
// 对每轮的 attempts 计算 9 个指标（BAo5/WAo5/Mo5/BPA/WPA/Median/BestCounting/WorstCounting/Worst）
// 值放在轮次第一把，其余把为 null

export interface RoundMetricConfig {
  key: string;
  label: string;
}

const CONFIGS: RoundMetricConfig[] = [
  { key: 'bao5',   label: 'BAo5' },
  { key: 'wao5',   label: 'WAo5' },
  { key: 'mo5',    label: 'Mo5' },
  { key: 'bpa',    label: 'BPA' },
  { key: 'wpa',    label: 'WPA' },
  { key: 'median', label: 'Median' },
  { key: 'bestc',  label: 'BestC' },
  { key: 'worstc', label: 'WorstC' },
  { key: 'worst',  label: 'Worst' },
];

export interface SolveEntry {
  cs: number;
  compName: string;
  compDate: string;
  roundType: string;
  attemptIdx: number;
  average: number | null;
}

interface RoundGroup {
  startIdx: number;
  endIdx: number;
  values: number[];
}

export interface RoundPbFlags {
  [key: string]: boolean[];
}

export interface RoundMetricsResult {
  pbFlags: RoundPbFlags;
  // NOTE: avg 和 avg PB 由 data_fetch 填充，此处不计算
  avg?: (number | null)[];
  [key: string]: (number | null)[] | boolean[] | RoundPbFlags | undefined;
}

/**
 * NOTE: 按轮次分组 solveEntries
 * 轮次边界 = compName 或 roundType 变化
 */
function groupByRound(entries: SolveEntry[]): RoundGroup[] {
  const rounds: RoundGroup[] = [];
  let start = 0;
  for (let i = 1; i <= entries.length; i++) {
    if (i === entries.length ||
        entries[i].compName !== entries[i - 1].compName ||
        entries[i].roundType !== entries[i - 1].roundType) {
      const values: number[] = [];
      for (let j = start; j < i; j++) values.push(entries[j].cs);
      rounds.push({ startIdx: start, endIdx: i - 1, values });
      start = i;
    }
  }
  return rounds;
}

/**
 * NOTE: 计算单轮的 9 个指标
 * values = 该轮所有 attempt 的厘秒值（>0 有效，≤0 = DNF/DNS）
 */
function computeRound(values: number[]): Record<string, number | null> {
  // NOTE: valid = 有效值升序排列
  const valid: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 0) valid.push(values[i]);
  }
  valid.sort((a, b) => a - b);
  const inv = values.length - valid.length;  // 无效成绩数
  const n = valid.length;

  const r: Record<string, number | null> = {};

  // BAo5: 最好 3 把均值，需 ≥3 有效
  r.bao5 = n >= 3 ? Math.round((valid[0] + valid[1] + valid[2]) / 3) : null;

  // WAo5: 最差 3 把均值，需全部有效
  r.wao5 = (inv === 0 && n >= 3)
    ? Math.round((valid[n - 1] + valid[n - 2] + valid[n - 3]) / 3) : null;

  // Mo5: 纯均值，需全部有效
  if (inv === 0 && n > 0) {
    let sum = 0;
    for (let k = 0; k < n; k++) sum += valid[k];
    r.mo5 = Math.round(sum / n);
  } else {
    r.mo5 = null;
  }

  // BPA: 前 4 把中最好 3 把均值
  const f4 = values.slice(0, 4);
  const f4v: number[] = [];
  for (let j = 0; j < f4.length; j++) {
    if (f4[j] > 0) f4v.push(f4[j]);
  }
  f4v.sort((a, b) => a - b);
  r.bpa = f4v.length >= 3 ? Math.round((f4v[0] + f4v[1] + f4v[2]) / 3) : null;

  // WPA: 前 4 把中最差 3 把均值，需前 4 把全部有效
  const f4inv = f4.length - f4v.length;
  r.wpa = (f4inv === 0 && f4v.length >= 3)
    ? Math.round((f4v[f4v.length - 1] + f4v[f4v.length - 2] + f4v[f4v.length - 3]) / 3) : null;

  // Median: 排序后第 3 个有效值，最多 2 个无效
  r.median = (inv <= 2 && n >= 3) ? valid[2] : null;

  // Best Counting: Ao5 中 counting 3 把的最小值 = sorted[1]
  // 1 DNF 时 DNF 是 dropped worst，sorted[1] 仍是 counting 最小
  r.bestc = (inv <= 1 && n >= 2) ? valid[1] : null;

  // Worst Counting: Ao5 中 counting 3 把的最大值
  if (inv === 0 && n >= 4) {
    // 5 有效：drop best(sorted[0]) + worst(sorted[4])，counting=[1,2,3]，worst=sorted[3]
    r.worstc = valid[n - 2];
  } else if (inv === 1 && n >= 3) {
    // 1 DNF：DNF=dropped worst，drop best(sorted[0])，counting=[1,2,...n-1]，worst=sorted[n-1]
    r.worstc = valid[n - 1];
  } else {
    r.worstc = null;
  }

  // Worst: 绝对最差把，需全部有效
  r.worst = (inv === 0 && n > 0) ? valid[n - 1] : null;

  return r;
}

/**
 * NOTE: 对全部 solveEntries 计算轮次指标
 * 返回与 RollingStats.compute() 同结构
 */
export function compute(entries: SolveEntry[]): RoundMetricsResult {
  const len = entries.length;
  const result: RoundMetricsResult = { pbFlags: {} };

  // 初始化所有数组
  for (let c = 0; c < CONFIGS.length; c++) {
    const key = CONFIGS[c].key;
    const arr = new Array<number | null>(len);
    const pb = new Array<boolean>(len);
    for (let i = 0; i < len; i++) {
      arr[i] = null;
      pb[i] = false;
    }
    result[key] = arr;
    result.pbFlags[key] = pb;
  }

  const rounds = groupByRound(entries);

  // 每个指标的当前最佳（用于 PB 判定）
  const bests: Record<string, number> = {};
  for (let c2 = 0; c2 < CONFIGS.length; c2++) {
    bests[CONFIGS[c2].key] = Infinity;
  }

  for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
    const round = rounds[rIdx];
    // NOTE: 少于 3 把的轮次跳过（部分指标需要至少 3 把）
    if (round.values.length < 3) continue;

    const metrics = computeRound(round.values);

    for (let c3 = 0; c3 < CONFIGS.length; c3++) {
      const k = CONFIGS[c3].key;
      const val = metrics[k];
      // 值放在轮次第一把
      (result[k] as (number | null)[])[round.startIdx] = val;
      if (val !== null && val < bests[k]) {
        bests[k] = val;
        result.pbFlags[k][round.startIdx] = true;
      }
    }
  }

  return result;
}

export function getConfigs(): RoundMetricConfig[] {
  return CONFIGS.slice();
}
