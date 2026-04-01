/**
 * ZBLS 选中 cases store
 * 两级选中管理：F2L 组级 + 单个 case 级
 */
import { create } from 'zustand';
import { allZblsKeys, ZBLS_BY_GROUP } from '../utils/zbls_helpers';

const LOCAL_STORAGE_KEY = 'zbls_selected_keys';

const loadKeys = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const persist = (keys: string[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(keys));
};

interface ZblsSelectedState {
  keys: string[];

  // 计算
  totalSelected: () => number;
  isSelected: (key: string) => boolean;
  numInGroupSelected: (groupNum: number) => number;

  // 操作
  addCase: (key: string) => void;
  removeCase: (key: string) => void;
  addF2lGroup: (groupNum: number) => void;
  removeF2lGroup: (groupNum: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  applyFromPreset: (keysSet: Set<string>) => void;
}

export const useZblsSelectedStore = create<ZblsSelectedState>((set, get) => ({
  keys: loadKeys(),

  totalSelected: () => get().keys.length,

  isSelected: (key: string) => get().keys.includes(key),

  numInGroupSelected: (groupNum: number) => {
    const groupKeys = ZBLS_BY_GROUP[groupNum] || [];
    const selectedSet = new Set(get().keys);
    return groupKeys.filter((k) => selectedSet.has(k)).length;
  },

  addCase: (key: string) => {
    const cur = get().keys;
    if (cur.includes(key)) return;
    const newKeys = [...cur, key];
    persist(newKeys);
    set({ keys: newKeys });
  },

  removeCase: (key: string) => {
    const newKeys = get().keys.filter((k) => k !== key);
    persist(newKeys);
    set({ keys: newKeys });
  },

  addF2lGroup: (groupNum: number) => {
    const groupKeys = ZBLS_BY_GROUP[groupNum] || [];
    const selectedSet = new Set(get().keys);
    const toAdd = groupKeys.filter((k) => !selectedSet.has(k));
    const newKeys = [...get().keys, ...toAdd];
    persist(newKeys);
    set({ keys: newKeys });
  },

  removeF2lGroup: (groupNum: number) => {
    const groupKeys = new Set(ZBLS_BY_GROUP[groupNum] || []);
    const newKeys = get().keys.filter((k) => !groupKeys.has(k));
    persist(newKeys);
    set({ keys: newKeys });
  },

  selectAll: () => {
    const newKeys = [...allZblsKeys];
    persist(newKeys);
    set({ keys: newKeys });
  },

  deselectAll: () => {
    persist([]);
    set({ keys: [] });
  },

  applyFromPreset: (keysSet: Set<string>) => {
    const newKeys = [...keysSet];
    persist(newKeys);
    set({ keys: newKeys });
  },
}));
