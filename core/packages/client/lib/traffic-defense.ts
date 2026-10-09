import { apiUrl } from './api-base';

// Server-side gate only. One shared request per process, at most every 5 seconds.
// Missing/unreachable state retains protection, including on a cold start.
let cached = { enabled: true, until: 0 };
let pending: Promise<boolean> | undefined;
export function trafficDefenseEnabled(): Promise<boolean> {
  if (Date.now() < cached.until) return Promise.resolve(cached.enabled);
  if (pending) return pending;
  pending = (async () => {
    let enabled = true;
    try {
      const response = await fetch(apiUrl('/v1/traffic-defense'), {
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const mode = await response.json();
        if (mode.enabled === 0) enabled = false;
      }
    } catch { /* Keep protection when the control endpoint cannot be read. */ }
    cached = { enabled, until: Date.now() + 5000 };
    return enabled;
  })().finally(() => { pending = undefined; });
  return pending;
}
