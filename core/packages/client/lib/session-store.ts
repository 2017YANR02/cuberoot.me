// Ported from packages/client-vite/src/stores/sessionStore.ts
'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PllCaseInstance } from './scramble-generator';
import { petReact } from './deskpet';
import {
  keysToCases,
  shuffle,
  resultsToEvalResults,
  evalResultsToNewQueue,
  DEFAULT_ALLOWED_CROSS_COLORS,
  randomCrossColor,
  type RecognitionResult,
} from './pll-helpers';
import { OLL_SET, PLL_SET, type RecognizeSet } from './recognize-sets';

export type GameState = 'paused' | 'playing' | 'evaluationDone';
export type TrainMode = 'recognition' | 'timer';

interface SessionState {
  gameState: GameState;
  trainMode: TrainMode;
  queue: PllCaseInstance[];
  results: RecognitionResult[];
  mistake: string;
  currentRecognitionStarted: string;
  allowedCrossColors: string[];
  timerStartMs: number | null;
  timerElapsedMs: number;
}

interface SessionActions {
  setInitial: () => void;
  pausePlay: () => void;
  resumePlay: () => void;
  /** `answer` 是 case 的 DB 名(`Aa` / `OLL 27`),按钮和键盘输入都归一到它。 */
  submitAnswer: (answer: string) => 'correct' | 'wrong' | null;
  giveUpOnCase: () => void;
  restartEvaluation: () => void;
  startPersonalized: () => void;
  setAllowedCrossColors: (colors: string[]) => void;
  setTrainMode: (mode: TrainMode) => void;

  startTimer: () => void;
  stopTimer: () => number;
  nextTimerCase: () => void;

  currentCase: () => PllCaseInstance | null;
  totalCases: () => number;
}

const generateEvaluationQueue = (
  recog: RecognizeSet, allowedCrossColors: string[],
): PllCaseInstance[] =>
  shuffle(keysToCases(
    recog.allKeys(), allowedCrossColors, recog.includeNoAuf, recog.turnOptions,
  ));

/**
 * 一个识别训练器 = 一个独立的持久化 store。PLL 和 OLL 各存各的 localStorage key,
 * 在两个页面之间来回切不会把对方的评估结果冲掉 —— 合成一个 store 再加个 `set` 字段的话,
 * 切页要么清空要么就得替旧数据写迁移,两条都不如各存各的干净。
 */
