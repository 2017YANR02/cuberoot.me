// NOTE: Calc 模块集中状态管理 — 合并 state.js + url_sync.js
// 使用 Zustand 替代手动观察者模式，React 组件自动响应状态变更

import { create } from 'zustand';
import {
  DNF_VALUE, UNFINISHED_VALUE,
  getAverage, getSortedIndices, getBestSingle,
  setMoveCntMode, setMbfMode,
} from '../engine/calc_engine';

// ── 常量 ──

// NOTE: Mo3 项目 — 一轮 3 把，算术均值（不去掉任何成绩）
const MO3_EVENTS = new Set(['666', '777', '444bf', '555bf', '333fm', '333mbf', '333mbo']);

/** 根据当前项目返回每轮成绩数 */
export function solveCountForEvent(event: string): number {
  return MO3_EVENTS.has(event) ? 3 : 5;
}

/** 是否为 Mo3 项目 */
export function isMo3ForEvent(event: string): boolean {
  return MO3_EVENTS.has(event);
}

/** 是否为多盲/旧多盲项目 */
export function isMbfForEvent(event: string): boolean {
  return event === '333mbf' || event === '333mbo';
}

// NOTE: 根据 URL ?lang= 参数决定默认标题语言
const DEFAULT_TITLES = new Set(['Result Calculator', '成绩计算器']);

function getDefaultCompName(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('lang') === 'zh' ? '成绩计算器' : 'Result Calculator';
}

// ── Store 类型 ──

export interface CalcState {
  // ── 数据 ──
  times: number[][];         // [seedOn..seedOn+maxPlayers][0..solveCount-1]
  names: string[];           // 选手名称
  compName: string;          // 比赛名称
  event: string;             // 当前项目 ID
  seedOn: number;            // 当前 seed 偏移量
  timeLive: [number, number];// 秒表激活的 [player, solve]
  timeLiveStart: number;     // 秒表开始时间戳
  sortedCache: number[];     // 按平均值排序的选手索引
  playerEnabled: boolean[];  // 选手启用状态

  // ── 派生查询 ──
  solveCount: () => number;
  isMo3: () => boolean;
  isMbf: () => boolean;

  // ── Actions ──
  updateTime: (playerIdx: number, solveIdx: number, value: number) => void;
  updateSort: () => void;
  setEvent: (id: string) => void;
  setCompName: (name: string) => void;
  setNames: (idx: number, name: string) => void;
  togglePlayer: (p: number) => void;
  setSeedOn: (seed: number) => void;
  addSeedPair: () => void;
  resetAll: () => void;
  resizeTimes: (newLen: number) => void;
  setTimeLive: (player: number, solve: number) => void;
  setTimeLiveStart: (ts: number) => void;

  // ── URL Sync ──
  saveToUrl: () => void;
  loadFromUrl: () => void;

  // ── 查询辅助 ──
  areTimesFullyFilled: () => boolean;
  getFirstUnfilledTime: (countLiveTime: boolean) => [number, number];
  getRankOf: (p: number) => number;
  getValidsCount: () => number;
}

// NOTE: URL 数据同步 debounce
let urlDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const URL_DEBOUNCE_MS = 500;

