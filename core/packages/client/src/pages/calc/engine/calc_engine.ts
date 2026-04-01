// NOTE: 纯计算引擎 + 时间格式化工具
// 不含任何 UI/DOM 逻辑，所有模块共享的计算基础

// ── 常量 ──

export const DNF_VALUE = 1000000000;
export const UNFINISHED_VALUE = 2000000000;
// NOTE: 各模式合法值范围（centiseconds）— 全局 fallback
export const MIN_TIME_VALUE = 30;       // 0.30s
export const MAX_TIME_VALUE = 59999;    // 9:59.99

// NOTE: 按项目上下限 [min, max]（centiseconds）
// FMC: 步数×100，MBF/MBO: 得分×100
const EVENT_LIMITS: Record<string, [number, number]> = {
  '333': [250, 1499],     // 2.50 ~ 14.99
  '222': [30, 999],       // 0.30 ~ 9.99
  '444': [1300, 5999],    // 13.00 ~ 59.99
  '555': [2600, 11999],   // 26.00 ~ 1:59.99
  '666': [5000, 23999],   // 50.00 ~ 3:59.99
  '777': [8000, 29999],   // 1:20.00 ~ 4:59.99
  '333bf': [900, 29999],  // 9.00 ~ 4:59.99
  '333fm': [1000, 4900],  // 10步 ~ 49步
  '333oh': [500, 2999],   // 5.00 ~ 29.99
  'minx': [1800, 11999],  // 18.00 ~ 1:59.99
  'pyram': [60, 999],     // 0.60 ~ 9.99
  'clock': [100, 1999],   // 1.00 ~ 19.99
  'skewb': [60, 999],     // 0.60 ~ 9.99
  'sq1': [250, 2999],     // 2.50 ~ 29.99
  '444bf': [5000, 59999], // 50.00 ~ 9:59.99
  '555bf': [10000, 59999],// 1:40.00 ~ 9:59.99
  '333mbf': [100, 7000],  // 1分 ~ 70分
  '333ft': [1200, 11999], // 12.00 ~ 1:59.99
  'magic': [50, 500],     // 0.50 ~ 5.00
  'mmagic': [50, 500],    // 0.50 ~ 5.00
  '333mbo': [100, 7000],  // 1分 ~ 70分
};

// NOTE: 当前项目 ID — 由外部在项目切换时设置
let currentEvent = '333';
export function setCurrentEvent(id: string): void { currentEvent = id; }

// NOTE: 统一值 clamp — 根据当前项目查表选择上下限
// 0 = 未填，DNF = 特殊标记，均不 clamp
export function clampValue(val: number): number {
  if (val === 0 || val >= DNF_VALUE) return val;
  const lim = EVENT_LIMITS[currentEvent];
  if (lim) return Math.max(lim[0], Math.min(val, lim[1]));
  return Math.max(MIN_TIME_VALUE, Math.min(val, MAX_TIME_VALUE));
}

// ── 时间格式化 ──

// NOTE: FMC 步数模式标志 — 由项目切换时设置
// formatTime 内部自动判断，无需每个调用方传参
let moveCntMode = false;
export function setMoveCntMode(flag: boolean): void { moveCntMode = flag; }
// NOTE: 多盲得分模式旗标
let mbfMode = false;
export function setMbfMode(flag: boolean): void { mbfMode = flag; }

export function formatTime(
  cs: number | null | undefined,
  axisLabel = false,
  isMoveCnt = false,
  forceDecimal = false,
): string {
  if (cs === null || cs === undefined) return '-';
  const n0 = Math.floor(cs);
  if (n0 >= DNF_VALUE) return 'DNF';

  // NOTE: FMC 步数格式 — 单次显示整数("20")，平均显示小数("20.00")
  // forceDecimal = true 时强制保留 2 位小数（用于平均值/Target Avg）
  if (isMoveCnt || moveCntMode) {
    const moves = cs / 100;
    // NOTE: axisLabel 模式下保留 1 位小数，防止浮点精度显示长小数
    if (axisLabel) {
      return Number.isInteger(moves) ? String(moves) : moves.toFixed(1);
    }
    if (forceDecimal || !Number.isInteger(moves)) {
      return moves.toFixed(2);
    }
    return String(moves);
  }

  // NOTE: 多盲得分模式 — 单次显示整数("56")，平均值显示小数("35.67")
  if (mbfMode) {
    const score = cs / 100;
    // NOTE: axisLabel 模式下保留 1 位小数，防止浮点精度显示长小数
    if (axisLabel) {
      return Number.isInteger(score) ? String(Math.round(score)) : score.toFixed(1);
    }
    if (forceDecimal || !Number.isInteger(score)) {
      return score.toFixed(2);
    }
    return String(Math.round(score));
  }

  // NOTE: 通过 digit/separator 数组逐位拆解，自动处理 分:秒.厘秒 格式
  const digits = [10, 10, 10, 6, 10, 6, 10, 10];
  const separator = ['', '', '.', '', ':', '', ':', '', '', '', '', ''];
  let result = '';
  let digitOn = 0;
  let rem = n0; // 剩余值

  // 至少输出 3 位（厘秒2位 + 秒至少1位），更高位按需输出
  while (digitOn < 3 || rem > 0) {
    result = (rem % digits[digitOn]) + separator[digitOn] + result;
    rem = Math.floor(rem / digits[digitOn]);
    digitOn += 1;
  }

  // NOTE: Y 轴标签精简为 1 位小数（"3.60" → "3.6"，"4.00" → "4.0"）
  if (axisLabel) {
    const dotIdx = result.lastIndexOf('.');
    if (dotIdx >= 0) {
      result = result.substring(0, dotIdx + 2); // 保留小数点后 1 位
    }
  }
  return result;
}

