/**
 * Battle 模块 Zustand Store
 * 1:1 翻译自 battle.js state 对象 + 全部 action 函数
 *
 * NOTE: 所有函数体逐行翻译 JS → TS，仅加类型注解，不改逻辑
 */

import { create } from 'zustand';
import type { PlayerState, SolveEntry, Session, WinnerValue, BattleMode, BattleLayout, TabName } from './types';
import { PENALTY, LS_PREFIX, MIN_SOLVE_TIME } from './constants';
import type { PenaltyType } from './constants';
import { generateScramble, generateScrambleImageUrl } from './scramble_engine';
import { getEffectiveTimeFromEntry, computeAo5, computeAverage } from '@/app/[lang]/timer/_shared/stats-core';

// SSR shim: Next renders Server Components without window/localStorage.
// We give a no-op store so module-level `localStorage.getItem(...)` calls don't
// throw at first render; client hydration uses the real DOM storage afterwards.
const localStorage: Storage = typeof window !== 'undefined'
  ? window.localStorage
  : {
      length: 0,
      key: () => null,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    };

// NOTE: createPlayer 工厂函数 — 1:1 翻译自 battle.js（行 143~171）
function createPlayer(id: number): PlayerState {
  return {
    id,
    isReady: false,
    canStart: false,
    isTiming: false,
    hasFinished: false,
    // NOTE: WCA 观察状态（Solo 模式）
    isInspecting: false,
    inspectionStart: 0,
    inspectionTimer: null,
    inspectionPenalty: null,
    penalty: PENALTY.OK,
    // NOTE: 以 ms 为单位的解题时间
    time: 0,
    // performance.now() 时间戳（单调时钟，更精确）
    startTime: 0,
    // NOTE: 多阶段计时 — phaseSplits 存储每次分段的时间戳
    phaseSplits: [],
    // 累积比分（刷新即清零）
    points: 0,
    // 此玩家绑定的 pointerId（多点触控隔离）
    pointerId: null,
    // requestAnimationFrame ID
    rafId: null,
    // NOTE: 成绩历史 — 对象数组
    solveHistory: [],
  };
}

// NOTE: 是否为盲拧项目（3BLD/4BLD/5BLD）— 自动启用 memo 分段
function isBLD(puzzleId: string): boolean {
  return ['333bf', '444bf', '555bf'].includes(puzzleId);
}

// NOTE: 启动时载入两人的 puzzle。新 key (battle_puzzle_0/_1) 缺失时回退到旧 key (battle_puzzle)
function loadInitialPuzzleIds(): [string, string] {
  const legacy = localStorage.getItem(LS_PREFIX + 'puzzle');
  const p0 = localStorage.getItem(LS_PREFIX + 'puzzle_0') ?? legacy ?? '333';
  const p1 = localStorage.getItem(LS_PREFIX + 'puzzle_1') ?? legacy ?? '333';
  return [p0, p1];
}

// NOTE: Web Speech API 语音播报（零依赖）— 1:1 翻译自 battle.js（行 1975~1990）
function speakAlert(text: string, locale: string): void {
  try {
    if ('speechSynthesis' in window) {
      const isZh = locale === 'zh';
      const zhMap: Record<string, string> = { '8 seconds': '八秒', '12 seconds': '十二秒' };
      const u = new SpeechSynthesisUtterance(isZh ? (zhMap[text] || text) : text);
      u.lang = isZh ? 'zh-CN' : 'en-US';
      u.rate = 1.2;
      u.volume = 0.8;
      speechSynthesis.speak(u);
    }
  } catch (_) {
    // NOTE: 不支持时静默失败
  }
}

// NOTE: Mo3 — 最近 3 次 Mean（不去最好最差，含 DNF 则 DNF）
// 1:1 翻译自 battle.js（行 2010~2015）
export function computeMo3(history: SolveEntry[]): number | null {
  if (history.length < 3) return null;
  const last3 = history.slice(-3).map(getEffectiveTimeFromEntry);
  if (last3.some(t => t === Infinity)) return Infinity;
  return Math.round((last3[0] + last3[1] + last3[2]) / 3);
}

