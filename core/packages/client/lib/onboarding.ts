import { persistItem } from './safe-storage';
import { sessionFetch } from './session-fetch';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import type { WcaUser } from './auth-store';

const GUEST_KEY = 'cuberoot_guided';
const PATH = '/v1/auth/onboarding';

function storageKey(user: WcaUser | null): string {
  return user ? `${GUEST_KEY}:account:${user.uid ? `uid:${user.uid}` : `wca:${user.wcaId}`}` : GUEST_KEY;
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string): void {
  persistItem(key, value);
}

const pendingSaves = new Map<string, Promise<void>>();

function save(key: string, headers: Record<string, string>): Promise<void> {
  const pending = pendingSaves.get(key);
  if (pending) return pending;

  const saving = sessionFetch(apiUrl(PATH), {
    method: 'PUT', headers, signal: AbortSignal.timeout(12_000),
  }).then(response => handleApi(response))
    .then(() => write(key, 'true'))
    .finally(() => pendingSaves.delete(key));
  pendingSaves.set(key, saving);
  return saving;
}

export async function isOnboardingGuided(user: WcaUser | null): Promise<boolean> {
  const key = storageKey(user);
  if (!user) return read(key) === 'true';
  // Capture this identity's credentials before awaiting; never retry as another user.
  const headers = authHeaders();
  if (read(key) === 'pending') {
    try { await save(key, headers); } catch { /* Retry on the next homepage visit. */ }
    return true;
  }
  try {
    const result = await handleApi<{ seen: boolean }>(await sessionFetch(apiUrl(PATH), {
      headers, cache: 'no-store', signal: AbortSignal.timeout(12_000),
    }));
    if (typeof result.seen !== 'boolean') return true;
    return result.seen;
  } catch {
    // A failed lookup must not be mistaken for a first visit.
    return true;
  }
}

export async function markOnboardingGuided(user: WcaUser | null): Promise<void> {
  const key = storageKey(user);
  if (!user) { write(key, 'true'); return; }
  write(key, 'pending');
  try { await save(key, authHeaders()); } catch { /* Keep the per-account pending marker. */ }
}
