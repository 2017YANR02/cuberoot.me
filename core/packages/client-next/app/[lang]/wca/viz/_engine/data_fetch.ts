// NOTE: WCA 数据获取 + 解析模块
// 从 viz/viz.js fetchPlayerData() + buildChannelDataForPlayer() 1:1 翻译为 TypeScript
// 复用 @cuberoot/shared 的 fetchResults / fetchCompetitions API

import { fetchResults, fetchCompetitions } from '@cuberoot/shared';
import { compute as computeRollingStats } from './rolling_stats';
import { compute as computeRoundMetrics } from './round_metrics';
import type { RollingResult } from './rolling_stats';
import type { RoundMetricsResult, SolveEntry } from './round_metrics';
import type { KDEPoint } from './kde';

// ─── 类型定义 ───

// NOTE: channelData[j] = [value, compDateIndex, originalSolveIndex(1-based)]
// 第三个元素仅 AoN 模式有，用于 tooltip 显示正确的把数序号
export type ChannelEntry = [number, number] | [number, number, number];

export interface MeanTrailPoint {
  x: number;
  frame: number;
}

export interface PlayerData {
  wcaId: string;
  name: string;
  nameZh: string;
  solveData: [number, number][];    // [cs, compIdx]
  channelData: ChannelEntry[];
  competitions: string[];
  compDates: string[];              // compDates[i] = 日期字符串，与 competitions[i] 平行
  statsData: RollingResult;
  roundMetrics: RoundMetricsResult;
  solveEntries: SolveEntry[];
  ghostKDE: KDEPoint[] | null;
  ghostMean: number;
  colorIdx: number;
  meanTrail: MeanTrailPoint[];
    nameZhHant?: string;
}

// NOTE: WCA 轮次类型 ID → 英文/中文名称，供 tooltip 和 CSV 导出共用
export const ROUND_NAMES: Record<string, string> = {
  '1': 'Round 1', 'd': 'Combined R1',
  '2': 'Round 2', 'b': 'Combined R2',
  '3': 'Semi Final', 'c': 'Combined Final', 'f': 'Final',
};
export const ROUND_ZH: Record<string, string> = {
  '1': '初赛', 'd': '初赛(联合)',
  '2': '复赛', 'b': '复赛(联合)',
  '3': '半决赛', 'c': '决赛(联合)', 'f': '决赛',
};

// NOTE: 4 色方案 — HSL 基色，用于 KDE 曲线、均值线、chip 标签
export const PLAYER_COLORS = [
  { h: 190, s: 90, l: 55, label: '青' },   // 青色（主色调，延续原风格）
  { h: 25,  s: 90, l: 55, label: '橙' },   // 橙色
  { h: 280, s: 70, l: 60, label: '紫' },   // 紫色
  { h: 130, s: 70, l: 50, label: '绿' },   // 绿色
];

// NOTE: 常量
export const MAX_PLAYERS = 4;
export const KDE_POINTS = 200;

// ─── 轮次排序 ───
const ROUND_ORDER: Record<string, number> = { '1': 0, 'd': 1, '2': 2, 'b': 3, '3': 4, 'c': 5, 'f': 6 };

// ─── 数据模式类型 ───
export type DataMode =
  | 'singles'
  | 'mo3' | 'ao5' | 'ao12' | 'ao25' | 'ao50' | 'ao100'
  | 'avg' | 'bao5' | 'wao5' | 'mo5' | 'bpa' | 'wpa' | 'median' | 'bestc' | 'worstc' | 'worst';

export type ViewMode = 'line' | 'histogram' | 'cumHist';
export type SyncMode = 'solve' | 'date';

// NOTE: Round Metrics 的 key 集合
export const ROUND_KEYS: Record<string, number> = {
  avg: 1, bao5: 1, wao5: 1, mo5: 1, bpa: 1, wpa: 1, median: 1, bestc: 1, worstc: 1, worst: 1,
};

// NOTE: 图层显隐控制（药丸开关）
export interface ShowLayers {
  currentVal: boolean;
  meanLine: boolean;
  ghost: boolean;
  trail: boolean;
  bimodal: boolean;
  followMean: boolean;
  histBars: boolean;
}

export const DEFAULT_SHOW_LAYERS: ShowLayers = {
  currentVal: false,
  meanLine: false,
  ghost: true,
  trail: true,
  bimodal: true,
  followMean: false,
  histBars: true,
};

