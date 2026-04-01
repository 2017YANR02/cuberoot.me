/**
 * SessionStore — 从 pll_recognition_trainer/src/stores/SessionStore.js 原版移植
 *
 * 状态机：Paused → Playing → EvaluationDone
 * 支持双模式：识别训练（submitAnswer）+ 计时训练（空格启停）
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import pllMap from '@cuberoot/shared/data/pll.json';
import type { PllCaseInstance } from '../utils/scrambleGenerator';
import {
  allPllKeys,
  keysToCases,
  shuffle,
  resultsToEvalResults,
  evalResultsToNewQueue,
  DEFAULT_ALLOWED_CROSS_COLORS,
  randomCrossColor,
  type RecognitionResult,
} from '../utils/pllHelpers';

export type GameState = 'paused' | 'playing' | 'evaluationDone';
export type TrainMode = 'recognition' | 'timer';

interface SessionState {
  gameState: GameState;
  trainMode: TrainMode;

  // 待训练 case 队列
  queue: PllCaseInstance[];
  // 已完成的识别结果
  results: RecognitionResult[];
  // 当前 case 的错误答案（空 = 未答/正确）
  mistake: string;
  // 当前 case 的识别开始时间
  currentRecognitionStarted: string;

  // 允许的底面颜色
  allowedCrossColors: string[];

  // 计时模式的状态
  timerStartMs: number | null;
  timerElapsedMs: number;
}

interface SessionActions {
  // 识别模式 actions
  setInitial: () => void;
  pausePlay: () => void;
  resumePlay: () => void;
  submitAnswer: (answer: string, fullNameMode?: boolean) => 'correct' | 'wrong' | null;
  giveUpOnCase: () => void;
  restartEvaluation: () => void;
  startPersonalized: () => void;
  setAllowedCrossColors: (colors: string[]) => void;
  setTrainMode: (mode: TrainMode) => void;

  // 计时模式 actions
  startTimer: () => void;
  stopTimer: () => number;
  nextTimerCase: () => void;

  // 通用
  currentCase: () => PllCaseInstance | null;
  totalCases: () => number;
}

// NOTE: 初始一轮不包含 no-AUF 的 case（太简单），和原版行为一致
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
        // 清除 mistake 并 shift 队列（如有）
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
          // 答错了 → 推入历史，shift 队列
          set({
            mistake: '',
            queue: s.queue.slice(1),
            gameState: 'paused',
          });
        } else {
          // 看到但没答 → 洗牌（因为已看过当前 case）
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

      /**
       * 提交识别答案
       * @returns 'correct' | 'wrong' | null (忽略的输入返回 null)
       */
      submitAnswer: (answer: string, fullNameMode = false) => {
        const s = get();
        if (s.gameState !== 'playing' || s.queue.length === 0) return null;
        const current = s.queue[0];

        const isCorrect = fullNameMode
          ? current.name === answer
          : current.name[0] === answer;

        // 第一次回答（还没出错）→ 记录结果
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
          // 进入下一个 case
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
        // 清除 mistake 的重复 case
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

      // ---- 计时模式 ----
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
      // NOTE: 不持久化 timerStartMs（运行时状态）
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
