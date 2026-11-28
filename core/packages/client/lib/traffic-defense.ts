import { apiUrl } from './api-base';

// Server-side gate only. One shared request per process, at most every 5 seconds.
// Incident protection is opt-in. An unavailable control endpoint must not
// reopen the CAPTCHA gate while the API is allowing visitors in open mode.
let cached = { known: false, enabled: false, competitionOnlyUntil: 0, until: 0 };
let pending: Promise<typeof cached> | undefined;
function readTrafficDefense() {
  if (Date.now() < cached.until) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    let known = false;
    let enabled = false;
    let competitionOnlyUntil = 0;
    try {
      const response = await fetch(apiUrl('/v1/traffic-defense'), {
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const mode = await response.json();
        known = (mode?.enabled === 0 || mode?.enabled === 1)
          && (mode.competitionOnlyUntil === undefined || Number.isSafeInteger(mode.competitionOnlyUntil));
        enabled = mode?.enabled === 1;
        if (Number.isSafeInteger(mode?.competitionOnlyUntil)) competitionOnlyUntil = mode.competitionOnlyUntil;
      }
    } catch { /* Public access stays open; account/API authorization is separate. */ }
    cached = { known, enabled, competitionOnlyUntil, until: Date.now() + 5000 };
    return cached;
  })().finally(() => { pending = undefined; });
  return pending;
}

export async function trafficDefenseEnabled() {
  return (await readTrafficDefense()).enabled;
}

export async function competitionOnlyVerificationEnabled() {
  return (await readTrafficDefense()).competitionOnlyUntil > Date.now() / 1000;
}

/** Only an explicit open state can retire a verification link. */
export async function competitionVerificationOpen() {
  const mode = await readTrafficDefense();
  return mode.known && !mode.enabled && mode.competitionOnlyUntil <= Date.now() / 1000;
}