// NOTE: 文本输入转 centiseconds
// 支持格式: "536" → 5.36s, "5.36" → 5.36s, "1:23" → 1m23s, "dnf"/"d"/"n"/"f" → DNF
export function textToTime(s: string): number {
  const dnf = 'dnf';
  for (let i = 0; i < dnf.length; i++) {
    if (s.toLowerCase().includes(dnf.charAt(i))) {
      return DNF_VALUE;
    }
  }
  let time = 0;
  const colonParts = s.split(':');
  const cpl = colonParts.length; // colonPartsLength
  const hours = cpl >= 3 ? strToNumber(colonParts[cpl - 3], -1) : 0;
  const minutes = cpl >= 2 ? strToNumber(colonParts[cpl - 2], -1) : 0;
  time += hours * 360000 + minutes * 6000;
  let lastPart = colonParts[cpl - 1];

  lastPart = lastPart.replace(',', '.'); // 兼容逗号作为小数点
  const periodIndex = lastPart.indexOf('.');
  if (periodIndex >= 0) {
    const seconds = strToNumber(lastPart.substring(0, periodIndex), -1);
    time += seconds * 100;
    const frac = lastPart.substring(periodIndex + 1);
    if (frac.length === 1) {
      time += strToNumber(frac, -1) * 10; // 1位 → 十分之一秒
    } else {
      time += strToNumber(frac, 2) * 1;   // 2位 → 厘秒
    }
  } else {
    // NOTE: 无小数点 — 无冒号时当 centiseconds，有冒号时当整秒
    const sec = strToNumber(lastPart, -1);
    if (cpl === 1) {
      // NOTE: FMC 模式下纯整数 = 步数（如 "20" → 20步 = 2000cs）
      if (moveCntMode) {
        time += sec * 100;
      } else {
        time += sec;       // 纯数字 → centiseconds（536 → 5.36 秒）
      }
    } else {
      time += sec * 100; // 有冒号 → 整秒（1:23 中的 23 秒）
    }
  }
  return clampValue(time);
}

// NOTE: 多盲得分解析 — 纯整数输入（如 "56" → 5600）
// 独立函数避免污染通用 textToTime 逻辑
export function textToMbfScore(s: string): number {
  const dnf = 'dnf';
  for (let i = 0; i < dnf.length; i++) {
    if (s.toLowerCase().includes(dnf.charAt(i))) {
      return DNF_VALUE;
    }
  }
  const score = parseInt(s.replace(/\D/g, ''), 10);
  if (Number.isNaN(score) || score <= 0) return 0;
  return clampValue(score * 100);
}

// 从字符串中提取数字，digitsToInclude 限制截取位数（-1 表示不限）
function strToNumber(s: string, digitsToInclude: number): number {
  let resultStr = s.replace(/\D/g, '');
  if (digitsToInclude >= 1) {
    resultStr = resultStr.substring(0, digitsToInclude);
  }
  const result = parseInt(resultStr);
  return Number.isNaN(result) ? 0 : result;
}

// NOTE: 序数词后缀（1st, 2nd, 3rd, 4th...）
export function rankify(s: number): string {
  const es = (s + 1) % 100;
  let ending = 'th';
  if (es >= 10 && es < 20) {
    // 11th-19th 特殊
  } else if ((es % 10) === 1) {
    ending = 'st';
  } else if ((es % 10) === 2) {
    ending = 'nd';
  } else if ((es % 10) === 3) {
    ending = 'rd';
  }
  return (s + 1) + ending;
}

