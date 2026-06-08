// NOTE: WR 数据模块 — 通过 WCA Rankings API 实时获取世界排名数据 + KDE 采样
// 页面初始化时 UI 瞬间就绪（load() 同步返回空壳），数据在后台异步加载
// 支持 playerOverride — 用户可用个人数据替代世界 #1/#2

import { fetchUserTimes } from '@cuberoot/shared';
import type { WcaUserTimes } from '@cuberoot/shared';
import { statsUrl } from '@/lib/stats-base';

// ── 类型 ──

interface WrEventCache {
  single?: number;
  average?: number;
  average_2?: number;
  ao100_1?: number;
  ao100_2?: number;
  times_1?: number[];
  times_2?: number[];
  _loaded?: boolean;
  _players?: (PlayerInfo | null)[];
}

export interface PlayerInfo {
  name: string;
  country: string;
  wca_id: string;
}

export interface PlayerOverrideData {
  times: number[];
  ao100: number;
  name: string;
  country: string;
  averagePR?: number | null;
}

// ── 状态 ──

// NOTE: 每个 eventId 的缓存
const wrData: Record<string, WrEventCache> = {};

// NOTE: 个人数据覆盖 — playerOverride[0/1] = data | null
// 设置后，sampleKDE / getAo100 自动使用个人数据
const playerOverride: (PlayerOverrideData | null)[] = [null, null];

/** 覆盖指定 player 的 KDE 数据源为用户个人数据 */
export function setPlayerOverride(playerIdx: number, data: PlayerOverrideData): void {
  playerOverride[playerIdx] = data;
  // NOTE: 清除该 player 的带宽和衰减权重缓存 — 新数据需要重新计算
  for (const key in bandwidthCache) {
    if (key.endsWith('_' + playerIdx)) delete bandwidthCache[key];
  }
  for (const key in decayCache) {
    if (key.endsWith('_' + playerIdx)) delete decayCache[key];
  }
}

/** 清除指定 player 的覆盖，恢复世界 #1/#2 数据 */
export function clearPlayerOverride(playerIdx: number): void {
  playerOverride[playerIdx] = null;
  for (const key in bandwidthCache) {
    if (key.endsWith('_' + playerIdx)) delete bandwidthCache[key];
  }
  for (const key in decayCache) {
    if (key.endsWith('_' + playerIdx)) delete decayCache[key];
  }
}

/** 获取指定 player 的覆盖数据（用于 UI 显示用户名等） */
export function getPlayerOverride(playerIdx: number): PlayerOverrideData | null {
  return playerOverride[playerIdx];
}

// NOTE: wr_ids.json 全局缓存 — 所有 event 共享一份文件
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wrIdsCache: Record<string, any> | null = null;

/**
 * NOTE: 同步初始化 — 仅创建空壳，不阻塞 UI
 * 保持向后兼容：app.js 中 wrData.load().then(...) 仍然有效
 */
export async function load(): Promise<void> {
  // NOTE: 预加载 wr_ids.json — 同源请求，极快
  if (!wrIdsCache) {
    try {
      const resp = await fetch(statsUrl('/stats/wr_ids.json'));
      if (resp.ok) wrIdsCache = await resp.json();
    } catch (e) {
      console.warn('wr_ids.json load failed:', e);
    }
  }
}

/**
 * NOTE: 异步加载指定项目的世界排名数据（fire-and-forget）
 * 1. 从 wr_ids.json 获取 WCA ID + WR 值（同源静态文件，秒级）
 * 2. fetchUserTimes → 100 把 singles + ao100（WCA API，有 CORS 支持）
 */
