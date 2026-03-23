// NOTE: Viz 模块集中状态管理 — 取代原版 30+ 全局变量
// 使用 Zustand，React 组件自动响应状态变更
// 所有变量名和语义与原版 viz.js 保持一致

import { create } from 'zustand';
import type {
  PlayerData, DataMode, ViewMode, SyncMode, ShowLayers,
} from '../engine/data_fetch';
import {
  fetchPlayerData as fetchPlayerDataFn,
  buildChannelDataForPlayer,
  rawToVal,
  DEFAULT_SHOW_LAYERS,
  ROUND_KEYS,
  MAX_PLAYERS,
  KDE_POINTS,
} from '../engine/data_fetch';
import {
  computeKDE, mean, maxOfKDE,
} from '../engine/kde';
import {
  buildDateTimeline,
  computePlayerFrame,
  getWindowTimes,
} from '../engine/sync';

// ─── 常量 ───
const MARGIN = { top: 50, right: 40, bottom: 55, left: 65 };

// ─── Store 类型 ───

export interface VizState {
  // ── 选手数据 ──
  players: PlayerData[];
  activePlayerIdx: number;
  currentEventId: string;

  // ── 播放状态 ──
  currentFrame: number;
  maxFrame: number;
  isPlaying: boolean;
  playSpeed: number;
  animationId: number | null;
  driverIdx: number;   // NOTE: 帧驱动选手索引（channelData 最长者）

  // ── 模式 ──
  dataMode: DataMode;
  viewMode: ViewMode;
  syncMode: SyncMode;

  // ── 渲染参数 ──
  windowSize: number;
  xMin: number;
  xMax: number;
  minBandwidth: number;
  userXMin: number | null;
  userXMax: number | null;
  lineXStart: number | null;
  lineXEnd: number | null;
  globalMaxY: number;

  // ── 图层显隐 ──
  showLayers: ShowLayers;

  // ── 日期时间线 ──
  dateTimeline: string[];

  // ── 折线图 hover ──
  lineHoverX: number | null;
  lineHoverY: number | null;

  // ── Canvas 尺寸 ──
  cw: number;
  ch: number;

  // ── 统计面板 delta 历史 ──
  deltaHistory: number[];

