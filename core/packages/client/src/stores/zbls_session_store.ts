/**
 * ZBLS 计时训练会话 store
 * 5 状态计时器 + recap 模式 + again 功能
 *
 * 计时器状态: NOT_RUNNING → AWAITING_READY → READY → RUNNING → STOPPING → NOT_RUNNING
 * Again: recap 模式下停止后可将上一个 case 重新加入待 recap 队列
 */
import { create } from 'zustand';
import { randomElement, makeZblsScramble } from '../utils/zbls_helpers';

const STATS_KEY = 'zbls_stats_array';
const STORE_KEY = 'zbls_store';

// NOTE: 使用 const object 而非 enum（项目启用了 erasableSyntaxOnly）
export const TimerState = {
  NOT_RUNNING: 0,
  AWAITING_READY: 1,
  READY: 2,
  RUNNING: 3,
  STOPPING: 4,
} as const;

export type TimerState = (typeof TimerState)[keyof typeof TimerState];

export interface ZblsResult {
  i: number;       // 结果索引
  key: string;     // case key（如 "1-3"）
  scramble: string; // 使用的打乱
  ms: number;       // 用时（毫秒）
}

interface SessionData {
  keys: string[];
  recapMode: boolean;
  keysCount: Record<string, number>; // 每个 case 的练习次数
  currentKey: string | null;
  currentScramble: string | null;
  stats: ZblsResult[];
}

const loadInitialData = (): SessionData => {
  try {
    const savedStats = JSON.parse(
      localStorage.getItem(STATS_KEY) || '[]'
    ) as ZblsResult[];
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved) {
      saved.stats = savedStats;
      return saved;
    }
  } catch {
    /* 忽略解析错误 */
  }
  return {
    keys: [],
    recapMode: false,
    keysCount: {},
    currentKey: null,
    currentScramble: null,
    stats: [],
  };
};

const persistData = (data: SessionData) => {
  const { stats, ...rest } = data;
  localStorage.setItem(STORE_KEY, JSON.stringify(rest));
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
};

interface ZblsSessionState {
  data: SessionData;
  timerState: TimerState;
  timerStarted: number;
  observingResult: number;
  // NOTE: recap 模式下 Again 功能需要记住上一个 case key
  lastCaseKey: string | null;
  againUsed: boolean; // 同一结果只能 again 一次

  // 计算属性
  casesWithZeroCount: () => string[];

