import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CaseStats {
  /** 所有计时（毫秒） */
  times: number[];
  /** 最近一次 */
  lastTime: number;
  /** 训练总次数 */
  count: number;
}

interface StatsStore {
  /** 按 "algSetId:caseId" 为 key 存储各 case 统计 */
  caseStats: Record<string, CaseStats>;

  // 动作
  recordTime: (algSetId: string, caseId: string, timeMs: number) => void;
  getStats: (algSetId: string, caseId: string) => CaseStats | undefined;
  getAo5: (algSetId: string, caseId: string) => number | null;
  getAo12: (algSetId: string, caseId: string) => number | null;
  clearStats: (algSetId: string) => void;
}

/** 计算 trim mean（去掉最快和最慢各 1 个） */
function trimmedMean(times: number[]): number | null {
  if (times.length < 3) return null;
  const sorted = [...times].sort((a, b) => a - b);
  // 去掉首尾各一个
  const trimmed = sorted.slice(1, -1);
  return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
}

export const useStatsStore = create<StatsStore>()(
  persist(
    (set, get) => ({
      caseStats: {},

      recordTime: (algSetId, caseId, timeMs) => {
        const key = `${algSetId}:${caseId}`;
        const { caseStats } = get();
        const prev = caseStats[key] ?? { times: [], lastTime: 0, count: 0 };
        set({
          caseStats: {
            ...caseStats,
            [key]: {
              times: [...prev.times, timeMs],
              lastTime: timeMs,
              count: prev.count + 1,
            },
          },
        });
      },

      getStats: (algSetId, caseId) => {
        const key = `${algSetId}:${caseId}`;
        return get().caseStats[key];
      },

      // NOTE: Ao5 = 最近 5 次的 trimmed mean（去掉最快最慢各 1 次）
      getAo5: (algSetId, caseId) => {
        const key = `${algSetId}:${caseId}`;
        const stats = get().caseStats[key];
        if (!stats || stats.times.length < 5) return null;
        return trimmedMean(stats.times.slice(-5));
      },

      // NOTE: Ao12 = 最近 12 次的 trimmed mean
      getAo12: (algSetId, caseId) => {
        const key = `${algSetId}:${caseId}`;
        const stats = get().caseStats[key];
        if (!stats || stats.times.length < 12) return null;
        return trimmedMean(stats.times.slice(-12));
      },

      clearStats: (algSetId) => {
        const { caseStats } = get();
        const filtered: Record<string, CaseStats> = {};
        for (const [key, val] of Object.entries(caseStats)) {
          if (!key.startsWith(`${algSetId}:`)) {
            filtered[key] = val;
          }
        }
        set({ caseStats: filtered });
      },
    }),
    { name: 'trainer-stats' },
  ),
);
