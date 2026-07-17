// Quota-resilient localStorage writes. iOS Safari's ~5MB quota is routinely
// packed by timer auto-backups; a raw setItem then throws QuotaExceededError
// and — when called inside an event handler — silently kills the interaction
// (e.g. trainer 全选 doing nothing in prod). All best-effort persistence
// should go through persistItem instead of raw localStorage.setItem.

/**
 * Evict regenerable / redundant localStorage entries to reclaim quota.
 * Targets timer auto-backups (up to 10 full-export snapshots — the biggest hog
 * on iOS Safari's ~5MB quota) and regenerable list caches. Never touches the
 * live timer DB (`cuberoot-timer.v3`) or other real user data. Returns whether
 * anything was freed.
 */
function reclaimQuota(): boolean {
  if (typeof window === 'undefined') return false;
  const evictable: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('cuberoot-timer.backup.v1.') || k.startsWith('recon_list_cache:')) {
        evictable.push(k);
      }
    }
  } catch {
    return false;
  }
  if (evictable.length === 0) return false;
  evictable.sort(); // backup keys end with Date.now() → oldest first
  let freed = false;
  for (const k of evictable) {
    try { localStorage.removeItem(k); freed = true; } catch { /* ignore */ }
  }
  return freed;
}

/**
 * Persist a key, surviving a (near-)full localStorage. On a quota error,
 * evict regenerable caches once and retry. Never throws. Returns false if the
 * value still couldn't be stored (e.g. Safari private browsing, 0 quota).
 */
export function persistItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    if (!reclaimQuota()) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}
