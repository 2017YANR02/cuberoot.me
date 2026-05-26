// Ported from packages/client/src/stores/sessionStore.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import pllMap from '@cuberoot/shared/data/pll.json';
import type { PllCaseInstance } from './scramble-generator';
import {
  allPllKeys,
  keysToCases,
  shuffle,
  resultsToEvalResults,
  evalResultsToNewQueue,
  DEFAULT_ALLOWED_CROSS_COLORS,
  randomCrossColor,
  type RecognitionResult,
} from './pll-helpers';

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
  submitAnswer: (answer: string, fullNameMode?: boolean) => 'correct' | 'wrong' | null;
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

const INCLUDE_NO_AUF_IN_INITIAL_QUEUE = false;

const generateEvaluationQueue = (allowedCrossColors: string[]): PllCaseInstance[] =>
  shuffle(keysToCases(allPllKeys(pllMap), allowedCrossColors, INCLUDE_NO_AUF_IN_INITIAL_QUEUE));

export const useSessionStore = create<SessionState & SessionActions>()(
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
            queue: generateEvaluationQueue(DEFAULT_ALLOWED_CROSS_COLORS),
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

      submitAnswer: (answer: string, fullNameMode = false) => {
        const s = get();
        if (s.gameState !== 'playing' || s.queue.length === 0) return null;
        const current = s.queue[0];

        const isCorrect = fullNameMode
          ? current.name === answer
          : current.name[0] === answer;

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
          queue: generateEvaluationQueue(get().allowedCrossColors),
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
            pllMap
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
      name: 'cuberoot-session-store',
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
