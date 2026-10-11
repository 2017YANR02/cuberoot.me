import { apiUrl } from './api-base';

// Server-side gate only. One shared request per process, at most every 5 seconds.
// Incident protection is opt-in. An unavailable control endpoint must not
// reopen the CAPTCHA gate while the API is allowing visitors in open mode.
let cached = { enabled: false, until: 0 };
let pending: Promise<boolean> | undefined;
export function trafficDefenseEnabled(): Promise<boolean> {
  if (Date.now() < cached.until) return Promise.resolve(cached.enabled);
  if (pending) return pending;
  pending = (async () => {
    let enabled = false;
    try {
      const response = await fetch(apiUrl('/v1/traffic-defense'), {
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const mode = await response.json();
        enabled = mode?.enabled === 1;
      }
    } catch { /* Public access stays open; account/API authorization is separate. */ }
    cached = { enabled, until: Date.now() + 5000 };
    return enabled;
  })().finally(() => { pending = undefined; });
  return pending;
}
