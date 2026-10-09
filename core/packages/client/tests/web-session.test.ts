// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const user = { uid: 7, wcaId: null, name: 'Canonical', avatar: '', avatarSource: 'auto', avatarPreset: null, isAdmin: false };
const access = 'short-access-token-for-memory';
const response = (generation: string, token = access) => new Response(JSON.stringify({ generation, token, user }));
const body = (init: RequestInit) => JSON.parse(String(init.body));
let session: typeof import('@/lib/web-session');
beforeEach(async () => {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear();
  session = await import('@/lib/web-session');
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('HttpOnly web session client', () => {
  it('persists only the marker and resolves an in-memory access token', async () => {
    const fetcher = vi.fn(async (_: unknown, init: RequestInit) => response(body(init).generation));
    vi.stubGlobal('fetch', fetcher);
    const marker = await session.establishWebSession('long-login-credential');
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem(session.WEB_SESSION_MARKER_KEY)).toBe(marker);
    expect(await session.getWebAccessToken(marker)).toBe(access);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', method: 'POST' });
    expect(await session.getWebAccessToken('temporary-preview-token')).toBe('temporary-preview-token');
  });

  it('migrates an old JWT once and removes both persistent credentials after success', async () => {
    localStorage.setItem('cuberoot_jwt', 'legacy-login-credential');
    localStorage.setItem('wca_access_token', 'legacy-wca-credential');
    const fetcher = vi.fn(async (_: unknown, init: RequestInit) => response(body(init).generation));
    vi.stubGlobal('fetch', fetcher);
    const marker = session.getWebSessionMarker();
    expect(marker.startsWith('web-session:')).toBe(true);
    expect(await session.getWebAccessToken(marker)).toBe(access);
    expect(body(fetcher.mock.calls[0][1]).token).toBe('legacy-login-credential');
    expect(localStorage.getItem('cuberoot_jwt')).toBeNull();
    expect(localStorage.getItem('wca_access_token')).toBeNull();
  });

  it('single-flights restoration and refreshes before access expiry', async () => {
    const generation = crypto.randomUUID(), marker = `web-session:${generation}`;
    localStorage.setItem(session.WEB_SESSION_MARKER_KEY, marker);
    const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + 120 }))}.signature`;
    const fetcher = vi.fn(async () => response(generation, token));
    vi.stubGlobal('fetch', fetcher);
    expect(await Promise.all([session.getWebAccessToken(marker), session.getWebAccessToken(marker)])).toEqual([token, token]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.useFakeTimers(); vi.setSystemTime(Date.now()+70_000);
    await session.getWebAccessToken(marker);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]).toEqual(['/api/web-session', expect.objectContaining({ method: 'GET', headers: { 'X-Web-Session': generation } })]);
  });

  it('rejects a late restoration after logout and never resurrects credentials', async () => {
    const generation = crypto.randomUUID(), marker = `web-session:${generation}`;
    localStorage.setItem(session.WEB_SESSION_MARKER_KEY, marker);
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn((_: unknown, init: RequestInit) => init.method === 'GET'
      ? new Promise<Response>(r => { resolve = r; }) : Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetcher);
    const restoring = session.getWebAccessToken(marker);
    const rejected = expect(restoring).rejects.toThrow('Session changed');
    await session.clearWebSession(); resolve(response(generation)); await rejected;
    expect(session.getWebSessionMarker()).toBe('');
    expect(localStorage.getItem('cuberoot_jwt')).toBeNull();
  });

  it('rejects cancelled login and cross-tab replacement responses', async () => {
    const fetcher = vi.fn(async (_: unknown, init: RequestInit) => init.method === 'DELETE' ? new Response(null, { status: 204 }) : response(body(init).generation));
    vi.stubGlobal('fetch', fetcher);
    await expect(session.establishWebSession('login-credential', () => false)).rejects.toThrow('cancelled');
    expect(session.getWebSessionMarker()).toBe('');
    expect(fetcher.mock.calls[1][1].method).toBe('DELETE');
    const oldMarker = await session.establishWebSession('login-credential');
    localStorage.setItem(session.WEB_SESSION_MARKER_KEY, `web-session:${crypto.randomUUID()}`);
    window.dispatchEvent(new StorageEvent('storage', { key: session.WEB_SESSION_MARKER_KEY }));
    await expect(session.getWebAccessToken(oldMarker)).rejects.toThrow('Session changed');
  });

  it('fails closed when migration fails instead of returning the old bearer', async () => {
    localStorage.setItem('cuberoot_jwt', 'legacy-login-credential');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    await expect(session.getWebAccessToken(session.getWebSessionMarker())).rejects.toThrow();
    expect(localStorage.getItem('cuberoot_jwt')).toBe('legacy-login-credential');
  });
});

it('rotates a short account response using only its existing cookie generation', async () => {
  const previousGeneration = crypto.randomUUID();
  localStorage.setItem(session.WEB_SESSION_MARKER_KEY, `web-session:${previousGeneration}`);
  const short = `header.${btoa(JSON.stringify({ browserAccess: true, uid: 7 }))}.signature`;
  const fetcher = vi.fn(async (_: unknown, init: RequestInit) => response(body(init).generation));
  vi.stubGlobal('fetch', fetcher);
  const marker = await session.establishWebSession(short);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'PATCH', headers: { 'X-Web-Session': previousGeneration } });
  expect(body(fetcher.mock.calls[0][1]).generation).toBe(marker.slice('web-session:'.length));
  expect(marker).not.toBe(`web-session:${previousGeneration}`);
  expect(localStorage.getItem('cuberoot_jwt')).toBeNull();
});

it('does not exchange a short token for a durable login without a marker', async () => {
  const short = `header.${btoa(JSON.stringify({ browserAccess: true, uid: 7 }))}.signature`;
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(session.establishWebSession(short)).rejects.toThrow('No durable web session');
  expect(fetcher).not.toHaveBeenCalled();
});
