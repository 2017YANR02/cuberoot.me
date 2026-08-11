// Ported from packages/client-vite/src/stores/trainerStore.ts
'use client';

import { create } from 'zustand';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import {
  generateScramble, cstimerStyleScramble, trainerSetScrambleFeatures, type ScrambleKind,
} from './trainer-scramble';
import { caseKey, findCaseByKey } from './trainer-case-key';
import { histBack, histForward, histPush, type ScrambleHist } from './scramble-history';
import { caseOrbit } from './alg_probability';
import { petReact } from './deskpet';
import { persistItem } from './safe-storage';
import { createRoom as apiCreateRoom, getRoom as apiGetRoom, claimRoomBatch, nextRoundRoom, type RoomOrder } from './trainer-room-api';

export const TimerState = {
  NOT_RUNNING: 0,
  AWAITING_READY: 1,
  READY: 2,
  RUNNING: 3,
  STOPPING: 4,
} as const;
export type TimerState = (typeof TimerState)[keyof typeof TimerState];

/**
 * 虚拟集(LSLL)的打乱现算器:库内集的打乱躺在 `case.setup` 里,虚拟集进来时那格是空的,
 * 抽到哪条解哪条。返回打乱 + 一条能解开它的公式;算不出返 null。
 */
export type CaseResolver = (c: AlgCase) => Promise<{ setup: string; alg?: string } | null>;

export type TrainerPenalty = 'ok' | '+2' | 'DNF';
/**
 * train = 随机抽取;recap = 打乱顺序后不重复逐个过一遍,过完重新洗牌;
 * memo = 记忆模式(间隔重复):只出「到期该复习的 + 限额内的新卡」,看图回忆公式后自评。
 */
export type TrainerMode = 'train' | 'recap' | 'memo';
/** uniform = 每个 case 1/N;real = 按数学真实概率(权重 = 轨道大小 16/cn)。 */
export type TrainerProbMode = 'uniform' | 'real';
/** recap 过一遍的顺序:shuffle = 洗牌(历史默认),seq = 按 set 里的 case 顺序。 */
export type TrainerRecapOrder = 'shuffle' | 'seq';
/** 计时数字字体(lcd 与 /timer 同款七段)。 */
export type TrainerTimerFont = 'lcd' | 'mono' | 'liberation' | 'sans';

/**
 * 在线协同房间(后端 trainer_rooms):房间持有共享 case 队列 + 领取游标,本机「下一题」向
 * 服务器原子领取 —— 多设备不重不漏、动态均衡、支持乱序(队列服务端洗)。房间态是运行时的,
 * 不落 prefs / localStorage(刷新即离开;要续会话再重新加入)。
 */
export interface TrainerRoom {
  code: string;
  order: RoomOrder;
  round: number;
  total: number;
}

export interface TrainerSolve {
  i: number;
  caseKey: string;
  caseName: string;
  scramble: string;
  ms: number;
  penalty: TrainerPenalty;
}

/** 打乱历史里的一条(←/→ 回看):case 身份 + 当时出的那条打乱。 */
export interface TrainerHistEntry {
  key: string;
  name: string;
  scramble: string;
  /** recap 模式下该条在本轮的位置(1 起)/ 本轮总数 —— 进度条随「当前题」而非预抽的
   *  下一题走:store 的 recapPos 是「已抽到第几格」,因预抽 peek/peek2 最多领先当前题两格。
   *  凡是要问「用户刷到第几个了」的地方,一律读这里,别读 recapPos。 */
  recap?: { pos: number; total: number };
}

/** 把当前题的 1-based 位置换成「已经练完几题」；确认轮末后才计入最后一题。 */
export function completedRecapCount(
  recap: TrainerHistEntry['recap'],
  roundCompleted: boolean,
): number {
  if (!recap || !Number.isInteger(recap.pos) || !Number.isInteger(recap.total) || recap.total <= 0) return 0;
  if (roundCompleted) return recap.total;
  return Math.min(recap.total, Math.max(0, recap.pos - 1));
}

interface PersistedSession {
  selected: string[];
  solves: TrainerSolve[];
}

const sessionKey = (p: string, s: string) => `trainer:${p}/${s}`;

/**
 * 合练会话的 id(勾选 / 成绩按它单独存一份,不与任何单集会话混)。
 * 成员先排序 ⟹ 「PLL + ZBLL」和「ZBLL + PLL」是同一场,不会各留一份进度。
 */
export const mixSessionId = (sets: readonly string[]) => `mix:${[...sets].sort().join('+')}`;
export const isMixSession = (sessionId: string) => sessionId.startsWith('mix:');
/** 合练 id → 成员 set 列表。 */
export const mixMembers = (sessionId: string): string[] =>
  isMixSession(sessionId) ? sessionId.slice(4).split('+').filter(Boolean) : [];

/**
 * 房间 API 只收 `[A-Za-z0-9_-]{1,48}` 的 set id —— 合练 id 带 `:` `+`,得先净化。
 * 双方(建房/加入)都走这一个函数,所以只要成员相同就一定对得上。太长则退化成短哈希。
 */
export function roomSetId(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, '_');
  if (safe.length <= 48) return safe;
  let h = 5381;
  for (let i = 0; i < sessionId.length; i++) h = (((h << 5) + h) ^ sessionId.charCodeAt(i)) >>> 0;
  return `mix_${h.toString(36)}`;
}

/** 这场会话有没有落过盘 —— 区分「从没开过」与「开过但把 case 全取消了」。 */
const hasPersisted = (p: string, s: string): boolean => {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(sessionKey(p, s)) !== null; } catch { return false; }
};

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

/**
 * 从**页面外**给一场会话预置勾选(`/alg/progress/cases` 的「专练不熟」:先算好队列,
 * 再跳进 run 页)。成绩保留 —— 换的是练哪些 case,不是重开一场。
 *
 * 存在的意义是让 storage key 只有一处 —— 调用方不该知道 `trainer:<puzzle>/<sessionId>` 这个格式。
 */
export function presetSessionSelection(puzzle: string, sessionId: string, keys: readonly string[]): void {
  const prev = loadPersisted(puzzle, sessionId);
  persist(puzzle, sessionId, { ...prev, selected: [...keys] });
}

