// Shared admin-API helper — mirrors packages/client-vite/src/utils/admin_api.ts.
// JWT (long-lived) preferred over raw WCA access token (2h).
// Server route requireAdminOrApiKey accepts both Bearer WCA tokens (when wcaId in ADMIN_WCA_IDS) or X-Admin-Key.

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('cuberoot_jwt') || localStorage.getItem('wca_access_token');
}

export function authHeaders(json = true): HeadersInit {
  const token = getToken();
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function handleApi<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || `API error ${r.status}`);
  }
  return r.json();
}
