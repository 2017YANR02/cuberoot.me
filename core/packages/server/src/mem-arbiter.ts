/**
 * Single-tenant memory arbiter for the two heavy in-process solvers on the small
 * (~3.5GB) box: the cube48 opt6 prune table (~2GB resident, cubeopt/daemon.ts)
 * and the cube555 JVM (~540MB, cube555/daemon.ts). Loaded together they push the
 * box into the OOM / watchdog-drop zone, so we keep only ONE resident at a time.
 *
 * Each daemon registers an evict() that frees its memory (kills its child) plus
 * an isBusy() telling whether it's mid-request. A daemon calls claimMemory(its-id)
 * right before it loads; that evicts every OTHER registered tenant first.
 *
 * Priority: a 3x3 optimal solve is long (up to 180s) and the user is actively
 * waiting on it, whereas a 5x5 scramble is sub-second and has a client-side
 * (cubing.js) fallback. So cubeopt may evict a BUSY cube555, but cube555 must NOT
 * evict a busy cubeopt — claimMemory returns false and cube555 sheds the request
 * (route 503 → client falls back) until the 3x3 solve finishes and frees memory.
 */
interface Tenant {
  id: string;
  evict: () => void; // free this tenant's memory (kill its child); idempotent
  isBusy: () => boolean; // true while serving a request
}

const tenants = new Map<string, Tenant>();

export function registerTenant(t: Tenant): void {
  tenants.set(t.id, t);
}

/**
 * Evict every tenant other than `owner` so `owner` can load. If `evictBusy` is
 * false (default) and some other tenant is mid-request, the claim is refused
 * (returns false) and nothing is evicted — the caller should shed its request.
 * With `evictBusy: true`, busy peers are evicted anyway.
 */
export function claimMemory(owner: string, opts: { evictBusy?: boolean } = {}): boolean {
  const others = [...tenants.values()].filter((t) => t.id !== owner);
  if (!opts.evictBusy && others.some((t) => t.isBusy())) return false;
  for (const t of others) {
    try {
      t.evict();
    } catch {
      /* best effort — the kill may race a natural exit */
    }
  }
  return true;
}