/** 跨 set 的训练偏好(pre/post-AUF / 计时 / 模式 / 概率 / 字体),全局一份。 */
interface TrainerPrefs {
  preAuf: boolean;
  /** 打乱收尾随机 AUF(历史默认行为,关掉 = 打乱原样呈现)。 */
  postAuf: boolean;
  /** PSF2L:打乱首尾的互逆 D 调整在 D / D2 / D' 之间随机。 */
  randomInitialD: boolean;
  /** F2L / 进阶 F2L:打乱末尾随机补 AUF。 */
  randomFinalAuf: boolean;
  /** F2L / 进阶 F2L:打乱末尾随机补 y 转体。 */
  randomFinalY: boolean;
  /**
   * 顶层朝向偏好:朝向组键 → 允许的相位(见 `lib/alg_ll_orientation`)。收尾 AUF 的
   * 细化版 —— 不是「随机四选一」而是「只出这几个方向」。组键按形状算,跨 set 通用,
   * 所以一份就够(在 ZBLL 里把 U 形状钉成朝上,练 COLL / OLL 的同一形状也跟着钉)。
   * 没有条目的组 = 不限制。
   */
  oriSel: Record<string, number[]>;
  timing: boolean;
  mode: TrainerMode;
  probMode: TrainerProbMode;
  recapOrder: TrainerRecapOrder;
  timerFont: TrainerTimerFont;
  scrambleFont: TrainerTimerFont;
  /** 极简开关:侧栏「上一个」卡片、统计卡片,可各自隐藏。 */
  showPrevCard: boolean;
  showStats: boolean;
  /** 左栏计时数字下方的当前 case 图,可隐藏。 */
  showStageThumb: boolean;
  /** 纯打乱:显示/复制时剥掉括号与 `↑↓·` 等标注,只留转动。 */
  pureScramble: boolean;
  /** 三条一屏(仅不计时模式):一屏出 3 条打乱,拧完 3 条再点一次切下一屏。 */
  multiScramble: boolean;
  /** 记忆模式:每场最多学几张新卡(0 = 只复习不学新的)。 */
  srsNewLimit: number;
  /** 记忆模式:每场卡片总数上限。 */
  srsSessionLimit: number;
  /** 记忆模式:到期卡与新卡都用完后,继续按「最该练的」加练补满本场。 */
  srsFillExtra: boolean;
  /** 记忆模式:按记忆进展自动升降「不熟 / 已掌握」标记。 */
  srsAutoMark: boolean;
  /** 计时/复习模式里做完一把也计入记忆调度(同一 case 每到期一次只计一把)。 */
  srsFromSolves: boolean;
  /**
   * 智能魔方出题:连上蓝牙魔方后由它「变成」当前 case(不用手动打乱)、第一下转动
   * 起表、该套的收尾步骤完成即停表。默认开 —— 连魔方本身就是明确的意思表示,
   * 连上了还要再拨一个开关是白让人找。没连魔方时这个开关不起任何作用。
   */
  smartCube: boolean;
}
const DEFAULT_PREFS: TrainerPrefs = {
  preAuf: true, postAuf: true, randomInitialD: true, randomFinalAuf: true, randomFinalY: true,
  oriSel: {}, timing: false, mode: 'recap', probMode: 'uniform',
  recapOrder: 'shuffle', timerFont: 'lcd', scrambleFont: 'sans',
  showPrevCard: true, showStats: true, showStageThumb: true,
  pureScramble: true, multiScramble: false,
  srsNewLimit: 10, srsSessionLimit: 60, srsFillExtra: true, srsAutoMark: true,
  srsFromSolves: true, smartCube: true,
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
  preAuf: st.preAuf, postAuf: st.postAuf,
  randomInitialD: st.randomInitialD,
  randomFinalAuf: st.randomFinalAuf, randomFinalY: st.randomFinalY,
  oriSel: st.oriSel, timing: st.timing, mode: st.mode,
  probMode: st.probMode, recapOrder: st.recapOrder,
  timerFont: st.timerFont, scrambleFont: st.scrambleFont,
  showPrevCard: st.showPrevCard, showStats: st.showStats,
  showStageThumb: st.showStageThumb, pureScramble: st.pureScramble,
  multiScramble: st.multiScramble,
  srsNewLimit: st.srsNewLimit, srsSessionLimit: st.srsSessionLimit,
  srsFillExtra: st.srsFillExtra, srsAutoMark: st.srsAutoMark,
  srsFromSolves: st.srsFromSolves, smartCube: st.smartCube,
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
  /** 会话 id:单集 = set slug;合练 = `mix:pll+zbll`(勾选 / 成绩按它单独存)。 */
  set: string | null;
  /**
   * 合练会话的成员 set(单集为 null)。非空时 `cases` 里每个 case 带 `srcSet`,
   * caseKey 因此带前缀,而标记 / 记忆仍按各自 set 落地(见 trainer-marks / alg-srs-store)。
   */
  sets: string[] | null;
  cases: AlgCase[];
  /**
   * 虚拟集的打乱现算器(库内集为 null)。见 {@link CaseResolver}。
   * 运行时态,由 `loadSession` 传入,不持久化。
   */
  caseResolver: CaseResolver | null;
  /** 虚拟集打乱生成失败的 case key;运行时态,供训练页显示重试入口。 */
  caseResolveErrors: Record<string, true>;
  /**
   * 本场的 AUF 默认是关的(虚拟集声明,见 `lib/alg-virtual-sets` 的 `noAufDefault`)。
   *
   * 两件事:进场时 preAuf/postAuf 一律置 false(不管全局偏好是什么);这场里再开关它,
   * **只改本场不写全局偏好** —— 否则在 LSLL 里临时开一下,回头练 PLL 也跟着开了。
   * 同 caseResolver:运行时态,不持久化,换一套集自然复位。
   */
  noAufDefault: boolean;
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
   * 预抽的「下一题」(lookahead):三条一屏时它就是屏上第 2 条,单条时 UI 拿它离屏预取图;
   * 出下一题时把它扶正为 current 再预抽一条 —— 预抽的打乱与将来实际要做的完全一致
   * (train 随机也不会重roll)。
   * pool 空 / 历史中段(← 回看过)时为 null,此时「下一题」= 历史里 idx+1 那条。
   */
  peek: TrainerHistEntry | null;
  /**
   * 再下一题(二级 lookahead):出下一题时它递补为 peek,三条一屏时它是屏上第 3 条。
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
  /**
   * 复习一轮刷完时置 true —— 出下一题被拦住,弹「本轮复习结束」提示,
   * `continueRecapRound()` 才进下一轮。
   * 在线房间:队列服务端共享,领完对全员同时弹(真·多方共同刷完)。
   * 单机整集:刷完必弹 —— 一轮走完是个节点,别无声重洗接着刷。
   */
  recapRoundDone: boolean;
  /**
   * 单机:用户在「本轮复习结束」里选了「先不了」—— 本轮不再弹,下次换题直接进新一轮。
   * 运行时态,进新一轮(promoteNext / pickFresh)自动清掉。
   */
  recapRoundAcked: boolean;

  // 在线协同房间(运行时态,不持久化)
  room: TrainerRoom | null;
  /** 领取请求在途(串行化,防连点重复领)。 */
  roomBusy: boolean;
  /**
   * 队尾已领、还没上屏的预取(排在 peek / peek2 之后)。房间模式专用:
   * 换题先吃手上这几条 ⟹ 点一下 0 网络往返,补领丢后台。深度见 `roomAheadTarget`。
   */
  roomBuf: TrainerHistEntry[];
  /** 全队已领取数(= 最近一次领取的全局序号),房间模式下作合并进度分子。 */
  roomClaimed: number;
  /** 最近一次房间操作的错误(网络/房间不存在),UI 展示后自愈。 */
  roomError: string | null;

  // 训练偏好(localStorage `trainer:prefs`;SSR 渲染默认值,挂载后 hydratePrefs 补水)
  preAuf: boolean;
  postAuf: boolean;
  randomInitialD: boolean;
  randomFinalAuf: boolean;
  randomFinalY: boolean;
  oriSel: Record<string, number[]>;
  timing: boolean;
  mode: TrainerMode;
  probMode: TrainerProbMode;
  recapOrder: TrainerRecapOrder;
  timerFont: TrainerTimerFont;
  scrambleFont: TrainerTimerFont;
  showPrevCard: boolean;
  showStats: boolean;
  showStageThumb: boolean;
  pureScramble: boolean;
  multiScramble: boolean;
  smartCube: boolean;
  srsNewLimit: number;
  srsSessionLimit: number;
  srsFillExtra: boolean;
  srsAutoMark: boolean;
  srsFromSolves: boolean;

  /** recap 模式的洗牌队列:pool 变了(recapSig 失配)重洗。 */
  recapQueue: string[];
  recapPos: number;
  recapSig: string;

  loadSession: (
    p: AlgPuzzle, s: string, cases: AlgCase[],
    opts?: {
      /** 没有 select 页的集(虚拟集):装进来的就是本场,默认全选。 */
      defaultAll?: boolean;
      /** 打乱现算器,见 {@link CaseResolver}。 */
      caseResolver?: CaseResolver | null;
      /** 本场 AUF 默认关(见 {@link TrainerState.noAufDefault})。 */
      noAufDefault?: boolean;
    },
  ) => void;
  /**
   * 把这个 case 的打乱现算出来并写回它(虚拟集专用;库内集 / 已算过的直接 resolve)。
   * 训练器自己会给屏上那三条调,记忆模式另有自己的节奏,所以对外也暴露一个。
   */
  resolveCase: (c: AlgCase) => Promise<void>;
  /**
   * 合练:一次装 N 个 set。`cases` 必须已按成员顺序拼好且每个带 `srcSet`
   * (调用方 loadAlg 完各自 stamp,store 不管数据从哪来)。
   */
  loadMixSession: (p: AlgPuzzle, sets: string[], cases: AlgCase[]) => void;
  setSelected: (keys: string[]) => void;
  setScope: (keys: string[] | null) => void;
  setScrambleKind: (k: ScrambleKind) => void;
  hydratePrefs: () => void;
  setPreAuf: (v: boolean) => void;
  setPostAuf: (v: boolean) => void;
  setRandomInitialD: (v: boolean) => void;
  setRandomFinalAuf: (v: boolean) => void;
  setRandomFinalY: (v: boolean) => void;
  /** 改某个朝向组的相位偏好。`offs` 为空 / 覆盖全部 = 该组不限制(存成空数组)。 */
  setOriSel: (key: string, offs: readonly number[]) => void;
  /** 清掉全部朝向限制,回到「随机四选一」。 */
  resetOriSel: () => void;
  setTiming: (v: boolean) => void;
  setMode: (m: TrainerMode) => void;
  setProbMode: (m: TrainerProbMode) => void;
  setRecapOrder: (o: TrainerRecapOrder) => void;
  /** 清空本轮复习进度:重洗队列、从第 1 个重新开始(不动成绩与学习标记)。 */
  restartRecapRound: () => void;
  /** 「本轮复习结束」里选「先不了」:关掉弹窗停在原地,本轮不再弹。 */
  dismissRecapRound: () => void;
  setTimerFont: (f: TrainerTimerFont) => void;
  setScrambleFont: (f: TrainerTimerFont) => void;
  setShowPrevCard: (v: boolean) => void;
  setShowStats: (v: boolean) => void;
  setShowStageThumb: (v: boolean) => void;
  setPureScramble: (v: boolean) => void;
  setSmartCube: (v: boolean) => void;
  setMultiScramble: (v: boolean) => void;
  setSrsNewLimit: (v: number) => void;
  setSrsSessionLimit: (v: number) => void;
  setSrsFillExtra: (v: boolean) => void;
  setSrsAutoMark: (v: boolean) => void;
  setSrsFromSolves: (v: boolean) => void;

  /** 下一个打乱:历史中段先前进,到队尾才出新题(train 随机 / recap 逐个)。 */
  nextScramble: () => void;
  /** 协同「本轮结束」弹窗点「继续下一轮」:清标志并真正进下一轮。 */
  continueRecapRound: () => void;
  /** 上一个打乱(可连按,直到最旧一条)。 */
  prevScramble: () => void;
  /** 打乱历史里直接跳到第 i 条(「历史」列表点选,不重出打乱)。 */
  jumpToHist: (i: number) => void;

  /** 用当前池 + 复习顺序建在线房间,建成即进房间模式并领第一题。 */
  createRoom: () => Promise<{ ok: boolean; code?: string; error?: string }>;
  /** 加入房间(需与房间同 puzzle/set)。 */
  joinRoom: (code: string) => Promise<{ ok: boolean; error?: string }>;
  /** 离开房间,回到本机模式。 */
  leaveRoom: () => void;
  /**
   * 房间推进 steps 步(单条=1,三条一屏切下一屏=3)。手上有预取就同步换题、补领丢后台;
   * 手空才等一次网络(那次的多余点击也不会丢,回包后接着走)。
   */
  roomAdvance: (steps: number) => Promise<void>;

  getTimerReady: (delayMs: number) => void;
  /**
   * `at` overrides "now" (epoch ms). A smart cube stamps its turns with its own
   * clock, which is what makes a bluetooth rep measure the turning rather than
   * the turning plus however long the BLE stack sat on the notification.
   * Keyboard callers omit it.
   */
  startTimer: (at?: number) => void;
  stopTimer: (at?: number) => void;
  setTimerState: (s: TimerState) => void;

  setObservingIdx: (i: number) => void;
  /** 统计里点选成绩:设 observingIdx 并钉住(不计时模式卡片也跟随)。 */
  pinObserving: (i: number) => void;
  setSolvePenalty: (idx: number, penalty: TrainerPenalty) => void;
  deleteSolve: (idx: number) => void;
  clearSolves: () => void;
}

