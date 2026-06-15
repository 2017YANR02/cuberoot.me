// NOTE: 滚动统计计算引擎
// 从 viz/rolling_stats.js 1:1 翻译为 TypeScript
// 输入 singles 数组（厘秒），输出 mo3/ao12/ao25/ao50/ao100 + PB 标记
// 供 viz 和 csv_export 共用

// NOTE: WCA 标准 trimming 规则
// mo3: 无 trim（纯均值），任一 DNF → 结果 DNF
// aoN(N≥5): trim = max(1, floor(N * 0.05)) from each end
// DNF 数 > trim → 结果 DNF
export interface RollingConfig {
  key: string;
  size: number;
  trim: number;
  label: string;
}

const CONFIGS: RollingConfig[] = [
  { key: 'mo3',   size: 3,   trim: 0,  label: 'Mo3'   },
  { key: 'ao5',   size: 5,   trim: 1,  label: 'Ao5'   },
  { key: 'ao12',  size: 12,  trim: 1,  label: 'Ao12'  },
  { key: 'ao25',  size: 25,  trim: 1,  label: 'Ao25'  },
  { key: 'ao50',  size: 50,  trim: 2,  label: 'Ao50'  },
  { key: 'ao100', size: 100, trim: 5,  label: 'Ao100' },
];

export interface PbFlags {
  singles: boolean[];
  [key: string]: boolean[];
}

export interface RollingResult {
  singles: number[];
  pbFlags: PbFlags;
  [key: string]: (number | null)[] | number[] | PbFlags;
}

/**
 * NOTE: 计算所有滚动统计
 * @param singles - 按时间正序排列的厘秒数组
 *   >0 = 有效成绩, -1 = DNF, -2 = DNS, 0 = 空(跳过)
 */
export function compute(singles: number[]): RollingResult {
  const result: RollingResult = { singles, pbFlags: { singles: [] } };

  // NOTE: 单次 PB 标记
  let bestSingle = Infinity;
  for (let i = 0; i < singles.length; i++) {
    const v = singles[i];
    if (v > 0 && v < bestSingle) {
      bestSingle = v;
      result.pbFlags.singles.push(true);
    } else {
      result.pbFlags.singles.push(false);
    }
  }

  // NOTE: 逐个统计类型计算
  for (let c = 0; c < CONFIGS.length; c++) {
    const cfg = CONFIGS[c];
    const arr = new Array<number | null>(singles.length);
    const pb = new Array<boolean>(singles.length);
    let bestVal = Infinity;

    for (let j = 0; j < singles.length; j++) {
      if (j < cfg.size - 1) {
        // 不足窗口大小
        arr[j] = null;
        pb[j] = false;
        continue;
      }

      const val = computeWindow(singles, j - cfg.size + 1, j, cfg.trim, cfg.key === 'mo3');
      arr[j] = val;

      if (val !== null && val < bestVal) {
        bestVal = val;
        pb[j] = true;
      } else {
        pb[j] = false;
      }
    }

    result[cfg.key] = arr;
    result.pbFlags[cfg.key] = pb;
  }

  return result;
}

/**
 * NOTE: 计算单个窗口的 average/mean
 * @param start - 窗口起始索引（含）
 * @param end - 窗口结束索引（含）
 * @param trim - 两端各 trim 掉的数量
 * @param isMean - true=Mo3（无 trim，任一 DNF→DNF）
 * @returns 厘秒或 null（DNF/无效）
 */
function computeWindow(
  singles: number[],
  start: number,
  end: number,
  trim: number,
  isMean: boolean,
): number | null {
  const win: number[] = [];
  let dnfCount = 0;

  for (let i = start; i <= end; i++) {
    const v = singles[i];
    if (v <= 0) {
      // DNF(-1) 或 DNS(-2) 视为无效
      dnfCount++;
      win.push(Infinity); // 排序时排到最后
    } else {
      win.push(v);
    }
  }

  if (isMean) {
    // Mo3: 任一 DNF → 结果 DNF
    if (dnfCount > 0) return null;
    let sum = 0;
    for (let k = 0; k < win.length; k++) sum += win[k];
    return Math.round(sum / win.length);
  }

  // AoN: DNF 数超过 trim → 结果 DNF
  if (dnfCount > trim) return null;

  // 排序后去头尾 trim
  win.sort((a, b) => a - b);
  const trimmed = win.slice(trim, win.length - trim);
  let total = 0;
  for (let m = 0; m < trimmed.length; m++) total += trimmed[m];
  return Math.round(total / trimmed.length);
}

/**
 * NOTE: 获取配置信息（供 UI 使用）
 */
export function getConfigs(): RollingConfig[] {
  return CONFIGS.slice();
}