// ─── 数据获取 ───

/**
 * NOTE: 从 WCA API 获取并解析选手数据，返回 PlayerData 对象
 * 1:1 翻译自 viz.js fetchPlayerData()
 */
export async function fetchPlayerData(wcaId: string, eventId: string): Promise<PlayerData | null> {
  const [results, comps] = await Promise.all([
    fetchResults(wcaId),
    fetchCompetitions(wcaId),
  ]);
  if (!results || !comps) {
    alert('Failed to load data for ' + wcaId);
    return null;
  }

  const compMap: Record<string, { name: string; date: string }> = {};
  for (const c of comps) {
    compMap[c.id] = { name: c.name, date: c.start_date };
  }

  // NOTE: 按比赛日期 + 轮次排序
  const eventResults = (results as Record<string, unknown>[])
    .filter(r => r.event_id === eventId && compMap[r.competition_id as string])
    .sort((a, b) => {
      const da = compMap[a.competition_id as string].date;
      const db = compMap[b.competition_id as string].date;
      if (da !== db) return da < db ? -1 : 1;
      return (ROUND_ORDER[a.round_type_id as string] || 0) - (ROUND_ORDER[b.round_type_id as string] || 0);
    });

  const competitions: string[] = [];
  const compDates: string[] = [];
  const compNameSet = new Map<string, number>();
  const solveData: [number, number][] = [];
  const solveEntries: SolveEntry[] = [];

  for (const r of eventResults) {
    const compName = compMap[r.competition_id as string].name;
    const compDate = compMap[r.competition_id as string].date;
    if (!compNameSet.has(compName)) {
      compNameSet.set(compName, competitions.length);
      competitions.push(compName);
      compDates.push(compDate);
    }
    const compIdx = compNameSet.get(compName)!;
    const attempts = (r.attempts as number[]) || [];
    // NOTE: WCA 官方 average（厘秒），仅填入轮次第一把，供 CSV 导出使用
    const roundAvg = (r.average && (r.average as number) > 0) ? (r.average as number) : null;
    let isFirstAttempt = true;
    for (let a = 0; a < attempts.length; a++) {
      const cs = attempts[a];
      if (cs === 0) continue;
      solveData.push([cs, compIdx]);
      solveEntries.push({
        cs, compName, compDate: compMap[r.competition_id as string].date,
        roundType: r.round_type_id as string, attemptIdx: a,
        average: isFirstAttempt ? roundAvg : null,
      });
      isFirstAttempt = false;
    }
  }

  const singlesCs = solveEntries.map(e => e.cs);
  const statsData = computeRollingStats(singlesCs);
  // NOTE: 轮次衍生指标（BAo5/WAo5 等），供 CSV 导出和折线图使用
  const roundMetricsData = computeRoundMetrics(solveEntries);

  // NOTE: 构建 WCA 官方 avg 数组（从 solveEntries.average 取，轮次第一把有值）
  const avgArr = new Array<number | null>(solveEntries.length).fill(null);
  const avgPb = new Array<boolean>(solveEntries.length).fill(false);
  let bestAvgVal = Infinity;
  for (let i = 0; i < solveEntries.length; i++) {
    const av = solveEntries[i].average;
    if (av !== null && av !== undefined && av > 0) {
      avgArr[i] = av;
      if (av < bestAvgVal) {
        bestAvgVal = av;
        avgPb[i] = true;
      }
    }
  }
  roundMetricsData.avg = avgArr;
  roundMetricsData.pbFlags.avg = avgPb;

  const firstResult = eventResults[0] as Record<string, unknown> | undefined;
  const personName = firstResult ? (firstResult.name as string) : wcaId;
  const zhMatch = personName.match(/\((.+?)\)/);

  return {
    wcaId,
    name: personName.replace(/\s*\(.+?\)/, ''),
    nameZh: zhMatch ? zhMatch[1] : personName.replace(/\s*\(.+?\)/, ''),
    solveData,
    channelData: [],
    competitions,
    compDates,
    statsData,
    roundMetrics: roundMetricsData,
    solveEntries,
    ghostKDE: null,
    ghostMean: 0,
    colorIdx: 0,
    meanTrail: [],
  };
}

// ─── 通道数据构建 ───

/**
 * NOTE: 根据 dataMode 从 player 数据构建 channelData
 * 1:1 翻译自 viz.js buildChannelDataForPlayer()
 */
