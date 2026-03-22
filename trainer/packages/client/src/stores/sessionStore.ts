import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AlgCase } from '@cuberoot/shared';

// NOTE: 训练状态机
// idle → caseShown → timerReady → timing → stopped → caseShown → ... → complete
type SessionState = 'idle' | 'caseShown' | 'timerReady' | 'timing' | 'stopped' | 'complete';

interface CaseResult {
  caseId: string;
  timeMs: number;
  timestamp: number;
}

interface SessionStore {
  // 状态
  state: SessionState;
  queue: AlgCase[];
  currentIndex: number;
  results: CaseResult[];
  startTime: number;

  // 动作
  startSession: (cases: AlgCase[]) => void;
  showCase: () => void;
  readyTimer: () => void;
  startTimer: () => void;
  stopTimer: () => void;
  nextCase: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionStore>()((set, get) => ({
  state: 'idle',
  queue: [],
  currentIndex: 0,
  results: [],
  startTime: 0,

  startSession: (cases) => {
    // 随机打乱队列
    const shuffled = [...cases].sort(() => Math.random() - 0.5);
    set({
      state: 'caseShown',
      queue: shuffled,
      currentIndex: 0,
      results: [],
      startTime: 0,
    });
  },

  showCase: () => set({ state: 'caseShown' }),

  readyTimer: () => set({ state: 'timerReady' }),

  startTimer: () => set({
    state: 'timing',
    startTime: performance.now(),
  }),

  stopTimer: () => {
    const { startTime, queue, currentIndex, results } = get();
    const timeMs = Math.round(performance.now() - startTime);
    const currentCase = queue[currentIndex];
    if (!currentCase) return;

    set({
      state: 'stopped',
      results: [...results, {
        caseId: currentCase.id,
        timeMs,
        timestamp: Date.now(),
      }],
    });
  },

  nextCase: () => {
    const { currentIndex, queue } = get();
    const nextIdx = currentIndex + 1;
    if (nextIdx >= queue.length) {
      set({ state: 'complete' });
    } else {
      set({ state: 'caseShown', currentIndex: nextIdx });
    }
  },

  resetSession: () => set({
    state: 'idle',
    queue: [],
    currentIndex: 0,
    results: [],
    startTime: 0,
  }),
}));
