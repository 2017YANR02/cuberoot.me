/**
 * ZBLL 笔记 store
 * 每个 ZBLL case 的自定义文字笔记
 */
import { create } from 'zustand';

const LOCAL_STORAGE_KEY = 'zbllTrainerNotes';

const loadNotes = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

interface ZbllNotesState {
  notes: Record<string, string>;
  setNote: (key: string, value: string) => void;
}

export const useZbllNotesStore = create<ZbllNotesState>((set, get) => ({
  notes: loadNotes(),

  setNote: (key: string, value: string) => {
    const newNotes = { ...get().notes, [key]: value };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newNotes));
    set({ notes: newNotes });
  },
}));
