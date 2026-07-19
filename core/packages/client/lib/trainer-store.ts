// Ported from packages/client-vite/src/stores/trainerStore.ts
'use client';

import { create } from 'zustand';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { generateScramble, cstimerStyleScramble, type ScrambleKind } from './trainer-scramble';
import { caseKey, findCaseByKey } from './trainer-case-key';
import { histBack, histForward, histPush, type ScrambleHist } from './scramble-history';
import { caseOrbit } from './alg_probability';
import { petReact } from './deskpet';
import { persistItem } from './safe-storage';

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
/** recap 过一遍的顺序:shuffle = 洗牌(历史默认),seq = 按 set 里的 case 顺序。 */
export type TrainerRecapOrder = 'shuffle' | 'seq';
/** 计时数字字体(lcd 与 /timer 同款七段)。 */
export type TrainerTimerFont = 'lcd' | 'mono' | 'liberation' | 'sans';

/**
 * 协同刷题(零后端分片):一个选手旁边多台设备各开一个账号帮忙打乱时,把复习队列
 * 按 `i % n === k` 切成 n 份,本机只出第 k 份(0 起),合起来正好覆盖全集不重不漏。
 * `code` 仅乱序模式用作确定性洗牌种子 —— 各设备同码 → 同一条全序 → 分片对齐;
 * 顺序模式(按 set 原序)本身确定,不需要 code。off = 单机整集。
 */
export interface TrainerCoop {
  on: boolean;
  code: string;
  /** 共几台(≥2 才生效)。 */
  n: number;
  /** 本机第几台,0 起(< n)。 */
  k: number;
}
const DEFAULT_COOP: TrainerCoop = { on: false, code: '', n: 2, k: 0 };
/** 分片生效条件:开了且至少 2 台。 */
export const coopActive = (c: TrainerCoop): boolean => c.on && c.n >= 2;
/** 本机分片号(钳到 [0, n)),用于 `i % n === kk` 过滤。 */
export const coopShard = (c: TrainerCoop): number => ((c.k % c.n) + c.n) % c.n;

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
  /** recap 模式下该条在本轮的位置(1 起)/ 本轮总数 —— 进度条随「当前题」而非预抽的
   *  下一题走(有 lookahead 后 store 的 recapPos 已领先当前题一格)。 */
  recap?: { pos: number; total: number };
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

// persistItem:localStorage 满(timer 备份塞爆配额)时驱逐可再生缓存重试,
// 仍失败也不抛 —— 落盘失败绝不能把调用方的 set() 状态更新一起炸掉。
const persist = (p: string, s: string, data: PersistedSession) => {
  if (typeof window === 'undefined') return;
  persistItem(sessionKey(p, s), JSON.stringify(data));
};

/** 跨 set 的训练偏好(pre/post-AUF / 计时 / 模式 / 概率 / 字体),全局一份。 */
interface TrainerPrefs {
  preAuf: boolean;
  /** 打乱收尾随机 AUF(历史默认行为,关掉 = 打乱原样呈现)。 */
  postAuf: boolean;
  timing: boolean;
  mode: TrainerMode;
  probMode: TrainerProbMode;
  recapOrder: TrainerRecapOrder;
  timerFont: TrainerTimerFont;
  scrambleFont: TrainerTimerFont;
  /** 极简开关:侧栏「上一个 / 下一个」卡片、统计卡片,可各自隐藏。 */
  showPrevCard: boolean;
  showNextCard: boolean;
  showStats: boolean;
  /** 左栏计时数字下方的当前 case 图,可隐藏。 */
  showStageThumb: boolean;
  /** 复习模式多设备协同分片配置(记住搭档 = 存进 prefs 下次自动恢复)。 */
  coop: TrainerCoop;
}
const DEFAULT_PREFS: TrainerPrefs = {
  preAuf: true, postAuf: true, timing: true, mode: 'train', probMode: 'uniform',
  recapOrder: 'shuffle', timerFont: 'lcd', scrambleFont: 'sans',
  showPrevCard: true, showNextCard: true, showStats: true, showStageThumb: true,
  coop: DEFAULT_COOP,
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
  persistItem(PREFS_KEY, JSON.stringify(p));
};