export async function loadDefaults(
  eventId: string,
  onReady?: (players: (PlayerInfo | null)[]) => void,
): Promise<void> {
  // NOTE: 已有缓存 → 重新建立 playerOverride 后回调
  // 用户可能曾用人物搜索覆盖过 override,再次"加载世界 TOP 2"必须把 override 重置回 WR 数据
  if (wrData[eventId]?.['_loaded']) {
    const cached = wrData[eventId]._players || [];
    for (let i = 0; i < cached.length; i++) {
      const p = cached[i];
      if (!p) continue;
      const times = wrData[eventId][i === 0 ? 'times_1' : 'times_2'];
      const ao100 = wrData[eventId][i === 0 ? 'ao100_1' : 'ao100_2'];
      const averagePR = i === 0 ? wrData[eventId].average : wrData[eventId].average_2;
      if (times && ao100) {
        setPlayerOverride(i, { times, ao100, name: p.name, country: p.country, averagePR });
      }
    }
    onReady?.(cached);
    return;
  }

  const ids = wrIdsCache?.[eventId];
  if (!ids) {
    // NOTE: 该项目没有 WR 数据（如 333mbf）
    onReady?.([]);
    return;
  }

  wrData[eventId] = wrData[eventId] || {};

  // NOTE: 存储 WR 值（用于 isWR / getWR / getAvgWR12）
  if (ids.single) wrData[eventId].single = ids.single;
  if (ids.avg_1) wrData[eventId].average = ids.avg_1;
  if (ids.avg_2) wrData[eventId].average_2 = ids.avg_2;

  try {
    // NOTE: 并行加载前 2 名选手的 100 把 singles（WCA API，有 CORS 支持）
    const wcaIds: string[] = [ids.avg_id_1, ids.avg_id_2].filter(Boolean);
    const timesResults = await Promise.all(
      wcaIds.map((id: string) => fetchUserTimes(id, eventId)),
    );

    // NOTE: 存入 wrData 缓存 + 设置 playerOverride
    const players: (PlayerInfo | null)[] = [];
    for (let i = 0; i < timesResults.length; i++) {
      const d: WcaUserTimes | null = timesResults[i];
      if (d) {
        // NOTE: FMC 的 WCA API 返回原始步数（26），
        // 但 calc 内部用 步数×100（2600）。这里对齐格式。
        const times = eventId === '333fm'
          ? d.times.map(v => v * 100)
          : d.times;
        const ao100 = eventId === '333fm' ? d.ao100 * 100 : d.ao100;

        const suffix = i === 0 ? '1' : '2';
        wrData[eventId]['ao100_' + suffix as 'ao100_1' | 'ao100_2'] = ao100;
        wrData[eventId]['times_' + suffix as 'times_1' | 'times_2'] = times;
        // NOTE: 用选手真实 averagePR 覆盖 wr_ids 中的值（更准确）
        if (d.averagePR) {
          if (i === 0) wrData[eventId].average = d.averagePR;
          else wrData[eventId].average_2 = d.averagePR;
        }
        setPlayerOverride(i, { times, ao100, name: d.name, country: d.country, averagePR: d.averagePR });
        players.push({
          name: d.name,
          country: d.country,
          wca_id: wcaIds[i],
        });
      } else {
        players.push(null);
      }
    }

    wrData[eventId]._loaded = true;
    wrData[eventId]._players = players;
    onReady?.(players);
  } catch (e) {
    console.warn('loadDefaults failed for', eventId, e);
    // NOTE: 即使 API 失败，WR 值已从 wr_ids.json 加载，isWR 仍可用
    wrData[eventId]._loaded = true;
    onReady?.([]);
  }
}

/**
 * NOTE: 查询是否打破 WR
 * @param metric - 指标类型：'single' | 'average' | 'bpa' | 'wpa'
 * @param value  - centiseconds 值
 * @returns value ≤ WR 则返回 true
 */
export function isWR(eventId: string, metric: string, value: number): boolean {
  if (!wrData[eventId]) return false;
  const wr = (wrData[eventId] as Record<string, unknown>)[metric] as number | undefined;
  if (wr === undefined || wr <= 0) return false;
  // NOTE: ≤ 而非 < — 平 WR 也算
  return value > 0 && value <= wr;
}

