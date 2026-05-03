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
  | 'id' | 'rawTime' | 'person' | 'reconer' | 'event' | 'method'
  | 'comp' | 'date' | 'stm' | 'tps' | 'average'
  | 'round' | 'aoType' | 'result';

export type SortDir = 'asc' | 'desc';

// ── 筛选 ──

export interface ReconFilters {
  event: string;       // '' = 全部
  method: string;      // '' = 全部
  official: string;    // '' = 全部, '1' = WCA, '0' = non-WCA
  solver: string;      // '' = 全部, '__NO_PERSON__' = 无选手名
  reconer: string;     // '' = 全部, '__NO_RECONER__' = 无复盘者
  comp: string;        // '' = 全部, '__NO_COMP__' = 无比赛
  record: string;      // '' = 全部 (e.g. 'WR' / 'CR' / 'NR' / ...)
  rawTimeMin: number | null;  // null = 不限；秒
  rawTimeMax: number | null;  // null = 不限；秒
  dateMin: string;     // '' = 不限；YYYY-MM-DD
  dateMax: string;     // '' = 不限；YYYY-MM-DD
  round: string;       // '' = 全部
  averageMin: number | null;
  averageMax: number | null;
  aoType: string;      // '' = 全部
  stmMin: number | null;
  stmMax: number | null;
  tpsMin: number | null;
  tpsMax: number | null;
  idMin: number | null;
  idMax: number | null;
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
  setSort: (key: SortKey, dir?: SortDir) => void;
  loadMore: () => void;
  resetPaging: () => void;
  getFilteredSolves: () => ReconSolve[];
  getAvailableEvents: () => string[];
  getAvailableMethods: () => { name: string; count: number }[];
  /** 按频率排序的选手列表;wcaId 取该选手第一条非空 personId */
  getAvailableSolvers: () => { name: string; count: number; country: string; wcaId: string }[];
  /** 按频率排序的复盘者列表;wcaId 取第一条非空 reconerId */
  getAvailableReconers: () => { name: string; count: number; wcaId: string }[];
  /** 按频率排序的比赛列表 */
  getAvailableComps: () => { name: string; count: number; country: string }[];
  /** 按频率排序的纪录代码列表 (WR / CR / NR 等) */
  getAvailableRecords: () => { code: string; count: number }[];
  /** 可用 round 列表（频率排序） */
  getAvailableRounds: () => { name: string; count: number }[];
  /** 可用 aoType 列表（频率排序） */
  getAvailableAoTypes: () => { name: string; count: number }[];
}