function createSessionStore(recog: RecognizeSet) {
  return create<SessionState & SessionActions>()(
  persist(
    (set, get) => ({
      gameState: 'paused',
      trainMode: 'recognition',
      queue: [],
      results: [],
      mistake: '',
      currentRecognitionStarted: new Date().toISOString(),
      allowedCrossColors: [...DEFAULT_ALLOWED_CROSS_COLORS],
      timerStartMs: null,
      timerElapsedMs: 0,

      currentCase: () => {
        const s = get();
        return s.gameState === 'playing' && s.queue.length > 0 ? s.queue[0] : null;
      },

      totalCases: () => {
        const s = get();
        return s.queue.length + s.results.length - (s.mistake === '' ? 0 : 1);
      },

      setInitial: () => {
        const s = get();
        if (s.mistake !== '') {
          set({
            mistake: '',
            queue: s.queue.slice(1),
          });
        }

        const updatedQueue = s.mistake !== '' ? s.queue.slice(1) : s.queue;
        if (updatedQueue.length === 0 && s.results.length === 0) {
          set({
            queue: generateEvaluationQueue(recog, DEFAULT_ALLOWED_CROSS_COLORS),
            gameState: 'paused',
          });
        } else {
          set({
            gameState: updatedQueue.length === 0 ? 'evaluationDone' : 'paused',
            queue: shuffle([...updatedQueue]),
          });
        }
      },

      pausePlay: () => {
        const s = get();
        if (s.gameState !== 'playing') return;
        if (s.mistake) {
          set({
            mistake: '',
            queue: s.queue.slice(1),
            gameState: 'paused',
          });
        } else {
          set({
            queue: shuffle([...s.queue]),
            gameState: 'paused',
          });
        }
      },

      resumePlay: () => {
        const s = get();
        if (s.gameState !== 'paused') return;
        set({
          gameState: 'playing',
          currentRecognitionStarted: new Date().toISOString(),
        });
      },

      submitAnswer: (answer: string) => {
        const s = get();
        if (s.gameState !== 'playing' || s.queue.length === 0) return null;
        const current = s.queue[0];

        const isCorrect = current.name === answer;

        if (!s.mistake) {
          const currentMistake = isCorrect ? '' : answer;
          const newResult: RecognitionResult = {
            pllCase: current,
            started: s.currentRecognitionStarted,
            finished: new Date().toISOString(),
            mistake: currentMistake,
          };
          set({
            results: [newResult, ...s.results],
            mistake: currentMistake,
          });
        }

        if (isCorrect) {
          const newQueue = s.queue.slice(1);
          set({
            mistake: '',
            queue: newQueue,
            gameState: newQueue.length === 0 ? 'evaluationDone' : 'playing',
            currentRecognitionStarted: new Date().toISOString(),
          });
        }

        petReact(isCorrect ? 'happy' : 'reactAnnoyed');
        return isCorrect ? 'correct' : 'wrong';
      },

      giveUpOnCase: () => {
        const s = get();
        if (s.gameState !== 'playing' || s.queue.length === 0) return;
        const current = s.queue[0];
        const newResult: RecognitionResult = {
          pllCase: current,
          started: s.currentRecognitionStarted,
          finished: new Date().toISOString(),
          mistake: '-',
        };
        set({
          results: [newResult, ...s.results],
          mistake: '-',
        });
      },

      restartEvaluation: () => {
        set({
          queue: generateEvaluationQueue(recog, get().allowedCrossColors),
          results: [],
          mistake: '',
          gameState: 'paused',
        });
      },

      startPersonalized: () => {
        const s = get();
        set({
          queue: evalResultsToNewQueue(
            resultsToEvalResults(s.results),
            s.allowedCrossColors,
            recog.allKeys(),
            recog.turnOptions,
          ),
          results: [],
          mistake: '',
          gameState: 'paused',
        });
      },

      setAllowedCrossColors: (colors: string[]) => {
        const s = get();
        if (s.mistake !== '') {
          set({
            mistake: '',
            queue: s.queue.slice(1),
          });
        }
        const currentColors = s.allowedCrossColors;
        if (
          currentColors.length === colors.length &&
          currentColors.every((v, i) => v === colors[i])
        ) {
          return;
        }
        const updatedQueue = s.mistake !== '' ? s.queue.slice(1) : s.queue;
        set({
          allowedCrossColors: colors,
          queue: updatedQueue.map((c) => ({ ...c, crossColor: randomCrossColor(colors) })),
        });
      },

      setTrainMode: (mode: TrainMode) => {
        set({ trainMode: mode });
      },

      startTimer: () => {
        set({
          timerStartMs: performance.now(),
          timerElapsedMs: 0,
        });
      },

      stopTimer: () => {
        const s = get();
        if (s.timerStartMs === null) return 0;
        const elapsed = performance.now() - s.timerStartMs;
        set({ timerStartMs: null, timerElapsedMs: elapsed });
        return elapsed;
      },

      nextTimerCase: () => {
        const s = get();
        if (s.queue.length <= 1) {
          set({
            gameState: 'evaluationDone',
            queue: [],
            timerStartMs: null,
          });
        } else {
          set({
            queue: s.queue.slice(1),
            currentRecognitionStarted: new Date().toISOString(),
            timerStartMs: null,
            timerElapsedMs: 0,
          });
        }
      },
    }),
    {
      name: recog.storageKey,
      // Skip auto-hydration so SSR and first client render both see defaults
      // (no React hydration mismatch). Components call useSessionHydrated()
      // and gate render on it; the hook rehydrates from localStorage in effect.
      skipHydration: true,
      partialize: (state) => ({
        gameState: state.gameState,
        trainMode: state.trainMode,
        queue: state.queue,
        results: state.results,
        mistake: state.mistake,
        currentRecognitionStarted: state.currentRecognitionStarted,
        allowedCrossColors: state.allowedCrossColors,
      }),
    }
  )
  );
}

export type SessionStore = ReturnType<typeof createSessionStore>;

export const useSessionStore = createSessionStore(PLL_SET);
export const useOllSessionStore = createSessionStore(OLL_SET);

const STORE_BY_SET: Record<string, SessionStore> = {
  pll: useSessionStore,
  oll: useOllSessionStore,
};

/** 路由段 → 该集合的 store。不认识的段落回 PLL,和 {@link recognizeSetFor} 一致。 */
export function sessionStoreFor(setId: string): SessionStore {
  return STORE_BY_SET[setId] ?? useSessionStore;
}

export function useSessionHydrated(store: SessionStore = useSessionStore): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(false);
    store.persist.rehydrate();
    setHydrated(true);
  }, [store]);
  return hydrated;
}