/** NOTE: 获取 WR 值 */
export function getWR(eventId: string, metric: string): number | null {
  if (!wrData[eventId]) return null;
  return (wrData[eventId] as Record<string, unknown>)[metric] as number ?? null;
}

/** NOTE: 获取 Average WR #1 和 #2 */
export function getAvgWR12(eventId: string): [number, number] | null {
  if (!wrData[eventId]) return null;
  const a1 = wrData[eventId].average;
  const a2 = wrData[eventId].average_2;
  if (!a1 || !a2) return null;
  return [a1, a2];
}

/** NOTE: 获取 Ao100 世界第 1 和第 2 的值 */
export function getAo100(eventId: string): [number, number] | null {
  // NOTE: 支持混合源 — 每个 player 独立判断 override
  const a1 = playerOverride[0] ? playerOverride[0].ao100
    : (wrData[eventId] ? wrData[eventId].ao100_1 : undefined);
  const a2 = playerOverride[1] ? playerOverride[1].ao100
    : (wrData[eventId] ? wrData[eventId].ao100_2 : undefined);
  if (!a1 || !a2) return null;
  return [a1, a2];
}

// ── KDE 采样 ──

// NOTE: Silverman 带宽缓存 — key = "eventId_playerIdx"
const bandwidthCache: Record<string, number> = {};

// NOTE: 衰减权重累积和缓存
interface DecayCacheEntry {
  cumWeights: Float64Array;
  total: number;
  n: number;
}
const decayCache: Record<string, DecayCacheEntry> = {};

// NOTE: 衰减因子 — λ=1 即均匀采样
const DECAY_LAMBDA = 1;

export function sampleKDE(eventId: string, playerIdx: number): number | null {
  // NOTE: 优先使用 playerOverride，fallback 到 wrData
  let times: number[] | undefined;
  let useDecay = false;
  if (playerOverride[playerIdx]) {
    times = playerOverride[playerIdx]!.times;
    useDecay = true; // NOTE: 个人数据按时间倒序排列，可用衰减加权
  } else if (wrData[eventId]) {
    times = wrData[eventId][playerIdx === 0 ? 'times_1' : 'times_2'];
  }
  if (!times || times.length < 10) return null;

  // NOTE: 带宽缓存 — ao100 数据不变，Silverman 带宽只需算一次
  const cacheKey = eventId + '_' + playerIdx;
  let h = bandwidthCache[cacheKey];
  if (h === undefined) {
    const n = times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const sigma = Math.sqrt(variance);
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    h = 0.9 * Math.min(sigma, iqr / 1.34) * Math.pow(n, -0.2);
    bandwidthCache[cacheKey] = h;
  }

  // NOTE: 选择基准成绩 — 个人数据用衰减加权（近期偏重），WR 数据均匀随机
  let baseTime: number;
  if (useDecay) {
    // NOTE: 预计算累积权重并缓存 — 500K 次采样只算一次
    let dc = decayCache[cacheKey];
    if (!dc || dc.n !== times.length) {
      const cumWeights = new Float64Array(times.length);
      let cum = 0;
      let w = 1;
      for (let i = 0; i < times.length; i++) {
        cum += w;
        cumWeights[i] = cum;
        w *= DECAY_LAMBDA;
      }
      dc = { cumWeights, total: cum, n: times.length };
      decayCache[cacheKey] = dc;
    }
    // NOTE: 二分查找加权随机索引 — O(log n) per sample
    const r = Math.random() * dc.total;
    let lo = 0, hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dc.cumWeights[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    baseTime = times[lo];
  } else {
    baseTime = times[Math.floor(Math.random() * times.length)];
  }

  // Box-Muller 生成标准正态随机数
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const result = Math.round(baseTime + h * z);
  return Math.max(30, result); // NOTE: 下限 0.30s，避免极端采样产生不合理成绩
}
