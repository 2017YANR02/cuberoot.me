/**
 * 统计计算函数
 * 1:1 翻译自 battle.js（行 1300~1478）
 */

import type { SolveEntry } from './types';

/**
 * NOTE: 从历史记录对象提取有效时间（含罚时计算）
 * 兼容新格式 {time, penalty, scramble, date} 和旧格式（纯 ms 数字）
 */
export function getEffectiveTimeFromEntry(entry: SolveEntry | number): number {
  if (typeof entry === 'number') return entry; // 兼容旧格式
  if (entry.penalty === 'dnf') return Infinity;
  if (entry.penalty === '+2') return entry.time + 2000;
  return entry.time;
}

/**
 * NOTE: 计算 Ao5 — 取最近 5 条成绩，排序去最好最差，取中间 3 条均值
 * 返回 ms 值，DNF 返回 Infinity，不足 5 条返回 null
 */
export function computeAo5(history: SolveEntry[]): number | null {
  if (history.length < 5) return null;
  const last5 = history.slice(-5).map(getEffectiveTimeFromEntry);
  const sorted = [...last5].sort((a, b) => a - b);
  // NOTE: 2+ 个 DNF（Infinity）→ 整个 Ao5 = DNF
  const dnfCount = sorted.filter(t => t === Infinity).length;
  if (dnfCount >= 2) return Infinity;
  // 去掉最好（sorted[0]）和最差（sorted[4]），取中间 3 条均值
  return Math.round((sorted[1] + sorted[2] + sorted[3]) / 3);
}

/**
 * NOTE: 通用 Average（Ao12/Ao100）— 参考 DCTimer Stats.java averageOf 算法
 * n ≤ 20: 去掉最好最差各 1 个
 * n > 20: 去掉最好最差各 ceil(n/20) 个（WCA 标准 5% trim）
 */
export function computeAverage(history: SolveEntry[], n: number): number | null {
  if (history.length < n) return null;
  const lastN = history.slice(-n).map(getEffectiveTimeFromEntry);
  const trim = Math.ceil(n / 20);
  const sorted = [...lastN].sort((a, b) => a - b);
  const dnfCount = sorted.filter(t => t === Infinity).length;
  if (dnfCount > trim) return Infinity; // DNF 超过 trim 数量 → 整个 average = DNF
  // 去掉前 trim 个最好和后 trim 个最差
  const middle = sorted.slice(trim, n - trim);
  const sum = middle.reduce((a, b) => a + b, 0);
  return Math.round(sum / middle.length);
}

/**
 * NOTE: 基础统计量一站式计算（DRY — 避免 mean/sd/cv 在多处重复计算）
 */
export function computeBasicStats(validTimes: number[]): { mean: number; sd: number; cv: number } | null {
  if (validTimes.length < 2) return null;
  let sum = 0;
  for (let i = 0; i < validTimes.length; i++) sum += validTimes[i];
  const mean = sum / validTimes.length;
  let sqSum = 0;
  for (let j = 0; j < validTimes.length; j++) {
    const d = validTimes[j] - mean;
    sqSum += d * d;
  }
  const variance = sqSum / validTimes.length;
  const sd = Math.sqrt(variance);
  // cv = σ / μ × 100（百分比形式）
  const cv = mean > 0 ? sd / mean * 100 : 0;
  return { mean: Math.round(mean), sd: sd, cv: cv };
}

/**
 * NOTE: Streak 追踪 — 连续低于阈值的成绩次数
 */
export function computeStreak(times: number[], threshold: number): { current: number; best: number } {
  let current = 0;
  let best = 0;
  let streak = 0;
  for (let i = 0; i < times.length; i++) {
    if (times[i] !== Infinity && times[i] < threshold) {
      streak++;
      if (streak > best) best = streak;
    } else {
      streak = 0;
    }
  }
  current = streak;
  return { current: current, best: best };
}

/**
 * NOTE: 检测第 index 条成绩是否为"截至当时"的 session best single
 * 用于历史列表中标记 PB
 */
export function isPBSingleAt(history: SolveEntry[], index: number): boolean {
  const effTime = getEffectiveTimeFromEntry(history[index]);
  if (effTime === Infinity) return false;
  for (let i = 0; i < index; i++) {
    const t = getEffectiveTimeFromEntry(history[i]);
    if (t <= effTime) return false;
  }
  return true;
}

/**
 * NOTE: 格式化相对日期（今天/昨天/具体日期）
 */
export function formatRelativeDate(isoDate: string, locale: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);

  const timeStr = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');

  if (diff === 0) return timeStr;
  if (diff === 1) {
    return (locale === 'zh' ? '昨天 ' : 'Yesterday ') + timeStr;
  }
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + timeStr;
}

/**
 * NOTE: 百分位表 — 计算低于各阈值的成绩占比
 * 1:1 翻译自 battle.js computeSubXBreakdown()（行 1423~1464）
 */
export function computeSubXBreakdown(
  validTimes: number[],
  formatTimePlainFn: (ms: number) => string
): Array<{ label: string; pct: number; threshold: number }> {
  if (validTimes.length < 5) return [];
  const stats = computeBasicStats(validTimes);
  if (!stats) return [];
  const mean = stats.mean;
  const sd = stats.sd;

  // NOTE: 生成阈值候选：mean-σ, mean-0.5σ, mean, mean+0.5σ, mean+σ
  const candidates = [mean - sd, mean - sd * 0.5, mean, mean + sd * 0.5, mean + sd];
  // 取整到最近的 "nice number"（基于数量级）
  const thresholds: Array<{ threshold: number; label: string; pct: number }> = [];
  const seen: Record<string, boolean> = {};
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c <= 0) continue;
    // NOTE: 根据数量级选择取整精度
    let nice: number;
    if (c >= 60000) {
      nice = Math.round(c / 10000) * 10000; // 10s 精度（分钟级）
    } else if (c >= 10000) {
      nice = Math.round(c / 5000) * 5000; // 5s 精度
    } else if (c >= 5000) {
      nice = Math.round(c / 1000) * 1000; // 1s 精度
    } else {
      nice = Math.round(c / 500) * 500; // 0.5s 精度
    }
    if (nice <= 0) continue;
    const key = '' + nice;
    if (seen[key]) continue;
    seen[key] = true;
    const count = validTimes.filter(t => t < nice).length;
    const pct = Math.round(count / validTimes.length * 100);
    // NOTE: 只保留有区分度的阈值（0% < pct < 100%）
    if (pct > 0 && pct < 100) {
      thresholds.push({ threshold: nice, label: 'sub-' + formatTimePlainFn(nice), pct: pct });
    }
  }

  // 去重后取最多 4 个
  thresholds.sort((a, b) => a.threshold - b.threshold);
  return thresholds.slice(0, 4);
}