// ── 核心统计计算 ──

// NOTE: 平均值计算（自动适配 Mo3 和 Ao5）
// Mo3 (arr.length=3): 算术均值，任何 DNF = 整个 DNF
// Ao5 (arr.length=5): 去掉最好最差，取中间 3 次均值
// includeZeros: false 时遇到 0（未填）返回 UNFINISHED
export function getAverage(arr: number[], includeZeros: boolean): number {
  const n = arr.length;
  if (!includeZeros) {
    for (let i = 0; i < n; i++) {
      if (arr[i] === 0) return UNFINISHED_VALUE;
    }
  }
  const sorted = [...arr].sort((a, b) => a - b);
  if (n <= 3) {
    // NOTE: Mo3 — 任何一个 DNF 则整个 Mean = DNF
    if (sorted[n - 1] >= DNF_VALUE) return DNF_VALUE;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sorted[i];
    return Math.round(sum / n);
  }
  // Ao5
  if (sorted[3] >= DNF_VALUE) return DNF_VALUE;
  return Math.round((sorted[1] + sorted[2] + sorted[3]) / 3);
}

// NOTE: 反向推算 — 给定 4 个已有值和目标 Ao5，求第 5 把需要多少
// sorted4: 已排序的 4 个值 [s0, s1, s2, s3]
// targetAvg: 目标 Ao5（centiseconds）
// 返回: centiseconds（已 clamp），或 null（目标不可达）
export function reverseAvgToTime(sorted4: number[], targetAvg: number): number | null {
  // x = 3*target - s1 - s2（无论 x 落在排序后的哪个区间）
  const x = 3 * targetAvg - sorted4[1] - sorted4[2];
  // 超出已有值的 [s0, s3] 范围时，counting 不含 x，avg 固定不可改变
  if (x <= 0) return null;
  return clampValue(Math.round(x));
}

// NOTE: 按平均值和最佳单次排序，返回索引数组
export function getSortedIndices(test: number[], test2: number[], descending: boolean): number[] {
  const len = test.length;
  const indices = new Array<number>(len);
  for (let i = 0; i < len; ++i) indices[i] = i;
  // NOTE: descending = true 时降序排列（多盲得分模式：高分 = 好）
  const dir = descending ? -1 : 1;
  indices.sort((a, b) => {
    if (test[a] < test[b] || (test[a] === test[b] && test2[a] < test2[b])) return -1 * dir;
    if (test[a] > test[b] || (test[a] === test[b] && test2[a] > test2[b])) return 1 * dir;
    return 0;
  });
  return indices;
}

// NOTE: 最佳单次成绩（忽略 0 和 DNF）
// mbf 模式下「最佳」= 最大值而非最小值
export function getBestSingle(arr: number[], descending: boolean): number {
  if (descending) {
    let best = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > 0 && arr[i] < DNF_VALUE && arr[i] > best) {
        best = arr[i];
      }
    }
    return best === 0 ? DNF_VALUE : best;
  }
  let record = DNF_VALUE;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > 0 && arr[i] < record) {
      record = arr[i];
    }
  }
  return record;
}

// ── ComputeResult 类型 ──

export interface ComputeResult {
  best: number;
  worst: number | null;
  complete: boolean;
  avg?: number;
  bpa?: number | null;
  wpa?: number | null;
  bao5?: number;
  wao5?: number;
  mo2?: number;
  mo3?: number;
  mo4?: number;
  mo5?: number;
  bestC?: number;
  median?: number;
  worstC?: number;
  variance?: number | null;
  bestAvgRatio?: number | null;
  // NOTE: 动态 key 用于 mo2~mo4 循环赋值
  [key: string]: number | boolean | null | undefined;
}

export interface ThresholdResult {
  t5?: number | null;
  t4wpa?: number | null;
  t4bpa?: number | null;
}

export type GhostBarType = 'safe' | 'conditional' | 'impossible' | 'any';

export interface GhostBarResult {
  value: number;
  type: GhostBarType;
  slotIndex: number;
}

// ── CalcEngine 命名空间 ──