  // ── Actions ──
  addPlayer: (wcaId: string, eventId: string) => Promise<boolean>;
  removePlayer: (idx: number) => void;
  setActivePlayer: (idx: number) => void;
  setDataMode: (mode: DataMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setSyncMode: (mode: SyncMode) => void;
  setFrame: (frame: number) => void;
  setPlaying: (v: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  setAnimationId: (id: number | null) => void;
  setShowLayer: (layer: keyof ShowLayers, value: boolean) => void;
  setUserZoom: (xMin: number | null, xMax: number | null) => void;
  setLineXRange: (start: number | null, end: number | null) => void;
  resetZoom: () => void;
  setLineHover: (x: number | null, y: number | null) => void;
  setCanvasSize: (w: number, h: number) => void;
  pushDeltaHistory: (val: number) => void;
  clearDeltaHistory: () => void;
  reloadAllPlayers: (eventId: string) => Promise<void>;
  rebuildAllChannels: () => void;
  setCurrentEventId: (eventId: string) => void;
}

export const useVizStore = create<VizState>((set, get) => ({
  // ── 初始状态 ──
  players: [],
  activePlayerIdx: 0,
  currentEventId: '333',

  currentFrame: 0,
  maxFrame: 0,
  isPlaying: false,
  playSpeed: 3,
  animationId: null,
  driverIdx: 0,

  dataMode: 'singles',
  viewMode: 'histogram',
  syncMode: 'solve',

  windowSize: 100,
  xMin: 2.5,
  xMax: 9.5,
  minBandwidth: 0,
  userXMin: null,
  userXMax: null,
  lineXStart: null,
  lineXEnd: null,
  globalMaxY: 0,

  showLayers: { ...DEFAULT_SHOW_LAYERS },
  dateTimeline: [],

  lineHoverX: null,
  lineHoverY: null,

  cw: 0,
  ch: 0,

  deltaHistory: [],

  // ── Actions ──

  setCurrentEventId: (eventId: string) => set({ currentEventId: eventId }),

  /**
   * NOTE: 添加一位选手到对比列表
   * 1:1 翻译自 viz.js addPlayer()
   */
  addPlayer: async (wcaId: string, eventId: string): Promise<boolean> => {
    const s = get();
    // 防重复
    if (s.players.find(p => p.wcaId === wcaId)) return false;
    if (s.players.length >= MAX_PLAYERS) {
      alert('最多同时对比 ' + MAX_PLAYERS + ' 位选手');
      return false;
    }

    try {
      const playerData = await fetchPlayerDataFn(wcaId, eventId);
      if (!playerData) return false;

      playerData.colorIdx = s.players.length;
      const newPlayers = [...s.players, playerData];

      set({
        players: newPlayers,
        activePlayerIdx: newPlayers.length - 1,
        currentEventId: eventId,
      });

      // 重建通道 + 参数
      get().rebuildAllChannels();
      return true;
    } catch (e) {
      console.error('addPlayer failed:', e);
      return false;
    }
  },

  /**
   * NOTE: 移除一位选手（1:1 翻译自 viz.js removePlayer）
   */
  removePlayer: (idx: number) => {
    const s = get();
    if (idx < 0 || idx >= s.players.length) return;

    const newPlayers = [...s.players];
    newPlayers.splice(idx, 1);
    // 重新分配颜色索引
    newPlayers.forEach((p, i) => { p.colorIdx = i; });

    const newActiveIdx = s.activePlayerIdx >= newPlayers.length
      ? Math.max(0, newPlayers.length - 1)
      : s.activePlayerIdx;

    set({
      players: newPlayers,
      activePlayerIdx: newActiveIdx,
      isPlaying: false,
    });

    if (newPlayers.length > 0) {
      get().rebuildAllChannels();
    }
  },

  setActivePlayer: (idx: number) => set({ activePlayerIdx: idx }),

  /**
   * NOTE: 切换数据模式 — 重建通道
   */
  setDataMode: (mode: DataMode) => {
    const s = get();
    if (mode === s.dataMode) return;
    set({ dataMode: mode, isPlaying: false });
    get().rebuildAllChannels();
  },

  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  setSyncMode: (mode: SyncMode) => set({ syncMode: mode }),
  setFrame: (frame: number) => set({ currentFrame: frame }),
  setPlaying: (v: boolean) => set({ isPlaying: v }),
  setPlaySpeed: (speed: number) => set({ playSpeed: speed }),
  setAnimationId: (id: number | null) => set({ animationId: id }),

  setShowLayer: (layer: keyof ShowLayers, value: boolean) => {
    set(s => ({
      showLayers: { ...s.showLayers, [layer]: value },
    }));
  },

  setUserZoom: (xMin: number | null, xMax: number | null) => {
    set({ userXMin: xMin, userXMax: xMax });
  },

  setLineXRange: (start: number | null, end: number | null) => {
    set({ lineXStart: start, lineXEnd: end });
  },

  resetZoom: () => {
    set({ userXMin: null, userXMax: null, lineXStart: null, lineXEnd: null });
  },

  setLineHover: (x: number | null, y: number | null) => {
    set({ lineHoverX: x, lineHoverY: y });
  },

  setCanvasSize: (w: number, h: number) => {
    set({ cw: w, ch: h });
  },

  pushDeltaHistory: (val: number) => {
    set(s => {
      const hist = [...s.deltaHistory, val];
      return { deltaHistory: hist };
    });
  },

  clearDeltaHistory: () => set({ deltaHistory: [] }),

  /**
   * NOTE: 切换项目时重新加载所有选手
   * 1:1 翻译自 viz.js reloadAllPlayers()
   */
  reloadAllPlayers: async (eventId: string) => {
    const s = get();
    const wcaIds = s.players.map(p => p.wcaId);

    set({ players: [], isPlaying: false, currentEventId: eventId });

    const newPlayers: PlayerData[] = [];
    for (const id of wcaIds) {
      const data = await fetchPlayerDataFn(id, eventId);
      if (data) {
        data.colorIdx = newPlayers.length;
        newPlayers.push(data);
      }
    }

    set({ players: newPlayers, activePlayerIdx: 0 });
    get().rebuildAllChannels();
  },

  /**
   * NOTE: 重建所有选手的 channelData + 日期时间线 + 重算参数
   * 1:1 翻译自 viz.js rebuildAllChannels() + recalcModeParams()
   */
  rebuildAllChannels: () => {
    const s = get();
    const dm = s.dataMode || 'singles';
    const eventId = s.currentEventId;

    // 重建 channelData
    for (const p of s.players) {
      buildChannelDataForPlayer(p, dm);
    }

    // 重建日期时间线
    const dt = buildDateTimeline(s.players);

    // ─── recalcModeParams() ───
    const vals: number[] = [];
    for (const p of s.players) {
      for (const d of p.channelData) {
        const v = rawToVal(d[0], eventId);
        if (v > 0) vals.push(v);
      }
    }
    if (vals.length === 0) {
      set({ dateTimeline: dt });
      return;
    }
    vals.sort((a, b) => a - b);
    const lo = vals[0] || 0;
    const p97Idx = Math.min(Math.floor(vals.length * 0.97), vals.length - 1);
    const hi = vals[p97Idx] || lo + 1;
    const margin = Math.max(0.5, (hi - lo) * 0.15);
    let newXMin = Math.floor((lo - margin) * 2) / 2;
    const newXMax = Math.ceil((hi + margin) * 2) / 2;
    if (newXMin < 0) newXMin = 0;

    let ws: number;
    let mb: number;
    if (dm === 'singles') {
      ws = 100;
      mb = 0;
    } else if (ROUND_KEYS[dm]) {
      // NOTE: Round Metrics 数据点稀疏（~200 点），窗口调小
      ws = 50;
      mb = Math.max(0.15, (hi - lo) * 0.03);
    } else {
      ws = 400;
      mb = Math.max(0.15, (hi - lo) * 0.03);
    }

    // NOTE: 自动选择 channelData 最长的选手作为帧驱动者
    let newDriverIdx = 0;
    let maxLen = 0;
    for (let i = 0; i < s.players.length; i++) {
      if (s.players[i].channelData.length > maxLen) {
        maxLen = s.players[i].channelData.length;
        newDriverIdx = i;
      }
    }

    const newMaxFrame = Math.max(0, maxLen - ws);
    // NOTE: 默认显示最新成绩（拉到末尾）
    const newCurrentFrame = newMaxFrame;

    // 为每位选手预计算 ghostKDE + ghostMean
    let newGlobalMaxY = 0;
    for (let pi = 0; pi < s.players.length; pi++) {
      const p = s.players[pi];
      const initTimes = getWindowTimes(pi, 0, s.players, ws, eventId, rawToVal);
      const pMax = Math.max(0, p.channelData.length - ws);
      const finalTimes = getWindowTimes(pi, pMax, s.players, ws, eventId, rawToVal);
      p.ghostKDE = computeKDE(initTimes, newXMin, newXMax, KDE_POINTS, mb);
      p.ghostMean = initTimes.length > 0 ? mean(initTimes) : 0;
      const finalKDE = computeKDE(finalTimes, newXMin, newXMax, KDE_POINTS, mb);
      const localMax = Math.max(maxOfKDE(p.ghostKDE), maxOfKDE(finalKDE));
      if (localMax > newGlobalMaxY) newGlobalMaxY = localMax;
    }
    newGlobalMaxY *= 1.2;

    set({
      xMin: newXMin,
      xMax: newXMax,
      windowSize: ws,
      minBandwidth: mb,
      driverIdx: newDriverIdx,
      maxFrame: newMaxFrame,
      currentFrame: newCurrentFrame,
      globalMaxY: newGlobalMaxY,
      dateTimeline: dt,
      // NOTE: 切换模式时重置用户缩放
      userXMin: null,
      userXMax: null,
      lineXStart: null,
      lineXEnd: null,
      deltaHistory: [],
    });
  },
}));

// ── 导出常量供组件使用 ──
export { MARGIN };