// NOTE: 遍历所有历史，找出 session best average（最小非 null 非 Infinity 值）
// 1:1 翻译自 battle.js（行 2023~2032）
export function findBestAverage(
  history: SolveEntry[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeFn: (h: SolveEntry[]) => number | null,
  minLen: number,
): number | null {
  let best: number | null = null;
  for (let i = minLen; i <= history.length; i++) {
    const val = computeFn(history.slice(0, i));
    if (val !== null && val !== Infinity) {
      if (best === null || val < best) best = val;
    }
  }
  return best;
}

// ===== Store 接口定义 =====

export interface BattleState {
  // NOTE: Solo/1v1 模式（'solo' 或 '1v1'）
  mode: BattleMode;
  // NOTE: 1v1 布局（versus=面对面, side=并排）
  layout: BattleLayout;
  // 每位玩家的项目 ID。Solo 只用 puzzleIds[0]
  // NOTE: 1v1 中两人始终独立选；同 id 时强制同 scramble（见 loadNewScramble）
  puzzleIds: [string, string];
  // 是否显示计时中的时间
  showTime: boolean;
  // 是否显示打乱图
  showImage: boolean;
  // WCA 观察倒计时时长（秒）：0=OFF, 8, 15(WCA), 9999=∞
  inspectionTime: number;
  // 观察语音提示（8s/12s）
  voice: boolean;
  // NOTE: 多阶段计时（1=正常, 2=BLD-style, 4=CFOP）
  phases: number;
  // 当前打乱图字号缩放比例
  scrambleScale: number;
  // NOTE: 背景不透明度（0.1~1.0），双方共用
  bgOpacity: number;
  // NOTE: 每位玩家自定义背景色（hex；空串 = 默认黑底）
  bgColors: [string, string];
  // NOTE: 每位玩家自定义背景图（base64 data URL；null = 不用图片）
  bgImages: [string | null, string | null];
  // NOTE: 每位玩家的 event picker 是否打开(打开时在自己 TimerArea 内覆盖大网格)
  eventPickerOpen: [boolean, boolean];
  // NOTE: 计时器精确度（小数位数：0=秒, 1=0.1s, 2=0.01s, 3=0.001s）
  timerPrecision: number;
  // NOTE: 启动延时（ms），按住多久后才能开始计时
  startDelay: number;
  // NOTE: 用户选择显示的 Average 类型
  enabledAverages: number[];
  // NOTE: 目标 Ao5 时间（秒，用于进度条显示）
  goalTime: number;
  // 每位玩家当前的打乱
  scrambles: [string | null, string | null];
  // 每位玩家当前的打乱图 data URL
  scrambleImageUrls: [string | null, string | null];
  // 每位玩家是否正在加载打乱
  scrambleLoadings: [boolean, boolean];
  // 赢家标识
  winner: WinnerValue;
  // NOTE: 红灯→绿灯的延时计时器 ID
  readyTimer: ReturnType<typeof setTimeout> | null;
  // 两个玩家状态
  players: [PlayerState, PlayerState];
  // NOTE: 撤销栈
  undoStack: Array<{ index: number; entry: SolveEntry }>;
  // NOTE: Session 管理
  sessionId: string;
  sessions: Session[];
  // NOTE: 当前 locale
  locale: string;
  // NOTE: 当前 tab（Solo 模式）
  activeTab: TabName;

  // ===== Actions =====
  // NOTE: 初始化 — 从 localStorage 加载所有设置
  init: () => void;
  // NOTE: 打乱相关。playerId 不传则两人都重生
  loadNewScramble: (playerId?: number) => void;
  // NOTE: 状态机核心
  playerDown: (playerId: number) => boolean;
  playerUp: (playerId: number) => void;
  // NOTE: 罚时处理
  handlePenalty: (playerId: number, penaltyType: PenaltyType) => void;
  // NOTE: 设置操作
  deleteLast: () => void;
  toggleShowTime: () => void;
  resetAll: () => void;
  // target=0/1 只换该侧。Solo 始终 target=0；1v1 各自独立
  changePuzzle: (target: 0 | 1, puzzleId: string) => void;
  setMode: (mode: BattleMode) => void;
  setLayout: (layout: BattleLayout) => void;
  setInspectionTime: (time: number) => void;
  setVoice: (voice: boolean) => void;
  setPhases: (phases: number) => void;
  setShowImage: (show: boolean) => void;
  setScrambleScale: (scale: number) => void;
  setBgOpacity: (opacity: number) => void;
  // NOTE: 单侧背景色;传空串清除
  setBgColor: (playerId: 0 | 1, color: string) => void;
  // NOTE: 单侧背景图(base64);传 null 清除。返回 false 表示图片超过 BG_MAX_BYTES
  setBgImage: (playerId: 0 | 1, dataUrl: string | null) => void;
  // NOTE: 单侧背景重置(色 + 图都清)
  resetBg: (playerId: 0 | 1) => void;
  // NOTE: 切换 / 关闭某玩家的 event picker overlay
  setEventPickerOpen: (playerId: 0 | 1, open: boolean) => void;
  setTimerPrecision: (precision: number) => void;
  setStartDelay: (delay: number) => void;
  setGoalTime: (goal: number) => void;
  setEnabledAverages: (averages: number[]) => void;
  setLocale: (locale: string) => void;
  // NOTE: Session 管理
  switchSession: (sessionId: string) => void;
  newSession: () => void;
  renameSession: () => void;
  deleteSession: () => void;
  // NOTE: Tab 切换
  switchTab: (tab: TabName) => void;
  // NOTE: 历史操作
  undoDelete: () => void;
  deleteHistoryItem: (index: number) => void;
  // NOTE: 1v1 模式删除某一轮(同时去掉双方对应 entry;最后一轮还会撤销该轮 points)
  deleteVsRound: (index: number) => void;
  // NOTE: Solo 数据持久化
  saveSolveHistory: () => void;
  loadSolveHistory: () => void;
  // NOTE: 检查里程碑
  checkMilestone: () => void;
  // NOTE: 检查疲劳
  checkFatigue: () => void;
  // NOTE: inspection
  startInspection: (playerId: number) => void;
  clearInspection: (playerId: number) => void;
  // NOTE: 内部辅助方法（状态机内部调用）
  resetForNextRound: () => void;
  checkBothReady: () => void;
  checkBothFinished: () => void;
  cancelReadyTimer: () => void;
  computeWinner: () => void;
  removeLastWinner: () => void;
}

// ===== Store 实现 =====

export const useBattleStore = create<BattleState>((set, get) => ({
  // NOTE: 初始值 — 1:1 翻译自 battle.js state 对象（行 99~141）
  mode: (localStorage.getItem(LS_PREFIX + 'mode') as BattleMode) || '1v1',
  layout: (localStorage.getItem(LS_PREFIX + 'layout') as BattleLayout) || 'versus',
  puzzleIds: loadInitialPuzzleIds(),
  showTime: localStorage.getItem(LS_PREFIX + 'showTime') !== 'false',
  showImage: localStorage.getItem(LS_PREFIX + 'showImage') !== 'false',
  inspectionTime: parseInt(localStorage.getItem(LS_PREFIX + 'inspectionTime') || '0') || 0,
  voice: localStorage.getItem(LS_PREFIX + 'voice') !== 'false',
  phases: parseInt(localStorage.getItem(LS_PREFIX + 'phases') || '1') || 1,
  scrambleScale: parseFloat(localStorage.getItem(LS_PREFIX + 'scrambleScale') || '1.0') || 1.0,
  bgOpacity: parseFloat(localStorage.getItem(LS_PREFIX + 'bgOpacity') || '1.0') || 1.0,
  bgColors: [
    localStorage.getItem(LS_PREFIX + 'bg_color_0') || '',
    localStorage.getItem(LS_PREFIX + 'bg_color_1') || '',
  ],
  bgImages: [
    localStorage.getItem(LS_PREFIX + 'bg_img_0'),
    localStorage.getItem(LS_PREFIX + 'bg_img_1'),
  ],
  eventPickerOpen: [false, false],
  timerPrecision: (() => { const v = localStorage.getItem(LS_PREFIX + 'timerPrecision'); return v !== null ? parseInt(v) : 3; })(),
  startDelay: (() => { const v = localStorage.getItem(LS_PREFIX + 'startDelay'); return v !== null ? parseInt(v) : 300; })(),
  enabledAverages: JSON.parse(localStorage.getItem(LS_PREFIX + 'enabledAverages') || '[5, 12]'),
  goalTime: parseFloat(localStorage.getItem(LS_PREFIX + 'goalTime') || '0') || 0,
  scrambles: [null, null],
  scrambleImageUrls: [null, null],
  scrambleLoadings: [false, false],
  winner: -2,
  readyTimer: null,
  players: [createPlayer(0), createPlayer(1)],
  undoStack: [],
  sessionId: localStorage.getItem(LS_PREFIX + 'sessionId') || '1',
  sessions: JSON.parse(localStorage.getItem(LS_PREFIX + 'sessions') || '[{"id":"1","name":"Session 1"}]'),
  locale: (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null) || 'en',
  activeTab: 'timer',

  // ===== init =====
  init: () => {
    // NOTE: 一次性迁移:BattleEventPicker 上线前的 puzzle 选择经常因为旧 split 逻辑
    //   被设成奇怪的值(测试残留),首次进入新版时强制清掉,从默认 333 起步。
    //   设置 VERSION_KEY 后刷新不再重置(用户自己后续改的项目正常持久化)。
    const VERSION_KEY = LS_PREFIX + 'event_picker_v1';
    if (localStorage.getItem(VERSION_KEY) !== 'done') {
      localStorage.removeItem(LS_PREFIX + 'puzzle_0');
      localStorage.removeItem(LS_PREFIX + 'puzzle_1');
      localStorage.removeItem(LS_PREFIX + 'puzzle');
      localStorage.removeItem(LS_PREFIX + 'splitPuzzles');
      localStorage.setItem(VERSION_KEY, 'done');
      set({ puzzleIds: ['333', '333'] });
    }
    get().loadSolveHistory();
    get().loadNewScramble();
  },

  // ===== 打乱生成 =====
  // playerId 不传则两人都重生（Solo 始终只对 0 生效）
  // NOTE: 不变量——1v1 模式下 puzzleIds[0] === puzzleIds[1] 时,scrambles 必须相等。
  //   即使只针对单侧调用,若两人同 puzzle,也强制把新 scramble 同步到另一侧。
  loadNewScramble: (playerId?: number) => {
    const s = get();
    const targets = playerId === undefined
      ? (s.mode === 'solo' ? [0] : [0, 1])
      : [playerId];

    const sharedPuzzle = s.mode === '1v1' && s.puzzleIds[0] === s.puzzleIds[1];
    // NOTE: 同 puzzle 时,影响范围扩展到双方
    const affected = sharedPuzzle ? [0, 1] : targets;

    const loadings: [boolean, boolean] = [...s.scrambleLoadings];
    const scramblesNext: [string | null, string | null] = [...s.scrambles];
    const imagesNext: [string | null, string | null] = [...s.scrambleImageUrls];
    for (const i of affected) {
      loadings[i] = true;
      scramblesNext[i] = null;
      imagesNext[i] = null;
    }
    set({ scrambleLoadings: loadings, scrambles: scramblesNext, scrambleImageUrls: imagesNext });

    const after = get();
    const newScrambles: [string | null, string | null] = [...after.scrambles];
    const newImages: [string | null, string | null] = [...after.scrambleImageUrls];
    const newLoadings: [boolean, boolean] = [...after.scrambleLoadings];

    if (sharedPuzzle) {
      // 一份 scramble 复制给两人
      const puzzleId = after.puzzleIds[0];
      const text = generateScramble(puzzleId);
      const img = (after.showImage && text && !text.startsWith('⚠️'))
        ? generateScrambleImageUrl(puzzleId, text)
        : null;
      newScrambles[0] = text;
      newScrambles[1] = text;
      newImages[0] = img;
      newImages[1] = img;
      newLoadings[0] = false;
      newLoadings[1] = false;
    } else {
      for (const i of affected) {
        const puzzleId = after.puzzleIds[i];
        const text = generateScramble(puzzleId);
        newScrambles[i] = text;
        newLoadings[i] = false;
        if (after.showImage && text && !text.startsWith('⚠️')) {
          newImages[i] = generateScrambleImageUrl(puzzleId, text);
        } else {
          newImages[i] = null;
        }
      }
    }
    set({ scrambles: newScrambles, scrambleImageUrls: newImages, scrambleLoadings: newLoadings });
  },

  // ===== 状态机核心 =====

  // 1:1 翻译自 battle.js playerDown()（行 542~636）
  playerDown: (playerId: number): boolean => {
    const s = get();
    const isSolo = s.mode === 'solo';

    // NOTE: Solo 模式只处理 player 0
    if (isSolo && playerId !== 0) return false;

    const p = s.players[playerId];

    if (isSolo) {
      // === Solo 模式状态机 ===
      if (p.hasFinished) {
        // 上一轮已完成 → 重置进入下一轮
        get().resetForNextRound();
      }
      if (p.isInspecting) {
        // NOTE: 观察中按下 → 进入准备状态
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[playerId] = { ...p, isReady: true };
        set({ players: newPlayers });
        get().checkBothReady();
        return true;
      }
      if (p.isTiming) {
        // 计时中按下
        const elapsed = performance.now() - p.startTime;
        if (elapsed > MIN_SOLVE_TIME) {
          // NOTE: 多阶段计时 — 获取有效阶段数（BLD 强制 2 阶段）
          const numPhases = isBLD(s.puzzleIds[0]) ? 2 : s.phases;
          if (numPhases > 1 && p.phaseSplits.length < numPhases - 1) {
            // 记录分段时间（不停表）
            const newPlayers = [...s.players] as [PlayerState, PlayerState];
            newPlayers[playerId] = {
              ...p,
              phaseSplits: [...p.phaseSplits, elapsed],
            };
            set({ players: newPlayers });
            return true;
          }
          // NOTE: 应用观察罚时（如果有）
          let penalty = p.penalty;
          if (p.inspectionPenalty === '+2') {
            penalty = PENALTY.PLUS2;
          } else if (p.inspectionPenalty === 'dnf') {
            penalty = PENALTY.DNF;
          }
          const newPlayers = [...s.players] as [PlayerState, PlayerState];
          newPlayers[playerId] = {
            ...p,
            time: elapsed,
            hasFinished: true,
            isTiming: false,
            penalty,
          };
          if (p.rafId !== null) cancelAnimationFrame(p.rafId);
          set({ players: newPlayers });
          get().checkBothFinished();
        }
        return true;
      }
      if (!p.hasFinished && !p.canStart && s.scrambles[0]) {
        // 空闲状态按下 → 准备
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[playerId] = { ...p, isReady: true };
        set({ players: newPlayers });
        get().checkBothReady();
        return true;
      }
      return false;
    }

    // === 1v1 模式原有逻辑 ===
    const [p0, p1] = s.players;
    if (p0.hasFinished && p1.hasFinished) {
      get().resetForNextRound();
    }

    // NOTE: 重新读取——resetForNextRound 可能改了 players
    const ps = get().players[playerId];

    if (ps.isTiming) {
      const elapsed = performance.now() - ps.startTime;
      if (elapsed > MIN_SOLVE_TIME) {
        const newPlayers = [...get().players] as [PlayerState, PlayerState];
        newPlayers[playerId] = {
          ...ps,
          time: elapsed,
          hasFinished: true,
          isTiming: false,
        };
        if (ps.rafId !== null) cancelAnimationFrame(ps.rafId);
        set({ players: newPlayers });
        // NOTE: 立即触发 confetti + vibrate（在 UI 组件中处理）
        get().checkBothFinished();
      }
      return true;
    } else if (!ps.hasFinished && !ps.canStart && get().scrambles[playerId]) {
      const newPlayers = [...get().players] as [PlayerState, PlayerState];
      newPlayers[playerId] = { ...ps, isReady: true };
      set({ players: newPlayers });
      get().checkBothReady();
      return true;
    }
    return false;
  },

  // 1:1 翻译自 battle.js playerUp()（行 641~711）
  playerUp: (playerId: number) => {
    const s = get();
    const isSolo = s.mode === 'solo';

    if (isSolo && playerId !== 0) return;

    const p = s.players[playerId];

    if (isSolo) {
      // === Solo 模式 ===
      if (p.canStart) {
        // NOTE: inspection 开启时，松手开始观察倒计时
        if (s.inspectionTime > 0 && !p.isInspecting && !p.isTiming) {
          const newPlayers = [...s.players] as [PlayerState, PlayerState];
          newPlayers[playerId] = { ...p, canStart: false, isReady: false };
          set({ players: newPlayers });
          get().startInspection(playerId);
          return;
        }
        // 松手开始计时
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[playerId] = {
          ...p,
          canStart: false,
          isTiming: true,
          isReady: false,
          startTime: performance.now(),
          time: 0,
          phaseSplits: [],
          penalty: p.inspectionPenalty ? p.penalty : PENALTY.OK,
        };
        set({ players: newPlayers });
        // NOTE: 清除观察状态
        get().clearInspection(playerId);
        return;
      }
      if (p.isReady && !p.isTiming && !p.hasFinished) {
        get().cancelReadyTimer();
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[playerId] = { ...p, isReady: false };
        set({ players: newPlayers });
      }
      return;
    }

    // === 1v1 模式原有逻辑 ===
    if (p.canStart) {
      // --- 第一名玩家松手触发，强制双方同时开始计时 ---
      const startTime = performance.now();
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      for (let i = 0; i < 2; i++) {
        const player = s.players[i];
        if (player.canStart) {
          newPlayers[i] = {
            ...player,
            canStart: false,
            isTiming: true,
            isReady: false,
            startTime: startTime,
            time: 0,
            penalty: PENALTY.OK,
          };
        }
      }
      set({ players: newPlayers });
    } else if (p.isReady && !p.isTiming && !p.hasFinished) {
      // NOTE: 对方未就绪时松手 → 恢复 idle（黑色），取消红灯延时
      get().cancelReadyTimer();
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      newPlayers[playerId] = { ...p, isReady: false };
      set({ players: newPlayers });
    }
  },

  // ===== 内部辅助方法（挂在 action 上但不对外暴露接口） =====

  // 1:1 翻译自 battle.js checkBothReady()（行 785~815）
  checkBothReady: () => {
    const s = get();
    const isSolo = s.mode === 'solo';

    if (isSolo) {
      const p0 = s.players[0];
      if (p0.isReady && !p0.canStart) {
        const timer = setTimeout(() => {
          const curr = get();
          if (curr.players[0].isReady) {
            const newPlayers = [...curr.players] as [PlayerState, PlayerState];
            newPlayers[0] = { ...curr.players[0], canStart: true };
            set({ players: newPlayers, readyTimer: null });
          }
        }, s.startDelay);
        set({ readyTimer: timer });
      }
      return;
    }
    // === 1v1 原有逻辑 ===
    const [p0, p1] = s.players;
    if (p0.isReady && !p0.canStart && p1.isReady && !p1.canStart) {
      const timer = setTimeout(() => {
        const curr = get();
        if (curr.players[0].isReady && curr.players[1].isReady) {
          const newPlayers = [...curr.players] as [PlayerState, PlayerState];
          newPlayers[0] = { ...curr.players[0], canStart: true };
          newPlayers[1] = { ...curr.players[1], canStart: true };
          set({ players: newPlayers, readyTimer: null });
        }
      }, s.startDelay);
      set({ readyTimer: timer });
    }
  },

  cancelReadyTimer: () => {
    const s = get();
    if (s.readyTimer) {
      clearTimeout(s.readyTimer);
      set({ readyTimer: null });
    }
  },

  // 1:1 翻译自 battle.js checkBothFinished()（行 835~880）
  checkBothFinished: () => {
    const s = get();
    const isSolo = s.mode === 'solo';

    if (isSolo) {
      const p = s.players[0];
      if (p.hasFinished) {
        const entry: SolveEntry = {
          time: p.time,
          penalty: p.penalty === PENALTY.DNF ? 'dnf' : (p.penalty === PENALTY.PLUS2 ? '+2' : 'ok'),
          scramble: s.scrambles[0] || '',
          date: new Date().toISOString(),
        };
        // NOTE: 多阶段分段记录
        if (p.phaseSplits.length > 0) entry.phases = [...p.phaseSplits, p.time];
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[0] = { ...p, solveHistory: [...p.solveHistory, entry] };
        set({ players: newPlayers });
        get().saveSolveHistory();
        get().checkMilestone();
        get().checkFatigue();
        // NOTE: 普通停表触觉反馈（非 PB 时的轻微震动）
        if (navigator.vibrate) navigator.vibrate(30);
        get().loadNewScramble();
      }
      return;
    }
    // === 1v1 原有逻辑 ===
    const [p0, p1] = s.players;
    if (p0.hasFinished && p1.hasFinished) {
      // NOTE: 记录成绩到历史
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      for (let i = 0; i < 2; i++) {
        const pi = s.players[i];
        newPlayers[i] = {
          ...pi,
          solveHistory: [...pi.solveHistory, {
            time: pi.time,
            penalty: pi.penalty === PENALTY.DNF ? 'dnf' : (pi.penalty === PENALTY.PLUS2 ? '+2' : 'ok'),
            scramble: s.scrambles[i] || '',
            date: new Date().toISOString(),
          }],
        };
      }
      set({ players: newPlayers });
      get().computeWinner();
      get().saveSolveHistory();
      get().loadNewScramble();
    }
  },

  // 1:1 翻译自 battle.js resetForNextRound()（行 887~914）
  resetForNextRound: () => {
    const s = get();
    const isSolo = s.mode === 'solo';

    if (isSolo) {
      const p = s.players[0];
      get().clearInspection(0);
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      newPlayers[0] = {
        ...p,
        isReady: false,
        canStart: false,
        isTiming: false,
        hasFinished: false,
        inspectionPenalty: null,
      };
      set({ players: newPlayers });
      return;
    }
    // === 1v1 原有逻辑 ===
    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    for (let i = 0; i < 2; i++) {
      newPlayers[i] = {
        ...s.players[i],
        isReady: false,
        canStart: false,
        isTiming: false,
        hasFinished: false,
      };
    }
    set({ players: newPlayers, winner: -2 });
  },

  // 1:1 翻译自 battle.js computeWinner()（行 963~1001）
  computeWinner: () => {
    const s = get();
    const [p0, p1] = s.players;
    const effectiveTimeFn = (player: PlayerState) => {
      if (player.penalty === PENALTY.DNF) return Infinity;
      if (player.penalty === PENALTY.PLUS2) return player.time + 2000;
      return player.time;
    };
    const t0 = effectiveTimeFn(p0);
    const t1 = effectiveTimeFn(p1);

    let winner: WinnerValue = -2;
    const newPlayers = [...s.players] as [PlayerState, PlayerState];

    if (t0 === Infinity && t1 === Infinity) {
      winner = -2;
    } else if (t0 < t1) {
      winner = 0;
      newPlayers[0] = { ...p0, points: p0.points + 1 };
    } else if (t1 < t0) {
      winner = 1;
      newPlayers[1] = { ...p1, points: p1.points + 1 };
    } else {
      winner = -1;
      newPlayers[0] = { ...p0, points: p0.points + 1 };
      newPlayers[1] = { ...p1, points: p1.points + 1 };
    }

    set({ winner, players: newPlayers });
  },

  // ===== 罚时处理 =====
  // 1:1 翻译自 battle.js handlePenalty()（行 1059~1097）
  handlePenalty: (playerId: number, penaltyType: PenaltyType) => {
    const s = get();
    const p = s.players[playerId];
    if (!p.hasFinished || p.isTiming) return;

    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    newPlayers[playerId] = { ...p, penalty: penaltyType };

    if (s.mode === 'solo') {
      // NOTE: Solo 模式——更新历史中最后一条记录的 penalty 字段
      const h = [...newPlayers[playerId].solveHistory];
      if (h.length > 0) {
        h[h.length - 1] = {
          ...h[h.length - 1],
          penalty: penaltyType === PENALTY.DNF ? 'dnf' : (penaltyType === PENALTY.PLUS2 ? '+2' : 'ok'),
        };
        newPlayers[playerId] = { ...newPlayers[playerId], solveHistory: h };
      }
      set({ players: newPlayers });
      get().saveSolveHistory();
      return;
    }

    // === 1v1 原有逻辑 ===
    // NOTE: 更新历史中最后一条记录的 penalty
    for (let i = 0; i < 2; i++) {
      const ph = [...newPlayers[i].solveHistory];
      if (ph.length > 0) {
        ph[ph.length - 1] = {
          ...ph[ph.length - 1],
          penalty: newPlayers[i].penalty === PENALTY.DNF ? 'dnf' : (newPlayers[i].penalty === PENALTY.PLUS2 ? '+2' : 'ok'),
        };
        newPlayers[i] = { ...newPlayers[i], solveHistory: ph };
      }
    }
    set({ players: newPlayers });

    // NOTE: 双方完成后才重算积分
    if (newPlayers[0].hasFinished && newPlayers[1].hasFinished) {
      get().removeLastWinner();
      get().computeWinner();
      get().saveSolveHistory();
    }
  },

  // 1:1 翻译自 battle.js removeLastWinner()（行 1184~1196）
  removeLastWinner: () => {
    const s = get();
    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    if (s.winner === 0) {
      newPlayers[0] = { ...s.players[0], points: s.players[0].points - 1 };
    } else if (s.winner === 1) {
      newPlayers[1] = { ...s.players[1], points: s.players[1].points - 1 };
    } else if (s.winner === -1) {
      newPlayers[0] = { ...s.players[0], points: s.players[0].points - 1 };
      newPlayers[1] = { ...s.players[1], points: s.players[1].points - 1 };
    }
    set({ winner: -2, players: newPlayers });
  },

  // ===== 设置操作 =====
  // 1:1 翻译自 battle.js deleteLast()（行 1106~1139）
  deleteLast: () => {
    const s = get();
    if (s.mode === 'solo') {
      const p = s.players[0];
      if (p.solveHistory.length === 0) return;
      const newPlayers = [...s.players] as [PlayerState, PlayerState];
      newPlayers[0] = {
        ...p,
        solveHistory: p.solveHistory.slice(0, -1),
        time: 0,
        hasFinished: false,
        penalty: PENALTY.OK,
      };
      set({ players: newPlayers });
      get().saveSolveHistory();
      return;
    }
    // === 1v1 原有逻辑 ===
    if (!s.players[0].hasFinished || !s.players[1].hasFinished) return;
    get().removeLastWinner();
    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    for (let i = 0; i < 2; i++) {
      newPlayers[i] = {
        ...s.players[i],
        time: 0,
        hasFinished: false,
        penalty: PENALTY.OK,
        solveHistory: s.players[i].solveHistory.slice(0, -1),
      };
    }
    set({ players: newPlayers });
    get().saveSolveHistory();
  },

  toggleShowTime: () => {
    const s = get();
    const newVal = !s.showTime;
    localStorage.setItem(LS_PREFIX + 'showTime', String(newVal));
    set({ showTime: newVal });
  },

  // 1:1 翻译自 battle.js resetAll()（行 1151~1182）
  resetAll: () => {
    const newPlayers: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];
    set({
      winner: -2,
      players: newPlayers,
      undoStack: [],
    });
    const s = get();
    s.saveSolveHistory();
    s.loadNewScramble();
  },

  // target=0/1 → 仅换该侧。Solo 始终 target=0；1v1 由 BattleEventPicker 各自调用
  // NOTE: 改完单侧后,若两人现在 id 相等则触发双人 loadNewScramble
  //       (loadNewScramble 内部会走"同 puzzle ⇒ 一份 scramble 复制给双方"分支)
  changePuzzle: (target: 0 | 1, newPuzzleId: string) => {
    const s = get();
    if (s.puzzleIds[target] === newPuzzleId) return;

    s.saveSolveHistory();

    const newPuzzleIds: [string, string] = [...s.puzzleIds];
    newPuzzleIds[target] = newPuzzleId;
    localStorage.setItem(LS_PREFIX + `puzzle_${target}`, newPuzzleId);
    if (newPuzzleIds[0] === newPuzzleIds[1]) {
      localStorage.setItem(LS_PREFIX + 'puzzle', newPuzzleIds[0]);
    }

    // 重置受影响玩家的当前回合（保留 points，loadSolveHistory 会替换 history）
    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    newPlayers[target] = createPlayer(target);
    newPlayers[target].points = s.players[target].points;

    // NOTE: 另一玩家也重置当前回合状态(保留 points / history)。
    //   否则 P0 切项目后,P1 还卡在上轮 hasFinished=true,playerDown 拒绝进入红灯。
    if (s.mode === '1v1') {
      const other = (1 - target) as 0 | 1;
      newPlayers[other] = {
        ...s.players[other],
        isReady: false,
        canStart: false,
        isTiming: false,
        hasFinished: false,
        isInspecting: false,
        inspectionPenalty: null,
        pointerId: null,
        time: 0,
      };
    }

    set({
      puzzleIds: newPuzzleIds,
      winner: -2,
      players: newPlayers,
    });
    get().loadSolveHistory();
    // NOTE: 同 id 走双人分支(共享 scramble);否则只重生该侧
    if (newPuzzleIds[0] === newPuzzleIds[1] && s.mode === '1v1') {
      get().loadNewScramble();
    } else {
      get().loadNewScramble(target);
    }
  },

  setMode: (mode: BattleMode) => {
    get().saveSolveHistory();
    localStorage.setItem(LS_PREFIX + 'mode', mode);
    const newPlayers: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];
    set({
      mode,
      winner: -2,
      players: newPlayers,
      activeTab: 'timer',
    });
    get().loadSolveHistory();
  },

  setLayout: (layout: BattleLayout) => {
    const s = get();
    if (s.layout === layout) return; // NOTE: 避免重复设置
    localStorage.setItem(LS_PREFIX + 'layout', layout);
    // NOTE: 保留玩家累积数据（solveHistory, points），仅重置当前回合状态
    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    for (let i = 0; i < 2; i++) {
      newPlayers[i] = {
        ...s.players[i],
        isReady: false,
        canStart: false,
        isTiming: false,
        hasFinished: false,
        pointerId: null,
      };
    }
    set({ layout, winner: -2, players: newPlayers });
    // NOTE: scrMgr 可能还没加载（自动横屏检测比脚本加载快）
    if (typeof window.scrMgr !== 'undefined') {
      get().loadNewScramble();
    }
  },

  setInspectionTime: (time: number) => {
    localStorage.setItem(LS_PREFIX + 'inspectionTime', String(time));
    set({ inspectionTime: time });
  },

  setVoice: (voice: boolean) => {
    localStorage.setItem(LS_PREFIX + 'voice', String(voice));
    set({ voice });
  },

  setPhases: (phases: number) => {
    localStorage.setItem(LS_PREFIX + 'phases', String(phases));
    set({ phases });
  },

  setShowImage: (show: boolean) => {
    localStorage.setItem(LS_PREFIX + 'showImage', String(show));
    set({ showImage: show });
    if (show) {
      const s = get();
      const newImages: [string | null, string | null] = [...s.scrambleImageUrls];
      const targets = s.mode === 'solo' ? [0] : [0, 1];
      for (const i of targets) {
        const sc = s.scrambles[i];
        if (sc && !sc.startsWith('⚠️')) {
          newImages[i] = generateScrambleImageUrl(s.puzzleIds[i], sc);
        }
      }
      set({ scrambleImageUrls: newImages });
    } else {
      set({ scrambleImageUrls: [null, null] });
    }
  },

  setScrambleScale: (scale: number) => {
    localStorage.setItem(LS_PREFIX + 'scrambleScale', String(scale));
    set({ scrambleScale: scale });
    // NOTE: 同步更新 CSS 变量，确保 .scramble-text 的 calc() 立即生效
    document.documentElement.style.setProperty('--scramble-scale', String(scale));
  },

  setBgOpacity: (opacity: number) => {
    localStorage.setItem(LS_PREFIX + 'bgOpacity', String(opacity));
    set({ bgOpacity: opacity });
  },

  // NOTE: 设置背景色;同时清掉图片(色 / 图二选一)
  setBgColor: (playerId: 0 | 1, color: string) => {
    const s = get();
    const newColors: [string, string] = [...s.bgColors];
    const newImages: [string | null, string | null] = [...s.bgImages];
    newColors[playerId] = color;
    newImages[playerId] = null;
    if (color) localStorage.setItem(LS_PREFIX + `bg_color_${playerId}`, color);
    else localStorage.removeItem(LS_PREFIX + `bg_color_${playerId}`);
    localStorage.removeItem(LS_PREFIX + `bg_img_${playerId}`);
    set({ bgColors: newColors, bgImages: newImages });
  },

  // NOTE: 设置背景图(base64);同时清掉颜色
  setBgImage: (playerId: 0 | 1, dataUrl: string | null) => {
    const s = get();
    const newImages: [string | null, string | null] = [...s.bgImages];
    const newColors: [string, string] = [...s.bgColors];
    newImages[playerId] = dataUrl;
    if (dataUrl) {
      newColors[playerId] = '';
      try {
        localStorage.setItem(LS_PREFIX + `bg_img_${playerId}`, dataUrl);
        localStorage.removeItem(LS_PREFIX + `bg_color_${playerId}`);
      } catch (e) {
        console.warn('Failed to save bg image:', e);
      }
    } else {
      localStorage.removeItem(LS_PREFIX + `bg_img_${playerId}`);
    }
    set({ bgImages: newImages, bgColors: newColors });
  },

  resetBg: (playerId: 0 | 1) => {
    const s = get();
    const newColors: [string, string] = [...s.bgColors];
    const newImages: [string | null, string | null] = [...s.bgImages];
    newColors[playerId] = '';
    newImages[playerId] = null;
    localStorage.removeItem(LS_PREFIX + `bg_color_${playerId}`);
    localStorage.removeItem(LS_PREFIX + `bg_img_${playerId}`);
    set({ bgColors: newColors, bgImages: newImages });
  },

  setEventPickerOpen: (playerId: 0 | 1, open: boolean) => {
    const s = get();
    const next: [boolean, boolean] = [...s.eventPickerOpen];
    next[playerId] = open;
    // NOTE: 同一时刻只允许一个玩家的 picker 开着(避免遮挡 + 简化交互)
    if (open) next[1 - playerId] = false;
    set({ eventPickerOpen: next });
  },

  setTimerPrecision: (precision: number) => {
    localStorage.setItem(LS_PREFIX + 'timerPrecision', String(precision));
    set({ timerPrecision: precision });
  },

  setStartDelay: (delay: number) => {
    localStorage.setItem(LS_PREFIX + 'startDelay', String(delay));
    set({ startDelay: delay });
  },

  setGoalTime: (goal: number) => {
    localStorage.setItem(LS_PREFIX + 'goalTime', String(goal));
    set({ goalTime: goal });
  },

  setEnabledAverages: (averages: number[]) => {
    localStorage.setItem(LS_PREFIX + 'enabledAverages', JSON.stringify(averages));
    set({ enabledAverages: averages });
  },

  setLocale: (locale: string) => {
    set({ locale });
  },

  // ===== Tab 切换 =====
  switchTab: (tab: TabName) => {
    set({ activeTab: tab });
  },

  // ===== Session 管理 =====
  // 1:1 翻译自 battle.js（行 3118~3210 大致区间）
  switchSession: (newSessionId: string) => {
    const s = get();
    s.saveSolveHistory();
    localStorage.setItem(LS_PREFIX + 'sessionId', newSessionId);
    const newPlayers: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];
    set({
      sessionId: newSessionId,
      winner: -2,
      players: newPlayers,
    });
    get().loadSolveHistory();
    get().loadNewScramble();
  },

  newSession: () => {
    const s = get();
    s.saveSolveHistory();
    const newId = String(Date.now());
    const name = `Session ${s.sessions.length + 1}`;
    const newSessions = [...s.sessions, { id: newId, name }];
    localStorage.setItem(LS_PREFIX + 'sessions', JSON.stringify(newSessions));
    localStorage.setItem(LS_PREFIX + 'sessionId', newId);
    const newPlayers: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];
    set({
      sessions: newSessions,
      sessionId: newId,
      winner: -2,
      players: newPlayers,
    });
    get().loadNewScramble();
  },

  renameSession: () => {
    const s = get();
    const current = s.sessions.find(ses => ses.id === s.sessionId);
    if (!current) return;
    const newName = prompt('Session name:', current.name);
    if (newName === null || newName.trim() === '') return;
    const newSessions = s.sessions.map(ses =>
      ses.id === s.sessionId ? { ...ses, name: newName.trim() } : ses
    );
    localStorage.setItem(LS_PREFIX + 'sessions', JSON.stringify(newSessions));
    set({ sessions: newSessions });
  },

  deleteSession: () => {
    const s = get();
    if (s.sessions.length <= 1) return;
    if (!confirm('Delete this session and all its data?')) return;
    // NOTE: 删除当前 session 的所有 localStorage 数据（solo + 1v1）
    const soloPrefix = `${LS_PREFIX}solo_history_${s.sessionId}_`;
    const vsPrefix = `${LS_PREFIX}1v1_history_${s.sessionId}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(soloPrefix) || key.startsWith(vsPrefix))) {
        localStorage.removeItem(key);
      }
    }
    const newSessions = s.sessions.filter(ses => ses.id !== s.sessionId);
    localStorage.setItem(LS_PREFIX + 'sessions', JSON.stringify(newSessions));
    const newSessionId = newSessions[0].id;
    localStorage.setItem(LS_PREFIX + 'sessionId', newSessionId);
    const newPlayers: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];
    set({
      sessions: newSessions,
      sessionId: newSessionId,
      winner: -2,
      players: newPlayers,
    });
    get().loadSolveHistory();
  },

  // ===== 历史操作 =====
  undoDelete: () => {
    const s = get();
    if (s.undoStack.length === 0) return;
    const lastUndo = s.undoStack[s.undoStack.length - 1];
    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    const p = newPlayers[0];
    const newHistory = [...p.solveHistory];
    newHistory.splice(lastUndo.index, 0, lastUndo.entry);
    newPlayers[0] = { ...p, solveHistory: newHistory };
    set({
      players: newPlayers,
      undoStack: s.undoStack.slice(0, -1),
    });
    get().saveSolveHistory();
  },

  deleteHistoryItem: (index: number) => {
    const s = get();
    const p = s.players[0];
    if (index < 0 || index >= p.solveHistory.length) return;
    const entry = p.solveHistory[index];
    const newHistory = [...p.solveHistory];
    newHistory.splice(index, 1);
    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    newPlayers[0] = { ...p, solveHistory: newHistory };
    set({
      players: newPlayers,
      undoStack: [...s.undoStack, { index, entry }],
    });
    get().saveSolveHistory();
  },

  // NOTE: 1v1 删除某一轮 — 同时去掉双方在 index 处的 entry。
  //   只有最后一轮能精准撤销 points(中间轮次的胜负已固定,不重算历史)。
  deleteVsRound: (index: number) => {
    const s = get();
    if (s.mode !== '1v1') return;
    const h0 = s.players[0].solveHistory;
    const h1 = s.players[1].solveHistory;
    const total = Math.max(h0.length, h1.length);
    if (index < 0 || index >= total) return;

    const isLast = index === total - 1;
    let p0Points = s.players[0].points;
    let p1Points = s.players[1].points;

    // NOTE: 仅对最新一轮撤销 points
    if (isLast) {
      const e0 = h0[index];
      const e1 = h1[index];
      if (e0 && e1) {
        const tEff = (e: SolveEntry) =>
          e.penalty === 'dnf' ? Infinity : (e.penalty === '+2' ? e.time + 2000 : e.time);
        const t0 = tEff(e0);
        const t1 = tEff(e1);
        if (t0 === Infinity && t1 === Infinity) {
          // 双 DNF 没加过分,不动
        } else if (t0 < t1) {
          p0Points = Math.max(0, p0Points - 1);
        } else if (t1 < t0) {
          p1Points = Math.max(0, p1Points - 1);
        } else {
          p0Points = Math.max(0, p0Points - 1);
          p1Points = Math.max(0, p1Points - 1);
        }
      }
    }

    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    for (let i = 0; i < 2; i++) {
      const p = s.players[i];
      if (index < p.solveHistory.length) {
        const newH = [...p.solveHistory];
        newH.splice(index, 1);
        newPlayers[i] = { ...p, solveHistory: newH };
      }
    }
    newPlayers[0] = { ...newPlayers[0], points: p0Points };
    newPlayers[1] = { ...newPlayers[1], points: p1Points };

    set({
      players: newPlayers,
      // NOTE: 删除的是当前一轮 → 撤销当前 winner 显示
      winner: isLast ? -2 : s.winner,
    });
    get().saveSolveHistory();
  },

  // ===== 数据持久化（Solo + 1v1 共用） =====
  // NOTE: Solo  key = solo_history_{session}_{puzzleP0}
  //       1v1   key = 1v1_history_{session}_{puzzleI}_{i}（每人各自的 puzzle）
  saveSolveHistory: () => {
    const s = get();
    try {
      if (s.mode === 'solo') {
        const key = `${LS_PREFIX}solo_history_${s.sessionId}_${s.puzzleIds[0]}`;
        const h = s.players[0].solveHistory;
        const toSave = h.length > 1000 ? h.slice(-1000) : h;
        localStorage.setItem(key, JSON.stringify(toSave));
      } else {
        for (let i = 0; i < 2; i++) {
          const key = `${LS_PREFIX}1v1_history_${s.sessionId}_${s.puzzleIds[i]}_${i}`;
          const h = s.players[i].solveHistory;
          const toSave = h.length > 1000 ? h.slice(-1000) : h;
          localStorage.setItem(key, JSON.stringify(toSave));
        }
      }
    } catch (e) {
      console.warn('Failed to save solve history:', e);
    }
  },

  loadSolveHistory: () => {
    const s = get();
    try {
      if (s.mode === 'solo') {
        const key = `${LS_PREFIX}solo_history_${s.sessionId}_${s.puzzleIds[0]}`;
        const data = localStorage.getItem(key);
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[0] = { ...s.players[0], solveHistory: data ? JSON.parse(data) : [] };
        set({ players: newPlayers });
      } else {
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        for (let i = 0; i < 2; i++) {
          const key = `${LS_PREFIX}1v1_history_${s.sessionId}_${s.puzzleIds[i]}_${i}`;
          const data = localStorage.getItem(key);
          newPlayers[i] = { ...s.players[i], solveHistory: data ? JSON.parse(data) : [] };
        }
        set({ players: newPlayers });
      }
    } catch (e) {
      console.warn('Failed to load solve history:', e);
    }
  },

  // ===== WCA Inspection =====
  // 1:1 翻译自 battle.js startInspection()（行 1912~1968）
  startInspection: (playerId: number) => {
    const s = get();
    const p = s.players[playerId];
    const limit = s.inspectionTime;

    let voiced8 = false;
    let voiced12 = false;

    const timer = setInterval(() => {
      const curr = get();
      const cp = curr.players[playerId];
      if (!cp.isInspecting) {
        clearInterval(timer);
        return;
      }
      const elapsed = (performance.now() - cp.inspectionStart) / 1000;

      // NOTE: 语音提示（8s 和 12s 时）
      if (curr.voice && elapsed >= 8 && !voiced8) {
        voiced8 = true;
        speakAlert('8 seconds', curr.locale);
      }
      if (curr.voice && elapsed >= 12 && !voiced12) {
        voiced12 = true;
        speakAlert('12 seconds', curr.locale);
      }

      if (limit < 9999) {
        if (elapsed >= limit + 2) {
          // >limit+2s → 自动 DNF
          clearInterval(timer);
          const newPlayers = [...curr.players] as [PlayerState, PlayerState];
          newPlayers[playerId] = {
            ...cp,
            inspectionPenalty: 'dnf',
            isInspecting: false,
            inspectionTimer: null,
            isReady: false,
            canStart: false,
            isTiming: false,
            hasFinished: true,
            time: 0,
            penalty: PENALTY.DNF,
          };
          set({ players: newPlayers });
          get().checkBothFinished();
        } else if (elapsed >= limit) {
          // NOTE: +2 罚时标记（UI 组件读取 inspectionPenalty 来显示）
          const newPlayers = [...curr.players] as [PlayerState, PlayerState];
          newPlayers[playerId] = { ...cp, inspectionPenalty: '+2' };
          set({ players: newPlayers });
        }
        // NOTE: elapsed < limit 时的倒计时显示由 UI 组件处理
      }
    }, 100);

    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    newPlayers[playerId] = {
      ...p,
      isInspecting: true,
      inspectionStart: performance.now(),
      inspectionPenalty: null,
      inspectionTimer: timer,
    };
    set({ players: newPlayers });
  },

  // 1:1 翻译自 battle.js clearInspection()（行 1995~2003）
  clearInspection: (playerId: number) => {
    const s = get();
    const p = s.players[playerId];
    if (p.inspectionTimer) {
      clearInterval(p.inspectionTimer);
    }
    const newPlayers = [...s.players] as [PlayerState, PlayerState];
    newPlayers[playerId] = {
      ...p,
      isInspecting: false,
      inspectionTimer: null,
    };
    set({ players: newPlayers });
  },

  // NOTE: 里程碑检测 — 通过自定义事件通知 UI 组件
  // 1:1 翻译自 battle.js checkMilestone()（行 2719~2788）
  checkMilestone: () => {
    const s = get();
    const h = s.players[0].solveHistory;
    if (h.length === 0) return;

    const isZh = get().locale === 'zh';
    const lastEntry = h[h.length - 1];
    const effTime = getEffectiveTimeFromEntry(lastEntry);
    const messages: string[] = [];

    // NOTE: PB single 检测
    if (effTime !== Infinity) {
      let isPB = true;
      for (let i = 0; i < h.length - 1; i++) {
        if (getEffectiveTimeFromEntry(h[i]) <= effTime) { isPB = false; break; }
      }
      if (isPB) messages.push(isZh ? '🏆 新 PB!' : '🏆 New PB!');
    }

    // NOTE: PB ao5 检测
    if (h.length >= 5) {
      const ao5 = computeAo5(h);
      if (ao5 !== null && ao5 !== Infinity) {
        if (h.length === 5) {
          messages.push(isZh ? '🥇 新 PB Ao5!' : '🥇 New PB Ao5!');
        } else {
          let prevBest: number | null = null;
          for (let i = 5; i <= h.length - 1; i++) {
            const val = computeAo5(h.slice(0, i));
            if (val !== null && val !== Infinity) {
              if (prevBest === null || val < prevBest) prevBest = val;
            }
          }
          if (prevBest === null || ao5 < prevBest) {
            messages.push(isZh ? '🥇 新 PB Ao5!' : '🥇 New PB Ao5!');
          }
        }
      }
    }

    // NOTE: PB ao12 检测
    if (h.length >= 12) {
      const ao12 = computeAverage(h, 12);
      if (ao12 !== null && ao12 !== Infinity) {
        if (h.length === 12) {
          messages.push(isZh ? '🥇 新 PB Ao12!' : '🥇 New PB Ao12!');
        } else {
          let prevBest: number | null = null;
          for (let i = 12; i <= h.length - 1; i++) {
            const val = computeAverage(h.slice(0, i), 12);
            if (val !== null && val !== Infinity) {
              if (prevBest === null || val < prevBest) prevBest = val;
            }
          }
          if (prevBest === null || ao12 < prevBest) {
            messages.push(isZh ? '🥇 新 PB Ao12!' : '🥇 New PB Ao12!');
          }
        }
      }
    }

    // NOTE: 整数里程碑
    const count = h.length;
    if ([100, 200, 500, 1000, 2000, 5000, 10000].includes(count)) {
      messages.push(isZh ? `🎯 ${count} 次完成!` : `🎯 ${count} solves!`);
    }

    if (messages.length > 0) {
      // NOTE: 通过自定义事件通知 UI 组件（避免 store 直接操作 DOM）
      window.dispatchEvent(new CustomEvent('battle-milestone', { detail: messages.join(' ') }));
      // 触觉反馈
      if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
    }
  },

  // NOTE: 疲劳预警 — 1:1 翻译自 battle.js checkFatigue()（行 2812~2834）
  checkFatigue: () => {
    const s = get();
    const h = s.players[0].solveHistory;
    if (h.length < 15) return;

    const times = h.slice(-10).map(getEffectiveTimeFromEntry).filter(t => t !== Infinity);
    if (times.length < 8) return;

    let rising = 0;
    for (let i = 0; i <= times.length - 5; i++) {
      const avg = (times[i] + times[i + 1] + times[i + 2] + times[i + 3] + times[i + 4]) / 5;
      if (i > 0) {
        const prevAvg = (times[i - 1] + times[i] + times[i + 1] + times[i + 2] + times[i + 3]) / 5;
        if (avg > prevAvg) rising++;
      }
    }

    if (rising >= 4) {
      const locale = s.locale;
      const msg = locale === 'zh' ? '建议休息一下 🍵' : 'Take a break? 🍵';
      window.dispatchEvent(new CustomEvent('battle-milestone', { detail: msg }));
    }
  },
}));
