// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Budget-limited fake localStorage: setItem throws (like iOS Safari's
// "The quota has been exceeded.") once total chars would exceed the budget.
// `used()` mirrors the helper's view (key.length + value.length).
function makeLocalStorage(budgetChars: number) {
  const map = new Map<string, string>();
  const used = () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() { return map.size; },
    key(i: number) { return [...map.keys()][i] ?? null; },
    getItem(k: string) { return map.has(k) ? (map.get(k) as string) : null; },
    setItem(k: string, v: string) {
      const prev = map.get(k);
      map.delete(k);
      if (used() + k.length + v.length > budgetChars) {
        if (prev !== undefined) map.set(k, prev);
        throw new Error('The quota has been exceeded.');
      }
      map.set(k, v);
    },
    removeItem(k: string) { map.delete(k); },
    clear() { map.clear(); },
    _keys() { return [...map.keys()]; },
  };
}


let auth: typeof import('@/lib/auth-store');
let persistAuthItem: typeof import('@/lib/auth-store').persistAuthItem;
let useAuthStore: typeof import('@/lib/auth-store').useAuthStore;
const setLS = (storage: ReturnType<typeof makeLocalStorage>) => vi.stubGlobal('localStorage', storage);
const user = { uid: 7, wcaId: null, name: 'Canonical', avatar: '', avatarSource: 'auto' as const, avatarPreset: null, isAdmin: true };
beforeEach(async () => {
  vi.resetModules(); setLS(makeLocalStorage(10000)); sessionStorage.clear();
  auth = await import('@/lib/auth-store'); ({ persistAuthItem, useAuthStore } = auth);
});
afterEach(() => vi.unstubAllGlobals());
describe('persistAuthItem quota resilience', () => {
  beforeEach(() => {
    setLS(makeLocalStorage(1_000_000));
    useAuthStore.getState().refresh();
  });

  it('stores normally when there is room', () => {
    const ls = makeLocalStorage(1_000_000);
    setLS(ls);
    expect(persistAuthItem('wca_user', '{"wcaId":"2017FOOB01"}')).toBe(true);
    expect(ls.getItem('wca_user')).toBe('{"wcaId":"2017FOOB01"}');
  });

  it('evicts timer backups + recon cache to make room, then succeeds', () => {
    const ls = makeLocalStorage(200);
    setLS(ls);
    ls.setItem('cuberoot-timer.backup.v1.100', 'x'.repeat(50));
    ls.setItem('cuberoot-timer.backup.v1.200', 'x'.repeat(50));
    // Near full; a fresh auth write would overflow.
    expect(() => ls.setItem('cuberoot_web_session_marker', 'a'.repeat(80))).toThrow();

    expect(persistAuthItem('cuberoot_web_session_marker', 'a'.repeat(80))).toBe(true);
    expect(ls.getItem('cuberoot_web_session_marker')).toBe('a'.repeat(80));
    // Redundant backups were evicted.
    expect(ls._keys().some(k => k.startsWith('cuberoot-timer.backup.v1.'))).toBe(false);
  });

  it('returns false and preserves live data when nothing is evictable', () => {
    const ls = makeLocalStorage(200);
    setLS(ls);
    // The live timer DB is NOT evictable — must never be dropped.
    ls.setItem('cuberoot-timer.v3', 'd'.repeat(180));

    expect(persistAuthItem('wca_user', 'v'.repeat(60))).toBe(false);
    expect(ls.getItem('wca_user')).toBeNull();
    expect(ls.getItem('cuberoot-timer.v3')).toBe('d'.repeat(180));
  });
});


describe('applySession persistence boundary', () => {
  it('stores canonical user metadata and marker, never either credential', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_: unknown, init: RequestInit) => new Response(JSON.stringify({
      generation: JSON.parse(String(init.body)).generation, token: 'short-access-token-for-memory', user,
    }))));
    expect(await auth.applySession('long-login-credential', user)).toBe(true);
    expect(localStorage.getItem('cuberoot_jwt')).toBeNull();
    expect(localStorage.getItem('wca_access_token')).toBeNull();
    expect(auth.getSessionToken()).toMatch(/^web-session:/);
    expect(useAuthStore.getState().user?.uid).toBe(7);
  });
  it('does not exchange credentials when marker storage is unavailable', async () => {
    setLS(makeLocalStorage(0)); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await auth.applySession('long-login-credential', user)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(auth.getSessionToken()).toBe('');
  });
  it('keeps preview credentials tab-scoped and refuses to replace the primary login', async () => {
    localStorage.setItem('cuberoot_web_session_marker', 'web-session:primary');
    sessionStorage.setItem('cuberoot_role_preview', JSON.stringify({ id: 'preview', role: 'user', token: 'preview-token', user }));
    const fetcher=vi.fn(); vi.stubGlobal('fetch',fetcher);
    expect(auth.getSessionToken()).toBe('preview-token');
    expect(await auth.applySession('unexpected-login', user)).toBe(false);
    expect(localStorage.getItem('cuberoot_web_session_marker')).toBe('web-session:primary');
    expect(auth.getWcaToken()).toBe('');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('role preview identity isolation', () => {
  it.each(['success', 'revoke-failure', 'start-failure'] as const)('uses the primary cookie bridge for role changes: %s', async outcome => {
    const session = await import('@/lib/web-session');
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/web-session') return new Response(JSON.stringify({
        generation: JSON.parse(String(init?.body)).generation, token: 'primary-short-access-token', user,
      }));
      if (init?.method === 'DELETE') return new Response(null, { status: outcome === 'revoke-failure' ? 500 : 204 });
      return new Response(JSON.stringify({ id: 'next', role: 'guest', token: '', user: null }), { status: outcome === 'start-failure' ? 500 : 200 });
    });
    vi.stubGlobal('fetch', fetcher);
    const marker = await session.establishWebSession('primary-long-credential');
    fetcher.mockClear();
    const previous = JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', role: 'user', token: 'temporary-preview-token', user });
    sessionStorage.setItem('cuberoot_role_preview', previous);
    const reload = vi.fn();
    vi.stubGlobal('window', { location: { href: 'http://localhost/', origin: 'http://localhost', protocol: 'http:', reload } });
    if (outcome === 'success') {
      await auth.startRolePreview('guest');
      expect(auth.getSessionToken()).toBe('');
      expect(reload).toHaveBeenCalledTimes(1);
    } else {
      await expect(auth.startRolePreview('guest')).rejects.toThrow();
      expect(sessionStorage.getItem('cuberoot_role_preview')).toBe(previous);
      expect(auth.getSessionToken()).toBe('temporary-preview-token');
      expect(reload).not.toHaveBeenCalled();
    }
    expect(fetcher).toHaveBeenCalledTimes(outcome === 'revoke-failure' ? 1 : 2);
    for (const [input, init] of fetcher.mock.calls) {
      expect(String(input)).toContain('/api/web-session/account/role-preview');
      expect(new Headers(init?.headers).get('Authorization')).toBeNull();
      expect(new Headers(init?.headers).get('X-Web-Session')).toBe(marker.slice('web-session:'.length));
    }
    expect(localStorage.getItem('cuberoot_web_session_marker')).toBe(marker);
    expect(localStorage.getItem('cuberoot_jwt')).toBeNull();
  });
});
