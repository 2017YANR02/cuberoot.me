/**
 * Recon 列表 localStorage 缓存——stale-while-revalidate
 * NOTE: 列表 endpoint 一次返回全部 ~2k 条，TTFB+下载耗时 5–30s。
 *       缓存后回访瞬开，后台再 fetch 替换。
 */
import type { ReconSolve } from '@cuberoot/shared';

// NOTE: schema 变化时 bump 版本（旧缓存自动废弃）
const CACHE_VERSION = 2;
const CACHE_KEY = `recon_list_cache:v${CACHE_VERSION}`;
// NOTE: 安全上限——超过 7 天的缓存丢弃，避免后端长时间不可用时返回过期数据
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  ts: number;
  wcaId: string;  // '' = 全集；不同 wcaId 的列表分开缓存
  data: ReconSolve[];
}

export function loadCachedSolves(wcaId?: string): ReconSolve[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.wcaId !== (wcaId ?? '')) return null;
    if (Date.now() - entry.ts > MAX_AGE_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function saveCachedSolves(solves: ReconSolve[], wcaId?: string): void {
  try {
    const entry: CacheEntry = {
      ts: Date.now(),
      wcaId: wcaId ?? '',
      data: solves,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // NOTE: 写入失败（quota exceeded 等）静默——下次仍走网络
  }
}