const DEFAULT_FILTERS: ReconFilters = {
  event: '',
  method: '',
  official: '',
  solver: '',
  reconer: '',
  comp: '',
  record: '',
  rawTimeMin: null,
  rawTimeMax: null,
  dateMin: '',
  dateMax: '',
  round: '',
  averageMin: null,
  averageMax: null,
  aoType: '',
  stmMin: null,
  stmMax: null,
  tpsMin: null,
  tpsMax: null,
  idMin: null,
  idMax: null,
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

  setSort: (key, dir) => {
    set((state) => {
      // dir 显式指定 → 直接采用(用于 ColFilter popup 的"升序/降序"按钮)
      if (dir) return { sortKey: key, sortDir: dir };
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
    if (filters.method === '__NO_METHOD__') {
      result = result.filter(s => !s.method);
    } else if (filters.method) {
      result = result.filter(s => s.method === filters.method);
    }
    if (filters.solver === '__NO_PERSON__') {
      result = result.filter(s => !s.person);
    } else if (filters.solver) {
      result = result.filter(s => s.person === filters.solver);
    }
    if (filters.reconer === '__NO_RECONER__') {
      result = result.filter(s => !s.reconer);
    } else if (filters.reconer) {
      result = result.filter(s => s.reconer === filters.reconer);
    }
    if (filters.official === '1') {
      result = result.filter(s => s.official);
    } else if (filters.official === '0') {
      result = result.filter(s => !s.official);
    }

    if (filters.comp === '__NO_COMP__') {
      result = result.filter(s => !s.comp);
    } else if (filters.comp) {
      result = result.filter(s => s.comp === filters.comp);
    }

    if (filters.record) {
      const q = filters.record.toUpperCase();
      result = result.filter(s =>
        (s.regionalAverageRecord && String(s.regionalAverageRecord).toUpperCase() === q) ||
        (s.regionalSingleRecord && String(s.regionalSingleRecord).toUpperCase() === q) ||
        (s.regionalAoxrRecord && String(s.regionalAoxrRecord).toUpperCase() === q),
      );
    }

    // NOTE: rawTime 范围（单次/成绩同源），单位秒。DNF (rawTime < 0) 视为不在任何范围
    if (filters.rawTimeMin != null) {
      const min = filters.rawTimeMin;
      result = result.filter(s => s.rawTime != null && s.rawTime >= 0 && s.rawTime >= min);
    }
    if (filters.rawTimeMax != null) {
      const max = filters.rawTimeMax;
      result = result.filter(s => s.rawTime != null && s.rawTime >= 0 && s.rawTime <= max);
    }

    // NOTE: 日期 / 轮次 / 平均 / AoXR / STM / TPS / id
    if (filters.dateMin) {
      const lo = filters.dateMin;
      result = result.filter(s => (s.date ?? '') >= lo);
    }
    if (filters.dateMax) {
      const hi = filters.dateMax;
      result = result.filter(s => (s.date ?? '') <= hi);
    }
    if (filters.round) {
      result = result.filter(s => (s.round ?? '') === filters.round);
    }
    if (filters.averageMin != null) {
      const min = filters.averageMin;
      result = result.filter(s => s.average != null && s.average >= 0 && s.average >= min);
    }
    if (filters.averageMax != null) {
      const max = filters.averageMax;
      result = result.filter(s => s.average != null && s.average >= 0 && s.average <= max);
    }
    if (filters.aoType) {
      result = result.filter(s => (s.aoType ?? '') === filters.aoType);
    }
    if (filters.stmMin != null) {
      const min = filters.stmMin;
      result = result.filter(s => typeof s.stm === 'number' && s.stm >= min);
    }
    if (filters.stmMax != null) {
      const max = filters.stmMax;
      result = result.filter(s => typeof s.stm === 'number' && s.stm <= max);
    }
    if (filters.tpsMin != null) {
      const min = filters.tpsMin;
      result = result.filter(s => typeof s.tps === 'number' && s.tps >= min);
    }
    if (filters.tpsMax != null) {
      const max = filters.tpsMax;
      result = result.filter(s => typeof s.tps === 'number' && s.tps <= max);
    }
    if (filters.idMin != null) {
      const min = filters.idMin;
      result = result.filter(s => s.id >= min);
    }
    if (filters.idMax != null) {
      const max = filters.idMax;
      result = result.filter(s => s.id <= max);
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

  getAvailableRounds: () => {
    const counts: Record<string, number> = {};
    for (const s of get().allSolves) {
      const r = s.round ?? '';
      if (!r) continue;
      counts[r] = (counts[r] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  },

  getAvailableAoTypes: () => {
    const counts: Record<string, number> = {};
    for (const s of get().allSolves) {
      const a = s.aoType ?? '';
      if (!a) continue;
      counts[a] = (counts[a] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  },

  // NOTE: 按频率排序的方法列表;空 method 用 sentinel '__NO_METHOD__'
  getAvailableMethods: () => {
    const counts: Record<string, number> = {};
    let noneCount = 0;
    for (const s of get().allSolves) {
      if (!s.method) { noneCount++; continue; }
      counts[s.method] = (counts[s.method] || 0) + 1;
    }
    const entries = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    if (noneCount > 0) entries.push({ name: '__NO_METHOD__', count: noneCount });
    return entries;
  },

  // NOTE: 按频率排序的选手列表（出现次数多的在前）；country / wcaId 取该选手第一条非空值
  // NOTE: 空选手用 sentinel '__NO_PERSON__' 列出（让用户能筛"未填选手名"的复盘）
  getAvailableSolvers: () => {
    const counts: Record<string, number> = {};
    const country: Record<string, string> = {};
    const wcaId: Record<string, string> = {};
    let noneCount = 0;
    for (const s of get().allSolves) {
      if (!s.person) { noneCount++; continue; }
      counts[s.person] = (counts[s.person] || 0) + 1;
      if (!country[s.person] && s.personCountry) country[s.person] = s.personCountry;
      if (!wcaId[s.person] && s.personId) wcaId[s.person] = s.personId;
    }
    const entries = Object.entries(counts)
      .map(([name, count]) => ({ name, count, country: country[name] || '', wcaId: wcaId[name] || '' }))
      .sort((a, b) => b.count - a.count);
    if (noneCount > 0) entries.push({ name: '__NO_PERSON__', count: noneCount, country: '', wcaId: '' });
    return entries;
  },

  // NOTE: 按频率排序的复盘者列表;wcaId 取第一条非空 reconerId
  getAvailableReconers: () => {
    const counts: Record<string, number> = {};
    const wcaId: Record<string, string> = {};
    let noneCount = 0;
    for (const s of get().allSolves) {
      if (!s.reconer) { noneCount++; continue; }
      counts[s.reconer] = (counts[s.reconer] || 0) + 1;
      if (!wcaId[s.reconer] && s.reconerId) wcaId[s.reconer] = s.reconerId;
    }
    const entries = Object.entries(counts)
      .map(([name, count]) => ({ name, count, wcaId: wcaId[name] || '' }))
      .sort((a, b) => b.count - a.count);
    if (noneCount > 0) entries.push({ name: '__NO_RECONER__', count: noneCount, wcaId: '' });
    return entries;
  },

  // NOTE: 按频率排序的比赛列表; country 取该比赛第一条非空 country
  // NOTE: 空比赛走 sentinel '__NO_COMP__'
  getAvailableComps: () => {
    const counts: Record<string, number> = {};
    const country: Record<string, string> = {};
    let noneCount = 0;
    for (const s of get().allSolves) {
      if (!s.comp) { noneCount++; continue; }
      counts[s.comp] = (counts[s.comp] || 0) + 1;
      if (!country[s.comp] && s.country) country[s.comp] = s.country;
    }
    const entries = Object.entries(counts)
      .map(([name, count]) => ({ name, count, country: country[name] || '' }))
      .sort((a, b) => b.count - a.count);
    if (noneCount > 0) entries.push({ name: '__NO_COMP__', count: noneCount, country: '' });
    return entries;
  },

  // NOTE: 按频率排序的纪录代码列表; 取自 single / average / aoxr 三个字段并集
  getAvailableRecords: () => {
    const counts: Record<string, number> = {};
    for (const s of get().allSolves) {
      const codes = new Set<string>();
      if (s.regionalSingleRecord) codes.add(String(s.regionalSingleRecord).toUpperCase());
      if (s.regionalAverageRecord) codes.add(String(s.regionalAverageRecord).toUpperCase());
      if (s.regionalAoxrRecord) codes.add(String(s.regionalAoxrRecord).toUpperCase());
      for (const c of codes) counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  },
}));
