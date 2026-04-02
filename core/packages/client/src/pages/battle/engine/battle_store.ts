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
import { getEffectiveTimeFromEntry, computeAo5, computeAverage } from './stats';

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
  // 当前项目 ID
  puzzleId: string;
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
  // NOTE: 背景不透明度（0.1~1.0）
  bgOpacity: number;
  // NOTE: 计时器精确度（小数位数：0=秒, 1=0.1s, 2=0.01s, 3=0.001s）
  timerPrecision: number;
  // NOTE: 启动延时（ms），按住多久后才能开始计时
  startDelay: number;
  // NOTE: 用户选择显示的 Average 类型
  enabledAverages: number[];
  // NOTE: 目标 Ao5 时间（秒，用于进度条显示）
  goalTime: number;
  // 当前打乱
  scramble: string | null;
  // 当前打乱图 data URL
  scrambleImageUrl: string | null;
  // 是否正在加载打乱
  scrambleLoading: boolean;
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
  // NOTE: 打乱相关
  loadNewScramble: () => void;
  // NOTE: 状态机核心
  playerDown: (playerId: number) => boolean;
  playerUp: (playerId: number) => void;
  // NOTE: 罚时处理
  handlePenalty: (playerId: number, penaltyType: PenaltyType) => void;
  // NOTE: 设置操作
  deleteLast: () => void;
  toggleShowTime: () => void;
  resetAll: () => void;
  changePuzzle: (puzzleId: string) => void;
  setMode: (mode: BattleMode) => void;
  setLayout: (layout: BattleLayout) => void;
  setInspectionTime: (time: number) => void;
  setVoice: (voice: boolean) => void;
  setPhases: (phases: number) => void;
  setShowImage: (show: boolean) => void;
  setScrambleScale: (scale: number) => void;
  setBgOpacity: (opacity: number) => void;
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
  puzzleId: localStorage.getItem(LS_PREFIX + 'puzzle') || '333',
  showTime: localStorage.getItem(LS_PREFIX + 'showTime') !== 'false',
  showImage: localStorage.getItem(LS_PREFIX + 'showImage') !== 'false',
  inspectionTime: parseInt(localStorage.getItem(LS_PREFIX + 'inspectionTime') || '0') || 0,
  voice: localStorage.getItem(LS_PREFIX + 'voice') !== 'false',
  phases: parseInt(localStorage.getItem(LS_PREFIX + 'phases') || '1') || 1,
  scrambleScale: parseFloat(localStorage.getItem(LS_PREFIX + 'scrambleScale') || '1.0') || 1.0,
  bgOpacity: parseFloat(localStorage.getItem(LS_PREFIX + 'bgOpacity') || '1.0') || 1.0,
  timerPrecision: (() => { const v = localStorage.getItem(LS_PREFIX + 'timerPrecision'); return v !== null ? parseInt(v) : 3; })(),
  startDelay: (() => { const v = localStorage.getItem(LS_PREFIX + 'startDelay'); return v !== null ? parseInt(v) : 300; })(),
  enabledAverages: JSON.parse(localStorage.getItem(LS_PREFIX + 'enabledAverages') || '[5, 12]'),
  goalTime: parseFloat(localStorage.getItem(LS_PREFIX + 'goalTime') || '0') || 0,
  scramble: null,
  scrambleImageUrl: null,
  scrambleLoading: false,
  winner: -2,
  readyTimer: null,
  players: [createPlayer(0), createPlayer(1)],
  undoStack: [],
  sessionId: localStorage.getItem(LS_PREFIX + 'sessionId') || '1',
  sessions: JSON.parse(localStorage.getItem(LS_PREFIX + 'sessions') || '[{"id":"1","name":"Session 1"}]'),
  locale: new URLSearchParams(window.location.search).get('lang') || 'en',
  activeTab: 'timer',

  // ===== init =====
  init: () => {
    const s = get();
    s.loadSolveHistory();
    s.loadNewScramble();
  },

  // ===== 打乱生成 =====
  // 1:1 翻译自 battle.js loadNewScramble()（行 484~502）
  loadNewScramble: () => {
    set({ scramble: null, scrambleLoading: true, scrambleImageUrl: null });

    const s = get();
    const scrambleText = generateScramble(s.puzzleId);
    let imgUrl: string | null = null;
    if (s.showImage && scrambleText && !scrambleText.startsWith('⚠️')) {
      imgUrl = generateScrambleImageUrl(s.puzzleId, scrambleText);
    }

    set({
      scramble: scrambleText,
      scrambleLoading: false,
      scrambleImageUrl: imgUrl,
    });
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
          const numPhases = isBLD(s.puzzleId) ? 2 : s.phases;
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
      if (!p.hasFinished && !p.canStart && s.scramble) {
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
    } else if (!ps.hasFinished && !ps.canStart && get().scramble) {
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
          scramble: s.scramble || '',
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
            scramble: s.scramble || '',
            date: new Date().toISOString(),
          }],
        };
      }
      set({ players: newPlayers });
      get().computeWinner();
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
    if (s.mode === 'solo') {
      s.saveSolveHistory();
    }
    s.loadNewScramble();
  },

  // 1:1 翻译自 battle.js changePuzzle()（行 1198~1236）
  changePuzzle: (newPuzzleId: string) => {
    const s = get();
    if (newPuzzleId === s.puzzleId) return;
    if (s.mode === 'solo') s.saveSolveHistory();
    localStorage.setItem(LS_PREFIX + 'puzzle', newPuzzleId);
    const newPlayers: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];
    set({
      puzzleId: newPuzzleId,
      winner: -2,
      players: newPlayers,
    });
    if (get().mode === 'solo') {
      get().loadSolveHistory();
    }
    get().loadNewScramble();
  },

  setMode: (mode: BattleMode) => {
    localStorage.setItem(LS_PREFIX + 'mode', mode);
    const newPlayers: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];
    set({
      mode,
      winner: -2,
      players: newPlayers,
      activeTab: 'timer',
    });
    if (mode === 'solo') {
      get().loadSolveHistory();
    }
  },

  setLayout: (layout: BattleLayout) => {
    localStorage.setItem(LS_PREFIX + 'layout', layout);
    const newPlayers: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];
    set({ layout, winner: -2, players: newPlayers });
    get().loadNewScramble();
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
    // NOTE: 切换后重新生成打乱图
    if (show) {
      const s = get();
      if (s.scramble && !s.scramble.startsWith('⚠️')) {
        const imgUrl = generateScrambleImageUrl(s.puzzleId, s.scramble);
        set({ scrambleImageUrl: imgUrl });
      }
    } else {
      set({ scrambleImageUrl: null });
    }
  },

  setScrambleScale: (scale: number) => {
    localStorage.setItem(LS_PREFIX + 'scrambleScale', String(scale));
    set({ scrambleScale: scale });
  },

  setBgOpacity: (opacity: number) => {
    localStorage.setItem(LS_PREFIX + 'bgOpacity', String(opacity));
    set({ bgOpacity: opacity });
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
    if (s.mode === 'solo') s.saveSolveHistory();
    localStorage.setItem(LS_PREFIX + 'sessionId', newSessionId);
    const newPlayers: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];
    set({
      sessionId: newSessionId,
      winner: -2,
      players: newPlayers,
    });
    if (get().mode === 'solo') {
      get().loadSolveHistory();
    }
    get().loadNewScramble();
  },

  newSession: () => {
    const s = get();
    if (s.mode === 'solo') s.saveSolveHistory();
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
    // NOTE: 删除当前 session 的所有 localStorage 数据
    const prefix = `${LS_PREFIX}solo_history_${s.sessionId}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
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
    if (get().mode === 'solo') {
      get().loadSolveHistory();
    }
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

  // ===== Solo 数据持久化 =====
  // 1:1 翻译自 battle.js saveSolveHistory()/loadSolveHistory()（行 2173~2198）
  saveSolveHistory: () => {
    const s = get();
    const key = `${LS_PREFIX}solo_history_${s.sessionId}_${s.puzzleId}`;
    const h = s.players[0].solveHistory;
    const toSave = h.length > 1000 ? h.slice(-1000) : h;
    try {
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save solve history:', e);
    }
  },

  loadSolveHistory: () => {
    const s = get();
    if (s.mode !== 'solo') return;
    const key = `${LS_PREFIX}solo_history_${s.sessionId}_${s.puzzleId}`;
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const newPlayers = [...s.players] as [PlayerState, PlayerState];
        newPlayers[0] = { ...s.players[0], solveHistory: JSON.parse(data) };
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

    const lastEntry = h[h.length - 1];
    const effTime = getEffectiveTimeFromEntry(lastEntry);
    const messages: string[] = [];

    // NOTE: PB single 检测
    if (effTime !== Infinity) {
      let isPB = true;
      for (let i = 0; i < h.length - 1; i++) {
        if (getEffectiveTimeFromEntry(h[i]) <= effTime) { isPB = false; break; }
      }
      if (isPB) messages.push('🏆 New PB!');
    }

    // NOTE: PB ao5 检测
    if (h.length >= 5) {
      const ao5 = computeAo5(h);
      if (ao5 !== null && ao5 !== Infinity) {
        if (h.length === 5) {
          messages.push('🥇 New PB Ao5!');
        } else {
          let prevBest: number | null = null;
          for (let i = 5; i <= h.length - 1; i++) {
            const val = computeAo5(h.slice(0, i));
            if (val !== null && val !== Infinity) {
              if (prevBest === null || val < prevBest) prevBest = val;
            }
          }
          if (prevBest === null || ao5 < prevBest) {
            messages.push('🥇 New PB Ao5!');
          }
        }
      }
    }

    // NOTE: PB ao12 检测
    if (h.length >= 12) {
      const ao12 = computeAverage(h, 12);
      if (ao12 !== null && ao12 !== Infinity) {
        if (h.length === 12) {
          messages.push('🥇 New PB Ao12!');
        } else {
          let prevBest: number | null = null;
          for (let i = 12; i <= h.length - 1; i++) {
            const val = computeAverage(h.slice(0, i), 12);
            if (val !== null && val !== Infinity) {
              if (prevBest === null || val < prevBest) prevBest = val;
            }
          }
          if (prevBest === null || ao12 < prevBest) {
            messages.push('🥇 New PB Ao12!');
          }
        }
      }
    }

    // NOTE: 整数里程碑
    const count = h.length;
    if ([100, 200, 500, 1000, 2000, 5000, 10000].includes(count)) {
      messages.push(`🎯 ${count} solves!`);
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
