import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH, POST as establish } from '@/app/api/web-session/route';
import { GET, PUT, POST, DELETE } from '@/app/api/web-session/account/[...path]/route';
const generation = '00000000-0000-4000-8000-000000000001';
const nextGeneration = '00000000-0000-4000-8000-000000000002';
const user = (uid = 7) => ({ uid, wcaId: null, name: 'Canonical', avatar: '', avatarSource: 'auto', avatarPreset: null, isAdmin: false });
const short = (uid = 7) => `header.${Buffer.from(JSON.stringify({ uid, browserAccess: true })).toString('base64url')}.signature`;
const long = 'durable-token-must-never-be-in-response';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function request(path: string, method = 'POST', body?: unknown, extra: Record<string, string> = {}) {
  return new Request(`https://example.com/api/web-session${path}`, {
    method, headers: { Origin: 'https://example.com', 'X-Web-Session': generation, 'Content-Type': 'application/json',
      Cookie: `__Host-cuberoot-web-session=${encodeURIComponent(JSON.stringify({ token: long, generation }))}`, ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  fetcher = vi.fn<typeof fetch>().mockImplementation(async input => {
    if (String(input).endsWith('/browser-access')) return json({ token: short(), user: user(), sessionExpiresAt: Date.now() + 86400_000 });
    if (String(input).endsWith('/me')) return json({ user: user() });
    return json({ ok: true, token: long, user: user() });
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('same-origin account bridge', () => {
  it('bridges onboarding reads and idempotent writes without widening PUT access', async () => {
    fetcher.mockImplementation(async () => json({ seen: true }));
    for (const [method, handler] of [['GET', GET], ['PUT', PUT]] as const) {
      const response = await handler(request('/account/onboarding', method), context('onboarding'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ seen: true });
      expect(fetcher.mock.lastCall?.[1]?.headers).toMatchObject({ Authorization: 'Bearer ' + long });
    }
    fetcher.mockClear();
    expect((await PUT(request('/account/profile', 'PUT'), context('profile'))).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses the cookie credential and only returns short credentials after profile changes', async () => {
    const response = await POST(request('/account/profile', 'POST', { name: 'Updated' }), context('profile'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ token: short(), generation, user: { uid: 7 } });
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${long}` });
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain(encodeURIComponent(long));
    expect(cookies.every(value => value.includes('HttpOnly') && value.includes('Secure'))).toBe(true);
  });
  it.each<Record<string, string>>([
    { Origin: 'https://evil.example' }, { 'X-Web-Session': nextGeneration }, { Cookie: '' },
  ])('rejects foreign origin, generation or missing cookie before upstream access: %j', async headers => {
    const response = await GET(request('/account/profile', 'GET', undefined, headers), context('profile'));
    expect([401, 403]).toContain(response.status);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('only forwards known account paths and never honors a supplied bearer or arbitrary path', async () => {
    const response = await POST(request('/account/browser-access', 'POST', {}, { Authorization: 'Bearer attacker' }), context('browser-access'));
    expect(response.status).toBe(404); expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps preview credentials temporary and restores the primary page credential on exit', async () => {
    vi.useFakeTimers(); vi.setSystemTime(Date.now());
    fetcher.mockImplementation(async input => {
      if (String(input).endsWith('/browser-access')) return json({ token: short(), user: user(), sessionExpiresAt: Date.now() + 86400_000 });
      return String(input).endsWith('/role-preview')
        ? json({ id: generation, role: 'user', token: 'temporary-preview-token', user: user(8) }) : json({ ok: true });
    });
    const started = await POST(request('/account/role-preview', 'POST', { role: 'user' }), context('role-preview'));
    expect((await started.json()).token).toBe('temporary-preview-token');
    expect(started.headers.getSetCookie()).toEqual([expect.stringContaining('cuberoot_page_session=temporary-preview-token;')]);
    expect(started.headers.getSetCookie()[0]).toContain('Max-Age=1800');
    const ended = await DELETE(request(`/account/role-preview/${generation}`, 'DELETE'), context(`role-preview/${generation}`));
    expect(ended.headers.getSetCookie()).toEqual([expect.stringContaining(`cuberoot_page_session=${long};`)]);
  });
  it('does not put an invalid browser-access response into cookies', async () => {
    fetcher.mockResolvedValue(json({ token: short(), user: user(), sessionExpiresAt: null }));
    const response = await establish(request('', 'POST', { token: long, generation }));
    expect(response.status).toBe(503); expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe('durable-cookie rotation', () => {
  it.each([7, 9])('rotates only the existing durable identity, including an already-merged identity %i', async uid => {
    fetcher.mockImplementation(async input => String(input).endsWith('/browser-access')
      ? json({ token: short(uid), user: user(uid), sessionExpiresAt: Date.now()+86400_000 }) : json({ user: user(uid) }));
    const response = await PATCH(request('', 'PATCH', { token: short(uid), generation: nextGeneration }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ token: short(uid), generation: nextGeneration, user: { uid } });
    expect(response.headers.getSetCookie()[0]).toContain(encodeURIComponent(long));
    expect(response.headers.getSetCookie()[0]).not.toContain(encodeURIComponent(short(uid)));
  });
  it('rejects an older identity response after the cookie has switched users', async () => {
    fetcher.mockImplementation(async input => String(input).endsWith('/browser-access')
      ? json({ token: short(9), user: user(9), sessionExpiresAt: Date.now()+86400_000 }) : json({ user: user(7) }));
    const response = await PATCH(request('', 'PATCH', { token: short(7), generation: nextGeneration }));
    expect(response.status).toBe(409); expect(response.headers.getSetCookie()).toEqual([]);
  });
  it('cannot upgrade a short credential without an existing generation-matched cookie', async () => {
    const response = await PATCH(request('', 'PATCH', { token: short(), generation: nextGeneration }, { Cookie: '' }));
    expect(response.status).toBe(401); expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('durable sliding renewal', () => {
  it.each([
    { uid: 7, exp: Math.floor(Date.now()/1000) + 10 * 86400 },
    { wcaId: '2017YANR02', exp: Math.floor(Date.now()/1000) + 180 * 86400 },
  ])('renews an expiring or legacy session server-side before issuing access', async payload => {
    const { GET: restore } = await import('@/app/api/web-session/route');
    const legacy = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
    const response = await restore(request('', 'GET', undefined, { Cookie: `__Host-cuberoot-web-session=${encodeURIComponent(JSON.stringify({ token: legacy, generation }))}` }));
    expect(response.status).toBe(200);
    expect(String(fetcher.mock.calls[0][0])).toContain('/auth/refresh');
    expect(fetcher.mock.calls[1][1]?.headers).toEqual({ Authorization: `Bearer ${long}` });
    expect(response.headers.getSetCookie()[0]).toContain(encodeURIComponent(long));
  });
  it('does not renew authentication time inside an active password-reset grant', async () => {
    const { GET: restore } = await import('@/app/api/web-session/route');
    const now = Math.floor(Date.now()/1000);
    const fresh = `header.${Buffer.from(JSON.stringify({ uid: 7, iat: now, exp: now+900, amr: 'email_code' })).toString('base64url')}.signature`;
    const response = await restore(request('', 'GET', undefined, { Cookie: `__Host-cuberoot-web-session=${encodeURIComponent(JSON.stringify({ token: fresh, generation }))}` }));
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain('/auth/browser-access');
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
