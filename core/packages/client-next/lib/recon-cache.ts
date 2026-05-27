/**
 * Recon 列表 localStorage 缓存——stale-while-revalidate.
 * Ported 1:1 from packages/client/src/utils/recon_cache.ts.
 */
import type { ReconSolve } from '@cuberoot/shared';

const CACHE_VERSION = 2;
const CACHE_KEY = `recon_list_cache:v${CACHE_VERSION}`;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  ts: number;
  wcaId: string;
  data: ReconSolve[];
}

export function loadCachedSolves(wcaId?: string): ReconSolve[] | null {
  if (typeof window === 'undefined') return null;
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
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = {
      ts: Date.now(),
      wcaId: wcaId ?? '',
      data: solves,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Quota exceeded → silent
  }
}
