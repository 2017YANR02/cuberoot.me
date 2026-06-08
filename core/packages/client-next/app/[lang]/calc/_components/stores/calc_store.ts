// NOTE: Calc 模块集中状态管理 — 合并 state.js + url_sync.js
// 使用 Zustand 替代手动观察者模式，React 组件自动响应状态变更

import { create } from 'zustand';
import {
  DNF_VALUE, UNFINISHED_VALUE,
  getAverage, getSortedIndices, getBestSingle,
  setMoveCntMode, setMbfMode,
} from '../engine/calc_engine';

// NOTE: re-export 供其他模块统一从 calc_store 导入
export { DNF_VALUE };

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

// ── Store 类型 ──

export interface CalcState {
  // ── 数据 ──
  times: number[][];         // [seedOn..seedOn+maxPlayers][0..solveCount-1]
  names: string[];           // 选手名称
  event: string;             // 当前项目 ID
  seedOn: number;            // 当前 seed 偏移量
  timeLive: [number, number];// 秒表激活的 [player, solve]
  timeLiveStart: number;     // 秒表开始时间戳
  sortedCache: number[];     // 按平均值排序的选手索引
  playerEnabled: boolean[];  // 选手启用状态
  targetAvgs: Record<number, number>; // 每个 seed 的目标平均值
  // NOTE: 用户当前聚焦的输入格 [playerIdx, solveIdx]，[-1,-1] 表示无聚焦
  // InputGrid focus 事件写入，Numpad/Drum 读取
  focusedCell: [number, number];

  // ── 派生查询 ──
  solveCount: () => number;
  isMo3: () => boolean;
  isMbf: () => boolean;

  // ── Actions ──
  updateTime: (playerIdx: number, solveIdx: number, value: number) => void;
  updateSort: () => void;
  setEvent: (id: string) => void;
  setNames: (idx: number, name: string) => void;
  togglePlayer: (p: number) => void;
  setSeedOn: (seed: number) => void;
  addSeedPair: () => void;
  resetAll: () => void;
  resizeTimes: (newLen: number) => void;
  setTimeLive: (player: number, solve: number) => void;
  setTimeLiveStart: (ts: number) => void;
  getTargetAvg: (seedIdx: number) => number;
  setTargetAvg: (seedIdx: number, val: number) => void;
  clearTargetAvgs: () => void;

  // ── URL Sync ──
  saveToUrl: () => void;
  loadFromUrl: () => void;

  // ── 查询辅助 ──
  areTimesFullyFilled: () => boolean;
  getFirstUnfilledTime: (countLiveTime: boolean) => [number, number];
  getRankOf: (p: number) => number;
  getValidsCount: () => number;
  setFocusedCell: (p: number, t: number) => void;
}

// NOTE: URL 数据同步 debounce
let urlDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const URL_DEBOUNCE_MS = 500;

export const useCalcStore = create<CalcState>((set, get) => ({
  // ── 初始数据 ──
  times: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
  names: ['Name A', 'Name B'],
  event: '333',
  seedOn: 0,
  timeLive: [-1, -1],
  timeLiveStart: -1,
  sortedCache: [],
  focusedCell: [-1, -1] as [number, number],
  playerEnabled: [true, false],
  targetAvgs: {},

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
      // NOTE: 不允许两行都不选 — 至少保留一个（原版 input_grid.js#403-409）
      const enabledCount = newEnabled.filter(v => v).length;
      if (newEnabled[p] && enabledCount <= 1) return s; // 还原勾选
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
      seedOn: 0,
      timeLive: [-1, -1],
      timeLiveStart: -1,
      targetAvgs: {},
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

  getTargetAvg: (seedIdx) => get().targetAvgs[seedIdx] || 0,
  setTargetAvg: (seedIdx, val) => {
    set(s => ({ targetAvgs: { ...s.targetAvgs, [seedIdx]: val } }));
  },
  clearTargetAvgs: () => set({ targetAvgs: {} }),

  // ── URL Sync ──

  saveToUrl: () => {
    if (urlDebounceTimer) clearTimeout(urlDebounceTimer);
    urlDebounceTimer = setTimeout(() => {
      const s = get();
      const params = new URLSearchParams();
      // NOTE: 保留现有的 lang 参数 + nuqs 管理的 ?tab=(本 store 重建整个 query,不保留会被清掉)
      const cur = new URLSearchParams(window.location.search);
      const curLang = cur.get('lang');
      if (curLang) params.set('lang', curLang);
      const curTab = cur.get('tab');
      if (curTab) params.set('tab', curTab);
      if (s.event) params.set('event', s.event);

      // NOTE: 保存 Target Avg（centiseconds），替代原来的 n0/n1 名字
      for (let i = 0; i < 2; i++) {
        const ta = s.targetAvgs[s.seedOn + i];
        if (ta && ta > 0) {
          params.set('target' + i, String(ta));
        }
      }
      // NOTE: 只保存 solveCount 个值，避免尾部多余的 0
      const sc = solveCountForEvent(s.event);
      for (let i = 0; i < s.times.length; i++) {
        const t = s.times[i].slice(0, sc);
        if (t.some(v => v > 0)) {
          params.set('t' + i, t.join(','));
        }
      }
      // 豁免:zustand store(无法用 React hook)+ t0/t1.. 动态键的成绩数据序列化,不适合 nuqs 固定 schema;
      // 改 nuqs 会变 URL 格式破坏已分享链接。data-blob 例外(见 CLAUDE.md「URL 状态 / 后退导航」)。
      // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
      history.replaceState(null, '', '?' + params.toString());
    }, URL_DEBOUNCE_MS);
  },

  loadFromUrl: () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('event') && !params.has('t0')) return;

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

    set({ event, times });

    // NOTE: 恢复 Target Avg（centiseconds）
    const seedOn = get().seedOn;
    const newTargetAvgs = { ...get().targetAvgs };
    for (let i = 0; i < 2; i++) {
      if (params.has('target' + i)) {
        const ta = parseInt(params.get('target' + i)!, 10);
        if (ta > 0) newTargetAvgs[seedOn + i] = ta;
      }
    }
    set({ targetAvgs: newTargetAvgs });

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

  setFocusedCell: (p: number, t: number) => set({ focusedCell: [p, t] as [number, number] }),
}));

// NOTE: 初始化排序
useCalcStore.getState().updateSort();

// NOTE: dev 模式暴露到 window 给 playwright 自动化测试用（tests/calc-interactions.ts）
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (globalThis as unknown as { __calcStore?: typeof useCalcStore }).__calcStore = useCalcStore;
}
