// Ported from packages/client-vite/src/stores/trainerStore.ts
'use client';

import { create } from 'zustand';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { generateScramble, type ScrambleKind } from './trainer-scramble';
import { caseKey, findCaseByKey } from './trainer-case-key';
import { histBack, histForward, histPush, type ScrambleHist } from './scramble-history';
import { caseOrbit } from './alg_probability';
import { petReact } from './deskpet';

export const TimerState = {
  NOT_RUNNING: 0,
  AWAITING_READY: 1,
  READY: 2,
  RUNNING: 3,
  STOPPING: 4,
} as const;
export type TimerState = (typeof TimerState)[keyof typeof TimerState];

export type TrainerPenalty = 'ok' | '+2' | 'DNF';
/** train = 随机抽取;recap = 打乱顺序后不重复逐个过一遍,过完重新洗牌。 */
export type TrainerMode = 'train' | 'recap';
/** uniform = 每个 case 1/N;real = 按数学真实概率(权重 = 轨道大小 16/cn)。 */
export type TrainerProbMode = 'uniform' | 'real';
/** 计时数字字体(lcd 与 /timer 同款七段)。 */
export type TrainerTimerFont = 'lcd' | 'mono' | 'liberation' | 'sans';

export interface TrainerSolve {
  i: number;
  caseKey: string;
  caseName: string;
  scramble: string;
  ms: number;
  penalty: TrainerPenalty;
}

/** 打乱历史里的一条(←/→ 回看):case 身份 + 当时出的那条打乱。 */
interface TrainerHistEntry {
  key: string;
  name: string;
  scramble: string;
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
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedSession;
      // Back-compat: older sessions predate per-solve penalties.
      parsed.solves = (parsed.solves ?? []).map(sv => ({ ...sv, penalty: sv.penalty ?? 'ok' }));
      return parsed;
    }
  } catch { /* ignore */ }
  return { selected: [], solves: [] };
};

const persist = (p: string, s: string, data: PersistedSession) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(sessionKey(p, s), JSON.stringify(data));
};

/** 跨 set 的训练偏好(pre/post-AUF / 计时 / 模式 / 概率 / 字体),全局一份。 */
interface TrainerPrefs {
  preAuf: boolean;
  /** 打乱收尾随机 AUF(历史默认行为,关掉 = 打乱原样呈现)。 */
  postAuf: boolean;
  timing: boolean;
  mode: TrainerMode;
  probMode: TrainerProbMode;
  timerFont: TrainerTimerFont;
  scrambleFont: TrainerTimerFont;
}
const DEFAULT_PREFS: TrainerPrefs = {
  preAuf: false, postAuf: true, timing: true, mode: 'train', probMode: 'uniform',
  timerFont: 'lcd', scrambleFont: 'sans',
};
const PREFS_KEY = 'trainer:prefs';

const loadPrefs = (): TrainerPrefs => {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<TrainerPrefs>) };
  } catch { /* ignore */ }
  return DEFAULT_PREFS;
};

const persistPrefs = (p: TrainerPrefs) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
};

/** 从整个 store state 里只摘偏好字段(直接 stringify 整个 state 会把 cases/solves 一起写进去)。 */
const prefsOf = (st: TrainerPrefs): TrainerPrefs => ({
  preAuf: st.preAuf, postAuf: st.postAuf, timing: st.timing, mode: st.mode,
  probMode: st.probMode, timerFont: st.timerFont, scrambleFont: st.scrambleFont,
});

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

interface TrainerState {
  puzzle: AlgPuzzle | null;
  set: string | null;
  cases: AlgCase[];
  selected: string[];
  /**
   * 训练范围(case key 列表)。从 subgroup 页的训练按钮进来时是该组的全部 key,
   * set 级进来是 null(不限)。实际出题池 = selected ∩ scope。
   */
  scope: string[] | null;
  solves: TrainerSolve[];
  currentKey: string | null;
  currentName: string | null;
  currentScramble: string | null;
  /** ←/→ 打乱历史(与 /timer 同一套环形队列,lib/scramble-history)。 */
  hist: ScrambleHist<TrainerHistEntry>;
  /** 出题用哪一种打乱。非 `inv` 的几套来自站长 1LLL 表的 meta,只有部分 set 有。 */
  scrambleKind: ScrambleKind;
  timerState: TimerState;
  timerStarted: number;
  observingIdx: number;