// NOTE: 高级指标计算引擎，接收 centisecond 值，返回所有 WCA 衍生指标
export const CalcEngine = {

  // 主入口 — 返回值中 null 表示该指标无法计算（数据不足）
  // mo3Mode: true 时使用 Mo3 计算（算术均值，无 BPA/WPA 等）
  compute(times: number[], mo3Mode: boolean): ComputeResult | null {
    const n = times.length;
    const filled = times.filter(t => t > 0);
    if (filled.length === 0) return null;

    const sorted = [...filled].sort((a, b) => a - b);
    const dnfCount = filled.filter(t => t >= DNF_VALUE).length;
    const nonDnf = sorted.filter(t => t < DNF_VALUE);

    const result: ComputeResult = {
      best: nonDnf.length > 0 ? nonDnf[0] : DNF_VALUE,
      worst: filled.length > 0 ? sorted[sorted.length - 1] : null,
      complete: false,
    };

    if (filled.length < n) {
      return result;
    }
    result.complete = true;

    if (mo3Mode) {
      // NOTE: Mo3 模式 — 算术均值，无 BPA/WPA/BestC/WorstC/BAo5/WAo5
      result.avg = (dnfCount > 0) ? DNF_VALUE
        : Math.round(filled.reduce((s, v) => s + v, 0) / n);

      // Mo2 / Mo3 — 连续 N 次的最佳算术均值
      for (let nn = 2; nn <= 3; nn++) {
        const key = 'mo' + nn;
        if (dnfCount > 0) {
          result[key] = DNF_VALUE;
        } else {
          let bestMean = Infinity;
          for (let i = 0; i <= n - nn; i++) {
            let sum = 0;
            let hasDnf = false;
            for (let j = i; j < i + nn; j++) {
              if (times[j] >= DNF_VALUE) { hasDnf = true; break; }
              sum += times[j];
            }
            if (!hasDnf) bestMean = Math.min(bestMean, Math.round(sum / nn));
          }
          result[key] = bestMean === Infinity ? DNF_VALUE : bestMean;
        }
      }
    } else {
      // NOTE: Ao5 模式
      // ── Ao5 ──
      result.avg = (dnfCount >= 2) ? DNF_VALUE
        : Math.round((sorted[1] + sorted[2] + sorted[3]) / 3);

      // ── BAo5 — 去掉最差，取最好 3 次均值 ──
      result.bao5 = (nonDnf.length < 3) ? DNF_VALUE
        : Math.round((nonDnf[0] + nonDnf[1] + nonDnf[2]) / 3);

      // ── WAo5 — 去掉最好，取最差 3 次均值 ──
      result.wao5 = (dnfCount >= 1) ? DNF_VALUE
        : Math.round((sorted[2] + sorted[3] + sorted[4]) / 3);

      // ── Mo5 — 5 次算术均值 ──
      result.mo5 = (dnfCount > 0) ? DNF_VALUE
        : Math.round(filled.reduce((s, v) => s + v, 0) / 5);

      // ── BPA / WPA ──
      if (times.length === 5) {
        const baseForPa = filled.slice(0, 4);
        if (baseForPa.length === 4) {
          const bpaArr = [...baseForPa, 0].sort((a, b) => a - b);
          const bpaDnf = bpaArr.filter(t => t >= DNF_VALUE).length;
          result.bpa = (bpaDnf >= 2) ? DNF_VALUE
            : Math.round((bpaArr[1] + bpaArr[2] + bpaArr[3]) / 3);
          const wpaArr = [...baseForPa, DNF_VALUE].sort((a, b) => a - b);
          const wpaDnf = wpaArr.filter(t => t >= DNF_VALUE).length;
          result.wpa = (wpaDnf >= 2) ? DNF_VALUE
            : Math.round((wpaArr[1] + wpaArr[2] + wpaArr[3]) / 3);
        } else {
          result.bpa = null;
          result.wpa = null;
        }
      }

      // ── BestC / Median / WorstC — 计入成绩的最好/中位/最差 ──
      if (dnfCount >= 2) {
        result.bestC = result.median = result.worstC = DNF_VALUE;
      } else {
        result.bestC = sorted[1];
        result.median = sorted[2];
        result.worstC = sorted[3];
      }

      // ── Mo2 ~ Mo4 — 连续 N 次的最佳算术均值 ──
      for (let nn = 2; nn <= 4; nn++) {
        const key = 'mo' + nn;
        if (dnfCount > 0) {
          result[key] = DNF_VALUE;
        } else {
          let bestMean = Infinity;
          for (let i = 0; i <= 5 - nn; i++) {
            let sum = 0;
            let hasDnf = false;
            for (let j = i; j < i + nn; j++) {
              if (times[j] >= DNF_VALUE) { hasDnf = true; break; }
              sum += times[j];
            }
            if (!hasDnf) bestMean = Math.min(bestMean, Math.round(sum / nn));
          }
          result[key] = bestMean === Infinity ? DNF_VALUE : bestMean;
        }
      }
    }

    // NOTE: 以下指标 Mo3/Ao5 通用
    // ── Variance — 方差（秒²单位） ──
    if (result.avg !== DNF_VALUE && result.avg !== undefined) {
      let countingVals: number[];
      if (mo3Mode) {
        countingVals = nonDnf;
      } else {
        countingVals = [sorted[1], sorted[2], sorted[3]];
      }
      const mean = countingVals.reduce((s, v) => s + v, 0) / countingVals.length;
      let variance = countingVals.reduce((s, v) => s + (v - mean) ** 2, 0) / countingVals.length;
      variance = Math.round(variance) / 10000;
      result.variance = variance;
    } else {
      result.variance = null;
    }

    // ── Best/Avg 比率 ──
    result.bestAvgRatio = (result.avg !== DNF_VALUE && result.best !== DNF_VALUE)
      ? Math.round(result.best / result.avg * 100) / 100
      : null;

    return result;
  },

  // NOTE: 阈值计算 — 给定目标平均(tavg)，计算第 N 次成绩的阈值
  computeThresholds(times5: number[], tavg: number): ThresholdResult | null {
    if (!tavg || tavg <= 0 || tavg >= DNF_VALUE) return null;

    const filled = times5.filter(t => t > 0 && t < DNF_VALUE);
    const result: ThresholdResult = {};

    // ── t#5: 已有 4 次，第 5 把最多多少才能 Ao5 ≤ tavg ──
    if (filled.length >= 4) {
      const s = [...filled.slice(0, 4)].sort((a, b) => a - b);
      if (s[1] + s[2] + s[3] <= 3 * tavg + 1) {
        result.t5 = DNF_VALUE; // 即使 DNF 也能达标
      } else {
        const threshold = 3 * tavg + 1 - s[1] - s[2];
        if (threshold < 0 || s[0] + s[1] + s[2] > 3 * tavg + 1) {
          result.t5 = null; // 不可能达标
        } else {
          result.t5 = threshold;
        }
      }
    }

    // ── t#4: 已有 3 次成绩，求第 4 把阈值 ──
    if (filled.length >= 3) {
      const s3 = [...filled.slice(0, 3)].sort((a, b) => a - b);
      const sumS3 = s3[0] + s3[1] + s3[2];

      // WPA 场景
      if (sumS3 <= 3 * tavg + 1) {
        result.t4wpa = 3 * tavg + 1 - s3[1] - s3[2];
      } else {
        result.t4wpa = null;
      }

      // BPA 场景
      if (sumS3 <= 3 * tavg + 1) {
        result.t4bpa = DNF_VALUE; // ANY — x 无论多大都达标
      } else {
        const bpaMax = 3 * tavg + 1 - s3[0] - s3[1];
        result.t4bpa = bpaMax >= 0 ? bpaMax : null;
      }
    }

    return result;
  },

  // NOTE: 合并阈值 — 将互斥的 WPA/BPA 合并为单一幽灵柱数据
  // safe = WPA 有值（绿色，即使第 5 把 DNF 也达标）
  // conditional = BPA 有值（黄色，需第 5 把发挥好）
  // any = 无上限（绿色）
  // impossible = 不可能达标（红色）
  getGhostBar(times: number[], tavg: number): GhostBarResult | null {
    if (!tavg || tavg <= 0 || tavg >= DNF_VALUE) return null;

    const filled = times.filter(t => t > 0 && t < DNF_VALUE);
    if (filled.length < 3 || filled.length >= times.length) return null;

    const th = this.computeThresholds(times, tavg);
    if (!th) return null;

    if (filled.length === 3) {
      // 第 4 柱的幽灵柱
      if (th.t4wpa !== undefined && th.t4wpa !== null) {
        return th.t4wpa >= DNF_VALUE
          ? { value: DNF_VALUE, type: 'any', slotIndex: 3 }
          : { value: th.t4wpa, type: 'safe', slotIndex: 3 };
      }
      if (th.t4bpa !== undefined && th.t4bpa !== null) {
        return th.t4bpa >= DNF_VALUE
          ? { value: DNF_VALUE, type: 'any', slotIndex: 3 }
          : { value: th.t4bpa, type: 'conditional', slotIndex: 3 };
      }
      return { value: 0, type: 'impossible', slotIndex: 3 };
    }

    if (filled.length === 4) {
      // 第 5 柱的幽灵柱
      if (th.t5 !== undefined && th.t5 !== null) {
        return th.t5 >= DNF_VALUE
          ? { value: DNF_VALUE, type: 'any', slotIndex: 4 }
          : { value: th.t5, type: 'safe', slotIndex: 4 };
      }
      return { value: 0, type: 'impossible', slotIndex: 4 };
    }

    return null;
  },

  // NOTE: 委托给统一的 formatTime
  formatTime: (cs: number): string => formatTime(cs),
};