/** 从整个 store state 里只摘偏好字段(直接 stringify 整个 state 会把 cases/solves 一起写进去)。 */
const prefsOf = (st: TrainerPrefs): TrainerPrefs => ({
  preAuf: st.preAuf, postAuf: st.postAuf, timing: st.timing, mode: st.mode,
  probMode: st.probMode, recapOrder: st.recapOrder,
  timerFont: st.timerFont, scrambleFont: st.scrambleFont,
  showPrevCard: st.showPrevCard, showNextCard: st.showNextCard, showStats: st.showStats,
  showStageThumb: st.showStageThumb, coop: st.coop,
});

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** 字符串 → 32 位种子(FNV-1a),空串也有确定值。 */
const seedFromString = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** mulberry32:确定性 PRNG。 */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** 确定性洗牌(同 seed 同序):协同乱序模式各设备必须切在同一条全序上。 */
const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const a = [...arr];
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
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
  /**
   * 预抽的「下一题」(lookahead):侧栏「下一个」卡片显示它,出下一题时把它扶正为 current
   * 再预抽一条 —— 预览的打乱与将来实际要做的完全一致(train 随机也不会重roll)。
   * pool 空 / 历史中段(← 回看过)时为 null,此时「下一题」= 历史里 idx+1 那条。
   */
  peek: TrainerHistEntry | null;
  /**
   * 再下一题(二级 lookahead):出下一题时它递补为 peek。UI 据此把「下一个」卡片将要显示的
   * 图提前一格离屏预取 —— 换题时右卡也秒出图,与左栏(靠预取 peek)同速,不再等网络往返。
   */
  peek2: TrainerHistEntry | null;
  /** ←/→ 打乱历史(与 /timer 同一套环形队列,lib/scramble-history)。 */
  hist: ScrambleHist<TrainerHistEntry>;
  /** 出题用哪一种打乱。非 `inv` 的几套来自站长 1LLL 表的 meta,只有部分 set 有。 */
  scrambleKind: ScrambleKind;
  timerState: TimerState;
  timerStarted: number;
  observingIdx: number;
  /**
   * 用户在统计里点选了某条成绩 —— 不计时模式下侧栏卡片也切到该成绩
   * (计时模式本来就跟随 observingIdx);出下一题 / 翻历史时自动解除,回到当前题。
   */
  observingPinned: boolean;

  // 训练偏好(localStorage `trainer:prefs`;SSR 渲染默认值,挂载后 hydratePrefs 补水)
  preAuf: boolean;
  postAuf: boolean;
  timing: boolean;
  mode: TrainerMode;
  probMode: TrainerProbMode;
  recapOrder: TrainerRecapOrder;
  timerFont: TrainerTimerFont;
  scrambleFont: TrainerTimerFont;
  showPrevCard: boolean;
  showNextCard: boolean;
  showStats: boolean;
  showStageThumb: boolean;
  coop: TrainerCoop;

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
  setRecapOrder: (o: TrainerRecapOrder) => void;
  setTimerFont: (f: TrainerTimerFont) => void;
  setScrambleFont: (f: TrainerTimerFont) => void;
  setShowPrevCard: (v: boolean) => void;
  setShowNextCard: (v: boolean) => void;
  setShowStats: (v: boolean) => void;
  setShowStageThumb: (v: boolean) => void;
  setCoop: (c: TrainerCoop) => void;

  /** 下一个打乱:历史中段先前进,到队尾才出新题(train 随机 / recap 逐个)。 */
  nextScramble: () => void;
  /** 上一个打乱(可连按,直到最旧一条)。 */
  prevScramble: () => void;

  getTimerReady: (delayMs: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  setTimerState: (s: TimerState) => void;

  setObservingIdx: (i: number) => void;
  /** 统计里点选成绩:设 observingIdx 并钉住(不计时模式卡片也跟随)。 */
  pinObserving: (i: number) => void;
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
  /**
   * cstimer 风格打乱是异步求解:同步先展示逆 case 占位,解出来后若还停在
   * 同一道题(且没在计时)原地替换。token 防串:后发的题作废先前的解。
   */
  let cstimerToken = 0;
  const cstimerize = () => {
    const st = get();
    if (st.scrambleKind !== 'cstimer' || st.puzzle !== '3x3') return;
    const placeholder = st.currentScramble;
    const forKey = st.currentKey;
    if (!placeholder || !forKey) return;
    const token = ++cstimerToken;
    cstimerStyleScramble(placeholder).then(scr => {
      if (!scr || token !== cstimerToken) return;
      const cur = get();
      // 已换题 / 打乱已被重出 → 这条解作废;计时准备/进行中不换题面
      if (cur.currentKey !== forKey || cur.currentScramble !== placeholder) return;
      if (cur.timerState !== TimerState.NOT_RUNNING && cur.timerState !== TimerState.STOPPING) return;
      const list = cur.hist.list.map((e, i) => (i === cur.hist.idx ? { ...e, scramble: scr } : e));
      set({ currentScramble: scr, hist: { list, idx: cur.hist.idx } });
    }).catch(() => { /* 保留占位打乱 */ });
  };

  /**
   * 纯抽题:按当前模式选一个 case、生成打乱,返回条目 + 推进后的 recap 队列状态。
   * 不落 current —— 供 current 与 peek(下一题预览)在一次操作里连抽两次复用。
   * pool 空 / 找不到 case 时返 null。
   */
  const draw = (
    st: TrainerState,
  ): { entry: TrainerHistEntry; recapQueue: string[]; recapPos: number; recapSig: string } | null => {
    const pool = trainerPool(st.selected, st.scope);
    if (pool.length === 0 || !st.puzzle) return null;

    let key: string;
    let recapQueue = st.recapQueue;
    let recapPos = st.recapPos;
    let recapSig = st.recapSig;
    let entryRecap: { pos: number; total: number } | undefined;

    if (st.mode === 'recap') {
      const coop = st.coop;
      const active = coopActive(coop);
      // sig 纳入协同配置:改「共几台/第几台/码/开关」都要重建队列(重新分片)
      const sig = [...pool].sort().join('|') + (active ? `#${coop.code}/${coop.n}/${coop.k}` : '');
      let q = st.recapQueue;
      let pos = st.recapPos;
      if (st.recapSig !== sig || pos >= q.length) {
        let full: string[];
        if (st.recapOrder === 'seq') {
          // 顺序:按 set 里 case 的原始顺序过一遍(本身确定,协同无需 code)
          const inPool = new Set(pool);
          full = st.cases.map(caseKey).filter(k => inPool.has(k));
        } else if (active) {
          // 协同乱序:用协同码做确定性洗牌,各设备同码 → 同一条全序 → 分片对齐
          full = seededShuffle(pool, seedFromString(coop.code));
        } else {
          full = shuffle(pool);
        }
        // 协同:在同一条全序上按 i % n === kk 切到本机那一份(顺序/乱序同理,不重不漏)
        if (active) {
          const kk = coopShard(coop);
          full = full.filter((_, i) => i % coop.n === kk);
        }
        q = full;
        pos = 0;
      }
      key = q[pos];
      entryRecap = { pos: pos + 1, total: q.length };
      recapQueue = q;
      recapPos = pos + 1;
      recapSig = sig;
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
    if (!c) return null;
    const scramble = generateScramble(c, st.puzzle, st.scrambleKind, { preAuf: st.preAuf, postAuf: st.postAuf });
    return { entry: { key, name: c.name, scramble, recap: entryRecap }, recapQueue, recapPos, recapSig };
  };

  /** 出一道新题(current)并预抽下一题(peek)、再下一题(peek2)、推进历史。pool 空时清空。 */
  const pickFresh = () => {
    const st = get();
    const a = draw(st);
    if (!a) {
      set({ currentKey: null, currentName: null, currentScramble: null, peek: null, peek2: null });
      return;
    }
    // 依次从上一抽推进后的 recap 状态继续抽(三次抽题共享同一队列推进,不重复过同一格)
    const b = draw({ ...st, recapQueue: a.recapQueue, recapPos: a.recapPos, recapSig: a.recapSig });
    const c = b ? draw({ ...st, recapQueue: b.recapQueue, recapPos: b.recapPos, recapSig: b.recapSig }) : null;
    const rec = c ?? b ?? a;
    set({
      recapQueue: rec.recapQueue,
      recapPos: rec.recapPos,
      recapSig: rec.recapSig,
      hist: histPush(st.hist, a.entry),
      currentKey: a.entry.key,
      currentName: a.entry.name,
      currentScramble: a.entry.scramble,
      peek: b ? b.entry : null,
      peek2: c ? c.entry : null,
      observingPinned: false,
    });
    cstimerize();
  };

  /** 当前题的打乱重出一条(换打乱类型 / 切 pre-AUF 时),历史当前条 + 预览的下两题同步替换。 */
  const regenCurrent = () => {
    const { currentKey, cases, puzzle, timerState, scrambleKind, preAuf, postAuf, hist, peek, peek2 } = get();
    if (!currentKey || !puzzle || timerState !== TimerState.NOT_RUNNING) return;
    const c = findCaseByKey(cases, currentKey);
    if (!c) return;
    const scramble = generateScramble(c, puzzle, scrambleKind, { preAuf, postAuf });
    const list = hist.list.map((e, i) => (i === hist.idx ? { ...e, scramble } : e));
    // 预览的下两题也用新打乱类型重出,保证预览 == 将来实际要做的
    const regenPeek = (pk: TrainerHistEntry | null): TrainerHistEntry | null => {
      if (!pk) return pk;
      const pc = findCaseByKey(cases, pk.key);
      return pc ? { ...pk, scramble: generateScramble(pc, puzzle, scrambleKind, { preAuf, postAuf }) } : pk;
    };
    set({ currentScramble: scramble, hist: { list, idx: hist.idx }, peek: regenPeek(peek), peek2: regenPeek(peek2) });
    cstimerize();
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
    peek: null,
    peek2: null,
    hist: EMPTY_HIST,
    // 默认 H*(最优 HTM 打乱);case/set 没有这列时组件的回退 effect 会落回 `inv`
    scrambleKind: 'htm',
    timerState: TimerState.NOT_RUNNING,
    timerStarted: 0,
    observingIdx: 0,
    observingPinned: false,
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
        peek: null,
        peek2: null,
        hist: EMPTY_HIST,
        recapQueue: [],
        recapPos: 0,
        recapSig: '',
        timerState: TimerState.NOT_RUNNING,
        observingIdx: Math.max(0, persisted.solves.length - 1),
        observingPinned: false,
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
    setRecapOrder: (o) => {
      set({ recapOrder: o, recapSig: '' }); // 清 sig ⟹ 下一题按新顺序重排队列
      persistPrefs(prefsOf(get()));
      if (get().mode === 'recap' && get().timerState === TimerState.NOT_RUNNING) pickFresh();
    },
    setCoop: (c) => {
      // k 越界钳回 [0, n)(改 n 时上层已收敛,这里兜底防持久化里的脏值)
      const n = Math.max(2, Math.floor(c.n) || 2);
      const coop: TrainerCoop = { on: c.on, code: c.code, n, k: Math.min(Math.max(0, Math.floor(c.k) || 0), n - 1) };
      set({ coop, recapSig: '' }); // 清 sig ⟹ 下一题按新分片重建队列
      persistPrefs(prefsOf(get()));
      if (get().mode === 'recap' && get().timerState === TimerState.NOT_RUNNING) pickFresh();
    },
    setShowPrevCard: (v) => {
      set({ showPrevCard: v });
      persistPrefs(prefsOf(get()));
    },
    setShowNextCard: (v) => {
      set({ showNextCard: v });
      persistPrefs(prefsOf(get()));
    },
    setShowStats: (v) => {
      set({ showStats: v });
      persistPrefs(prefsOf(get()));
    },
    setShowStageThumb: (v) => {
      set({ showStageThumb: v });
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
        // 历史中段(← 回看过)向前翻:current 前进一格,peek 不动(它仍是队尾之后的预览)
        const cur = fwd.list[fwd.idx];
        set({ hist: fwd, currentKey: cur.key, currentName: cur.name, currentScramble: cur.scramble, observingPinned: false });
        cstimerize();
        return;
      }
      // 已在队尾:把预抽的下一题(peek)扶正为当前题,peek2 递补为新 peek,再预抽新的 peek2。
      // 这样「你先前看到的下一题」就是「现在要做的这一题」,预览稳定不重roll;右卡预览也提前
      // 一格备好(peek2),换题时右图秒出。
      if (!st.peek) { pickFresh(); return; }
      const committed = st.peek;
      const c = draw(st); // st.recap* 已反映 peek2 抽取后的状态 → 抽 peek2 之后的那一题
      set({
        recapQueue: c ? c.recapQueue : st.recapQueue,
        recapPos: c ? c.recapPos : st.recapPos,
        recapSig: c ? c.recapSig : st.recapSig,
        hist: histPush(st.hist, committed),
        currentKey: committed.key,
        currentName: committed.name,
        currentScramble: committed.scramble,
        peek: st.peek2,
        peek2: c ? c.entry : null,
        observingPinned: false,
      });
      cstimerize();
    },

    prevScramble: () => {
      const st = get();
      if (st.timerState !== TimerState.NOT_RUNNING && st.timerState !== TimerState.STOPPING) return;
      const back = histBack(st.hist);
      if (!back) return;
      const cur = back.list[back.idx];
      set({ hist: back, currentKey: cur.key, currentName: cur.name, currentScramble: cur.scramble, observingPinned: false });
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
      // 停表即自动出下一题(cstimer 式):把预览的下一题(peek)扶正为 current 再预抽一条。
      // 左栏随之显示「下一个要 solve 的把 + 它的图」,计时数字停留在刚做完这把的成绩,
      // 右栏「下一把」也跟着滚到再下一个 —— 不然连续 solve 时 current/peek 都不动,右卡冻住。
      setTimeout(() => get().nextScramble(), 0);
    },

    setTimerState: (s) => set({ timerState: s }),

    setObservingIdx: (i) => set({ observingIdx: i }),

    pinObserving: (i) => set({ observingIdx: i, observingPinned: true }),

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
        observingPinned: false,
      });
    },

    clearSolves: () => {
      const { puzzle, set: setSlug, selected } = get();
      if (!puzzle || !setSlug) return;
      persist(puzzle, setSlug, { selected, solves: [] });
      set({ solves: [], observingIdx: 0, observingPinned: false });
    },
  };
});
