/**
 * ZBLL 选中 cases store
 * 管理用户选中的 ZBLL key 列表
 */
import { create } from 'zustand';
import { allZbllKeys, type ZbllEntry } from '../utils/zbllHelpers';
import zbllMap from '@cuberoot/shared/data/zbll.json';

const LOCAL_STORAGE_KEY = 'zbll_selected_keys';

const loadKeys = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

interface ZbllSelectedState {
  keys: string[];

  // 计算属性
  commonScrambleLength: () => number;
  totalSelected: () => number;
  isSelected: (key: string) => boolean;
  numInCollSelected: (oll: string, coll: string) => number;
  numInOllSelected: (oll: string) => number;

  // 操作
  addOll: (oll: string) => void;
  removeOll: (oll: string) => void;
  addColl: (oll: string, coll: string) => void;
  removeColl: (oll: string, coll: string) => void;
  addZbll: (key: string) => void;
  removeZbll: (key: string) => void;
  applyFromPreset: (keysSet: Set<string>) => void;
}

const persist = (keys: string[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(keys));
};

export const useZbllSelectedStore = create<ZbllSelectedState>((set, get) => ({
  keys: loadKeys(),

  commonScrambleLength: () => {
    const { keys } = get();
    let result = 0;
    const map = zbllMap as Record<string, ZbllEntry>;
    keys.forEach((key) => {
      const entry = map[key];
      if (!entry) return;
      // NOTE: 取所有选中 case 中最短打乱长度的最大值，确保公平
      const minLength = parseInt(Object.keys(entry.scrambles)[0]);
      result = Math.max(result, minLength);
    });
    return result;
  },

  totalSelected: () => get().keys.length,

  isSelected: (key: string) => get().keys.includes(key),

  numInCollSelected: (oll: string, coll: string) =>
    get().keys.filter((k) => k.startsWith(`${oll} ${coll} `)).length,

  numInOllSelected: (oll: string) =>
    get().keys.filter((k) => k.startsWith(`${oll} `)).length,

  addOll: (oll: string) => {
    const newKeys = [
      ...get().keys,
      ...allZbllKeys.filter((k) => k.startsWith(`${oll} `)),
    ];
    persist(newKeys);
    set({ keys: newKeys });
  },

  removeOll: (oll: string) => {
    const newKeys = get().keys.filter((k) => !k.startsWith(`${oll} `));
    persist(newKeys);
    set({ keys: newKeys });
  },

  addColl: (oll: string, coll: string) => {
    const newKeys = [
      ...get().keys,
      ...allZbllKeys.filter((k) => k.startsWith(`${oll} ${coll} `)),
    ];
    persist(newKeys);
    set({ keys: newKeys });
  },

  removeColl: (oll: string, coll: string) => {
    const newKeys = get().keys.filter(
      (k) => !k.startsWith(`${oll} ${coll} `)
    );
    persist(newKeys);
    set({ keys: newKeys });
  },

  addZbll: (key: string) => {
    const newKeys = [...get().keys, key];
    persist(newKeys);
    set({ keys: newKeys });
  },

  removeZbll: (key: string) => {
    const newKeys = get().keys.filter((k) => k !== key);
    persist(newKeys);
    set({ keys: newKeys });
  },

  applyFromPreset: (keysSet: Set<string>) => {
    const newKeys = [...keysSet];
    persist(newKeys);
    set({ keys: newKeys });
  },
}));
