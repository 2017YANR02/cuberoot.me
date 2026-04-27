/**
 * Recon 模块 Zustand Store
 * NOTE: 管理复盘列表、筛选状态、排序、搜索
 */
import { create } from 'zustand';
import type { ReconSolve } from '@cuberoot/shared';
import { listRecons } from '../utils/recon_api';
import { loadCachedSolves, saveCachedSolves } from '../utils/recon_cache';

// ── 排序 ──

// NOTE: 'result' 映射到 rawTime（三位小数列），'aoType' 排序按 aoType 字段
export type SortKey =
  | 'id' | 'rawTime' | 'person' | 'event' | 'method'
  | 'comp' | 'date' | 'stm' | 'tps' | 'average'
  | 'round' | 'aoType' | 'result';

export type SortDir = 'asc' | 'desc';

// ── 筛选 ──

export interface ReconFilters {
  event: string;       // '' = 全部
  method: string;      // '' = 全部
  official: string;    // '' = 全部, '1' = WCA, '0' = non-WCA
  solver: string;      // '' = 全部
  search: string;      // 全文搜索
}

// ── Store ──

interface ReconStoreState {
  allSolves: ReconSolve[];
  loading: boolean;
  error: string | null;
  filters: ReconFilters;
  sortKey: SortKey;
  sortDir: SortDir;
  displayCount: number;
  pageSize: number;
}

interface ReconStoreActions {
  loadAll: (wcaId?: string) => Promise<void>;
  setFilter: <K extends keyof ReconFilters>(key: K, value: ReconFilters[K]) => void;
  setSort: (key: SortKey) => void;
  loadMore: () => void;
  resetPaging: () => void;
  getFilteredSolves: () => ReconSolve[];
  getAvailableEvents: () => string[];
  getAvailableMethods: () => string[];
  /** 按频率排序的选手列表 */
  getAvailableSolvers: () => { name: string; count: number }[];
}

const DEFAULT_FILTERS: ReconFilters = {
  event: '',
  method: '',
  official: '',
  solver: '',
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
    // NOTE: stale-while-revalidate——有缓存就先渲染，再后台 fetch 替换
    const cached = loadCachedSolves(wcaId);
    if (cached) {
      set({ allSolves: cached, loading: false, error: null, displayCount: PAGE_SIZE });
    } else {
      set({ loading: true, error: null });
    }
    try {
      const solves = await listRecons(wcaId);
      set({ allSolves: solves, loading: false, error: null, displayCount: PAGE_SIZE });
      saveCachedSolves(solves, wcaId);
    } catch (err) {
      // NOTE: 有缓存兜底就只静默失败；没缓存才 surface error
      if (cached) {
        // 保留缓存数据，不切换到 error 状态
      } else {
        set({ error: (err as Error).message, loading: false });
      }
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
      // NOTE: 成绩/平均默认升序（小的在前），其他默认降序
      const defaultAsc = ['rawTime', 'average', 'result'].includes(key);
      return { sortKey: key, sortDir: defaultAsc ? 'asc' : 'desc' };
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
    if (filters.solver) {
      result = result.filter(s => s.person === filters.solver);
    }
    if (filters.official === '1') {
      result = result.filter(s => s.official);
    } else if (filters.official === '0') {
      result = result.filter(s => !s.official);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();

      // NOTE: #编号精确匹配（如 #2026 只匹配 id=2026，不会误中 2026 年比赛）
      if (q.startsWith('#')) {
        const numStr = q.slice(1);
        result = result.filter(s => String(s.id) === numStr);
      } else {
        // NOTE: "取消"/"cancel" 映射为 "cancelled" 以匹配被取消纪录
        const normalizedQ = (q === '取消' || q === 'cancel') ? 'cancelled' : q;
        const qUpper = normalizedQ.toUpperCase();

        result = result.filter(s => {
          // NOTE: 搜索范围：选手名、比赛名、成绩、打乱、OLL/PLL、备注
          const haystack = [
            s.person, s.comp, s.optimalScramble,
            s.oll, s.pll, s.country, s.note,
            s.value,
            s.rawTime != null && typeof s.rawTime === 'number' ? s.rawTime.toFixed(3) : '',
          ].filter(Boolean).join(' ').toLowerCase();

          // NOTE: 纪录字段精确匹配（大小写不敏感），搜 WR 不误中 FWR
          const recordMatch =
            (s.regionalAverageRecord && String(s.regionalAverageRecord).toUpperCase() === qUpper) ||
            (s.regionalSingleRecord && String(s.regionalSingleRecord).toUpperCase() === qUpper) ||
            (s.regionalAoxrRecord && String(s.regionalAoxrRecord).toUpperCase() === qUpper);

          return haystack.includes(normalizedQ) || recordMatch;
        });
      }
    }

    // NOTE: 排序——'result' 实际排 rawTime
    const actualKey = sortKey === 'result' ? 'rawTime' : sortKey;
    result.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[actualKey] ?? '';
      const bVal = (b as unknown as Record<string, unknown>)[actualKey] ?? '';
      // NOTE: null/空值排到最后
      if (aVal == null && bVal == null) return 0;
      if (aVal == null || aVal === '') return 1;
      if (bVal == null || bVal === '') return -1;
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

  // NOTE: 按频率排序的选手列表（出现次数多的在前）
  getAvailableSolvers: () => {
    const counts: Record<string, number> = {};
    for (const s of get().allSolves) {
      if (s.person) counts[s.person] = (counts[s.person] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  },
}));