  // 操作
  setSelectedKeys: (keys: string[]) => void;
  setRandomCase: () => void;
  startRecap: () => void;
  clearSession: () => void;
  deleteResult: (index: number) => void;
  getTimerReady: (delayMs: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  setTimerState: (state: TimerState) => void;
  setObservingResult: (index: number) => void;
  recapCaseAgain: () => void;
}

export const useZblsSessionStore = create<ZblsSessionState>((set, get) => ({
  data: loadInitialData(),
  timerState: TimerState.NOT_RUNNING,
  timerStarted: 0,
  observingResult: 0,
  lastCaseKey: null,
  againUsed: false,

  casesWithZeroCount: () => {
    const { keysCount } = get().data;
    return Object.keys(keysCount).filter((k) => keysCount[k] === 0);
  },

  setSelectedKeys: (keys: string[]) => {
    const keysCount: Record<string, number> = {};
    keys.forEach((k) => (keysCount[k] = 0));

    const newData: SessionData = {
      ...get().data,
      keys,
      recapMode: false,
      keysCount,
    };

    if (keys.length > 0) {
      newData.currentKey = randomElement(keys);
      newData.currentScramble = makeZblsScramble(newData.currentKey);
    } else {
      newData.currentKey = null;
      newData.currentScramble = null;
    }

    persistData(newData);
    set({ data: newData, timerState: TimerState.NOT_RUNNING });
  },

  setRandomCase: () => {
    const data = { ...get().data };
    if (data.keys.length === 0) {
      data.currentKey = null;
      data.currentScramble = null;
      persistData(data);
      set({ data });
      return;
    }

    if (data.recapMode) {
      const zeros = Object.keys(data.keysCount).filter(
        (k) => data.keysCount[k] === 0
      );
      if (zeros.length === 0) {
        // recap 完成，重置计数
        data.keys.forEach((k) => (data.keysCount[k] = 0));
        data.currentKey = randomElement(data.keys);
      } else {
        data.currentKey = randomElement(zeros);
      }
    } else {
      data.currentKey = randomElement(data.keys);
    }

    data.currentScramble = makeZblsScramble(data.currentKey!);
    persistData(data);
    set({ data });
  },

  startRecap: () => {
    const data = { ...get().data };
    const keysCount: Record<string, number> = {};
    data.keys.forEach((k) => (keysCount[k] = 0));
    data.keysCount = keysCount;
    data.recapMode = true;

    if (data.keys.length > 0) {
      data.currentKey = randomElement(data.keys);
      data.currentScramble = makeZblsScramble(data.currentKey);
    }

    persistData(data);
    set({ data });
  },

  clearSession: () => {
    const data = { ...get().data, stats: [] };
    persistData(data);
    set({ data, observingResult: 0 });
  },

  deleteResult: (index: number) => {
    const data = { ...get().data };
    const key = data.stats[index]?.key;
    if (key && data.keysCount[key] > 0) {
      data.keysCount[key]--;
    }
    data.stats = [...data.stats];
    data.stats.splice(index, 1);
    // 重建索引
    for (let j = Math.max(index - 1, 0); j < data.stats.length; j++) {
      data.stats[j].i = j;
    }
    persistData(data);
    set({
      data,
      observingResult: Math.max(0, data.stats.length - 1),
    });
  },

  getTimerReady: (delayMs: number) => {
    if (get().timerState !== TimerState.NOT_RUNNING) return;
    if (delayMs > 0) {
      set({ timerState: TimerState.AWAITING_READY });
      setTimeout(() => {
        if (get().timerState === TimerState.AWAITING_READY) {
          set({ timerState: TimerState.READY });
        }
      }, delayMs);
    } else {
      set({ timerState: TimerState.READY });
    }
  },

  startTimer: () => {
    set({ timerStarted: Date.now(), timerState: TimerState.RUNNING });
  },

  stopTimer: () => {
    const { data, timerStarted } = get();
    const index = data.stats.length;
    if (data.currentKey !== null) {
      const newStats = [
        ...data.stats,
        {
          i: index,
          key: data.currentKey,
          scramble: data.currentScramble || '',
          ms: Date.now() - timerStarted,
        },
      ];
      const newKeysCount = { ...data.keysCount };
      newKeysCount[data.currentKey] =
        (newKeysCount[data.currentKey] || 0) + 1;

      const newData = {
        ...data,
        stats: newStats,
        keysCount: newKeysCount,
      };
      persistData(newData);
      set({
        data: newData,
        timerState: TimerState.STOPPING,
        observingResult: index,
        lastCaseKey: data.currentKey,
        againUsed: false,
      });
    } else {
      set({ timerState: TimerState.STOPPING });
    }

    // 设置下一个随机 case
    setTimeout(() => get().setRandomCase(), 0);
  },

  setTimerState: (state: TimerState) => set({ timerState: state }),
  setObservingResult: (index: number) => set({ observingResult: index }),

  /**
   * Recap Again — 将上一个 case 重新加入待 recap 队列
   * 完整复刻上游 recapCaseAgain() 逻辑
   */
  recapCaseAgain: () => {
    const { data, lastCaseKey, againUsed } = get();
    if (!data.recapMode || !lastCaseKey || againUsed) return;

    // 将该 case 的计数重置为 0，使其重新出现在 recap 队列
    const newKeysCount = { ...data.keysCount };
    newKeysCount[lastCaseKey] = 0;
    const newData = { ...data, keysCount: newKeysCount };
    persistData(newData);
    set({ data: newData, againUsed: true });
  },
}));
