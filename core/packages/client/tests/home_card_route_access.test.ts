import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SITE_DIRECTORY_GROUPS } from '@cuberoot/shared/site-directory';
import { proxy } from '@/proxy';
import { matchingHomeCards, PAGE_SESSION_COOKIE } from '@/lib/home-card-access';

afterEach(() => vi.unstubAllGlobals());
const user = { uid: 1, wcaId: null, name: 'Fixture', avatar: '', isAdmin: true };
function mockApi(locks: Record<string, boolean>, admin = false, status = 200) {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/home-locks')
    ? Response.json({ locks }) : Response.json({ user: { ...user, isAdmin: admin } }, { status }));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
const cards = SITE_DIRECTORY_GROUPS.flatMap((group) => [...group.entries]).filter((card) => card.internal);

describe('homepage locks protect document and RSC routes', () => {
  it.each([
    { token: '', admin: false, status: 200, expected: 307 },
    { token: 'member', admin: false, status: 200, expected: 307 },
    { token: 'expired', admin: true, status: 401, expected: 307 },
    { token: 'admin', admin: true, status: 200, expected: 200 },
  ])('keeps partnership permanently private for $token', async ({ token, admin, status, expected }) => {
    mockApi({ partnership: false }, admin, status);
    for (const prefix of ['/en', '/zh']) {
      for (const suffix of ['', '/private-child', '/talking-points']) {
        const response = await proxy(new NextRequest(`https://cuberoot.me${prefix}/partnership${suffix}?_rsc=fixture`, {
          headers: { cookie: `${PAGE_SESSION_COOKIE}=${token}`, RSC: '1' },
        }));
        expect(response.status).toBe(expected);
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      }
    }
  });
  it.each(cards)('protects $id, both languages and descendants', async (card) => {
    mockApi({ [card.id]: true });
    const target = new URL(card.href, 'https://cuberoot.me');
    for (const prefix of ['', '/en', '/zh']) {
      for (const suffix of ['', '/private-child', '/private-child.json']) {
        const url = `https://cuberoot.me${prefix}${target.pathname}${suffix}${target.search}`;
        const response = await proxy(new NextRequest(url, { headers: { RSC: '1' } }));
        expect(response.status, url).toBe(307);
        // Competition practice has a permanent role gate before configurable
        // homepage locks; anonymous users go straight to localized sign-in.
        const expectedTarget = target.pathname === '/comp-sim'
          ? `${prefix === '/zh' ? '/zh' : ''}/account`
          : '/auth/page-access';
        expect(new URL(response.headers.get('location')!).pathname).toBe(expectedTarget);
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('x-middleware-next')).toBeNull();
      }
    }
  });
  it.each([
    { token: '', admin: false, status: 200, target: '/zh/account', authCalls: 0 },
    { token: 'member', admin: false, status: 200, target: '/zh', authCalls: 1 },
    { token: 'expired', admin: true, status: 401, target: '/zh/account', authCalls: 1 },
    { token: 'denied', admin: true, status: 403, target: '/zh/account', authCalls: 1 },
  ])('enforces the early competition role gate for $token without loading locks', async ({ token, admin, status, target, authCalls }) => {
    const fetcher = mockApi({ 'comp-sim': false }, admin, status);
    const response = await proxy(new NextRequest('https://cuberoot.me/zh/comp-sim/child?event=333&_rsc=fixture', {
      headers: { cookie: `${PAGE_SESSION_COOKIE}=${token}`, RSC: '1' },
    }));
    expect(response.status).toBe(307);
    const destination = new URL(response.headers.get('location')!);
    expect(destination.pathname).toBe(target);
    expect(destination.searchParams.get('next')).toBe(target === '/zh/account' ? '/zh/comp-sim/child?event=333' : null);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('x-middleware-next')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(authCalls);
    expect(fetcher.mock.calls.some(([input]) => String(input).endsWith('/home-locks'))).toBe(false);
  });
  it.each([false, true])('only admits the server-confirmed admin=%s', async (admin) => {
    const fetcher = mockApi({ 'comp-sim': true }, admin);
    const response = await proxy(new NextRequest('https://cuberoot.me/zh/comp-sim', {
      headers: { cookie: `${PAGE_SESSION_COOKIE}=fixture-session` },
    }));
    expect(response.status).toBe(admin ? 200 : 307);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/v1/auth/me'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer fixture-session', 'X-Request-ID': expect.any(String) }), cache: 'no-store',
    }));
  });
  it('rejects forged and expired credentials', async () => {
    mockApi({ 'comp-sim': true }, true, 401);
    expect((await proxy(new NextRequest('https://cuberoot.me/zh/comp-sim', {
      headers: { cookie: `${PAGE_SESSION_COOKIE}=forged` },
    }))).status).toBe(307);
  });
  it('applies unlocking immediately, including default locks', async () => {
    mockApi({ platform: false, 'comp-sim': false }, true);
    for (const path of ['/zh/platform/events/online', '/zh/comp-sim']) {
      expect((await proxy(new NextRequest(`https://cuberoot.me${path}`, { headers: { cookie: `${PAGE_SESSION_COOKIE}=fixture-session` } }))).status).toBe(200);
    }
  });
  it('keeps locked ancestors effective even if the child card is unlocked', async () => {
    mockApi({ platform: true, 'online-competitions': false });
    expect((await proxy(new NextRequest('https://cuberoot.me/zh/platform/events/online'))).status).toBe(307);
  });
  it('matches path boundaries and query-specific cards without locking unrelated pages', () => {
    expect(matchingHomeCards(new URL('https://cuberoot.me/zh/comp-similar'))).toEqual([]);
    expect(matchingHomeCards(new URL('https://cuberoot.me/zh/docs/edit?id=other')).map((c) => c.id)).toEqual(['documents']);
  });
  it.each([null, { locks: null }, { locks: { 'comp-sim': 'false' } }])('fails closed for malformed lock state %j', async (data) => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/home-locks')
      ? Response.json(data) : Response.json({ user }));
    vi.stubGlobal('fetch', fetcher);
    expect((await proxy(new NextRequest('https://cuberoot.me/zh/comp-sim', {
      headers: { cookie: `${PAGE_SESSION_COOKIE}=admin` },
    }))).status).toBe(503);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/home-locks'), expect.any(Object));
  });
  it('fails closed on network failure while leaving homepage and sign-in available', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) return Response.json({ user });
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', fetcher);
    for (const path of ['/zh/comp-sim', '/zh/platform/events/online']) {
      expect((await proxy(new NextRequest(`https://cuberoot.me${path}`, {
        headers: { cookie: `${PAGE_SESSION_COOKIE}=admin` },
      }))).status).toBe(503);
    }
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/home-locks'), expect.any(Object));
    for (const path of ['/zh', '/zh/account', '/auth/page-access']) {
      expect((await proxy(new NextRequest(`https://cuberoot.me${path}`))).status).toBe(200);
    }
  });
});
