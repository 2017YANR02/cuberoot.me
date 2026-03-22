import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  /** 选中的 case ID 集合 */
  selectedCases: string[];
  /** 是否启用 15 秒观察 */
  inspection: boolean;
  /** 是否显示公式提示 */
  showHints: boolean;
  /** 自适应学习开关 */
  adaptiveLearning: boolean;
  /** 主题 */
  theme: 'light' | 'dark';

  // 动作
  toggleCase: (caseId: string) => void;
  selectAll: (caseIds: string[]) => void;
  deselectAll: () => void;
  setInspection: (val: boolean) => void;
  setShowHints: (val: boolean) => void;
  setAdaptiveLearning: (val: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      selectedCases: [],
      inspection: false,
      showHints: false,
      adaptiveLearning: true,
      theme: 'dark',

      toggleCase: (caseId) => {
        const { selectedCases } = get();
        if (selectedCases.includes(caseId)) {
          set({ selectedCases: selectedCases.filter((id) => id !== caseId) });
        } else {
          set({ selectedCases: [...selectedCases, caseId] });
        }
      },

      selectAll: (caseIds) => set({ selectedCases: [...caseIds] }),

      deselectAll: () => set({ selectedCases: [] }),

      setInspection: (val) => set({ inspection: val }),
      setShowHints: (val) => set({ showHints: val }),
      setAdaptiveLearning: (val) => set({ adaptiveLearning: val }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'trainer-settings' },
  ),
);