  // 训练偏好(localStorage `trainer:prefs`;SSR 渲染默认值,挂载后 hydratePrefs 补水)
  preAuf: boolean;
  postAuf: boolean;
  timing: boolean;
  mode: TrainerMode;
  probMode: TrainerProbMode;
  timerFont: TrainerTimerFont;
  scrambleFont: TrainerTimerFont;

  /** recap 模式的洗牌队列:pool 变了(recapSig 失配)重洗。 */
  recapQueue: string[];
  recapPos: number;
  recapSig: string;

  loadSession: (p: AlgPuzzle, s: string, cases: AlgCase[]) => void;
  setSelected: (keys: string[]) => void;
  setScope: (keys: string[] | null) => void;
  setScrambleKind: (k: ScrambleKind) => void;
  hydratePrefs: () => void;
  setPreAuf: (v: boolean) => void;
  setPostAuf: (v: boolean) => void;
  setTiming: (v: boolean) => void;
  setMode: (m: TrainerMode) => void;
  setProbMode: (m: TrainerProbMode) => void;
  setTimerFont: (f: TrainerTimerFont) => void;
  setScrambleFont: (f: TrainerTimerFont) => void;

  /** 下一个打乱:历史中段先前进,到队尾才出新题(train 随机 / recap 逐个)。 */
  nextScramble: () => void;
  /** 上一个打乱(可连按,直到最旧一条)。 */
  prevScramble: () => void;