export const useCalcStore = create<CalcState>((set, get) => ({
  // ── 初始数据 ──
  times: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
  names: ['Name A', 'Name B'],
  compName: getDefaultCompName(),
  event: '333',
  seedOn: 0,
  timeLive: [-1, -1],
  timeLiveStart: -1,
  sortedCache: [],
  playerEnabled: [true, false],

  // ── 派生查询 ──
  solveCount: () => solveCountForEvent(get().event),
  isMo3: () => isMo3ForEvent(get().event),
  isMbf: () => isMbfForEvent(get().event),

  // ── Actions ──

  updateTime: (playerIdx, solveIdx, value) => {
    set(s => {
      const newTimes = s.times.map(row => [...row]);
      newTimes[playerIdx][solveIdx] = value;
      return { times: newTimes };
    });
    get().updateSort();
  },

  updateSort: () => {
    const s = get();
    // NOTE: 每次排序前同步计算引擎的项目模式标志
    setMoveCntMode(s.event === '333fm');
    setMbfMode(s.event === '333mbf' || s.event === '333mbo');

    const desc = isMbfForEvent(s.event);
    const avgs = s.times.map(t => getAverage(t, false));
    const singles = s.times.map(t => getBestSingle(t, desc));
    const sortedCache = getSortedIndices(avgs, singles, desc);
    set({ sortedCache });
  },

  setEvent: (id) => set({ event: id }),
  setCompName: (name) => set({ compName: name }),
  setNames: (idx, name) => {
    set(s => {
      const newNames = [...s.names];
      newNames[idx] = name;
      return { names: newNames };
    });
  },

  togglePlayer: (p) => {
    set(s => {
      const newEnabled = [...s.playerEnabled];
      newEnabled[p] = !newEnabled[p];
      return { playerEnabled: newEnabled };
    });
  },

  setSeedOn: (seed) => set({ seedOn: seed }),

  addSeedPair: () => {
    set(s => {
      const idx = s.names.length;
      const newNames = [
        ...s.names,
        'Name ' + String.fromCharCode(65 + idx),
        'Name ' + String.fromCharCode(66 + idx),
      ];
      const sc = solveCountForEvent(s.event);
      const newTimes = [...s.times, new Array(sc).fill(0), new Array(sc).fill(0)];
      return { names: newNames, times: newTimes };
    });
    get().updateSort();
  },

  resetAll: () => {
    const sc = solveCountForEvent(get().event);
    set({
      times: [new Array(sc).fill(0) as number[], new Array(sc).fill(0) as number[]],
      names: ['Name A', 'Name B'],
      compName: getDefaultCompName(),
      seedOn: 0,
      timeLive: [-1, -1],
      timeLiveStart: -1,
    });
    get().updateSort();
  },

  resizeTimes: (newLen) => {
    set(s => {
      const newTimes = s.times.map(arr => {
        if (arr.length < newLen) {
          return [...arr, ...new Array(newLen - arr.length).fill(0)];
        } else if (arr.length > newLen) {
          return arr.slice(0, newLen);
        }
        return [...arr];
      });
      return { times: newTimes };
    });
    get().updateSort();
  },

  setTimeLive: (player, solve) => set({ timeLive: [player, solve] }),
  setTimeLiveStart: (ts) => set({ timeLiveStart: ts }),

  // ── URL Sync ──

  saveToUrl: () => {
    if (urlDebounceTimer) clearTimeout(urlDebounceTimer);
    urlDebounceTimer = setTimeout(() => {
      const s = get();
      const params = new URLSearchParams();
      // NOTE: 保留现有的 lang 参数
      const curLang = new URLSearchParams(window.location.search).get('lang');
      if (curLang) params.set('lang', curLang);
      params.set('comp', s.compName);
      if (s.event) params.set('event', s.event);

      for (let i = 0; i < s.names.length; i++) {
        params.set('n' + i, s.names[i]);
      }
      // NOTE: 只保存 solveCount 个值，避免尾部多余的 0
      const sc = solveCountForEvent(s.event);
      for (let i = 0; i < s.times.length; i++) {
        const t = s.times[i].slice(0, sc);
        if (t.some(v => v > 0)) {
          params.set('t' + i, t.join(','));
        }
      }
      history.replaceState(null, '', '?' + params.toString());
    }, URL_DEBOUNCE_MS);
  },

  loadFromUrl: () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('comp') && !params.has('t0')) return;

    // NOTE: 如果 URL 的 comp 是默认标题，用当前语言的默认值替换
    let compName = get().compName;
    if (params.has('comp')) {
      const comp = params.get('comp')!;
      compName = DEFAULT_TITLES.has(comp) ? getDefaultCompName() : comp;
    }

    // 恢复名字
    const names = [...get().names];
    let i = 0;
    while (params.has('n' + i)) {
      if (i >= names.length) names.push('Name ' + String.fromCharCode(65 + i));
      names[i] = params.get('n' + i)!;
      i++;
    }

    // 恢复事件
    let event = get().event;
    if (params.has('event')) event = params.get('event')!;

    // 恢复成绩
    const times = [...get().times.map(row => [...row])];
    let j = 0;
    while (params.has('t' + j)) {
      const parts = params.get('t' + j)!.split(',').map(Number);
      if (j >= times.length) times.push([0, 0, 0, 0, 0]);
      for (let k = 0; k < 5 && k < parts.length; k++) {
        times[j][k] = parts[k] || 0;
      }
      j++;
    }

    set({ compName, names, event, times });
    // NOTE: Mo3 项目 times 数组必须截断为 3 元素
    get().resizeTimes(solveCountForEvent(event));
  },

  // ── 查询辅助 ──

  areTimesFullyFilled: () => {
    const s = get();
    const sc = solveCountForEvent(s.event);
    for (let p = 0; p < 2; p++) {
      for (let t = 0; t < sc; t++) {
        const val = s.times[s.seedOn + p][t];
        if (val === 0 || val === UNFINISHED_VALUE) return false;
      }
    }
    return true;
  },

  getFirstUnfilledTime: (countLiveTime) => {
    const s = get();
    const sc = solveCountForEvent(s.event);
    for (let t = 0; t < sc; t++) {
      for (let p = 0; p < 2; p++) {
        if (!s.playerEnabled[p]) continue;
        const isFilled = s.times[s.seedOn + p][t] !== 0;
        const isLive = countLiveTime && s.timeLive[0] === p && s.timeLive[1] === t;
        if (!isFilled || isLive) {
          return [p, t];
        }
      }
    }
    return [-1, -1];
  },

  getRankOf: (p) => {
    const s = get();
    for (let rank = 0; rank < s.sortedCache.length; rank++) {
      if (s.sortedCache[rank] === p) return rank;
    }
    return -1;
  },

  getValidsCount: () => {
    const s = get();
    const sc = solveCountForEvent(s.event);
    let count = 0;
    for (let i = 0; i < s.times.length; i++) {
      let allFilled = true;
      for (let t = 0; t < sc; t++) {
        if (s.times[i][t] === 0 || s.times[i][t] === UNFINISHED_VALUE) {
          allFilled = false;
          break;
        }
      }
      if (allFilled) count++;
    }
    return count;
  },
}));

// NOTE: 初始化排序
useCalcStore.getState().updateSort();
