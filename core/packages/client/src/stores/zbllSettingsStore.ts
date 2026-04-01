/**
 * ZBLL 设置 store
 * 计时器、打乱、图片显示等用户偏好设置
 */
import { create } from 'zustand';

const LOCAL_STORAGE_KEY = 'zbllTrainerSettings';

export const FONTS_LIST = [
  'Roboto Mono',
  'Courier New',
  'Ubuntu Mono',
  'Arial',
  'Helvetica',
  'sans-serif',
  'Times',
  'serif',
] as const;

export interface ZbllSettings {
  pictureView: 'top' | '3D';
  timerUpdate: 'on' | 'seconds' | 'off';
  timerPrecision: 1 | 2 | 3;
  timerFont: string;
  scrambleFontSize: number;
  timerFontSize: number;
  showHowTo: boolean;
  timerStartDelayMs: number;
  scrambleAppendix: string;
}

const DEFAULT_SETTINGS: ZbllSettings = {
  pictureView: 'top',
  timerUpdate: 'seconds',
  timerPrecision: 2,
  timerFont: FONTS_LIST[0],
  scrambleFontSize: 28,
  timerFontSize: 64,
  showHowTo: true,
  timerStartDelayMs: 100,
  scrambleAppendix: 'None',
};

const loadSettings = (): ZbllSettings => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY) || 'null'
    );
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

interface ZbllSettingsState {
  settings: ZbllSettings;
  updateSetting: <K extends keyof ZbllSettings>(
    key: K,
    value: ZbllSettings[K]
  ) => void;
  resetDefaults: () => void;
}

export const useZbllSettingsStore = create<ZbllSettingsState>((set, get) => ({
  settings: loadSettings(),

  updateSetting: (key, value) => {
    const newSettings = { ...get().settings, [key]: value };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
    set({ settings: newSettings });
  },

  resetDefaults: () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    set({ settings: { ...DEFAULT_SETTINGS } });
  },
}));