export function buildChannelDataForPlayer(player: PlayerData, dataMode: DataMode): void {
  player.channelData = [];
  if (dataMode === 'singles') {
    player.channelData = player.solveData;
    return;
  }
  // NOTE: Round Metrics 的 key 从 roundMetrics 取，Rolling Stats 从 statsData 取
  const isRound = player.roundMetrics && player.roundMetrics[dataMode] !== undefined;
  const arr = isRound
    ? (player.roundMetrics[dataMode] as (number | null)[])
    : (player.statsData[dataMode] as (number | null)[]);
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null) {
      player.channelData.push([arr[i] as number, player.solveData[i][1], i + 1]);
    }
  }
}

// ─── 值转换工具 ───

/**
 * NOTE: 原始值 → 显示值（1:1 翻译自 viz.js rawToVal）
 */
export function rawToVal(v: number, eventId: string): number {
  if (eventId === '333fm') return v;
  if (eventId === '333mbf') {
    // 编码: 0DDTTTTTMM → score = 99 - DD
    const s = String(v).padStart(10, '0');
    const dd = parseInt(s.slice(1, 3), 10);
    const mm = parseInt(s.slice(8, 10), 10);
    const diff = 99 - dd;
    const solved = diff + mm;
    return solved - mm;  // = diff = 99 - DD
  }
  return v / 100;
}

/**
 * NOTE: 格式化显示值（1:1 翻译自 viz.js fmtVal）
 */
export function fmtVal(v: number, eventId: string): string {
  if (eventId === '333fm') return Math.round(v) + ' moves';
  if (eventId === '333mbf') return Math.round(v) + ' pts';
  return v.toFixed(2) + 's';
}

export function isFMC(eventId: string): boolean { return eventId === '333fm'; }
export function isMBLD(eventId: string): boolean { return eventId === '333mbf'; }
export function isHigherBetter(eventId: string): boolean { return isMBLD(eventId); }

// ─── 颜色工具 ───

/**
 * NOTE: 从 PLAYER_COLORS 构造 CSS 颜色字符串
 */
export function playerHSL(idx: number, a?: number): string {
  const c = PLAYER_COLORS[idx % PLAYER_COLORS.length];
  if (a !== undefined) return `hsla(${c.h}, ${c.s}%, ${c.l}%, ${a})`;
  return `hsl(${c.h}, ${c.s}%, ${c.l}%)`;
}

/**
 * NOTE: 单选手变色 — 根据当前均值与初始均值的差异插值 hue
 * 1:1 翻译自 viz.js getShiftedHSL()
 */
export function getShiftedHSL(
  pi: number,
  alpha: number,
  currentMean: number,
  players: PlayerData[],
  eventId: string,
): string {
  const p = players[pi];
  if (players.length > 1 || !p.ghostMean || p.ghostMean <= 0) {
    return playerHSL(pi, alpha);
  }
  const c = PLAYER_COLORS[pi % PLAYER_COLORS.length];
  // delta 占初始均值的比例，clamp 到 [-0.3, 0.3]
  let ratio = Math.max(-0.3, Math.min(0.3, (currentMean - p.ghostMean) / p.ghostMean));
  // NOTE: MBLD 得分越高越好，ratio 反转使正方向=绿色
  if (isHigherBetter(eventId)) ratio = -ratio;
  // ratio < 0 → 改善 → hue 往绿(130)偏；ratio > 0 → 退步 → hue 往红(0)偏
  const t = ratio / 0.3;  // [-1, 1]
  let targetHue: number;
  if (t <= 0) {
    targetHue = c.h + (-t) * (130 - c.h);  // 基色→绿
  } else {
    targetHue = c.h * (1 - t);              // 线性插值到 0
  }
  return `hsla(${Math.round(targetHue)}, ${c.s}%, ${c.l}%, ${alpha})`;
}

// ─── HTML 转义 ───
export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── 日期工具 ───
/**
 * NOTE: YYYY-MM-DD → 可比较数值（无需 Date 对象，高性能）
 */
export function dateToNum(d: string): number {
  const parts = d.split('-');
  return Number(parts[0]) * 10000 + Number(parts[1]) * 100 + Number(parts[2]);
}

/**
 * NOTE: 格式化比赛名称
 * CamelCase → 空格分隔，年份前加空格
 */
export function formatCompName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(\D)(\d{4})/g, '$1 $2')
    .trim();
}