/**
 * 虚拟集的屏上打乱是否全部就绪。普通公式集的 setup 随数据一起到,永远放行;
 * 虚拟集必须等异步 resolver 补完,否则空白题面也会被「下一题」记成已经练过。
 */
export function trainerScramblesReady(
  st: Pick<TrainerState, 'caseResolver' | 'currentKey' | 'currentScramble' | 'peek' | 'peek2'>,
  count: 1 | 3 = 1,
): boolean {
  if (!st.caseResolver) return true;
  const slots = [
    { key: st.currentKey, scramble: st.currentScramble },
    st.peek,
    st.peek2,
  ].slice(0, count);
  return slots.every(slot => !slot?.key || !!slot.scramble);
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
   * 虚拟集(LSLL)的打乱现算:case 进来时 `setup` 是空的,`generateScramble` 只给得出空串。
   * 解出来后**原地**写回那个 case —— 不换 `cases` 数组,一场一万多个 case 的 key 索引
   * 才不用跟着重建(见 trainer-case-key)。同一个 case 并发抽到也只解一次。
   */
  // 按本场的 case 对象去重,不要只按 key:离开旧会话时尚未结束的任务可能与新会话同 key,
  // 若共用一条 Promise,新页面会永远等旧页面的 resolver,甚至被旧结果串场。
  const resolving = new WeakMap<AlgCase, Promise<void>>();
  const fillCase = (c: AlgCase): Promise<void> => {
    const resolver = get().caseResolver;
    if (!resolver || c.setup.trim()) return Promise.resolve();
    const k = caseKey(c);
    const hit = resolving.get(c);
    if (hit) return hit;
    const p = resolver(c)
      .then(r => {
        if (!r) {
          set(st => ({ caseResolveErrors: { ...st.caseResolveErrors, [k]: true } }));
          return;
        }
        c.setup = r.setup;
        // 打乱取逆就是一条能解开它的公式 —— 记忆模式的「揭示」、卡片上的演示都靠它
        if (r.alg) c.algs = [[{ alg: r.alg }]];
        set(st => {
          if (!st.caseResolveErrors[k]) return {};
          const next = { ...st.caseResolveErrors };
          delete next[k];
          return { caseResolveErrors: next };
        });
      })
      .catch(() => {
        // 算不出就留空并显式报错:UI 给重试入口,绝不编一条假的或偷偷跳题。
        set(st => ({ caseResolveErrors: { ...st.caseResolveErrors, [k]: true } }));
      })
      .finally(() => { resolving.delete(c); });
    resolving.set(c, p);
    return p;
  };

  /**
   * 出题时实际用哪套 AUF。
   *
   * 记忆模式一律不加 —— 它是「看着图把公式回忆出来」,题面必须与库里那张 case 图逐字对得上。
   * 首尾随机 U 虽然不改 case,但会把揭示出来的那条公式变成对不上眼前这张图的公式,
   * 背的人只会以为自己记错了。训练 / 复习照旧随机(练的正是识别,不是背图)。
   */
  const aufOpts = (st: {
    mode: TrainerMode; puzzle: AlgPuzzle | null; set: string | null;
    preAuf: boolean; postAuf: boolean; randomInitialD: boolean;
    randomFinalAuf: boolean; randomFinalY: boolean;
    oriSel: Record<string, number[]>;
  }) => {
    const features = trainerSetScrambleFeatures(st.puzzle, st.set);
    return st.mode === 'memo'
      ? { preAuf: false, postAuf: false, randomInitialD: false, randomFinalAuf: false, randomFinalY: false }
      : {
          preAuf: st.preAuf,
          postAuf: st.postAuf,
          randomInitialD: features.randomInitialD && st.randomInitialD,
          randomFinalAuf: features.randomFinalAuf && st.randomFinalAuf,
          randomFinalY: features.randomFinalY && st.randomFinalY,
          orientation: st.oriSel,
          orientationSet: st.set,
        };
  };

  /** 某个 case 的 setup 到位后,把当时留空的打乱补上(当前 / 预抽两条 / 历史里同一 case)。 */
  const patchScramble = (key: string) => {
    const st = get();
    if (!st.puzzle) return;
    const c = findCaseByKey(st.cases, key);
    if (!c || !c.setup.trim()) return;
    const gen = () => generateScramble(c, st.puzzle!, st.scrambleKind, aufOpts(st));
    const fix = <T extends TrainerHistEntry | null>(e: T): T =>
      (e && e.key === key && !e.scramble ? { ...e, scramble: gen() } as T : e);
    const list = st.hist.list.map(fix);
    const peek = fix(st.peek);
    const peek2 = fix(st.peek2);
    const roomBuf = st.roomBuf.map(fix);
    const histChanged = list.some((e, i) => e !== st.hist.list[i]);
    const bufChanged = roomBuf.some((e, i) => e !== st.roomBuf[i]);
    if (!histChanged && !bufChanged && peek === st.peek && peek2 === st.peek2) return;
    set({
      roomBuf: bufChanged ? roomBuf : st.roomBuf,
      hist: histChanged ? { list, idx: st.hist.idx } : st.hist,
      // current 就是历史里 idx 那条,用同一份补上 —— 各自 gen 一次会得到两个不同的 AUF
      currentScramble: st.currentKey === key && !st.currentScramble
        ? (list[st.hist.idx]?.scramble ?? null)
        : st.currentScramble,
      peek,
      peek2,
    });
  };

  /** 屏上这三条(当前 + 预抽两条)里打乱还空着的,解出来补上。 */
  const fillPending = () => {
    if (!get().caseResolver) return;
    const st = get();
    const keys = [st.currentKey, st.peek?.key, st.peek2?.key].filter((k): k is string => !!k);
    for (const key of new Set(keys)) {
      const c = findCaseByKey(st.cases, key);
      if (!c) continue;
      void fillCase(c).then(() => { patchScramble(key); cstimerize(); });
    }
  };

  /** 出完题的收尾:cstimer 风格打乱异步换,虚拟集空着的打乱异步补。 */
  const afterDraw = () => { cstimerize(); fillPending(); };

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
      const sig = [...pool].sort().join('|');
      let q = st.recapQueue;
      let pos = st.recapPos;
      if (st.recapSig !== sig || pos >= q.length) {
        if (st.recapOrder === 'seq') {
          // 顺序:按 set 里 case 的原始顺序(与本机的勾选先后无关)。
          const inPool = new Set(pool);
          q = st.cases.map(caseKey).filter(k => inPool.has(k));
        } else {
          q = shuffle(pool);                                // 乱序:随机洗。
        }
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
    const scramble = generateScramble(c, st.puzzle, st.scrambleKind, aufOpts(st));
    return { entry: { key, name: c.name, scramble, recap: entryRecap }, recapQueue, recapPos, recapSig };
  };

  /** 出一道新题(current)并预抽下一题(peek)、再下一题(peek2)、推进历史。pool 空时清空。 */
  const pickFresh = () => {
    const st = get();
    const a = draw(st);
    if (!a) {
      set({ currentKey: null, currentName: null, currentScramble: null, peek: null, peek2: null, recapRoundDone: false });
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
      recapRoundDone: false,
      recapRoundAcked: false,
    });
    afterDraw();
  };

  /**
   * 队尾把预抽的下一题(peek)扶正为当前题、peek2 递补为 peek、再预抽新的 peek2。
   * nextScramble(过了「本轮结束」拦截后)与 continueRecapRound 共用这段推进。
   */
  const promoteNext = () => {
    const st = get();
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
      recapRoundDone: false,
      // 已经翻进新一轮 ⟹ 上一轮的「先不了」失效,下一轮刷完照弹
      recapRoundAcked: false,
    });
    afterDraw();
  };

  /**
   * 退房时把「房间里已经刷过的」接回本机这一轮:本机队列 = 已翻过去的排在最前(记为完成)
   * + 当前这题 + 剩下的按本机顺序模式排,recapPos 指到当前这题。于是退房后停在同一题、
   * 进度接着显示,刷过的不用再刷一遍(房间的队列在服务端,本机只知道自己领到过哪些)。
   * 非 recap 模式(train / memo)没有「一轮」可言,返 null 走原来的整轮重来。
   */
  const resumeRoundFromHist = (
    st: TrainerState,
  ): { recapQueue: string[]; recapPos: number; recapSig: string } | null => {
    if (st.mode !== 'recap') return null;
    const pool = trainerPool(st.selected, st.scope);
    if (pool.length === 0) return null;
    const inPool = new Set(pool);
    const taken = new Set<string>();
    const done: string[] = [];
    // 只有「已经翻过去的」算刷完;当前这题还没做完,留作退房后的第一题
    for (let i = 0; i < st.hist.idx; i++) {
      const k = st.hist.list[i]?.key;
      if (k && inPool.has(k) && !taken.has(k)) { taken.add(k); done.push(k); }
    }
    const curKey = st.hist.idx >= 0 ? st.hist.list[st.hist.idx]?.key : undefined;
    const head = curKey && inPool.has(curKey) && !taken.has(curKey) ? [curKey] : [];
    for (const k of head) taken.add(k);
    if (done.length === 0 && head.length === 0) return null; // 一题没领到过 ⟹ 没什么可接的
    const restSet = new Set(pool.filter(k => !taken.has(k)));
    const rest = st.recapOrder === 'seq'
      ? st.cases.map(caseKey).filter(k => restSet.has(k))
      : shuffle([...restSet]);
    return {
      recapQueue: [...done, ...head, ...rest],
      recapPos: done.length,                       // 下一抽正好抽到 head(当前这题)
      recapSig: [...pool].sort().join('|'),        // 与 draw 里的 sig 同源,不触发重洗
    };
  };

  /**
   * 屏上是不是一次摆三条(三条一屏且不计时)—— 第 2、3 条就是 peek / peek2。
   * 房间据此决定要不要提前领两条;本轮进度判定也据此看屏上最后一条而非 current。
   */
  const screenShowsThree = (st: TrainerState): boolean => st.multiScramble && !st.timing;

  /**
   * 屏上最后一条是不是本轮的最后一个 case(= 再点一下就翻进下一轮)。
   * 三条一屏时屏上摆的是 current + peek + peek2,判据要看 peek2 而不是 current,
   * 否则「19/21 那一屏其实已经把 20、21 摆出来了」会被误判成还没刷完。
   */
  const atRoundTail = (st: TrainerState): boolean => {
    if (st.mode !== 'recap') return false;
    const cur = st.hist.idx >= 0 ? st.hist.list[st.hist.idx] : null;
    const tail = (screenShowsThree(st) ? (st.peek2 ?? st.peek) : null) ?? cur;
    return !!tail?.recap && tail.recap.pos >= tail.recap.total;
  };

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  /** 后台补领在途(闭包态:不进 state,免得为它多渲一次)。 */
  let roomRefilling = false;
  /** 阻塞领取在途时又点了几下 —— 回包后接着走,别把点击吞掉。 */
  let roomPendingSteps = 0;

  /**
   * 一次原子领取最多 count 题,转成条目数组;只更新 roomClaimed / room 元信息,不落
   * current/peek/history。三条一屏一次占三格 = 一次网络往返 + 一次限流额度(旧后端只回单格,
   * 归一后仍工作,仅少领)。返回 { cases, terminal }:terminal='done'(本轮领完)/'advanced'
   * (本机落后,已同步轮次)/undefined(拿到 cases)。
   */
  const roomClaimBatch = async (
    count: number,
  ): Promise<{ cases: TrainerHistEntry[]; terminal?: 'done' | 'advanced' | 'error' }> => {
    const st = get();
    if (!st.room || !st.puzzle || count <= 0) return { cases: [] };
    // 429(限流)/ 网络抖动是暂态失败,退避重试一次再认输 —— 认输也只报错,绝不能当「本轮领完」
    let res;
    for (let attempt = 0; ; attempt++) {
      try { res = await claimRoomBatch(st.room.code, st.room.round, count); break; }
      catch (e) {
        const msg = (e as Error).message;
        if (attempt === 0 && /rate limit|429|fetch|network|load failed/i.test(msg)) {
          await sleep(1500);
          if (!get().room) return { cases: [], terminal: 'error' };
          continue;
        }
        set({ roomError: msg });
        return { cases: [], terminal: 'error' };
      }
    }
    const st2 = get();
    if (!st2.room || !st2.puzzle) return { cases: [], terminal: 'error' };
    if (res.kind === 'advanced') {
      set({ room: { ...st2.room, round: res.round, total: res.total } });
      return { cases: [], terminal: 'advanced' };
    }
    if (res.kind === 'done') {
      set({ room: { ...st2.room, total: res.total }, roomClaimed: res.total });
      return { cases: [], terminal: 'done' };
    }
    const cases: TrainerHistEntry[] = [];
    let maxClaimed = st2.roomClaimed;
    for (const { caseKey: k, index } of res.cases) {
      const c = findCaseByKey(st2.cases, k);
      if (!c) continue;
      const scramble = generateScramble(c, st2.puzzle, st2.scrambleKind, aufOpts(st2));
      cases.push({ key: k, name: c.name, scramble, recap: { pos: index + 1, total: res.total } });
      maxClaimed = Math.max(maxClaimed, index + 1);
    }
    set({ roomClaimed: maxClaimed, room: { ...st2.room, round: res.round, total: res.total } });
    // 领到了格但本集里一个都找不到(房间与本机的 case key 对不上)是数据错,不是「刷完了」
    if (cases.length === 0) {
      set({ roomError: 'claimed cases not in this set' });
      return { cases: [], terminal: 'error' };
    }
    return { cases };
  };

  /**
   * 队尾要在手里揣多少条(current 之外):屏上要用的 + 再备一屏。
   * 单条 1 条,三条一屏 2(屏上第 2、3 条)+ 3(下一屏)= 5。
   *
   * 一条 = 一次 solve(线上相邻两次领取的中位间隔 5s),后台补领远快于想题时间,备一屏就够。
   * 再深只会把「已领未做」的格占死更多 —— 用户中途关页面,那些格这一轮就没人做了。
   */
  const roomAheadTarget = (st: TrainerState): number => (screenShowsThree(st) ? 5 : 1);

  /** 队尾手上已领、还没扶正的条目(顺序 = 将来的出题顺序)。 */
  const roomAheadList = (st: TrainerState): TrainerHistEntry[] =>
    [st.peek, st.peek2, ...st.roomBuf].filter(Boolean) as TrainerHistEntry[];

  /** 把队尾预取重新摊回 peek / peek2 / roomBuf 三格(顺序不变)。 */
  const spreadAhead = (list: TrainerHistEntry[]) =>
    ({ peek: list[0] ?? null, peek2: list[1] ?? null, roomBuf: list.slice(2) });

  /**
   * 用手上已领的条目走 need 步(不足就走到底 —— 一轮最后一屏可能不满)。**纯同步,不发请求**。
   * 手上一条都没有 ⟹ false,由调用方决定是等网络领还是判本轮结束。
   */
  const roomTake = (need: number, from?: TrainerHistEntry[]): boolean => {
    const st = get();
    const ahead = from ?? roomAheadList(st);
    if (ahead.length === 0) return false;
    const k = Math.min(need, ahead.length);
    let hist = st.hist;
    for (let i = 0; i < k; i++) hist = histPush(hist, ahead[i]);
    const current = ahead[k - 1];
    set({
      hist,
      currentKey: current.key, currentName: current.name, currentScramble: current.scramble,
      ...spreadAhead(ahead.slice(k)),
      observingPinned: false, recapRoundDone: false,
    });
    afterDraw();
    return true;
  };

  /**
   * 后台把队尾预取补到目标深度。不置 roomBusy(补领期间点击照常走同步路径)、失败也不打扰用户 ——
   * 真出了问题,下一次手空时的阻塞领取会把错误摆出来。
   * setMultiScramble 开三条一屏后也调它:当前这屏立刻凑满,不必先切一次。
   */
  const roomRefill = async (): Promise<void> => {
    if (roomRefilling) return;
    const st = get();
    if (!st.room || st.roomBusy || st.currentKey == null) return;
    if (histForward(st.hist)) return;   // 回看历史中段:peek 恒代表队尾之后,不动
    const gap = roomAheadTarget(st) - roomAheadList(st).length;
    if (gap <= 0) return;
    const code = st.room.code;
    const prevError = st.roomError;
    roomRefilling = true;
    try {
      const { cases, terminal } = await roomClaimBatch(gap);
      const now = get();
      if (!now.room || now.room.code !== code) return;   // 期间退了房 / 换了房
      // 别人已开新一轮 ⟹ 手上这些是上一轮的,作废;下次点击照常领新一轮的
      if (terminal === 'advanced') { set({ peek: null, peek2: null, roomBuf: [] }); return; }
      // 本轮领完 / 领取失败:后台不动声色(错误也咽回去 —— 用户这一下点击根本没等它)
      if (terminal) { set({ roomError: prevError }); return; }
      set(spreadAhead([...roomAheadList(now), ...cases]));
    } finally {
      roomRefilling = false;
    }
  };

  /**
   * 房间推进 steps 步(单条=1,三条一屏切下一屏=3)。
   *   ① 历史中段(←回看后)先向前翻,不领题(不发请求);
   *   ② 到队尾:手上预取够走就**同步**换题(点一下 0 网络往返),补领丢后台;
   *   ③ 手空(刚进房 / 断过网 / 连点快过补领)才等一次网络,顺手把预取补到目标深度。
   */
  const roomAdvance = async (steps: number): Promise<void> => {
    const st0 = get();
    if (!st0.room) return;
    if (st0.timerState !== TimerState.NOT_RUNNING && st0.timerState !== TimerState.STOPPING) return;

    let need = steps;
    // ① 历史中段:向前翻,不领题
    while (need > 0) {
      const st = get();
      if (st.recapRoundDone) return;
      const fwd = histForward(st.hist);
      if (!fwd) break;
      const cur = fwd.list[fwd.idx];
      set({ hist: fwd, currentKey: cur.key, currentName: cur.name, currentScramble: cur.scramble, observingPinned: false });
      afterDraw();
      need--;
    }
    if (need <= 0) return;

    // ② 队尾:手上够走这一屏就立刻换,网络往返留给后台
    if (roomAheadList(get()).length >= need) { roomTake(need); void roomRefill(); return; }

    // ③ 手空:这一下只能等网络。已有阻塞领取在途就把点击记下来(别吞掉),回包后接着走。
    if (get().roomBusy) { roomPendingSteps += need; return; }
    set({ roomBusy: true, roomError: null });
    try {
      // advanced(本机落后,别人已开新一轮)⟹ roomClaimBatch 已同步轮次,旧预取作废,再领一次
      for (let attempt = 0; attempt < 2; attempt++) {
        const st = get();
        // 一次领够:走掉的 need 条 + 留在手里的目标深度。后台补领可能正好也在途,
        // 于是这次会多领几条 —— 只是预取变深一点,下次 refill 自然不再补,不会失控。
        const toClaim = need + roomAheadTarget(st) - roomAheadList(st).length;
        const { cases: fresh, terminal } = await roomClaimBatch(Math.max(1, toClaim));
        if (terminal === 'advanced') { set({ peek: null, peek2: null, roomBuf: [] }); continue; }
        // 领取失败(限流 / 断网 / 后端出错)绝不能冒充「本轮结束」—— 那个弹窗会骗用户点「继续
        // 下一轮」,而下一轮是真的会把全队进度重置的。只报错,题面原地不动,用户重试即可。
        if (terminal === 'error') return;

        const st2 = get();
        const ahead = [...roomAheadList(st2), ...fresh];
        // 等网络这会儿用户已经按下起表了(只有慢网才来得及):领到的收进预取,题面不动 ——
        // 计时中途把打乱换掉,比晚一步换题糟得多。停表后的下一次换题直接吃这些预取。
        if (st2.timerState !== TimerState.NOT_RUNNING && st2.timerState !== TimerState.STOPPING) {
          set(spreadAhead(ahead));
          return;
        }
        if (!roomTake(need, ahead)) set({ recapRoundDone: true });
        return;
      }
    } finally {
      set({ roomBusy: false });
      const pending = roomPendingSteps;
      roomPendingSteps = 0;
      if (pending > 0) void roomAdvance(pending);
    }
  };

  /** 房间模式「继续下一轮」:请求开新一轮(CAS,第一个真开,其余读到已开的轮)→ 领第一题。 */
  const roomContinue = async (): Promise<void> => {
    const st0 = get();
    if (!st0.room || st0.roomBusy) return;
    set({ roomBusy: true, roomError: null });
    try {
      const res = await nextRoundRoom(st0.room.code, st0.room.round);
      const st = get();
      if (!st.room) return;
      set({
        room: { ...st.room, round: res.round, total: res.total },
        recapRoundDone: false,
        roomClaimed: 0,
        hist: EMPTY_HIST,
        currentKey: null, currentName: null, currentScramble: null, peek: null, peek2: null, roomBuf: [],
        roomBusy: false,
      });
      void roomAdvance(1);
    } catch (e) {
      set({ roomBusy: false, roomError: (e as Error).message });
    }
  };

  /** 当前题的打乱重出一条(换打乱类型 / 切 pre-AUF / 改朝向时),历史当前条 + 手上预取的全部同步替换。 */
  const regenCurrent = () => {
    const st = get();
    const { currentKey, cases, puzzle, timerState, scrambleKind, hist, peek, peek2, roomBuf } = st;
    if (!currentKey || !puzzle || timerState !== TimerState.NOT_RUNNING) return;
    const c = findCaseByKey(cases, currentKey);
    if (!c) return;
    // 走 aufOpts 而不是直接读 preAuf/postAuf —— 出题(draw)用的就是它,两条路各读各的
    // 会让「重出」这一下和原来那题不是同一套规则(记忆模式尤其明显:那边一律不加 AUF)。
    const opts = aufOpts(st);
    const scramble = generateScramble(c, puzzle, scrambleKind, opts);
    const list = hist.list.map((e, i) => (i === hist.idx ? { ...e, scramble } : e));
    // 预览的下两题、房间里手上揣着的预取也一起用新打乱类型重出,保证看到的 == 将来实际要做的
    const regenPeek = <T extends TrainerHistEntry | null>(pk: T): T => {
      if (!pk) return pk;
      const pc = findCaseByKey(cases, pk.key);
      return (pc ? { ...pk, scramble: generateScramble(pc, puzzle, scrambleKind, opts) } : pk) as T;
    };
    set({
      currentScramble: scramble, hist: { list, idx: hist.idx },
      peek: regenPeek(peek), peek2: regenPeek(peek2), roomBuf: roomBuf.map(regenPeek),
    });
    afterDraw();
  };

  /** 起一场会话(单集 / 合练共用):清干净运行时态,按持久化的勾选出第一题。 */
  const startSession = (
    puzzle: AlgPuzzle, sessionId: string, sets: string[] | null, cases: AlgCase[],
    opts?: { defaultAll?: boolean; caseResolver?: CaseResolver | null; noAufDefault?: boolean },
  ) => {
    const persisted = loadPersisted(puzzle, sessionId);
    const prefs = loadPrefs();
    const valid = new Set(cases.map(caseKey));
    let selected = persisted.selected.filter(k => valid.has(k));
    // 头一次开这场合练:用户点的就是「这几套一起练」,默认全选,免得进来先撞一句「尚未选 case」。
    // 单集流程一律先经 select 页挑 case,不改它。开过后取消到零 = 用户本意,落过盘就照他的来。
    if (opts?.defaultAll && selected.length === 0 && !hasPersisted(puzzle, sessionId)) {
      selected = cases.map(caseKey);
    }
    set({
      puzzle,
      set: sessionId,
      sets,
      cases,
      caseResolver: opts?.caseResolver ?? null,
      caseResolveErrors: {},
      noAufDefault: !!opts?.noAufDefault,
      // 声明了默认关就压成关;普通集从落盘的偏好取回来 —— 从 LSLL 切回 PLL 得能恢复,
      // 光靠一次性的 hydratePrefs 是回不来的。
      preAuf: opts?.noAufDefault ? false : prefs.preAuf,
      postAuf: opts?.noAufDefault ? false : prefs.postAuf,
      randomInitialD: prefs.randomInitialD,
      randomFinalAuf: prefs.randomFinalAuf,
      randomFinalY: prefs.randomFinalY,
      // 朝向偏好按形状分组、跨 set 通用,没有「本场默认关」这回事 —— 直接取落盘的。
      oriSel: prefs.oriSel,
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
      recapRoundDone: false,
      recapRoundAcked: false,
      room: null, roomBusy: false, roomClaimed: 0, roomError: null, roomBuf: [],
    });
    if (trainerPool(selected, get().scope).length > 0) pickFresh();
  };

  return {
    puzzle: null,
    set: null,
    sets: null,
    cases: [],
    caseResolver: null,
    caseResolveErrors: {},
    noAufDefault: false,
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
    recapRoundDone: false,
    recapRoundAcked: false,
    room: null,
    roomBusy: false,
    roomBuf: [],
    roomClaimed: 0,
    roomError: null,
    ...DEFAULT_PREFS,
    recapQueue: [],
    recapPos: 0,
    recapSig: '',

    loadSession: (puzzle, setSlug, cases, opts) => startSession(puzzle, setSlug, null, cases, opts),

    resolveCase: (c) => fillCase(c).then(() => { patchScramble(caseKey(c)); }),

    loadMixSession: (puzzle, sets, cases) => {
      const members = [...sets].sort();
      startSession(puzzle, mixSessionId(members), members, cases, { defaultAll: true });
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
      if (st.room) return; // 房间模式题面由服务端领取,scope 不本地出题
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
      // 默认关的那种集里,开关只作用于本场(见 noAufDefault),不污染全局偏好
      if (!get().noAufDefault) persistPrefs(prefsOf(get()));
      regenCurrent(); // 立刻在当前题上生效,同 setScrambleKind
    },
    setPostAuf: (v) => {
      set({ postAuf: v });
      if (!get().noAufDefault) persistPrefs(prefsOf(get()));
      regenCurrent();
    },
    setRandomInitialD: (v) => {
      set({ randomInitialD: v });
      persistPrefs(prefsOf(get()));
      regenCurrent();
    },
    setRandomFinalAuf: (v) => {
      set({ randomFinalAuf: v });
      persistPrefs(prefsOf(get()));
      regenCurrent();
    },
    setRandomFinalY: (v) => {
      set({ randomFinalY: v });
      persistPrefs(prefsOf(get()));
      regenCurrent();
    },
    setOriSel: (key, offs) => {
      const next = { ...get().oriSel };
      if (offs.length === 0) delete next[key];
      else next[key] = [...offs].sort((a, b) => a - b);
      // 钉了朝向就顺手关掉 post-AUF:两者是同一件事的粗细两档,同时摆着只会让人以为
      // 「随机四选一」还在跑。UI 也把开关收起来(见 TrainerRunClient)。
      set({ oriSel: next, postAuf: Object.keys(next).length > 0 ? false : get().postAuf });
      persistPrefs(prefsOf(get()));
      regenCurrent(); // 立刻在当前题上生效,同 setPostAuf
    },
    resetOriSel: () => {
      if (Object.keys(get().oriSel).length === 0) return;
      set({ oriSel: {} });
      persistPrefs(prefsOf(get()));
      regenCurrent();
    },
    setTiming: (v) => {
      set({ timing: v });
      persistPrefs(prefsOf(get()));
    },
    setMode: (m) => {
      if (get().room) return; // 房间是复习专用,离开房间才切模式
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
      // 房间模式顺序由服务端队列定,本地不重出(改 recapOrder 只影响下次建房)
      if (!get().room && get().mode === 'recap' && get().timerState === TimerState.NOT_RUNNING) pickFresh();
    },
    // 「7/472 刷到一半想重来」:只清本轮队列进度,成绩 / 学习标记 / 记忆排期一概不动
    //(那三样是长期资产,清进度是「这一遍重刷」而不是「从没学过」)。
    restartRecapRound: () => {
      const st = get();
      if (st.room || st.mode !== 'recap') return; // 房间轮次由服务端队列定,本地不重开
      // 清 sig ⟹ 下一抽重洗、从第 1 格起;顺手收掉「本轮结束」弹窗(重开就是新一轮)
      set({ recapQueue: [], recapPos: 0, recapSig: '', recapRoundDone: false, recapRoundAcked: false });
      // 计时中不打断手上这把(新一轮从下一题起);空闲则立刻从头出第一题
      if (st.timerState === TimerState.NOT_RUNNING) {
        set({ hist: EMPTY_HIST });
        pickFresh();
      }
    },
    // 「先不了」:停在最后这题(不换题),本轮不再弹 —— 再点一下就直接进新一轮
    dismissRecapRound: () => {
      if (!get().recapRoundDone) return;
      set({ recapRoundDone: false, recapRoundAcked: true });
    },
    setShowPrevCard: (v) => {
      set({ showPrevCard: v });
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
    setPureScramble: (v) => {
      set({ pureScramble: v });
      persistPrefs(prefsOf(get()));
    },
    setSmartCube: (v) => {
      set({ smartCube: v });
      persistPrefs(prefsOf(get()));
    },
    setMultiScramble: (v) => {
      // 三条一屏要摆三张打乱图,一屏根本放不下(手机尤甚),所以开三条时顺手把打乱图关掉。
      // 关回单条不自动开回来 —— 还想要图自己再勾上,别跟用户抢开关。
      set(v ? { multiScramble: true, showStageThumb: false } : { multiScramble: false });
      persistPrefs(prefsOf(get()));
      // 房间里现开三条一屏:预取目标从 1 涨到 5,立刻补上 —— 当前这屏马上凑满三条
      // (否则要先切一次才补上),下一屏也一并备好。
      if (v) void roomRefill();
    },
    // 记忆模式的四个额度/开关:改了只影响「下一场」怎么组队列,当前这场不重排
    // (刷到一半突然把卡片抽掉最劝退)。MemoryTrainer 里有显式的「重开一场」。
    setSrsNewLimit: (v) => {
      set({ srsNewLimit: Math.max(0, Math.min(200, Math.round(v))) });
      persistPrefs(prefsOf(get()));
    },
    setSrsSessionLimit: (v) => {
      set({ srsSessionLimit: Math.max(5, Math.min(500, Math.round(v))) });
      persistPrefs(prefsOf(get()));
    },
    setSrsFillExtra: (v) => {
      set({ srsFillExtra: v });
      persistPrefs(prefsOf(get()));
    },
    setSrsAutoMark: (v) => {
      set({ srsAutoMark: v });
      persistPrefs(prefsOf(get()));
    },
    setSrsFromSolves: (v) => {
      set({ srsFromSolves: v });
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
      // 虚拟集的打乱异步生成。当前题还是空的就绝不能前进 —— 否则用户点着空白页,
      // 复习游标却一路增长;所有 UI / 键盘 / 智能魔方入口最终都由这里兜底。
      if (st.currentKey && !trainerScramblesReady(st)) return;
      // 「本轮结束」弹窗开着时拦住一切换题 —— 只有弹窗里的「继续下一轮」能推进(见 continueRecapRound)
      if (st.recapRoundDone) return;
      const fwd = histForward(st.hist);
      if (fwd) {
        // 历史中段(← 回看过)向前翻:current 前进一格,peek 不动(它仍是队尾之后的预览)
        const cur = fwd.list[fwd.idx];
        set({ hist: fwd, currentKey: cur.key, currentName: cur.name, currentScramble: cur.scramble, observingPinned: false });
        afterDraw();
        return;
      }
      // 在线房间:队尾向服务器领取下一题(异步,不预抽)
      if (st.room) { void roomAdvance(1); return; }
      // 单机整集刷完一轮:先停下来弹「本轮复习结束」,由用户决定要不要再来一轮
      //(「先不了」= acked,停在原地不再弹,再点一下直接进新一轮)。
      if (!st.recapRoundAcked && atRoundTail(st)) {
        set({ recapRoundDone: true });
        return;
      }
      // 已在队尾:把预抽的下一题(peek)扶正为当前题,peek2 递补为新 peek,再预抽新的 peek2。
      // 这样「先前预抽的下一题」就是「现在要做的这一题」,打乱稳定不重roll(三条一屏切下一屏
      // 同理,屏上三条各就各位)。
      promoteNext();
    },

    continueRecapRound: () => {
      if (!get().recapRoundDone) return;
      if (get().room) { void roomContinue(); return; } // 房间:请求开新一轮再领第一题
      // 单机:预抽的 peek 已经是新一轮的第 1 个(draw 在队列走完时就重洗了),扶正即可。
      // 三条一屏:屏上那三条都是本轮的,要一次翻过去三条,否则新一屏会带上刚做完的两条。
      const n = screenShowsThree(get()) ? 3 : 1;
      set({ recapRoundDone: false });
      for (let i = 0; i < n; i++) promoteNext();
    },

    prevScramble: () => {
      const st = get();
      if (st.timerState !== TimerState.NOT_RUNNING && st.timerState !== TimerState.STOPPING) return;
      const back = histBack(st.hist);
      if (!back) return;
      const cur = back.list[back.idx];
      set({ hist: back, currentKey: cur.key, currentName: cur.name, currentScramble: cur.scramble, observingPinned: false, recapRoundDone: false });
      // 回看到一条当初没算出打乱的(虚拟集解失败)—— 补一次,不走 cstimerize(打乱已存在的不重解)
      fillPending();
    },

    // 「历史」列表点选:直接把光标落到第 i 条(打乱已存在历史里,不重出 —— 不走 cstimerize,
    // 否则会拿已解好的打乱当占位再解一次、换成另一条)。计时中不跳;越界 / 原地忽略。
    jumpToHist: (i) => {
      const st = get();
      if (st.timerState !== TimerState.NOT_RUNNING && st.timerState !== TimerState.STOPPING) return;
      if (i < 0 || i >= st.hist.list.length || i === st.hist.idx) return;
      const cur = st.hist.list[i];
      set({
        hist: { list: st.hist.list, idx: i },
        currentKey: cur.key, currentName: cur.name, currentScramble: cur.scramble,
        observingPinned: false, recapRoundDone: false,
      });
      fillPending();   // 同上:只补当初没算出来的那些,已有打乱一概不动
    },

    createRoom: async () => {
      const st = get();
      if (!st.puzzle || !st.set) return { ok: false, error: 'no set loaded' };
      const pool = new Set(trainerPool(st.selected, st.scope));
      const poolKeys = st.cases.map(caseKey).filter(k => pool.has(k)); // 规范序全集
      // 房间题库 = 全集(都入,total 不变);建房者已单机刷到 recapPos ⟹ 用 start=recapPos-1 让房间从
      // 第 recapPos 格派发:前 start 格记为建房者已完成、永不派发,队友接着分工,进度接着显示 recapPos/总数。
      // 为让「跳过的前缀」正好是已刷的那几个,直接把本机复习队列(已按 seq/shuffle 排好的全集)整条交给房间
      // 并 order='seq' 保序(否则服务端重洗会把前缀打乱、跳过的就不是已刷的了)。仅当队列恰好覆盖当前池时
      // 才走这条;否则(train 模式 / 尚未起步 / 选择变过)退回规范序全集从头开始。
      //
      // 「已刷到第几格」必须读当前题自己记的 pos,不能读 st.recapPos —— 后者是「已抽到第几格」,
      // 因预抽 peek/peek2 领先当前题最多两格。拿它当已刷前缀,刚开页面(current=1/N,recapPos=3)
      // 建的房会 start=2:全队从 3/N 起步,头两个 case 永不派发。(线上 16 个房全中,见 0077 表
      // next_index 建房后 <200ms 即到 3;且 order 被这条分支一律钉成 seq,用户选的乱序也没生效。)
      const curPos = st.hist.idx >= 0 ? (st.hist.list[st.hist.idx]?.recap?.pos ?? 0) : 0;
      const rq = st.recapQueue;
      const rqMatchesPool = rq.length === poolKeys.length && rq.every(k => pool.has(k));
      const useQueue = st.mode === 'recap' && rqMatchesPool && curPos > 1;
      const keys = useQueue ? rq : poolKeys;
      const order: RoomOrder = useQueue ? 'seq' : st.recapOrder;
      const start = useQueue ? Math.min(curPos - 1, keys.length - 1) : 0;
      if (keys.length === 0) return { ok: false, error: 'empty pool' };
      set({ roomBusy: true, roomError: null });
      try {
        // 房间只收 [A-Za-z0-9_-] 的 set id;合练 id 走 roomSetId 净化(建/加入同一函数)
        const info = await apiCreateRoom(st.puzzle, roomSetId(st.set), order, keys, start);
        set({
          mode: 'recap',
          room: { code: info.code, order: info.order, round: info.round, total: info.total },
          roomClaimed: start, recapRoundDone: false, roomBusy: false,
          hist: EMPTY_HIST, currentKey: null, currentName: null, currentScramble: null, peek: null, peek2: null, roomBuf: [],
        });
        persistPrefs(prefsOf(get()));
        void roomAdvance(1);
        return { ok: true, code: info.code };
      } catch (e) {
        set({ roomBusy: false, roomError: (e as Error).message });
        return { ok: false, error: (e as Error).message };
      }
    },

    joinRoom: async (rawCode) => {
      const st = get();
      const code = rawCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,12}$/.test(code)) return { ok: false, error: 'invalid code' };
      if (!st.puzzle || !st.set) return { ok: false, error: 'no set loaded' };
      set({ roomBusy: true, roomError: null });
      try {
        const info = await apiGetRoom(code);
        // 房间绑定 (puzzle,set):不同集不能混(领来的 case_key 不在本集里)。
        // 合练房间的 set 是净化后的合练 id ⟹ 成员集合不同的两场自然对不上,不会串。
        if (info.puzzle !== st.puzzle || info.set !== roomSetId(st.set)) {
          set({ roomBusy: false });
          return { ok: false, error: `room is for ${info.puzzle}/${info.set}` };
        }
        set({
          mode: 'recap',
          room: { code: info.code, order: info.order, round: info.round, total: info.total },
          roomClaimed: info.claimed, recapRoundDone: false, roomBusy: false,
          hist: EMPTY_HIST, currentKey: null, currentName: null, currentScramble: null, peek: null, peek2: null, roomBuf: [],
        });
        persistPrefs(prefsOf(get()));
        void roomAdvance(1);
        return { ok: true };
      } catch (e) {
        set({ roomBusy: false, roomError: (e as Error).message });
        return { ok: false, error: (e as Error).message };
      }
    },

    leaveRoom: () => {
      const st = get();
      // 房间里刷过的不该白刷:退房后接着本机这一轮走(见 resumeRoundFromHist)。
      // 不在房间里时(测试 / UI 复位调它)照旧整轮重来。
      const resume = st.room ? resumeRoundFromHist(st) : null;
      set({
        room: null, roomBusy: false, roomClaimed: 0, roomError: null, recapRoundDone: false, roomBuf: [],
        hist: EMPTY_HIST, currentKey: null, currentName: null, currentScramble: null, peek: null, peek2: null,
        ...(resume ?? { recapQueue: [], recapPos: 0, recapSig: '' }),
      });
      // 回本机模式:按当前选择重新出题
      if (trainerPool(get().selected, get().scope).length > 0 && get().timerState === TimerState.NOT_RUNNING) {
        pickFresh();
      }
    },

    roomAdvance,

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

    startTimer: (at) => {
      set({ timerStarted: at ?? Date.now(), timerState: TimerState.RUNNING });
    },

    stopTimer: (at) => {
      const { puzzle, set: setSlug, solves, currentKey, currentName, currentScramble, timerStarted } = get();
      if (!puzzle || !setSlug) return;
      // Never negative: a device clock that disagrees with ours by more than the
      // rep took would otherwise store a negative time and poison the averages.
      const ms = Math.max(0, (at ?? Date.now()) - timerStarted);
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
      // 停表即自动出下一题(cstimer 式):把预抽的下一题(peek)扶正为 current 再预抽一条。
      // 主屏随之显示「下一个要 solve 的把 + 它的图」,计时数字停留在刚做完这把的成绩 ——
      // 不然连续 solve 时 current/peek 都不动,屏上冻住。
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
