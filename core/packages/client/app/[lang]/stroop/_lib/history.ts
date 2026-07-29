/**
 * Stroop 成绩本地存档 + 干扰量计算(纯函数,方便测)。
 *
 * 成绩按「每格用时」比,不按总时长 —— 换词数就不可比了。干扰量是本页唯一
 * 有意义的指标:同一套颜色下,干扰卡每格 − 色块卡每格,单位 ms;色块卡是这
 * 个人自己的命名基线,减掉之后剩下的才是被字面意思拖慢的那部分。
 * 颜色数不同(4 / 6)难度不同,所以只在同一颜色数内相减。
 */

import { persistItem } from '@/lib/safe-storage';
import type { CardKind } from './card';

export interface StroopRun {
  kind: CardKind;
  /** 这次卡有几格。 */
  count: number;
  colorCount: number;
  /** 总用时 ms。 */
  ms: number;
  /** 完成时刻(Date.now)。 */
  ts: number;
}

const KEY = 'cuberoot-stroop.v1';
/** 存档上限 —— 只用来算最好成绩和最近几条,不做长期统计。 */
export const MAX_RUNS = 50;

export function perCellMs(run: StroopRun): number {
  return run.count > 0 ? run.ms / run.count : 0;
}

/** 追加一条并裁到上限(新的在前)。纯函数,不落盘。 */
export function addRun(runs: readonly StroopRun[], run: StroopRun): StroopRun[] {
  return [run, ...runs].slice(0, MAX_RUNS);
}

/** 同类型同颜色数里最快的每格用时;没有记录返回 null。 */
export function bestPerCell(
  runs: readonly StroopRun[],
  kind: CardKind,
  colorCount: number,
): number | null {
  let best: number | null = null;
  for (const r of runs) {
    if (r.kind !== kind || r.colorCount !== colorCount || r.count <= 0) continue;
    const per = perCellMs(r);
    if (best === null || per < best) best = per;
  }
  return best;
}

/**
 * 干扰量 ms/格 = 干扰卡最好 − 色块卡最好。两种卡都得跑过才有值。
 * 可能是负数(基线那次手抖 / 干扰卡蒙对节奏),照实返回,不夹到 0。
 */
export function interferenceMs(runs: readonly StroopRun[], colorCount: number): number | null {
  const hard = bestPerCell(runs, 'incongruent', colorCount);
  const base = bestPerCell(runs, 'patch', colorCount);
  if (hard === null || base === null) return null;
  return hard - base;
}

function isRun(v: unknown): v is StroopRun {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (r.kind === 'patch' || r.kind === 'congruent' || r.kind === 'incongruent')
    && typeof r.count === 'number' && Number.isFinite(r.count)
    && typeof r.colorCount === 'number' && Number.isFinite(r.colorCount)
    && typeof r.ms === 'number' && Number.isFinite(r.ms)
    && typeof r.ts === 'number' && Number.isFinite(r.ts);
}

/** 读存档。SSR / 坏数据 / 隐私模式一律退成空数组。 */
export function loadRuns(): StroopRun[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRun).slice(0, MAX_RUNS);
  } catch {
    return [];
  }
}

export function saveRuns(runs: readonly StroopRun[]): void {
  persistItem(KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
}

export function clearRuns(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY); } catch { /* 隐私模式,忽略 */ }
}
