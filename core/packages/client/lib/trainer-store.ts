// Ported from packages/client/src/stores/trainerStore.ts
'use client';

import { create } from 'zustand';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { generateScramble } from './trainer-scramble';
import { caseKey, findCaseByKey } from './trainer-case-key';
import { petReact } from './deskpet';

export const TimerState = {
  NOT_RUNNING: 0,
  AWAITING_READY: 1,
  READY: 2,
  RUNNING: 3,
  STOPPING: 4,
} as const;
export type TimerState = (typeof TimerState)[keyof typeof TimerState];

export interface TrainerSolve {
  i: number;
  caseKey: string;
  caseName: string;
  scramble: string;
  ms: number;
}

interface PersistedSession {
  selected: string[];
  solves: TrainerSolve[];
}

const sessionKey = (p: string, s: string) => `trainer:${p}/${s}`;

const loadPersisted = (p: string, s: string): PersistedSession => {
  if (typeof window === 'undefined') return { selected: [], solves: [] };
  try {
    const raw = localStorage.getItem(sessionKey(p, s));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { selected: [], solves: [] };
};

const persist = (p: string, s: string, data: PersistedSession) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(sessionKey(p, s), JSON.stringify(data));
};

interface TrainerState {
  puzzle: AlgPuzzle | null;
  set: string | null;
  cases: AlgCase[];
  selected: string[];
  solves: TrainerSolve[];
  currentKey: string | null;
  currentName: string | null;
  currentScramble: string | null;
  timerState: TimerState;
  timerStarted: number;
  observingIdx: number;

  loadSession: (p: AlgPuzzle, s: string, cases: AlgCase[]) => void;
  setSelected: (keys: string[]) => void;
  pickRandomCase: () => void;

  getTimerReady: (delayMs: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  setTimerState: (s: TimerState) => void;

  setObservingIdx: (i: number) => void;
  deleteSolve: (idx: number) => void;
  clearSolves: () => void;
}

export const useTrainerStore = create<TrainerState>((set, get) => ({
  puzzle: null,
  set: null,
  cases: [],
  selected: [],
  solves: [],
  currentKey: null,
  currentName: null,
  currentScramble: null,
  timerState: TimerState.NOT_RUNNING,
  timerStarted: 0,
  observingIdx: 0,

  loadSession: (puzzle, setSlug, cases) => {
    const persisted = loadPersisted(puzzle, setSlug);
    const valid = new Set(cases.map(caseKey));
    const selected = persisted.selected.filter(k => valid.has(k));
    set({
      puzzle,
      set: setSlug,
      cases,
      selected,
      solves: persisted.solves,
      currentKey: null,
      currentName: null,
      currentScramble: null,
      timerState: TimerState.NOT_RUNNING,
      observingIdx: Math.max(0, persisted.solves.length - 1),
    });
    if (selected.length > 0) {
      get().pickRandomCase();
    }
  },

  setSelected: (keys) => {
    const { puzzle, set: setSlug, solves } = get();
    if (!puzzle || !setSlug) return;
    persist(puzzle, setSlug, { selected: keys, solves });
    set({ selected: keys });
  },

  pickRandomCase: () => {
    const { selected, cases, puzzle } = get();
    if (selected.length === 0 || !puzzle) {
      set({ currentKey: null, currentName: null, currentScramble: null });
      return;
    }
    const key = selected[Math.floor(Math.random() * selected.length)];
    const c = findCaseByKey(cases, key);
    if (!c) {
      set({ currentKey: null, currentName: null, currentScramble: null });
      return;
    }
    set({
      currentKey: key,
      currentName: c.name,
      currentScramble: generateScramble(c, puzzle),
    });
  },

  getTimerReady: (delayMs) => {
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
    const { puzzle, set: setSlug, solves, currentKey, currentName, currentScramble, timerStarted } = get();
    if (!puzzle || !setSlug) return;
    const ms = Date.now() - timerStarted;
    if (currentKey === null || currentName === null) {
      set({ timerState: TimerState.STOPPING });
      return;
    }
    const newSolve: TrainerSolve = {
      i: solves.length,
      caseKey: currentKey,
      caseName: currentName,
      scramble: currentScramble || '',
      ms,
    };
    const newSolves = [...solves, newSolve];
    persist(puzzle, setSlug, { selected: get().selected, solves: newSolves });
    set({
      solves: newSolves,
      timerState: TimerState.STOPPING,
      observingIdx: newSolves.length - 1,
    });
    // Celebrate a new fastest single across the session.
    if (solves.length > 0 && ms < Math.min(...solves.map(s => s.ms))) petReact('happy');
    setTimeout(() => get().pickRandomCase(), 0);
  },

  setTimerState: (s) => set({ timerState: s }),

  setObservingIdx: (i) => set({ observingIdx: i }),

  deleteSolve: (idx) => {
    const { puzzle, set: setSlug, solves, selected } = get();
    if (!puzzle || !setSlug) return;
    const newSolves = solves.filter((_, j) => j !== idx)
      .map((s, j) => ({ ...s, i: j }));
    persist(puzzle, setSlug, { selected, solves: newSolves });
    set({
      solves: newSolves,
      observingIdx: Math.max(0, newSolves.length - 1),
    });
  },

  clearSolves: () => {
    const { puzzle, set: setSlug, selected } = get();
    if (!puzzle || !setSlug) return;
    persist(puzzle, setSlug, { selected, solves: [] });
    set({ solves: [], observingIdx: 0 });
  },
}));
