/**
 * ZBLL 预设 store
 * 管理用户自定义预设和⭐收藏
 */
import { create } from 'zustand';

const LOCAL_STORAGE_KEY = 'zbll2_presets_arrays';
export const STARRED_NAME = '⭐';

type PresetMap = Record<string, Set<string>>;

const loadFromStorage = (): PresetMap => {
  try {
    const raw = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY) ?? `{"${STARRED_NAME}": []}`
    ) as Record<string, string[]>;
    const result: PresetMap = {};
    for (const name in raw) {
      result[name] = new Set(raw[name]);
    }
    return result;
  } catch {
    return { [STARRED_NAME]: new Set() };
  }
};

const saveToStorage = (map: PresetMap) => {
  const toSave: Record<string, string[]> = {};
  for (const name in map) {
    toSave[name] = [...map[name]];
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(toSave));
};

interface ZbllPresetState {
  map: PresetMap;

  setPreset: (name: string, keys: string[]) => void;
  getCases: (name: string) => Set<string>;
  deletePreset: (name: string) => void;
  hasCase: (name: string, key: string) => boolean;
  addToPreset: (name: string, key: string) => void;
  removeFromPreset: (name: string, key: string) => void;
  toggleAddRemove: (name: string, key: string) => void;
}

export const useZbllPresetStore = create<ZbllPresetState>((set, get) => ({
  map: loadFromStorage(),

  setPreset: (name: string, keys: string[]) => {
    const newMap = { ...get().map, [name]: new Set(keys) };
    saveToStorage(newMap);
    set({ map: newMap });
  },

  getCases: (name: string) => get().map[name] ?? new Set(),

  deletePreset: (name: string) => {
    const newMap = { ...get().map };
    delete newMap[name];
    saveToStorage(newMap);
    set({ map: newMap });
  },

  hasCase: (name: string, key: string) => {
    return (get().map[name] ?? new Set()).has(key);
  },

  addToPreset: (name: string, key: string) => {
    const newMap = { ...get().map };
    if (!newMap[name]) newMap[name] = new Set();
    newMap[name] = new Set([...newMap[name], key]);
    saveToStorage(newMap);
    set({ map: newMap });
  },

  removeFromPreset: (name: string, key: string) => {
    const newMap = { ...get().map };
    if (newMap[name]) {
      const newSet = new Set(newMap[name]);
      newSet.delete(key);
      newMap[name] = newSet;
      saveToStorage(newMap);
      set({ map: newMap });
    }
  },

  toggleAddRemove: (name: string, key: string) => {
    if (!key || typeof key !== 'string') return;
    if (get().hasCase(name, key)) {
      get().removeFromPreset(name, key);
    } else {
      get().addToPreset(name, key);
    }
  },
}));
