/**
 * ZBLS 预设 store
 * 管理用户自定义预设，参考 zbllPresetStore
 */
import { create } from 'zustand';

const LOCAL_STORAGE_KEY = 'zbls_presets';

type PresetMap = Record<string, Set<string>>;

const loadFromStorage = (): PresetMap => {
  try {
    const raw = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY) ?? '{}'
    ) as Record<string, string[]>;
    const result: PresetMap = {};
    for (const name in raw) {
      result[name] = new Set(raw[name]);
    }
    return result;
  } catch {
    return {};
  }
};

const saveToStorage = (map: PresetMap) => {
  const toSave: Record<string, string[]> = {};
  for (const name in map) {
    toSave[name] = [...map[name]];
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(toSave));
};

interface ZblsPresetState {
  map: PresetMap;

  setPreset: (name: string, keys: string[]) => void;
  getCases: (name: string) => Set<string>;
  deletePreset: (name: string) => void;
}

export const useZblsPresetStore = create<ZblsPresetState>((set, get) => ({
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
}));