  getTimerReady: (delayMs: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  setTimerState: (s: TimerState) => void;

  setObservingIdx: (i: number) => void;
  setSolvePenalty: (idx: number, penalty: TrainerPenalty) => void;
  deleteSolve: (idx: number) => void;
  clearSolves: () => void;
}

/** 实际出题池 = selected ∩ scope(scope 为 null 时不限)。 */
export const trainerPool = (selected: string[], scope: string[] | null): string[] => {
  if (!scope) return selected;
  const allow = new Set(scope);
  return selected.filter(k => allow.has(k));
};

const EMPTY_HIST: ScrambleHist<TrainerHistEntry> = { list: [], idx: -1 };

export const useTrainerStore = create<TrainerState>((set, get) => {
  /** 出一道新题并推进历史。pool 空时清空当前题。 */
  const pickFresh = () => {
    const st = get();
    const pool = trainerPool(st.selected, st.scope);
    if (pool.length === 0 || !st.puzzle) {
      set({ currentKey: null, currentName: null, currentScramble: null });
      return;
    }

    let key: string;
    let recapPatch: Partial<TrainerState> = {};
    if (st.mode === 'recap') {
      const sig = [...pool].sort().join('|');
      let { recapQueue, recapPos } = st;
      if (st.recapSig !== sig || recapPos >= recapQueue.length) {
        recapQueue = shuffle(pool);
        recapPos = 0;
      }
      key = recapQueue[recapPos];
      recapPatch = { recapQueue, recapPos: recapPos + 1, recapSig: sig };
    } else if (st.probMode === 'real') {
      // 真实概率:权重 = 轨道大小(16/cn)。无 meta 的 case 当权重 16(≈无对称)。
      const weights = pool.map(k => {
        const c = findCaseByKey(st.cases, k);
        return c ? (caseOrbit(c) ?? 16) : 16;
      });
      const totalW = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * totalW;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        r -= weights[idx];
        if (r < 0) break;
      }
      key = pool[idx];
    } else {
      key = pool[Math.floor(Math.random() * pool.length)];
    }

    const c = findCaseByKey(st.cases, key);
    if (!c) {
      set({ currentKey: null, currentName: null, currentScramble: null });
      return;
    }
    const scramble = generateScramble(c, st.puzzle, st.scrambleKind, { preAuf: st.preAuf, postAuf: st.postAuf });
    set({
      ...recapPatch,
      hist: histPush(st.hist, { key, name: c.name, scramble }),
      currentKey: key,
      currentName: c.name,
      currentScramble: scramble,
    });
  };

  /** 当前题的打乱重出一条(换打乱类型 / 切 pre-AUF 时),历史当前条同步替换。 */
  const regenCurrent = () => {
    const { currentKey, cases, puzzle, timerState, scrambleKind, preAuf, postAuf, hist } = get();
    if (!currentKey || !puzzle || timerState !== TimerState.NOT_RUNNING) return;
    const c = findCaseByKey(cases, currentKey);
    if (!c) return;
    const scramble = generateScramble(c, puzzle, scrambleKind, { preAuf, postAuf });
    const list = hist.list.map((e, i) => (i === hist.idx ? { ...e, scramble } : e));
    set({ currentScramble: scramble, hist: { list, idx: hist.idx } });
  };

  return {
    puzzle: null,
    set: null,
    cases: [],
    selected: [],
    scope: null,
    solves: [],
    currentKey: null,
    currentName: null,
    currentScramble: null,
    hist: EMPTY_HIST,
    scrambleKind: 'inv',
    timerState: TimerState.NOT_RUNNING,
    timerStarted: 0,
    observingIdx: 0,
    ...DEFAULT_PREFS,
    recapQueue: [],
    recapPos: 0,
    recapSig: '',

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
        hist: EMPTY_HIST,
        recapQueue: [],
        recapPos: 0,
        recapSig: '',
        timerState: TimerState.NOT_RUNNING,
        observingIdx: Math.max(0, persisted.solves.length - 1),
      });
      if (trainerPool(selected, get().scope).length > 0) {
        pickFresh();
      }
    },

    // 换打乱类型立刻重出当前这道题 —— 不然要等下一次出题才生效,
    // 用户会以为没起作用。计时中不换(会把手上正在做的题换掉)。
    setScrambleKind: (k) => {
      set({ scrambleKind: k });
      regenCurrent();
    },

    setSelected: (keys) => {
      const { puzzle, set: setSlug, solves } = get();
      if (!puzzle || !setSlug) return;
      persist(puzzle, setSlug, { selected: keys, solves });
      set({ selected: keys });
    },

    setScope: (keys) => {
      set({ scope: keys });
      // 当前题落在范围外(或还没有题)⟹ 清掉历史、立刻按新范围出一道
      const st = get();
      const pool = trainerPool(st.selected, st.scope);
      if (pool.length > 0 && (!st.currentKey || !pool.includes(st.currentKey))) {
        if (st.timerState === TimerState.NOT_RUNNING) {
          set({ hist: EMPTY_HIST });
          pickFresh();
        }
      }
    },

    hydratePrefs: () => set(loadPrefs()),
    setPreAuf: (v) => {
      set({ preAuf: v });
      persistPrefs(prefsOf(get()));
      regenCurrent(); // 立刻在当前题上生效,同 setScrambleKind
    },
    setPostAuf: (v) => {
      set({ postAuf: v });
      persistPrefs(prefsOf(get()));
      regenCurrent();
    },
    setTiming: (v) => {
      set({ timing: v });
      persistPrefs(prefsOf(get()));
    },
    setMode: (m) => {
      set({ mode: m, recapSig: '' }); // 清 sig ⟹ 下一题重洗队列
      persistPrefs(prefsOf(get()));
      // 切到 recap 立刻从头开始过一遍(空闲时)
      if (get().timerState === TimerState.NOT_RUNNING) pickFresh();
    },
    setProbMode: (m) => {
      set({ probMode: m });
      persistPrefs(prefsOf(get()));
    },
    setTimerFont: (f) => {
      set({ timerFont: f });
      persistPrefs(prefsOf(get()));
    },
    setScrambleFont: (f) => {
      set({ scrambleFont: f });
      persistPrefs(prefsOf(get()));
    },

    nextScramble: () => {
      const st = get();
      // 计时进行中 / 蓄力中不换题;STOPPING 放行(stopTimer 收尾就是在这个状态里出下一题)
      if (st.timerState !== TimerState.NOT_RUNNING && st.timerState !== TimerState.STOPPING) return;
      const fwd = histForward(st.hist);
      if (fwd) {
        const cur = fwd.list[fwd.idx];
        set({ hist: fwd, currentKey: cur.key, currentName: cur.name, currentScramble: cur.scramble });
        return;
      }
      pickFresh();
    },

    prevScramble: () => {
      const st = get();
      if (st.timerState !== TimerState.NOT_RUNNING && st.timerState !== TimerState.STOPPING) return;
      const back = histBack(st.hist);
      if (!back) return;
      const cur = back.list[back.idx];
      set({ hist: back, currentKey: cur.key, currentName: cur.name, currentScramble: cur.scramble });
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
        penalty: 'ok',
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
      setTimeout(() => get().nextScramble(), 0);
    },

    setTimerState: (s) => set({ timerState: s }),

    setObservingIdx: (i) => set({ observingIdx: i }),

    setSolvePenalty: (idx, penalty) => {
      const { puzzle, set: setSlug, solves, selected } = get();
      if (!puzzle || !setSlug) return;
      if (idx < 0 || idx >= solves.length) return;
      const newSolves = solves.map((s, j) => j === idx ? { ...s, penalty } : s);
      persist(puzzle, setSlug, { selected, solves: newSolves });
      set({ solves: newSolves });
    },

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
  };
});
