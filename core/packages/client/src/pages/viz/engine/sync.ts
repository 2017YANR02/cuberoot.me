// NOTE: 多选手帧同步模块
// 从 viz/viz.js 中提取的同步相关函数，1:1 翻译为 TypeScript
// 包括：日期时间线构建、帧定位、插值

import type { PlayerData, ChannelEntry } from './data_fetch';
import { dateToNum } from './data_fetch';

// ─── 日期时间线 ───

/**
 * NOTE: 构建全局日期时间线
 * 从所有选手的 channelData 中收集比赛日期，去重排序
 * 1:1 翻译自 viz.js buildDateTimeline()
 */
export function buildDateTimeline(players: PlayerData[]): string[] {
  const dateSet = new Set<string>();
  for (const p of players) {
    for (const d of p.channelData) {
      const compIdx = d[1];
      dateSet.add(p.compDates[compIdx]);
    }
  }
  return Array.from(dateSet).sort();
}

// ─── 帧同步 ───

/**
 * NOTE: 根据 syncMode 计算某选手在当前 progress 下的窗口起始帧
 * 1:1 翻译自 viz.js computePlayerFrame()
 */
export function computePlayerFrame(
  pi: number,
  progress: number,
  players: PlayerData[],
  windowSize: number,
  syncMode: string,
): number {
  const p = players[pi];
  const pMax = Math.max(0, p.channelData.length - windowSize);
  if (pMax === 0) return 0;

  if (syncMode === 'solve' || players.length <= 1) {
    return Math.round(progress * pMax);
  }

  // ─── date 模式：全局日期范围映射 ───
  // NOTE: 用所有选手的最早/最晚日期作为全局时间轴
  let globalFirst = Infinity, globalLast = -Infinity;
  for (const pl of players) {
    const f = dateToNum(pl.compDates[pl.channelData[0][1]]);
    const l = dateToNum(pl.compDates[pl.channelData[pl.channelData.length - 1][1]]);
    if (f < globalFirst) globalFirst = f;
    if (l > globalLast) globalLast = l;
  }
  if (globalLast <= globalFirst) return Math.round(progress * pMax);

  // 当前连续日期数值（线性插值全局起止日期）
  const currentDateNum = globalFirst + progress * (globalLast - globalFirst);

  // 该选手的时间跨度
  const pFirst = dateToNum(p.compDates[p.channelData[0][1]]);
  const pLast = dateToNum(p.compDates[p.channelData[p.channelData.length - 1][1]]);
  if (pLast <= pFirst) return Math.round(progress * pMax);

  // 映射全局日期到该选手的时间跨度
  const pProgress = (currentDateNum - pFirst) / (pLast - pFirst);
  return Math.round(Math.max(0, Math.min(1, pProgress)) * pMax);
}

// ─── 日期定位 ───

/**
 * NOTE: 给定一个日期，返回该选手在此日期（含）之前最后一个 solve 的索引
 * 1:1 翻译自 viz.js solveIdxAtDate()
 */
export function solveIdxAtDate(
  playerIdx: number,
  targetDate: string,
  players: PlayerData[],
): number {
  const p = players[playerIdx];
  if (!p) return -1;
  const cd = p.channelData;
  let lastIdx = -1;
  for (let i = 0; i < cd.length; i++) {
    if (p.compDates[cd[i][1]] <= targetDate) {
      lastIdx = i;
    } else {
      break;
    }
  }
  return lastIdx;
}

/**
 * NOTE: 日期间线性插值版本 — 让非 driver 选手在两场比赛之间平滑过渡
 * 1:1 翻译自 viz.js interpolatedSolveIdx()
 */
export function interpolatedSolveIdx(
  playerIdx: number,
  targetDate: string,
  players: PlayerData[],
): number {
  const p = players[playerIdx];
  if (!p) return -1;
  const cd: ChannelEntry[] = p.channelData;

  // 阶梯版定位
  const prevIdx = solveIdxAtDate(playerIdx, targetDate, players);
  if (prevIdx < 0) return -1;
  if (prevIdx >= cd.length - 1) return prevIdx;

  const prevDate = p.compDates[cd[prevIdx][1]];

  // 找下一个不同日期的首个 solve
  let nextIdx = -1;
  let nextDate: string | null = null;
  for (let i = prevIdx + 1; i < cd.length; i++) {
    const d = p.compDates[cd[i][1]];
    if (d > prevDate) {
      nextIdx = i;
      nextDate = d;
      break;
    }
  }

  // 没有下一个日期，或 targetDate 正好在 prevDate 上 → 不插值
  if (nextIdx < 0 || targetDate <= prevDate) return prevIdx;

  // NOTE: 日期 → 数值，做线性插值
  const tNum = dateToNum(targetDate);
  const pNum = dateToNum(prevDate);
  const nNum = dateToNum(nextDate!);
  if (nNum <= pNum) return prevIdx;

  const ratio = Math.min(1, (tNum - pNum) / (nNum - pNum));
  return Math.round(prevIdx + ratio * (nextIdx - prevIdx));
}

/**
 * NOTE: 从 channelData 中提取窗口内的显示值
 * 1:1 翻译自 viz.js getWindowTimes()
 */
export function getWindowTimes(
  playerIdx: number,
  frame: number,
  players: PlayerData[],
  windowSize: number,
  eventId: string,
  rawToValFn: (v: number, eventId: string) => number,
): number[] {
  const p = players[playerIdx];
  if (!p) return [];
  const cd = p.channelData;
  const end = Math.min(frame + windowSize, cd.length);
  const times: number[] = [];
  for (let i = frame; i < end; i++) {
    const v = cd[i][0];
    if (v > 0) times.push(rawToValFn(v, eventId));
  }
  return times;
}
