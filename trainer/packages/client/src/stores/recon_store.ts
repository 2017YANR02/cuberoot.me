/**
 * Recon 模块 Zustand Store
 * NOTE: 管理复盘列表、筛选状态、当前操作的数据
 */
import { create } from 'zustand';
import type { ReconSolve } from '@cuberoot/shared';
import { listRecons } from '../utils/recon_api';

// ── 排序 ──

export type SortKey =
  | 'id' | 'rawTime' | 'person' | 'event' | 'method'
  | 'comp' | 'date' | 'stm' | 'tps' | 'average';

export type SortDir = 'asc' | 'desc';

// ── 筛选 ──

export interface ReconFilters {
  event: string;       // '' = 全部
  method: string;      // '' = 全部
  official: string;    // '' = 全部, '1' = WCA, '0' = non-WCA
  search: string;      // 全文搜索
}

// ── Store ──

interface ReconStoreState {
  /** 全量数据（从 API 加载后缓存） */
  allSolves: ReconSolve[];
  /** 是否正在加载 */
  loading: boolean;
  /** 加载错误 */
  error: string | null;
  /** 筛选条件 */
  filters: ReconFilters;
  /** 排序 */
  sortKey: SortKey;
  sortDir: SortDir;
  /** 分页——当前显示数量 */
  displayCount: number;
  /** 每次加载更多的增量 */
  pageSize: number;
}

interface ReconStoreActions {
  /** 从 API 加载全量数据 */
  loadAll: (wcaId?: string) => Promise<void>;
  /** 更新筛选条件 */
  setFilter: <K extends keyof ReconFilters>(key: K, value: ReconFilters[K]) => void;
  /** 设置排序（点击同一列切换方向） */
  setSort: (key: SortKey) => void;
  /** 加载更多 */
  loadMore: () => void;
  /** 重置显示数量 */
  resetPaging: () => void;
  /** 获取筛选+排序后的数据 */
  getFilteredSolves: () => ReconSolve[];
  /** 获取可用的事件和方法列表 */
  getAvailableEvents: () => string[];
  getAvailableMethods: () => string[];
}

const DEFAULT_FILTERS: ReconFilters = {
  event: '',
  method: '',
  official: '',
  search: '',
};

const PAGE_SIZE = 50;

export const useReconStore = create<ReconStoreState & ReconStoreActions>()((set, get) => ({
  allSolves: [],
  loading: false,
  error: null,
  filters: { ...DEFAULT_FILTERS },
  sortKey: 'id',
  sortDir: 'desc',
  displayCount: PAGE_SIZE,
  pageSize: PAGE_SIZE,

  loadAll: async (wcaId?: string) => {
    set({ loading: true, error: null });
    try {
      const solves = await listRecons(wcaId);
      set({ allSolves: solves, loading: false, displayCount: PAGE_SIZE });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      displayCount: PAGE_SIZE, // NOTE: 切换筛选时重置分页
    }));
  },

  setSort: (key) => {
    set((state) => {
      if (state.sortKey === key) {
        return { sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' };
      }
      return { sortKey: key, sortDir: 'desc' };
    });
  },

  loadMore: () => {
    set((state) => ({
      displayCount: state.displayCount + PAGE_SIZE,
    }));
  },

  resetPaging: () => set({ displayCount: PAGE_SIZE }),

  getFilteredSolves: () => {
    const { allSolves, filters, sortKey, sortDir } = get();
    let result = [...allSolves];

    // NOTE: 筛选
    if (filters.event) {
      result = result.filter(s => s.event === filters.event);
    }
    if (filters.method) {
      result = result.filter(s => s.method === filters.method);
    }
    if (filters.official === '1') {
      result = result.filter(s => s.official);
    } else if (filters.official === '0') {
      result = result.filter(s => !s.official);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(s =>
        (s.person?.toLowerCase().includes(q)) ||
        (s.comp?.toLowerCase().includes(q)) ||
        (s.event?.toLowerCase().includes(q)) ||
        (s.method?.toLowerCase().includes(q)) ||
        (s.personId?.toLowerCase().includes(q)) ||
        (String(s.id).includes(q)),
      );
    }

    // NOTE: 排序
    result.sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  },

  getAvailableEvents: () => {
    const events = new Set<string>();
    for (const s of get().allSolves) {
      if (s.event) events.add(s.event);
    }
    return Array.from(events).sort();
  },

  getAvailableMethods: () => {
    const methods = new Set<string>();
    for (const s of get().allSolves) {
      if (s.method) methods.add(s.method);
    }
    return Array.from(methods).sort();
  },
}));
