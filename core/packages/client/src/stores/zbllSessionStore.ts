/**
 * ZBLL 计时训练会话 store
 * 5 状态计时器状态机 + 随机 case 选取 + recap 模式
 */
import { create } from 'zustand';
import { randomElement, makeScramble } from '../utils/zbllHelpers';

const STATS_KEY = 'zbll_stats_array';
const STORE_KEY = 'zbll_store';

// NOTE: 使用 const object 而非 enum，因为项目启用了 erasableSyntaxOnly
export const TimerState = {
  NOT_RUNNING: 0,
  AWAITING_READY: 1,
  READY: 2,
  RUNNING: 3,
  STOPPING: 4,
} as const;

export type TimerState = (typeof TimerState)[keyof typeof TimerState];

export interface ZbllResult {
  i: number;
  key: string;
  scramble: string;
  ms: number;
}

interface SessionData {
  keys: string[];
  recapMode: boolean;
  scrambleLength: number;
  keysCount: Record<string, number>;
  currentKey: string | null;
  currentScramble: string | null;
  stats: ZbllResult[];
}

const loadInitialData = (): SessionData => {
  try {
    const savedStats = JSON.parse(
      localStorage.getItem(STATS_KEY) || '[]'
    ) as ZbllResult[];
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
    scrambleLength: 0,
    keysCount: {},
    currentKey: null,
    currentScramble: null,
    stats: [],
  };
};

interface ZbllSessionState {
  data: SessionData;
  timerState: TimerState;
  timerStarted: number;
  observingResult: number;

  // 计算属性
  casesWithZeroCount: () => string[];

  // 操作
  setSelectedKeys: (keys: string[], scrambleLength: number) => void;
  setRandomCase: () => void;
  startRecap: () => void;
  clearSession: () => void;
  deleteResult: (index: number) => void;
  getTimerReady: (delayMs: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  setTimerState: (state: TimerState) => void;
  setObservingResult: (index: number) => void;
}

const persistData = (data: SessionData) => {
  const { stats, ...rest } = data;
  localStorage.setItem(STORE_KEY, JSON.stringify(rest));
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
};

export const useZbllSessionStore = create<ZbllSessionState>((set, get) => ({
  data: loadInitialData(),
  timerState: TimerState.NOT_RUNNING,
  timerStarted: 0,
  observingResult: 0,

  casesWithZeroCount: () => {
    const { keysCount } = get().data;
    return Object.keys(keysCount).filter((k) => keysCount[k] === 0);
  },

  setSelectedKeys: (keys: string[], scrambleLength: number) => {
    const keysCount: Record<string, number> = {};
    keys.forEach((k) => (keysCount[k] = 0));

    const newData: SessionData = {
      ...get().data,
      keys,
      scrambleLength,
      recapMode: false,
      keysCount,
    };

    // 设置随机 case
    if (keys.length > 0) {
      newData.currentKey = randomElement(keys);
      newData.currentScramble = makeScramble(
        newData.currentKey,
        scrambleLength
      );
    } else {
      newData.currentKey = null;
      newData.currentScramble = null;
    }

    persistData(newData);
    set({
      data: newData,
      timerState: TimerState.NOT_RUNNING,
    });
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
        // recap 完成，退出 recap 模式
        data.recapMode = false;
        data.currentKey = randomElement(data.keys);
      } else {
        data.currentKey = randomElement(zeros);
      }
    } else {
      // NOTE: 20% 概率选最少计次的 key，增加练习弱项的机会
      if (Math.random() < 0.2) {
        const minCount = Math.min(...Object.values(data.keysCount));
        const leastKeys = Object.keys(data.keysCount).filter(
          (k) => data.keysCount[k] === minCount
        );
        data.currentKey = randomElement(leastKeys);
      } else {
        data.currentKey = randomElement(data.keys);
      }
    }

    data.currentScramble = makeScramble(
      data.currentKey!,
      data.scrambleLength
    );
    persistData(data);
    set({ data });
  },

  startRecap: () => {
    const data = { ...get().data };
    const keysCount: Record<string, number> = {};
    data.keys.forEach((k) => (keysCount[k] = 0));
    data.keysCount = keysCount;
    data.recapMode = true;

    // 选一个随机 case
    if (data.keys.length > 0) {
      data.currentKey = randomElement(data.keys);
      data.currentScramble = makeScramble(
        data.currentKey,
        data.scrambleLength
      );
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
      });
    } else {
      set({ timerState: TimerState.STOPPING });
    }

    // 设置下一个随机 case
    // NOTE: 需要延迟调用以确保 state 已更新
    setTimeout(() => get().setRandomCase(), 0);
  },

  setTimerState: (state: TimerState) => set({ timerState: state }),
  setObservingResult: (index: number) => set({ observingResult: index }),
}));
